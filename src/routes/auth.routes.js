// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');
const { verifyToken, isShopOwner }  = require('../middlewares/auth.middleware');
const { upload } = require('../middlewares/upload.middleware');

router.post('/login', controller.login);
router.post('/register', upload.single('logo'), controller.register);
router.post('/logout', controller.logout);
router.get('/me', verifyToken, controller.me);
router.get('/slug-disponible/:slug', controller.slugDisponible);

module.exports = router;