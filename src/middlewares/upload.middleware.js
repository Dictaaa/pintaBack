// src/middlewares/upload.middleware.js
const multer = require('multer');

// memoryStorage: el archivo queda en req.file.buffer
// y de ahí va directo a Supabase — nada toca el disco del servidor
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },   // 5 MB
});

module.exports = { upload };