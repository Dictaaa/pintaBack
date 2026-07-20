// src/controllers/auth.controller.js
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const { User, Role, Shop, Plan, ShopSubscription, City } = require('../models');
const { uploadImage } = require('../services/storage.service');

const JWT_SECRET  = process.env.JWT_SECRET  || 'change_me_in_env';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// Slugs que ninguna tienda puede usar — coinciden con rutas fijas del frontend
const RESERVED_SLUGS = [
  'carrito', 'producto', 'favoritos', 'cuenta', 'tiendas',
  'iniciar-sesion', 'registro', 'dashboard', 'checkout',
  'mujer', 'hombre', 'ninos', 'admin', 'api', 'ayuda',
];

const signToken = (user, shop = null) =>
  jwt.sign(
    { id: user.id, role_id: user.role_id, shop_id: shop ? shop.id : null },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  );

// Respuesta uniforme de usuario + tienda
const buildAuthResponse = (user, shop) => ({
  user: {
    id:         user.id,
    first_name: user.first_name,
    last_name:  user.last_name,
    email:      user.email,
    role_id:    user.role_id,
  },
  shop: shop
    ? { id: shop.id, slug: shop.slug, name: shop.name, status: shop.status, verified: shop.verified }
    : null,
});

// ─────────────────────────────────────────────
// POST /auth/login
// ─────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    // Scope withPassword para incluir el hash en la query
    const user = await User.scope('withPassword').findOne({
      where: { email: email.toLowerCase().trim(), active: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Tienda del usuario (si es shop_owner)
    const shop = await Shop.findOne({
      where: { owner_id: user.id, active: true },
    });

    // Tienda suspendida/baneada por el admin → no entra al panel
    if (shop && ['suspended', 'banned'].includes(shop.status)) {
      return res.status(403).json({
        error: 'Tu tienda está suspendida. Contacta al soporte de PINTA.',
        status: shop.status,
      });
    }

    user.last_login_at = new Date();
    await user.save();

    const token = signToken(user, shop);

    res.json({ token, ...buildAuthResponse(user, shop) });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// ─────────────────────────────────────────────
// POST /auth/register
// Crea usuario + tienda + suscripción al plan
// Gratis, todo o nada (transacción)
// ─────────────────────────────────────────────
exports.register = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      first_name, middle_name, last_name, second_last_name,
      email, password, phone,
      shop_name, slug, city_id,
      whatsapp, instagram, facebook, tiktok,
    } = req.body;

    // ── Validaciones ──
    if (!first_name || !last_name || !email || !password || !shop_name || !slug || !city_id) {
      await t.rollback();
      return res.status(400).json({
        error: 'Nombre, apellido, email, contraseña, nombre de tienda, slug y ciudad son requeridos',
      });
    }

    if (password.length < 6) {
      await t.rollback();
      return res.status(400).json({ error: 'La contraseña debe tener mínimo 6 caracteres' });
    }

    const cleanSlug = String(slug).trim();

    if (!/^[a-zA-Z0-9]{3,60}$/.test(cleanSlug)) {
      await t.rollback();
      return res.status(400).json({ error: 'El slug solo puede tener letras y números (3 a 60 caracteres)' });
    }

    if (RESERVED_SLUGS.includes(cleanSlug.toLowerCase())) {
      await t.rollback();
      return res.status(409).json({ error: 'Esa dirección no está disponible' });
    }

    // Slug único sin importar mayúsculas: ModaLuna = modaluna
    const slugTaken = await Shop.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('slug')),
        cleanSlug.toLowerCase(),
      ),
      transaction: t,
    });
    if (slugTaken) {
      await t.rollback();
      return res.status(409).json({ error: 'Esa dirección ya está en uso' });
    }

    const emailTaken = await User.findOne({
      where: { email: email.toLowerCase().trim() },
      transaction: t,
    });
    if (emailTaken) {
      await t.rollback();
      return res.status(409).json({ error: 'Ese correo ya está registrado' });
    }

    // ── Rol shop_owner ──
    const role = await Role.findOne({ where: { name: 'shop_owner' }, transaction: t });
    if (!role) {
      await t.rollback();
      return res.status(500).json({ error: 'Rol shop_owner no configurado' });
    }

    // ── 1. Usuario (password hasheado por el hook beforeCreate) ──
    const user = await User.create(
      {
        role_id: role.id,
        first_name,
        middle_name: middle_name || null,
        last_name,
        second_last_name: second_last_name || null,
        email: email.toLowerCase().trim(),
        password,
        phone: phone || null,
      },
      { transaction: t },
    );

    // ── 2. Logo → Supabase Storage (antes de crear la tienda) ──
    let logoUrl = null;
    if (req.file) {
      logoUrl = await uploadImage(req.file, `shops/${cleanSlug}`);
    }

    // ── 3. Tienda (nace en pending — el admin la aprueba) ──
    const shop = await Shop.create(
      {
        owner_id: user.id,
        city_id,
        slug: cleanSlug,
        name: shop_name.trim(),
        logo_url: logoUrl,
        whatsapp: whatsapp || null,
        instagram: instagram || null,
        facebook: facebook || null,
        tiktok: tiktok || null,
        status: 'pending',
      },
      { transaction: t },
    );

    // ── 3. Suscripción al plan Gratis ──
    const freePlan = await Plan.findOne({
      where: { monthly_price: 0, active: true },
      transaction: t,
    });
    if (!freePlan) {
      await t.rollback();
      return res.status(500).json({ error: 'Plan gratuito no configurado' });
    }

    await ShopSubscription.create(
      {
        shop_id: shop.id,
        plan_id: freePlan.id,
        starts_at: new Date(),
        status: 'active',
        price_paid: 0,
      },
      { transaction: t },
    );

    await t.commit();

    const token = signToken(user, shop);

    res.status(201).json({ token, ...buildAuthResponse(user, shop) });
  } catch (error) {
    await t.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'El slug o email ya existe' });
    }
    console.error('Error in register:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// ─────────────────────────────────────────────
// GET /auth/slug-disponible/:slug
// Para el "✓ Disponible" en vivo del formulario
// ─────────────────────────────────────────────
exports.slugDisponible = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();

    if (!/^[a-zA-Z0-9]{3,60}$/.test(slug)) {
      return res.json({ available: false, reason: 'invalid' });
    }
    if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
      return res.json({ available: false, reason: 'reserved' });
    }

    const taken = await Shop.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('slug')),
        slug.toLowerCase(),
      ),
    });

    res.json({ available: !taken, reason: taken ? 'taken' : null });
  } catch (error) {
    console.error('Error in slugDisponible:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// ─────────────────────────────────────────────
// POST /auth/logout
// ─────────────────────────────────────────────
exports.logout = (req, res) => {
  // JWT es stateless — solo confirmamos en el servidor
  res.json({ message: 'Sesión cerrada correctamente' });
};

// ─────────────────────────────────────────────
// GET /auth/me  (requiere middleware que setee req.user_id)
// ─────────────────────────────────────────────
exports.me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user_id);
    if (!user || !user.active) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const shop = await Shop.findOne({
      where: { owner_id: user.id, active: true },
      include: [{ model: City, attributes: ['id', 'name'] }],
    });

    res.json(buildAuthResponse(user, shop));
  } catch (error) {
    console.error('Error in /me:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

exports.getCities = async (req, res) => {
  try {
    const cities = await City.findAll({
      where: { active: true },
      attributes: ['id', 'name', 'department'],
      order: [['name', 'ASC']],
    });
    res.json(cities);
  } catch (error) {
    console.error('Error in getCities:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};