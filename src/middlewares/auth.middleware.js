// src/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';

exports.verifyToken = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user_id = payload.id;
    req.role_id = payload.role_id;
    req.shop_id = payload.shop_id;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// Solo dueños de tienda (el token debe traer shop_id)
exports.isShopOwner = (req, res, next) => {
  if (!req.shop_id) {
    return res.status(403).json({ error: 'Necesitas una tienda para esta acción' });
  }
  next();
};