// src/routes/subscription.routes.js
const router = require('express').Router();
const subs = require('../controllers/subscription.controller');
const { verifyToken, isShopOwner } = require('../middlewares/auth.middleware');

router.get('/plans', verifyToken, subs.listPlans);
router.get('/mine', verifyToken, isShopOwner, subs.getMine);
router.post('/change', verifyToken, isShopOwner, subs.changePlan);

module.exports = router;