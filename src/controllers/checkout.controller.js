// src/controllers/checkout.controller.js
const { sequelize } = require('../config/db');
const {
  User, Role, Address, City,
  Order, ShopOrder, OrderItem,
  Product, ProductVariant, Shop, Plan, ShopSubscription,
  Size, Color,
} = require('../models');

const SHIPPING_PER_SHOP = 12000;   // TODO: tarifa real por ciudad cuando exista

// ─────────────────────────────────────────────
// POST /checkout  (PÚBLICO — el cliente no necesita cuenta)
// body: {
//   buyer: { first_name, last_name, email, phone },
//   shipping: { city_id, address_line, address_detail, receiver_name, receiver_phone },
//   items: [{ product_id, variant_id, quantity }]
// }
// ─────────────────────────────────────────────
exports.checkout = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { buyer, shipping, items } = req.body;

    if (!buyer?.first_name || !buyer?.last_name || !buyer?.email || !buyer?.phone) {
      await t.rollback();
      return res.status(400).json({ error: 'Tus datos de contacto son requeridos' });
    }
    if (!shipping?.city_id || !shipping?.address_line || !shipping?.receiver_name || !shipping?.receiver_phone) {
      await t.rollback();
      return res.status(400).json({ error: 'Los datos de envío son requeridos' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      await t.rollback();
      return res.status(400).json({ error: 'El carrito está vacío' });
    }

    /* ── 1. Recalcular cada item contra la BD (nunca confiar en el precio del cliente) ── */
    const resolved = [];
    for (const item of items) {
      const product = await Product.findOne({
        where: { id: item.product_id, active: true },
        include: [{ model: Shop, as: 'shop' }],
        transaction: t,
      });
      if (!product) {
        await t.rollback();
        return res.status(409).json({ error: 'Uno de los productos ya no está disponible' });
      }

      let variant = null;
let sizeName = null;
let colorName = null;

if (item.variant_id) {
  variant = await ProductVariant.findOne({
    where: { id: item.variant_id, product_id: product.id, active: true },
    transaction: t,
    lock: t.LOCK.UPDATE,   // ahora sin includes: el lock puede aplicarse limpio
  });

  if (!variant || variant.stock < item.quantity) {
    await t.rollback();
    return res.status(409).json({
      error: `"${product.name}" no tiene stock suficiente en la talla elegida`,
    });
  }

  // Nombres para el snapshot — consulta aparte, sin lock (no la necesita)
  const { Size, Color } = require('../models');
  if (variant.size_id) {
    const size = await Size.findByPk(variant.size_id, { transaction: t });
    sizeName = size ? size.name : null;
  }
  if (variant.color_id) {
    const color = await Color.findByPk(variant.color_id, { transaction: t });
    colorName = color ? color.name : null;
  }
}

resolved.push({
  product,
  variant,
  sizeName,
  colorName,
  quantity: Number(item.quantity),
  unit_price: Number(product.price),
});
    }

    /* ── 2. Usuario invitado: reutiliza por email si ya existe ── */
    let user = await User.findOne({ where: { email: buyer.email.toLowerCase().trim() }, transaction: t });
    if (!user) {
      const customerRole = await Role.findOne({ where: { name: 'customer' }, transaction: t });
      user = await User.create(
        {
          role_id: customerRole ? customerRole.id : null,
          first_name: buyer.first_name.trim(),
          last_name: buyer.last_name.trim(),
          email: buyer.email.toLowerCase().trim(),
          phone: buyer.phone,
          // password queda null — es invitado, no puede iniciar sesión
        },
        { transaction: t },
      );
    }

    /* ── 3. Dirección de envío ── */
    const address = await Address.create(
      {
        user_id: user.id,
        city_id: shipping.city_id,
        address_line: shipping.address_line.trim(),
        address_detail: shipping.address_detail?.trim() || null,
        receiver_name: shipping.receiver_name.trim(),
        receiver_phone: shipping.receiver_phone,
      },
      { transaction: t },
    );

    /* ── 4. Agrupar por tienda ── */
    const porTienda = new Map();
    for (const r of resolved) {
      const shopId = r.product.shop_id;
      if (!porTienda.has(shopId)) porTienda.set(shopId, { shop: r.product.shop, items: [] });
      porTienda.get(shopId).items.push(r);
    }

    const shippingTotal = SHIPPING_PER_SHOP * porTienda.size;
    const subtotal = resolved.reduce((acc, r) => acc + r.unit_price * r.quantity, 0);
    const total = subtotal + shippingTotal;

    /* ── 5. Orden maestra ── */
    const order = await Order.create(
      {
        buyer_id: user.id,
        address_id: address.id,
        order_number: 'TEMP',
        subtotal,
        shipping_total: shippingTotal,
        total,
        status: 'pending_payment',
      },
      { transaction: t },
    );
    order.order_number = 'PIN-' + String(order.id).padStart(6, '0');
    await order.save({ transaction: t });

    /* ── 6. Sub-orden por tienda + items + descuento de stock ── */
    const shopsInfo = [];

    for (const [shopId, grupo] of porTienda) {
      const shopSubtotal = grupo.items.reduce((acc, r) => acc + r.unit_price * r.quantity, 0);

      const subscription = await ShopSubscription.findOne({
        where: { shop_id: shopId, status: 'active', active: true },
        include: [{ model: Plan, as: 'plan' }],
        transaction: t,
      });
      const commissionPct = subscription ? Number(subscription.plan.commission_percentage) : 0;
      const commissionAmount = Math.round(shopSubtotal * (commissionPct / 100));

      const shopOrder = await ShopOrder.create(
        {
          order_id: order.id,
          shop_id: shopId,
          subtotal: shopSubtotal,
          shipping_cost: SHIPPING_PER_SHOP,
          commission_amount: commissionAmount,
          status: 'pending',
        },
        { transaction: t },
      );

      for (const r of grupo.items) {
        await OrderItem.create(
          {
            shop_order_id: shopOrder.id,
            product_id: r.product.id,
            variant_id: r.variant ? r.variant.id : null,
            product_name: r.product.name,
            size_name: r.sizeName,
            color_name: r.colorName,
            unit_price: r.unit_price,
            quantity: r.quantity,
          },
          { transaction: t },
        );

        // Reserva de stock: se descuenta ya para no sobrevender
        // mientras se espera el comprobante de pago manual.
        // Si la tienda rechaza el pedido, se restaura (ver order.controller.reject).
        if (r.variant) {
          r.variant.stock -= r.quantity;
          await r.variant.save({ transaction: t });
        }
      }

      shopsInfo.push({
        shop_id: shopId,
        name: grupo.shop.name,
        whatsapp: grupo.shop.whatsapp,
        subtotal: shopSubtotal,
      });
    }

    await t.commit();

    res.status(201).json({
      order_number: order.order_number,
      total,
      subtotal,
      shipping_total: shippingTotal,
      shops: shopsInfo,   // el front usa esto para mostrar "envía tu comprobante a este WhatsApp"
    });
  } catch (error) {
    await t.rollback();
    console.error('Error in checkout:', error);
    res.status(500).json({ error: 'No pudimos procesar tu pedido. Intenta de nuevo.' });
  }
};