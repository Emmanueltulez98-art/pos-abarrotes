// Capa de datos de entradas de mercancía (Supabase).
import { supabase } from '../lib/supabase.js'
import { tiendaId } from './sesion.js'

function aEntrada(r) {
  return {
    id: r.id,
    folio: r.folio,
    fecha: r.fecha,
    proveedor: r.proveedor || '',
    notas: r.notas || '',
    total: Number(r.total),
    partidas: (r.entrada_partidas || []).map((p) => ({
      productoId: p.producto_id,
      nombre: p.nombre,
      unidad: p.unidad,
      cantidad: Number(p.cantidad),
      costo: p.costo === null ? null : Number(p.costo),
      importe: p.importe === null ? null : Number(p.importe),
    })),
  }
}

// Últimas entradas de la tienda (las más nuevas primero)
export async function obtenerEntradas({ limite = 30 } = {}) {
  const { data, error } = await supabase
    .from('entradas')
    .select('*, entrada_partidas(*)')
    .eq('tienda_id', tiendaId())
    .order('fecha', { ascending: false })
    .limit(limite)
  if (error) throw new Error(error.message)
  return data.map(aEntrada)
}

// Registra la entrada y suma existencias en una sola operación (función en Supabase)
export async function registrarEntrada({ proveedor, notas, partidas }) {
  const { data, error } = await supabase.rpc('registrar_entrada', {
    p_tienda: tiendaId(),
    p_proveedor: proveedor,
    p_notas: notas,
    p_partidas: partidas,
  })
  if (error) throw new Error(error.message)
  return aEntrada({ ...data, entrada_partidas: [] })
}
