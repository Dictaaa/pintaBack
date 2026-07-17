// src/controllers/product.controller.js
const { sequelize } = require('../config/db');
const {
    Product, ProductImage, ProductVariant,
    Shop, Plan, ShopSubscription,
    Category, Brand, Size, Color,
} = require('../models');
const { uploadImage, deleteImage } = require('../services/storage.service');

// ─────────────────────────────────────────────
// Helper: plan vigente de la tienda
// ─────────────────────────────────────────────
const getActivePlan = async (shopId, transaction = null) => {
    const sub = await ShopSubscription.findOne({
        where: { shop_id: shopId, status: 'active', active: true },
        include: [{ model: Plan, as: 'plan' }],
        order: [['created_at', 'DESC']],
        transaction,
    });
    return sub ? sub.plan : null;
};

// ─────────────────────────────────────────────
// GET /catalogs — categorías, marcas, tallas, colores
// (para poblar los selects del formulario)
// ─────────────────────────────────────────────
exports.getCatalogs = async (req, res) => {
    try {
        const [categories, brands, sizes, colors] = await Promise.all([
            Category.findAll({ where: { active: true }, order: [['position', 'ASC']] }),
            Brand.findAll({ where: { active: true }, order: [['name', 'ASC']] }),
            Size.findAll({ where: { active: true }, order: [['position', 'ASC']] }),
            Color.findAll({ where: { active: true }, order: [['name', 'ASC']] }),
        ]);
        res.json({ categories, brands, sizes, colors });
    } catch (error) {
        console.error('Error in getCatalogs:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// ─────────────────────────────────────────────
// GET /products/mine — productos de mi tienda
// + uso del plan para la barra del dashboard
// ─────────────────────────────────────────────
exports.listMine = async (req, res) => {
    try {
        const products = await Product.findAll({
            where: { shop_id: req.shop_id },
            include: [
                { model: ProductImage, as: 'images', where: { active: true }, required: false },
                { model: ProductVariant, as: 'variants', where: { active: true }, required: false },
                { model: Category, as: 'category', attributes: ['id', 'name'] },
            ],
            order: [['created_at', 'DESC']],
        });

        const plan = await getActivePlan(req.shop_id);
        const activeCount = products.filter(p => p.active).length;

        res.json({
            products,
            plan_usage: {
                plan_name: plan ? plan.name : null,
                products_used: activeCount,
                product_limit: plan ? plan.product_limit : 0,
                images_per_product: plan ? plan.images_per_product : 0,
            },
        });
    } catch (error) {
        console.error('Error in listMine:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// ─────────────────────────────────────────────
// POST /products — crear producto
// form-data: campos + variants (JSON string) + images (files)
// Valida: product_limit e images_per_product del plan
// ─────────────────────────────────────────────
exports.create = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const {
            name, description, price, previous_price,
            category_id, brand_id, gender, condition,
        } = req.body;

        if (!name || !price || !category_id || !gender) {
            await t.rollback();
            return res.status(400).json({ error: 'Nombre, precio, categoría y género son requeridos' });
        }

        // variants llega como JSON string en el form-data
        let variants = [];
        try {
            variants = req.body.variants ? JSON.parse(req.body.variants) : [];
        } catch {
            await t.rollback();
            return res.status(400).json({ error: 'Formato de variantes inválido' });
        }

        // ── Límites del plan ──
        const plan = await getActivePlan(req.shop_id, t);
        if (!plan) {
            await t.rollback();
            return res.status(402).json({ error: 'Tu tienda no tiene un plan activo' });
        }

        const activeCount = await Product.count({
            where: { shop_id: req.shop_id, active: true },
            transaction: t,
        });
        if (activeCount >= plan.product_limit) {
            await t.rollback();
            return res.status(403).json({
                error: `Tu plan ${plan.name} permite máximo ${plan.product_limit} productos activos. Mejora tu plan para publicar más.`,
                code: 'PRODUCT_LIMIT',
            });
        }

        const files = req.files || [];
        if (files.length === 0) {
            await t.rollback();
            return res.status(400).json({ error: 'Sube al menos una foto del producto' });
        }
        if (files.length > plan.images_per_product) {
            await t.rollback();
            return res.status(403).json({
                error: `Tu plan ${plan.name} permite máximo ${plan.images_per_product} fotos por producto.`,
                code: 'IMAGE_LIMIT',
            });
        }

        // ── Producto ──
        const product = await Product.create(
            {
                shop_id: req.shop_id,
                category_id,
                brand_id: brand_id || null,
                name: name.trim(),
                description: description || null,
                price,
                previous_price: previous_price || null,
                gender,
                condition: condition || 'new',
            },
            { transaction: t },
        );

        // ── Variantes (talla + stock) ──
        if (variants.length > 0) {
            const rows = variants
                .filter(v => Number(v.stock) >= 0)
                .map(v => ({
                    product_id: product.id,
                    size_id: v.size_id || null,
                    color_id: v.color_id || null,
                    stock: Number(v.stock) || 0,
                }));
            await ProductVariant.bulkCreate(rows, { transaction: t });
        }

        // ── Fotos → Supabase (antes del commit: si falla, rollback) ──
        const imageRows = [];
        for (let i = 0; i < files.length; i++) {
            const url = await uploadImage(files[i], `products/${product.id}`);
            imageRows.push({ product_id: product.id, url, position: i });
        }
        await ProductImage.bulkCreate(imageRows, { transaction: t });

        await t.commit();

        const created = await Product.findByPk(product.id, {
            include: [
                { model: ProductImage, as: 'images' },
                { model: ProductVariant, as: 'variants' },
            ],
        });
        res.status(201).json(created);
    } catch (error) {
        await t.rollback();
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Error in create product:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// ─────────────────────────────────────────────
// PUT /products/:id — editar (solo dueño)
// Campos + variantes; las fotos van por endpoints aparte
// ─────────────────────────────────────────────
exports.update = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const product = await Product.findOne({
            where: { id: req.params.id, shop_id: req.shop_id },
            transaction: t,
        });
        if (!product) {
            await t.rollback();
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const {
            name, description, price, previous_price,
            category_id, brand_id, gender, condition, variants,
        } = req.body;

        await product.update(
            {
                name: name ?? product.name,
                description: description ?? product.description,
                price: price ?? product.price,
                previous_price: previous_price === '' ? null : (previous_price ?? product.previous_price),
                category_id: category_id ?? product.category_id,
                brand_id: brand_id === '' ? null : (brand_id ?? product.brand_id),
                gender: gender ?? product.gender,
                condition: condition ?? product.condition,
            },
            { transaction: t },
        );

        // Reemplazo simple de variantes: desactivar y recrear
        if (variants) {
            const parsed = typeof variants === 'string' ? JSON.parse(variants) : variants;
            await ProductVariant.update(
                { active: false },
                { where: { product_id: product.id }, transaction: t },
            );
            const rows = parsed
                .filter(v => Number(v.stock) >= 0)
                .map(v => ({
                    product_id: product.id,
                    size_id: v.size_id || null,
                    color_id: v.color_id || null,
                    stock: Number(v.stock) || 0,
                }));
            if (rows.length) await ProductVariant.bulkCreate(rows, { transaction: t });
        }

        await t.commit();

        const updated = await Product.findByPk(product.id, {
            include: [
                { model: ProductImage, as: 'images', where: { active: true }, required: false },
                { model: ProductVariant, as: 'variants', where: { active: true }, required: false },
            ],
        });
        res.json(updated);
    } catch (error) {
        await t.rollback();
        console.error('Error in update product:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// ─────────────────────────────────────────────
// PATCH /products/:id/active — activar/pausar
// Al reactivar se valida de nuevo el límite del plan
// ─────────────────────────────────────────────
exports.toggleActive = async (req, res) => {
    try {
        const product = await Product.findOne({
            where: { id: req.params.id, shop_id: req.shop_id },
        });
        if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

        if (!product.active) {
            const plan = await getActivePlan(req.shop_id);
            const activeCount = await Product.count({
                where: { shop_id: req.shop_id, active: true },
            });
            if (plan && activeCount >= plan.product_limit) {
                return res.status(403).json({
                    error: `Tu plan ${plan.name} permite máximo ${plan.product_limit} productos activos.`,
                    code: 'PRODUCT_LIMIT',
                });
            }
        }

        product.active = !product.active;
        await product.save();
        res.json({ id: product.id, active: product.active });
    } catch (error) {
        console.error('Error in toggleActive:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// ─────────────────────────────────────────────
// POST /products/:id/images — agregar fotos
// ─────────────────────────────────────────────
exports.addImages = async (req, res) => {
    try {
        const product = await Product.findOne({
            where: { id: req.params.id, shop_id: req.shop_id },
            include: [{ model: ProductImage, as: 'images', where: { active: true }, required: false }],
        });
        if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

        const plan = await getActivePlan(req.shop_id);
        const current = product.images ? product.images.length : 0;
        const files = req.files || [];

        if (files.length === 0) {
            return res.status(400).json({ error: 'No enviaste ninguna imagen' });
        }
        if (plan && current + files.length > plan.images_per_product) {
            return res.status(403).json({
                error: `Tu plan ${plan.name} permite máximo ${plan.images_per_product} fotos por producto (tienes ${current}).`,
                code: 'IMAGE_LIMIT',
            });
        }

        const rows = [];
        for (let i = 0; i < files.length; i++) {
            const url = await uploadImage(files[i], `products/${product.id}`);
            rows.push({ product_id: product.id, url, position: current + i });
        }
        const images = await ProductImage.bulkCreate(rows);
        res.status(201).json(images);
    } catch (error) {
        if (error.status) return res.status(error.status).json({ error: error.message });
        console.error('Error in addImages:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// ─────────────────────────────────────────────
// DELETE /products/:id/images/:imageId
// ─────────────────────────────────────────────
exports.removeImage = async (req, res) => {
    try {
        const image = await ProductImage.findOne({
            where: { id: req.params.imageId, product_id: req.params.id },
            include: [{ model: Product, as: 'product', where: { shop_id: req.shop_id } }],
        });
        if (!image) return res.status(404).json({ error: 'Imagen no encontrada' });

        await deleteImage(image.url);       // borra del bucket
        await image.destroy();              // borra el registro
        res.json({ message: 'Imagen eliminada' });
    } catch (error) {
        console.error('Error in removeImage:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

// ─────────────────────────────────────────────
// DELETE /products/:id — baja lógica
// ─────────────────────────────────────────────
exports.remove = async (req, res) => {
    try {
        const product = await Product.findOne({
            where: { id: req.params.id, shop_id: req.shop_id },
        });
        if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

        product.active = false;
        await product.save();
        res.json({ message: 'Producto eliminado' });
    } catch (error) {
        console.error('Error in remove product:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};