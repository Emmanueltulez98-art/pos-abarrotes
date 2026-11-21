// Capa de datos de productos.
// Por ahora guarda todo en el navegador (localStorage).
// Más adelante cambiaremos SOLO este archivo para usar Supabase;
// las pantallas no tendrán que cambiar.

const CLAVE = 'pos-abarrotes:productos'

function leer() {
  try {
    const texto = localStorage.getItem(CLAVE)
    return texto ? JSON.parse(texto) : []
  } catch {
    return []
  }
}

function escribir(lista) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista))
  } catch (error) {
    console.error('No se pudieron guardar los productos', error)
  }
}

// Devuelve la lista completa de productos
export async function obtenerProductos() {
  return leer()
}

// Crea un producto nuevo (si no tiene id) o actualiza uno existente
export async function guardarProducto(producto) {
  const lista = leer()
  if (producto.id) {
    const i = lista.findIndex((p) => p.id === producto.id)
    if (i >= 0) lista[i] = { ...producto, actualizado: new Date().toISOString() }
  } else {
    lista.push({
      ...producto,
      id: crypto.randomUUID(),
      creado: new Date().toISOString(),
    })
  }
  escribir(lista)
  return lista
}

// Suma o resta existencias. cambios = [{ id, cantidad }] (cantidad negativa = salida)
export async function ajustarExistencias(cambios) {
  const lista = leer()
  for (const c of cambios) {
    const p = lista.find((x) => x.id === c.id)
    if (p) p.existencia = Math.round((Number(p.existencia) + c.cantidad) * 1000) / 1000
  }
  escribir(lista)
  return lista
}

// Elimina un producto por su id
export async function eliminarProducto(id) {
  const lista = leer().filter((p) => p.id !== id)
  escribir(lista)
  return lista
}
