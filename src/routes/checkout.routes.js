// src/routes/checkout.routes.js
const router = require('express').Router();
const checkout = require('../controllers/checkout.controller');
 
router.post('/', checkout.checkout);   // público — sin verifyToken
 
module.exports = router;