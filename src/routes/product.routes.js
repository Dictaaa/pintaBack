// src/routes/product.routes.js
const router = require('express').Router();
const products = require('../controllers/product.controller');
const { verifyToken, isShopOwner } = require('../middlewares/auth.middleware');
const { upload } = require('../middlewares/upload.middleware');

// Catálogos para el formulario (requiere sesión, no tienda)
router.get('/catalogs', verifyToken, products.getCatalogs);

// CRUD del tiendero
router.get('/mine', verifyToken, isShopOwner, products.listMine);
router.post('/', verifyToken, isShopOwner, upload.array('images', 10), products.create);
router.put('/:id', verifyToken, isShopOwner, products.update);
router.patch('/:id/active', verifyToken, isShopOwner, products.toggleActive);
router.delete('/:id', verifyToken, isShopOwner, products.remove);

// Fotos
router.post('/:id/images', verifyToken, isShopOwner, upload.array('images', 10), products.addImages);
router.delete('/:id/images/:imageId', verifyToken, isShopOwner, products.removeImage);

module.exports = router;

// En app.js:  app.use('/products', require('./routes/product.routes'));