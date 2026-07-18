// src/routes/shop.routes.js
const router = require('express').Router();
const shops = require('../controllers/shop.controller');

// Públicas — sin verifyToken: los clientes navegan sin cuenta
router.get('/:slug/catalog', shops.getCatalog);
router.get('/:slug/products/:id', shops.getProduct);

module.exports = router;

// En app.js:  app.use('/api/v1/shops', require('./routes/shop.routes'));