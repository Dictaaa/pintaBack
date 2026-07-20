// src/controllers/dashboard.controller.js
const { Product, Shop, Plan, ShopSubscription } = require('../models');

// ─────────────────────────────────────────────
// GET /dashboard/summary — todo lo que la home
// del panel necesita, en una sola llamada
// ─────────────────────────────────────────────
exports.getSummary = async (req, res) => {
  try {
    const shop = await Shop.findByPk(req.shop_id);
    if (!shop) return res.status(404).json({ error: 'Tienda no encontrada' });

    /* ── Plan vigente ── */
    const subscription = await ShopSubscription.findOne({
      where: { shop_id: req.shop_id, status: 'active', active: true },
      include: [{ model: Plan, as: 'plan' }],
      order: [['created_at', 'DESC']],
    });

    /* ── Productos ── */
    const [activeCount, totalCount] = await Promise.all([
      Product.count({ where: { shop_id: req.shop_id, active: true } }),
      Product.count({ where: { shop_id: req.shop_id } }),
    ]);

    /* ── Ventas: suma real de sold_count.
       Hoy siempre es 0 porque sold_count solo sube cuando el
       checkout marca una entrega, y ese módulo aún no existe.
       En cuanto exista, este número será real sin tocar nada aquí. ── */
    const products = await Product.findAll({
      where: { shop_id: req.shop_id },
      attributes: ['sold_count'],
    });
    const totalSold = products.reduce((acc, p) => acc + (p.sold_count || 0), 0);

    res.json({
      shop: { id: shop.id, slug: shop.slug, name: shop.name },
      plan: subscription ? {
        name: subscription.plan.name,
        product_limit: subscription.plan.product_limit,
      } : null,
      stats: {
        products_active: activeCount,
        products_total: totalCount,
        total_sold: totalSold,
      },
      // Se activa cuando exista el módulo de checkout/pedidos.
      recent_orders: [],
      orders_module_ready: false,
    });
  } catch (error) {
    console.error('Error in getSummary:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};