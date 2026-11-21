// Guarda la tienda con la que se está trabajando en este momento
let tienda = null

export function setTienda(t) {
  tienda = t
}

export function tiendaId() {
  if (!tienda) throw new Error('No hay una tienda seleccionada.')
  return tienda.id
}

export function nombreTienda() {
  return tienda?.nombre ?? ''
}
