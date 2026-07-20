// src/controllers/subscription.controller.js
const { sequelize } = require('../config/db');
const { Plan, ShopSubscription, Product } = require('../models');

// ─────────────────────────────────────────────
// GET /subscriptions/plans — los 3 planes disponibles
// (público dentro del dashboard, requiere sesión)
// ─────────────────────────────────────────────
exports.listPlans = async (req, res) => {
  try {
    const plans = await Plan.findAll({
      where: { active: true },
      order: [['position', 'ASC']],
    });
    res.json(plans);
  } catch (error) {
    console.error('Error in listPlans:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// ─────────────────────────────────────────────
// GET /subscriptions/mine — plan actual + uso + historial
// ─────────────────────────────────────────────
exports.getMine = async (req, res) => {
  try {
    const current = await ShopSubscription.findOne({
      where: { shop_id: req.shop_id, status: 'active', active: true },
      include: [{ model: Plan, as: 'plan' }],
      order: [['created_at', 'DESC']],
    });

    const history = await ShopSubscription.findAll({
      where: { shop_id: req.shop_id },
      include: [{ model: Plan, as: 'plan' }],
      order: [['created_at', 'DESC']],
    });

    const productsUsed = await Product.count({
      where: { shop_id: req.shop_id, active: true },
    });

    res.json({
      current: current ? { ...current.toJSON(), products_used: productsUsed } : null,
      history,
    });
  } catch (error) {
    console.error('Error in getMine:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// ─────────────────────────────────────────────
// POST /subscriptions/change — cambiar de plan
// Sin cobro real por ahora: cierra la suscripción
// vigente y abre una nueva, dejando registro exacto
// de cuándo ocurrió el cambio (para cuando se integre
// el pago, aquí es donde entraría el paso de cobro).
// ─────────────────────────────────────────────
exports.changePlan = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { plan_id } = req.body;

    if (!plan_id) {
      await t.rollback();
      return res.status(400).json({ error: 'plan_id es requerido' });
    }

    const newPlan = await Plan.findOne({
      where: { id: plan_id, active: true },
      transaction: t,
    });
    if (!newPlan) {
      await t.rollback();
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    const current = await ShopSubscription.findOne({
      where: { shop_id: req.shop_id, status: 'active', active: true },
      include: [{ model: Plan, as: 'plan' }],
      transaction: t,
    });

    if (current && current.plan_id === newPlan.id) {
      await t.rollback();
      return res.status(409).json({ error: 'Ya tienes ese plan activo' });
    }

    // Si es un downgrade, no dejar cambiar con productos
    // activos por encima del nuevo límite
    if (current && newPlan.product_limit < current.plan.product_limit) {
      const activeCount = await Product.count({
        where: { shop_id: req.shop_id, active: true },
        transaction: t,
      });
      if (activeCount > newPlan.product_limit) {
        await t.rollback();
        return res.status(403).json({
          error: `Tienes ${activeCount} productos activos y el plan ${newPlan.name} permite máximo ${newPlan.product_limit}. Pausa productos antes de bajar de plan.`,
          code: 'DOWNGRADE_BLOCKED',
        });
      }
    }

    const now = new Date();

    // Cierra la suscripción vigente (queda en el historial)
    if (current) {
      await current.update(
        { status: 'canceled', ends_at: now },
        { transaction: t },
      );
    }

    // Abre la nueva — el momento exacto queda en created_at/starts_at
    const created = await ShopSubscription.create(
      {
        shop_id: req.shop_id,
        plan_id: newPlan.id,
        starts_at: now,
        status: 'active',
        price_paid: 0,   // TODO: precio real cuando se integre el cobro (Wompi)
      },
      { transaction: t },
    );

    await t.commit();

    const result = await ShopSubscription.findByPk(created.id, {
      include: [{ model: Plan, as: 'plan' }],
    });
    res.status(201).json(result);
  } catch (error) {
    await t.rollback();
    console.error('Error in changePlan:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};