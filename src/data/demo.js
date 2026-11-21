// Datos de PRUEBA para desarrollar y probar la app.
// Todo lo que se carga aquí lleva demo: true y se puede borrar sin tocar los datos reales.
// Los precios son aproximados y los códigos son internos de prueba (empiezan con 2000…):
// cuando escanees el producto real, edítalo y escanea su código para reemplazarlo.
import { obtenerProductos, importarProductos, eliminarProductosDemo } from './productos.js'
import { importarVentas, eliminarVentasDemo } from './ventas.js'

// [nombre, categoría, unidad, precio, existencia, mínimo, popularidad]
const CATALOGO = [
  // Sabritas
  ['Sabritas Original 45 g', 'Botanas', 'pieza', 20, 24, 6, 9],
  ['Doritos Nacho 58 g', 'Botanas', 'pieza', 20, 20, 6, 8],
  ['Cheetos Torciditos 52 g', 'Botanas', 'pieza', 17, 18, 5, 6],
  ['Ruffles Queso 45 g', 'Botanas', 'pieza', 20, 12, 5, 5],
  ['Tostitos Salsa Verde 62 g', 'Botanas', 'pieza', 20, 4, 5, 4],
  ['Fritos Limón y Sal 57 g', 'Botanas', 'pieza', 17, 10, 4, 3],
  // Bimbo
  ['Pan Blanco Bimbo Grande', 'Pan', 'pieza', 50, 8, 3, 7],
  ['Pan Integral Bimbo', 'Pan', 'pieza', 55, 5, 2, 3],
  ['Medias Noches Bimbo 8 pz', 'Pan', 'pieza', 42, 4, 2, 2],
  ['Gansito Marinela', 'Pan', 'pieza', 16, 30, 8, 8],
  ['Mantecadas Bimbo 4 pz', 'Pan', 'pieza', 32, 6, 3, 3],
  ['Roles de Canela Bimbo', 'Pan', 'pieza', 22, 2, 3, 3],
  ['Barritas Marinela Fresa', 'Pan', 'pieza', 15, 15, 5, 4],
  // Coca-Cola
  ['Coca-Cola 600 ml', 'Bebidas', 'pieza', 20, 36, 12, 10],
  ['Coca-Cola 2 L', 'Bebidas', 'pieza', 38, 12, 4, 6],
  ['Coca-Cola 3 L', 'Bebidas', 'pieza', 50, 8, 3, 4],
  ['Sprite 600 ml', 'Bebidas', 'pieza', 18, 12, 6, 4],
  ['Fanta Naranja 600 ml', 'Bebidas', 'pieza', 18, 0, 6, 4],
  ['Agua Ciel 1 L', 'Bebidas', 'pieza', 14, 20, 6, 5],
  ['Jugo Del Valle Durazno 413 ml', 'Bebidas', 'pieza', 18, 10, 4, 3],
  // Gamesa
  ['Emperador Chocolate', 'Galletas', 'pieza', 20, 14, 5, 5],
  ['Marías Gamesa 170 g', 'Galletas', 'pieza', 18, 10, 4, 4],
  ['Chokis Chocolate', 'Galletas', 'pieza', 20, 12, 4, 5],
  ['Saladitas Gamesa', 'Galletas', 'pieza', 22, 6, 3, 3],
  ['Arcoíris Gamesa', 'Galletas', 'pieza', 22, 8, 3, 3],
  ['Crackets Gamesa', 'Galletas', 'pieza', 20, 3, 3, 2],
  // Granel (para probar ventas por kilo)
  ['Frijol Negro (granel)', 'Granel', 'kg', 38, 25, 5, 5],
  ['Azúcar Estándar (granel)', 'Granel', 'kg', 32, 30, 5, 6],
]

// Generador de números aleatorios con semilla (siempre da la misma simulación)
function crearAzar(semilla) {
  return () => {
    semilla |= 0
    semilla = (semilla + 0x6d2b79f5) | 0
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const redondear = (n) => Math.round(n * 100) / 100

export async function hayDatosDemo() {
  return (await obtenerProductos()).some((p) => p.demo)
}

export async function cargarDatosDemo() {
  if (await hayDatosDemo()) return 'Los datos de prueba ya están cargados.'

  const nuevos = CATALOGO.map(([nombre, categoria, unidad, precio, existencia, minimo, popularidad], i) => ({
    id: crypto.randomUUID(),
    codigo: unidad === 'kg' ? '' : `20000000000${String(i + 1).padStart(2, '0')}`,
    nombre,
    categoria,
    unidad,
    precio,
    existencia,
    minimo,
    popularidad,
    demo: true,
    creado: new Date().toISOString(),
  }))
  await importarProductos(nuevos)

  // Simular 30 días de ventas
  const azar = crearAzar(2026)
  const pesoTotal = nuevos.reduce((s, p) => s + p.popularidad, 0)
  const elegir = () => {
    let r = azar() * pesoTotal
    for (const p of nuevos) {
      r -= p.popularidad
      if (r <= 0) return p
    }
    return nuevos[0]
  }

  const ahora = new Date()
  const ventas = []
  for (let d = 29; d >= 0; d--) {
    const dia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - d)
    const finDeSemana = dia.getDay() === 0 || dia.getDay() === 6
    const cuantas = Math.round((10 + azar() * 14) * (finDeSemana ? 1.3 : 1))
    for (let v = 0; v < cuantas; v++) {
      // Más ventas en la mañana (7-10) y en la tarde (17-20)
      const hora = azar() < 0.5 ? 7 + Math.floor(azar() * 4) : azar() < 0.6 ? 17 + Math.floor(azar() * 4) : 11 + Math.floor(azar() * 6)
      const fecha = new Date(dia)
      fecha.setHours(hora, Math.floor(azar() * 60), Math.floor(azar() * 60))
      if (fecha > ahora) continue

      const partidas = []
      const piezas = 1 + Math.floor(azar() * azar() * 4)
      for (let k = 0; k < piezas; k++) {
        const p = elegir()
        if (partidas.some((x) => x.productoId === p.id)) continue
        let cantidad
        let importe
        if (p.unidad === 'kg') {
          if (azar() < 0.5) {
            cantidad = [0.25, 0.5, 1][Math.floor(azar() * 3)]
            importe = redondear(cantidad * p.precio)
          } else {
            importe = [10, 20, 30][Math.floor(azar() * 3)]
            cantidad = Math.round((importe / p.precio) * 1000) / 1000
          }
        } else {
          cantidad = azar() < 0.8 ? 1 : 2
          importe = redondear(cantidad * p.precio)
        }
        partidas.push({ productoId: p.id, nombre: p.nombre, unidad: p.unidad, precio: p.precio, cantidad, importe })
      }
      const total = redondear(partidas.reduce((s, x) => s + x.importe, 0))
      const pago = [20, 50, 100, 200, 500].find((b) => b >= total && azar() < 0.7) ?? total
      ventas.push({
        id: crypto.randomUUID(),
        fecha: fecha.toISOString(),
        partidas,
        total,
        metodoPago: 'efectivo',
        pago,
        cambio: redondear(pago - total),
        demo: true,
      })
    }
  }
  await importarVentas(ventas)
  return `Listo: ${nuevos.length} productos y ${ventas.length} ventas de prueba cargadas.`
}

export async function borrarDatosDemo() {
  await eliminarVentasDemo()
  await eliminarProductosDemo()
  return 'Datos de prueba eliminados.'
}
