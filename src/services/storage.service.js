// src/services/storage.service.js
const path = require('path');
const { supabase } = require('../config/supabase');

const BUCKET = process.env.SUPABASE_BUCKET || 'pinta-images';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;

/**
 * Sube un archivo de multer (memoryStorage) al bucket
 * y devuelve la URL pública.
 * @param {object} file   req.file de multer
 * @param {string} folder 'shops/ModaLuna' | 'products/123'
 */
exports.uploadImage = async (file, folder) => {
  if (!file) return null;

  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    const err = new Error('Formato no permitido. Usa JPG, PNG o WebP');
    err.status = 400;
    throw err;
  }

  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    const err = new Error(`La imagen no puede superar ${MAX_SIZE_MB} MB`);
    err.status = 400;
    throw err;
  }

  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const filePath = `${folder}/${Date.now()}${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    console.error('Supabase upload error:', error);
    const err = new Error('No se pudo subir la imagen');
    err.status = 500;
    throw err;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
};

/** Elimina una imagen a partir de su URL pública */
exports.deleteImage = async (publicUrl) => {
  if (!publicUrl) return;

  const marker = `/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;

  const filePath = publicUrl.slice(idx + marker.length);
  const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
  if (error) console.error('Supabase delete error:', error);
};