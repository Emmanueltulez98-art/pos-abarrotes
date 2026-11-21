// Capa de datos de productos (Supabase).
// Las pantallas solo usan estas funciones; no saben dónde se guardan los datos.
import { supabase } from '../lib/supabase.js'
import { tiendaId } from './sesion.js'

// Fila de la base de datos -> objeto que usa la app
function aProducto(r) {
  return {
    id: r.id,
    codigo: r.codigo || '',
    nombre: r.nombre,
    categoria: r.categoria || '',
    unidad: r.unidad,
    precio: Number(r.precio),
    existencia: Number(r.existencia),
    minimo: Number(r.minimo),
    demo: r.demo,
  }
}

// Objeto de la app -> columnas de la base de datos
function aFila(p) {
  return {
    codigo: p.codigo || null,
    nombre: p.nombre,
    categoria: p.categoria || null,
    unidad: p.unidad,
    precio: p.precio,
    existencia: p.existencia || 0,
    minimo: p.minimo || 0,
  }
}

function traducirError(e) {
  if (e.code === '23505') return new Error('Ya existe otro producto con ese código de barras.')
  return new Error(e.message)
}

export async function obtenerProductos() {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('tienda_id', tiendaId())
    .order('nombre')
    .range(0, 4999)
  if (error) throw traducirError(error)
  return data.map(aProducto)
}

// Crea un producto nuevo (si no tiene id) o actualiza uno existente
export async function guardarProducto(producto) {
  const fila = { ...aFila(producto), tienda_id: tiendaId() }
  const { error } = producto.id
    ? await supabase
        .from('productos')
        .update({ ...fila, actualizado: new Date().toISOString() })
        .eq('id', producto.id)
    : await supabase.from('productos').insert(fila)
  if (error) throw traducirError(error)
  return obtenerProductos()
}

export async function eliminarProducto(id) {
  const { error } = await supabase.from('productos').delete().eq('id', id)
  if (error) throw traducirError(error)
  return obtenerProductos()
}

// Agrega varios productos de golpe (datos de prueba)
export async function importarProductos(nuevos) {
  const t = tiendaId()
  const filas = nuevos.map((p) => ({ ...aFila(p), id: p.id, demo: !!p.demo, tienda_id: t }))
  const { error } = await supabase.from('productos').insert(filas)
  if (error) throw traducirError(error)
  return obtenerProductos()
}

// Borra solo los productos de prueba
export async function eliminarProductosDemo() {
  const { error } = await supabase.from('productos').delete().eq('tienda_id', tiendaId()).eq('demo', true)
  if (error) throw traducirError(error)
}
