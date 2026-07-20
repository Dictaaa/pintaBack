// src/routes/dashboard.routes.js
const router = require('express').Router();
const dashboard = require('../controllers/dashboard.controller');
const { verifyToken, isShopOwner } = require('../middlewares/auth.middleware');

router.get('/summary', verifyToken, isShopOwner, dashboard.getSummary);

module.exports = router;
