// src/controllers/shop.controller.js
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const {
  Shop, City, Product, ProductImage, ProductVariant, Category, Size,
} = require('../models');

const MAX_LIMIT = 60;
const DEFAULT_LIMIT = 20;

const SORT_MAP = {
  relevancia: [['featured', 'DESC'], ['created_at', 'DESC']],
  ventas: [['sold_count', 'DESC']],
  precio_asc: [['price', 'ASC']],
  precio_desc: [['price', 'DESC']],
  rating: [['rating_average', 'DESC']],
};

// ─────────────────────────────────────────────
// GET /shops/:slug/catalog  (PÚBLICO — sin token)
// Query params: page, limit, category, q, sort
// Todo el filtrado/orden/paginado se resuelve aquí,
// nunca se manda el catálogo completo al cliente.
// ─────────────────────────────────────────────
exports.getCatalog = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();

    const shop = await Shop.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('Shop.slug')),
        slug.toLowerCase(),
      ),
      include: [{ model: City, as: 'city', attributes: ['id', 'name'] }],
    });

    // TODO: cuando exista el flujo de aprobación, exigir status === 'approved'
    if (!shop || !shop.active || ['suspended', 'banned'].includes(shop.status)) {
      return res.status(404).json({ error: 'Tienda no encontrada' });
    }

    /* ── Parámetros de la query ── */
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
    const offset = (page - 1) * limit;
    const q = String(req.query.q || '').trim();
    const sort = SORT_MAP[req.query.sort] ? req.query.sort : 'relevancia';

    /* ── Resolver categoría por nombre → id (evita join solo para filtrar) ── */
    let categoryId = null;
    if (req.query.category && req.query.category !== 'Todo') {
      const cat = await Category.findOne({ where: { name: req.query.category } });
      categoryId = cat ? cat.id : -1;   // -1 = nombre inexistente, no debe traer nada
    }

    const where = { shop_id: shop.id, active: true };
    if (categoryId !== null) where.category_id = categoryId;
    if (q) where.name = { [Op.iLike]: `%${q}%` };

    /* ── Total para la paginación (sin includes: no hay duplicados que contar) ── */
    const total = await Product.count({ where });

    /* ── Página actual, con sus relaciones ── */
    const products = await Product.findAll({
      where,
      include: [
        {
          model: ProductImage, as: 'images',
          where: { active: true }, required: false,
          attributes: ['id', 'url', 'position'],
          separate: true,          // evita que el LIMIT de arriba se rompa por el join hasMany
          order: [['position', 'ASC']],
        },
        {
          model: ProductVariant, as: 'variants',
          where: { active: true }, required: false,
          attributes: ['id', 'size_id', 'stock'],
          separate: true,
        },
        { model: Category, as: 'category', attributes: ['id', 'name'] },
      ],
      order: SORT_MAP[sort],
      limit,
      offset,
    });

    /* ── Categorías disponibles en esta tienda (para los chips) —
       independiente del filtro actual, refleja toda la tienda ── */
    const [categoryRows] = await sequelize.query(
      `SELECT c.name, COUNT(p.id)::int AS count
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.shop_id = :shopId AND p.active = true
       GROUP BY c.name
       ORDER BY c.name ASC`,
      { replacements: { shopId: shop.id } },
    );

    /* ── Estadísticas del encabezado (sobre TODA la tienda, no la página) ── */
    const totalSold = await Product.sum('sold_count', { where: { shop_id: shop.id, active: true } });
    const productsCount = await Product.count({ where: { shop_id: shop.id, active: true } });

    res.json({
      shop: {
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        description: shop.description,
        logo_url: shop.logo_url,
        banner_url: shop.banner_url,
        verified: shop.verified,
        instagram: shop.instagram,
        whatsapp: shop.whatsapp,
        city: shop.city ? shop.city.name : null,
        products_count: productsCount,
        total_sold: totalSold || 0,
      },
      categories: categoryRows,   // [{ name, count }]
      products,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
        has_more: page * limit < total,
      },
    });
  } catch (error) {
    console.error('Error in getCatalog:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// ─────────────────────────────────────────────
// GET /shops/:slug/products/:id  (PÚBLICO)
// Detalle de un producto de la tienda — sin cambios,
// no necesita paginación (es un solo producto).
// ─────────────────────────────────────────────
exports.getProduct = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();

    const shop = await Shop.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('slug')),
        slug.toLowerCase(),
      ),
    });
    if (!shop || !shop.active || ['suspended', 'banned'].includes(shop.status)) {
      return res.status(404).json({ error: 'Tienda no encontrada' });
    }

    const product = await Product.findOne({
      where: { id: req.params.id, shop_id: shop.id, active: true },
      include: [
        { model: ProductImage, as: 'images', where: { active: true }, required: false },
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        {
          model: ProductVariant, as: 'variants',
          where: { active: true }, required: false,
          include: [{ model: Size, as: 'size', attributes: ['id', 'name'] }],
        },
      ],
      order: [[{ model: ProductImage, as: 'images' }, 'position', 'ASC']],
    });

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({
      shop: {
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        verified: shop.verified,
      },
      product,
    });
  } catch (error) {
    console.error('Error in getProduct:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};