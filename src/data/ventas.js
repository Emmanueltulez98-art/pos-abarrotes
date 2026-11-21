// Capa de datos de ventas (Supabase).
import { supabase } from '../lib/supabase.js'
import { tiendaId } from './sesion.js'

// Fila de la base de datos (con sus partidas) -> objeto que usa la app
function aVenta(r) {
  return {
    id: r.id,
    folio: r.folio,
    fecha: r.fecha,
    total: Number(r.total),
    metodoPago: r.metodo_pago,
    pago: Number(r.pago),
    cambio: Number(r.cambio),
    demo: r.demo,
    partidas: (r.venta_partidas || []).map((p) => ({
      productoId: p.producto_id,
      nombre: p.nombre,
      unidad: p.unidad,
      precio: Number(p.precio),
      cantidad: Number(p.cantidad),
      importe: Number(p.importe),
    })),
  }
}

// Ventas de la tienda (opcionalmente entre dos fechas), de la más nueva a la más vieja.
// Supabase entrega máximo 1000 filas por consulta, así que pedimos por páginas.
export async function obtenerVentas({ desde, hasta } = {}) {
  const todas = []
  const tam = 1000
  for (let i = 0; ; i += tam) {
    let q = supabase
      .from('ventas')
      .select('*, venta_partidas(*)')
      .eq('tienda_id', tiendaId())
      .order('fecha', { ascending: false })
      .range(i, i + tam - 1)
    if (desde) q = q.gte('fecha', desde.toISOString())
    if (hasta) q = q.lt('fecha', hasta.toISOString())
    const { data, error } = await q
    if (error) throw new Error(error.message)
    todas.push(...data.map(aVenta))
    if (data.length < tam) break
  }
  return todas
}

// Registra la venta, sus partidas y descuenta inventario en una sola operación (función en Supabase)
export async function registrarVenta({ partidas, pago }) {
  const { data, error } = await supabase.rpc('registrar_venta', {
    p_tienda: tiendaId(),
    p_partidas: partidas,
    p_pago: pago,
  })
  if (error) throw new Error(error.message)
  return aVenta({ ...data, venta_partidas: partidas.map((p) => ({ ...p, producto_id: p.productoId })) })
}

async function insertarEnLotes(tabla, filas, tam = 500) {
  for (let i = 0; i < filas.length; i += tam) {
    const { error } = await supabase.from(tabla).insert(filas.slice(i, i + tam))
    if (error) throw new Error(error.message)
  }
}

// Agrega varias ventas de golpe con folios consecutivos (datos de prueba; no descuenta inventario)
export async function importarVentas(nuevas) {
  const t = tiendaId()
  const { data: ultima, error } = await supabase
    .from('ventas')
    .select('folio')
    .eq('tienda_id', t)
    .order('folio', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)

  let folio = ultima?.[0]?.folio ?? 0
  const ordenadas = [...nuevas].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const filasVentas = ordenadas.map((v) => ({
    id: v.id,
    tienda_id: t,
    folio: ++folio,
    fecha: v.fecha,
    total: v.total,
    metodo_pago: 'efectivo',
    pago: v.pago,
    cambio: v.cambio,
    demo: !!v.demo,
  }))
  const filasPartidas = ordenadas.flatMap((v) =>
    v.partidas.map((p) => ({
      venta_id: v.id,
      producto_id: p.productoId,
      nombre: p.nombre,
      unidad: p.unidad,
      precio: p.precio,
      cantidad: p.cantidad,
      importe: p.importe,
    })),
  )
  await insertarEnLotes('ventas', filasVentas)
  await insertarEnLotes('venta_partidas', filasPartidas, 1000)
}

// Borra solo las ventas de prueba (sus partidas se borran solas)
export async function eliminarVentasDemo() {
  const { error } = await supabase.from('ventas').delete().eq('tienda_id', tiendaId()).eq('demo', true)
  if (error) throw new Error(error.message)
}
