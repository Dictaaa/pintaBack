// src/config/supabase.js
const { createClient } = require('@supabase/supabase-js');

// SERVICE_ROLE key: SOLO en el backend, nunca en Angular.
// Se salta las políticas RLS — es la llave maestra del proyecto.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

module.exports = { supabase };