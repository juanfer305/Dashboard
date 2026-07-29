// Inicializa el cliente de Supabase usando las credenciales de config.js
const { createClient } = supabase;
window.sb = createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_ANON_KEY);
