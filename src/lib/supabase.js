// Conexión con Supabase. Los datos salen del archivo .env.local
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const llave = import.meta.env.VITE_SUPABASE_ANON_KEY

// true si .env.local tiene datos válidos
export const configurado = Boolean(
  url && llave && url.startsWith('https://') && !url.includes('PEGA_AQUI') && !llave.includes('PEGA_AQUI'),
)

export const supabase = configurado ? createClient(url, llave) : null
