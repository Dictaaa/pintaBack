// src/controllers/shop.controller.js
const { sequelize } = require('../config/db');
const {
  Shop, City, Product, ProductImage, ProductVariant, Category, Size,
} = require('../models');

// ─────────────────────────────────────────────
// GET /shops/:slug/catalog  (PÚBLICO — sin token)
// Perfil de la tienda + sus productos activos
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

    // Tienda inexistente, desactivada o sancionada por el admin → 404
    // TODO: cuando exista el flujo de aprobación, exigir status === 'approved'
    if (!shop || !shop.active || ['suspended', 'banned'].includes(shop.status)) {
      return res.status(404).json({ error: 'Tienda no encontrada' });
    }

    const products = await Product.findAll({
      where: { shop_id: shop.id, active: true },
      include: [
        {
          model: ProductImage, as: 'images',
          where: { active: true }, required: false,
          attributes: ['id', 'url', 'position'],
        },
        {
          model: ProductVariant, as: 'variants',
          where: { active: true }, required: false,
          attributes: ['id', 'size_id', 'stock'],
        },
        { model: Category, as: 'category', attributes: ['id', 'name'] },
      ],
      order: [
        ['featured', 'DESC'],
        ['created_at', 'DESC'],
        [{ model: ProductImage, as: 'images' }, 'position', 'ASC'],
      ],
    });

    const totalSold = products.reduce((acc, p) => acc + (p.sold_count || 0), 0);

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
        products_count: products.length,
        total_sold: totalSold,
      },
      products,
    });
  } catch (error) {
    console.error('Error in getCatalog:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// ─────────────────────────────────────────────
// GET /shops/:slug/products/:id  (PÚBLICO)
// Detalle de un producto de la tienda
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
        { model: ProductVariant, as: 'variants', where: { active: true }, required: false },
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