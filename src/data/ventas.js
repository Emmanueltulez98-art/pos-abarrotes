// Capa de datos de ventas.
// Igual que productos: por ahora en el navegador, después en Supabase.
import { ajustarExistencias } from './productos.js'

const CLAVE = 'pos-abarrotes:ventas'

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
    console.error('No se pudieron guardar las ventas', error)
  }
}

export async function obtenerVentas() {
  return leer()
}

// Guarda la venta con un folio consecutivo y descuenta el inventario
export async function registrarVenta({ partidas, total, pago, cambio }) {
  const ventas = leer()
  const folio = ventas.reduce((max, v) => Math.max(max, v.folio), 0) + 1
  const venta = {
    id: crypto.randomUUID(),
    folio,
    fecha: new Date().toISOString(),
    partidas,
    total,
    metodoPago: 'efectivo',
    pago,
    cambio,
  }
  ventas.push(venta)
  escribir(ventas)
  await ajustarExistencias(partidas.map((p) => ({ id: p.productoId, cantidad: -p.cantidad })))
  return venta
}
