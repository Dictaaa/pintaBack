// src/routes/order.routes.js
const router = require('express').Router();
const orders = require('../controllers/order.controller');
const { verifyToken, isShopOwner } = require('../middlewares/auth.middleware');
 
router.get('/mine', verifyToken, isShopOwner, orders.listMine);
router.patch('/:id/confirm', verifyToken, isShopOwner, orders.confirm);
router.patch('/:id/reject', verifyToken, isShopOwner, orders.reject);
router.patch('/:id/ship', verifyToken, isShopOwner, orders.ship);
router.patch('/:id/deliver', verifyToken, isShopOwner, orders.deliver);
 
module.exports = router;