// src/controllers/order.controller.js
const { sequelize } = require('../config/db');
const {
  ShopOrder, OrderItem, Order, Address, City, User, Product, ProductVariant,
} = require('../models');

// ─────────────────────────────────────────────
// GET /orders/mine — pedidos de mi tienda
// ─────────────────────────────────────────────
exports.listMine = async (req, res) => {
  try {
    const orders = await ShopOrder.findAll({
      where: { shop_id: req.shop_id },
      include: [
        { model: OrderItem, as: 'items' },
        {
          model: Order, as: 'order',
          attributes: ['id', 'order_number', 'created_at'],
          include: [
            { model: User, as: 'buyer', attributes: ['first_name', 'last_name', 'phone', 'email'] },
            {
              model: Address, as: 'shipping_address',
              include: [{ model: City, as: 'city', attributes: ['name'] }],
            },
          ],
        },
      ],
      order: [['created_at', 'DESC']],
    });
    res.json(orders);
  } catch (error) {
    console.error('Error in listMine (orders):', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const findOwn = (id, shopId, t) =>
  ShopOrder.findOne({
    where: { id, shop_id: shopId },
    include: [{ model: OrderItem, as: 'items' }],
    transaction: t,
  });

// ─────────────────────────────────────────────
// PATCH /orders/:id/confirm
// El tiendero ya recibió el comprobante por fuera del sistema
// ─────────────────────────────────────────────
exports.confirm = async (req, res) => {
  try {
    const shopOrder = await findOwn(req.params.id, req.shop_id);
    if (!shopOrder) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (shopOrder.status !== 'pending') {
      return res.status(409).json({ error: 'Este pedido ya fue procesado' });
    }

    shopOrder.status = 'confirmed';
    await shopOrder.save();
    res.json({ id: shopOrder.id, status: shopOrder.status });
  } catch (error) {
    console.error('Error in confirm order:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// ─────────────────────────────────────────────
// PATCH /orders/:id/reject — restaura el stock reservado
// ─────────────────────────────────────────────
exports.reject = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const shopOrder = await findOwn(req.params.id, req.shop_id, t);
    if (!shopOrder) {
      await t.rollback();
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    if (['shipped', 'delivered', 'canceled'].includes(shopOrder.status)) {
      await t.rollback();
      return res.status(409).json({ error: 'Este pedido ya no se puede rechazar' });
    }

    for (const item of shopOrder.items) {
      if (item.variant_id) {
        await ProductVariant.increment(
          { stock: item.quantity },
          { where: { id: item.variant_id }, transaction: t },
        );
      }
    }

    shopOrder.status = 'canceled';
    await shopOrder.save({ transaction: t });
    await t.commit();

    res.json({ id: shopOrder.id, status: shopOrder.status });
  } catch (error) {
    await t.rollback();
    console.error('Error in reject order:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// ─────────────────────────────────────────────
// PATCH /orders/:id/ship  { tracking_number }
// ─────────────────────────────────────────────
exports.ship = async (req, res) => {
  try {
    const shopOrder = await findOwn(req.params.id, req.shop_id);
    if (!shopOrder) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (shopOrder.status !== 'confirmed') {
      return res.status(409).json({ error: 'Confirma el pago antes de marcar como enviado' });
    }

    shopOrder.status = 'shipped';
    shopOrder.tracking_number = req.body.tracking_number || null;
    shopOrder.shipped_at = new Date();
    await shopOrder.save();

    res.json({ id: shopOrder.id, status: shopOrder.status, tracking_number: shopOrder.tracking_number });
  } catch (error) {
    console.error('Error in ship order:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// ─────────────────────────────────────────────
// PATCH /orders/:id/deliver
// Aquí es donde sold_count por fin se vuelve real
// ─────────────────────────────────────────────
exports.deliver = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const shopOrder = await findOwn(req.params.id, req.shop_id, t);
    if (!shopOrder) {
      await t.rollback();
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    if (shopOrder.status !== 'shipped') {
      await t.rollback();
      return res.status(409).json({ error: 'Marca como enviado antes de entregar' });
    }

    for (const item of shopOrder.items) {
      await Product.increment(
        { sold_count: item.quantity },
        { where: { id: item.product_id }, transaction: t },
      );
    }

    shopOrder.status = 'delivered';
    shopOrder.delivered_at = new Date();
    await shopOrder.save({ transaction: t });
    await t.commit();

    res.json({ id: shopOrder.id, status: shopOrder.status });
  } catch (error) {
    await t.rollback();
    console.error('Error in deliver order:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};