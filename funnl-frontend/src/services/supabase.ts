import { createClient } from '@supabase/supabase-js';

// Usar valores predeterminados o valores de entorno
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ejemplo.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'clave-publica-ejemplo';

export const supabase = createClient(supabaseUrl, supabaseKey); 