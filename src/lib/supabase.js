// Conexión con Supabase.
// En tu computadora los datos salen de .env.local; en Netlify, de sus "Environment variables".
import { createClient } from '@supabase/supabase-js'

// Quita espacios y comillas que a veces se cuelan al copiar y pegar
const limpiar = (v) => (v || '').trim().replace(/^["']|["']$/g, '').trim()

const url = limpiar(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '')
const llave = limpiar(import.meta.env.VITE_SUPABASE_ANON_KEY)

// Diagnóstico de cada dato (sin mostrar la llave)
function revisarUrl() {
  if (!url) return 'falta'
  if (url.includes('PEGA_AQUI') || url.includes('xxxx')) return 'tiene el valor de ejemplo'
  if (!/^https:\/\/.+\.supabase\.co$/.test(url)) return 'no tiene el formato https://....supabase.co'
  return 'ok'
}
function revisarLlave() {
  if (!llave) return 'falta'
  if (llave.includes('PEGA_AQUI') || llave.includes('pega_aqui')) return 'tiene el valor de ejemplo'
  if (llave.length < 30) return 'parece incompleta (muy corta)'
  return 'ok'
}

export const diagnostico = {
  url: revisarUrl(),
  llave: revisarLlave(),
  // Primeros caracteres de la URL para comprobar cuál llegó (la URL no es secreta)
  inicioUrl: url ? `${url.slice(0, 24)}…` : '',
}

export const configurado = diagnostico.url === 'ok' && diagnostico.llave === 'ok'

export const supabase = configurado ? createClient(url, llave) : null
