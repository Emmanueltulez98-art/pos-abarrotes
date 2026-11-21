import { supabase } from '../lib/supabase.js'

// La primera tienda del usuario (por ahora cada usuario tiene una)
export async function obtenerMiTienda() {
  const { data, error } = await supabase
    .from('tiendas')
    .select('id, nombre')
    .order('creado')
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function crearTienda(nombre) {
  const { data, error } = await supabase.from('tiendas').insert({ nombre }).select('id, nombre').single()
  if (error) throw new Error(error.message)
  return data
}
