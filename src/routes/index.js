const { Router } = require('express');

const authRoutes         = require('./auth.routes');
const productRoutes         = require('./product.routes');
const shopRoutes         = require('./shop.routes');
const subscriptionRoutes = require('./subscription.routes');
const dashboardRoutes    = require('./dashboard.routes');
const orderRoutes        = require('./order.routes');
const checkoutRoutes     = require('./checkout.routes');

const router = Router();

router.use('/auth',            authRoutes);
router.use('/products',        productRoutes);
router.use('/shops',           shopRoutes);
router.use('/subscriptions',   subscriptionRoutes);
router.use('/dashboard',       dashboardRoutes);
router.use('/orders',          orderRoutes);
router.use('/checkout',        checkoutRoutes);


module.exports = router;