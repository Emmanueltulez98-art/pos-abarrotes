import { useEffect, useMemo, useState } from 'react'
import { obtenerProductos } from '../data/productos.js'
import { obtenerVentas } from '../data/ventas.js'
import { cargarDatosDemo, borrarDatosDemo } from '../data/demo.js'

const dinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const dineroCorto = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
const formatoKg = (n) => `${Number(n).toLocaleString('es-MX', { maximumFractionDigits: 3 })} kg`

const PERIODOS = [
  { id: 'hoy', nombre: 'Hoy' },
  { id: 'ayer', nombre: 'Ayer' },
  { id: '7', nombre: 'Últimos 7 días' },
  { id: '30', nombre: 'Últimos 30 días' },
  { id: 'mes', nombre: 'Este mes' },
]

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

// Devuelve [inicio, fin) del periodo elegido
function rango(id) {
  const a = new Date()
  const dia = (desplazamiento) => new Date(a.getFullYear(), a.getMonth(), a.getDate() + desplazamiento)
  switch (id) {
    case 'ayer': return [dia(-1), dia(0)]
    case '7': return [dia(-6), dia(1)]
    case '30': return [dia(-29), dia(1)]
    case 'mes': return [new Date(a.getFullYear(), a.getMonth(), 1), dia(1)]
    default: return [dia(0), dia(1)]
  }
}

export default function Reportes() {
  const [productos, setProductos] = useState([])
  const [ventas, setVentas] = useState([])
  const [periodo, setPeriodo] = useState('hoy')
  const [abierta, setAbierta] = useState(null)
  const [mensaje, setMensaje] = useState('')

  const [cargando, setCargando] = useState(false)

  async function recargar() {
    const [desde, hasta] = rango(periodo)
    setCargando(true)
    try {
      setProductos(await obtenerProductos())
      setVentas(await obtenerVentas({ desde, hasta }))
    } catch (e) {
      setMensaje(`No se pudieron cargar los datos: ${e.message}`)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    recargar()
  }, [periodo]) // eslint-disable-line react-hooks/exhaustive-deps

  const [inicio, fin] = rango(periodo)
  const unDia = periodo === 'hoy' || periodo === 'ayer'

  const datos = useMemo(() => {
    const delPeriodo = ventas
      .filter((v) => {
        const f = new Date(v.fecha)
        return f >= inicio && f < fin
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha))

    const total = delPeriodo.reduce((s, v) => s + v.total, 0)
    const articulos = delPeriodo.reduce(
      (s, v) => s + v.partidas.reduce((t, p) => t + (p.unidad === 'kg' ? 1 : p.cantidad), 0),
      0,
    )

    // Serie para la gráfica: por hora (un día) o por día (varios días)
    let serie = []
    if (unDia) {
      const porHora = {}
      for (const v of delPeriodo) {
        const h = new Date(v.fecha).getHours()
        porHora[h] = (porHora[h] || 0) + v.total
      }
      for (let h = 7; h <= 21; h++) {
        serie.push({ etiqueta: `${h}h`, detalle: `${h}:00 – ${h}:59`, valor: porHora[h] || 0 })
      }
    } else {
      const porDia = {}
      for (const v of delPeriodo) {
        const f = new Date(v.fecha)
        const clave = `${f.getFullYear()}-${f.getMonth()}-${f.getDate()}`
        porDia[clave] = (porDia[clave] || 0) + v.total
      }
      for (let d = new Date(inicio); d < fin; d.setDate(d.getDate() + 1)) {
        const clave = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        serie.push({
          etiqueta: `${d.getDate()}`,
          detalle: `${DIAS[d.getDay()]} ${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`,
          valor: porDia[clave] || 0,
        })
      }
    }

    // Productos más vendidos y ventas por categoría
    const porProducto = {}
    const porCategoria = {}
    for (const v of delPeriodo) {
      for (const p of v.partidas) {
        const acum = (porProducto[p.productoId] ||= { nombre: p.nombre, unidad: p.unidad, cantidad: 0, importe: 0 })
        acum.cantidad += p.cantidad
        acum.importe += p.importe
        const cat = productos.find((x) => x.id === p.productoId)?.categoria || 'Sin categoría'
        porCategoria[cat] = (porCategoria[cat] || 0) + p.importe
      }
    }
    const top = Object.values(porProducto).sort((a, b) => b.importe - a.importe).slice(0, 10)
    const categorias = Object.entries(porCategoria)
      .map(([nombre, importe]) => ({ nombre, importe }))
      .sort((a, b) => b.importe - a.importe)

    return { delPeriodo, total, articulos, serie, top, categorias }
  }, [ventas, productos, periodo]) // eslint-disable-line react-hooks/exhaustive-deps

  const porSurtir = productos
    .filter((p) => Number(p.existencia) <= 0 || (Number(p.minimo) > 0 && Number(p.existencia) <= Number(p.minimo)))
    .sort((a, b) => Number(a.existencia) - Number(b.existencia))

  const numVentas = datos.delPeriodo.length
  const promedio = numVentas ? datos.total / numVentas : 0

  async function alCargarDemo() {
    setMensaje('Cargando datos de prueba…')
    try {
      setMensaje(await cargarDatosDemo())
    } catch (e) {
      setMensaje(`Error: ${e.message}`)
    }
    await recargar()
  }

  async function alBorrarDemo() {
    if (!window.confirm('¿Borrar todos los productos y ventas de prueba? Tus datos reales no se tocan.')) return
    try {
      setMensaje(await borrarDatosDemo())
    } catch (e) {
      setMensaje(`Error: ${e.message}`)
    }
    await recargar()
  }

  return (
    <section>
      <div className="encabezado">
        <div>
          <h1>Reportes</h1>
          <p className="sub">
            {inicio.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
            {!unDia && ` – ${new Date(fin - 1).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}`}
            {cargando && ' · Cargando…'}
          </p>
        </div>
        <div className="periodos">
          {PERIODOS.map((p) => (
            <button key={p.id} className={periodo === p.id ? 'activo' : ''} onClick={() => setPeriodo(p.id)}>
              {p.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Indicadores principales */}
      <div className="kpis">
        <div className="kpi destacado">
          <span>Ventas totales</span>
          <strong>{dinero.format(datos.total)}</strong>
          <small>Efectivo esperado en caja</small>
        </div>
        <div className="kpi">
          <span>Número de ventas</span>
          <strong>{numVentas}</strong>
        </div>
        <div className="kpi">
          <span>Ticket promedio</span>
          <strong>{dinero.format(promedio)}</strong>
        </div>
        <div className="kpi">
          <span>Artículos vendidos</span>
          <strong>{datos.articulos.toLocaleString('es-MX')}</strong>
        </div>
      </div>

      <div className="tarjeta">
        <h3>{unDia ? 'Ventas por hora' : 'Ventas por día'}</h3>
        <Barras serie={datos.serie} mostrarCada={datos.serie.length > 15 ? 5 : 1} />
      </div>

      <div className="dos-columnas">
        <div className="tarjeta">
          <h3>Productos más vendidos</h3>
          {datos.top.length === 0 ? (
            <p className="sub">Sin ventas en este periodo.</p>
          ) : (
            <BarrasHorizontales
              filas={datos.top.map((p) => ({
                nombre: p.nombre,
                valor: p.importe,
                detalle: p.unidad === 'kg' ? formatoKg(p.cantidad) : `${p.cantidad} pz`,
              }))}
            />
          )}
        </div>
        <div className="tarjeta">
          <h3>Ventas por categoría</h3>
          {datos.categorias.length === 0 ? (
            <p className="sub">Sin ventas en este periodo.</p>
          ) : (
            <BarrasHorizontales
              filas={datos.categorias.map((c) => ({
                nombre: c.nombre,
                valor: c.importe,
                detalle: `${Math.round((c.importe / datos.total) * 100)}%`,
              }))}
            />
          )}
        </div>
      </div>

      <div className="dos-columnas">
        <div className="tarjeta">
          <h3>Por surtir ({porSurtir.length})</h3>
          {porSurtir.length === 0 ? (
            <p className="sub">Todo el inventario está por encima del mínimo.</p>
          ) : (
            <table className="tabla compacta">
              <thead>
                <tr><th>Producto</th><th className="num">Existencia</th><th className="num">Mínimo</th></tr>
              </thead>
              <tbody>
                {porSurtir.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.nombre}
                      <span className={`estado ${Number(p.existencia) <= 0 ? 'agotado' : 'bajo'}`}>
                        {Number(p.existencia) <= 0 ? 'Agotado' : 'Bajo'}
                      </span>
                    </td>
                    <td className="num">{p.unidad === 'kg' ? formatoKg(p.existencia) : `${p.existencia} pz`}</td>
                    <td className="num">{p.unidad === 'kg' ? formatoKg(p.minimo) : `${p.minimo} pz`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="tarjeta">
          <h3>Ventas del periodo</h3>
          {numVentas === 0 ? (
            <p className="sub">Sin ventas en este periodo.</p>
          ) : (
            <>
              <table className="tabla compacta">
                <thead>
                  <tr><th>Folio</th><th>Fecha</th><th className="num">Total</th></tr>
                </thead>
                <tbody>
                  {datos.delPeriodo.slice(0, 30).map((v) => (
                    <FilaVenta key={v.id} venta={v} abierta={abierta === v.id} alternar={() => setAbierta(abierta === v.id ? null : v.id)} />
                  ))}
                </tbody>
              </table>
              {numVentas > 30 && <p className="sub">Mostrando las 30 más recientes de {numVentas}.</p>}
            </>
          )}
        </div>
      </div>

      <div className="tarjeta pruebas">
        <h3>Datos de prueba</h3>
        <p className="sub">
          Carga productos de Sabritas, Bimbo, Coca-Cola y Gamesa (más 2 de granel) con 30 días de ventas simuladas.
          Los precios son aproximados y los códigos de barras son de prueba. Se borran con un clic sin tocar tus datos reales.
        </p>
        <div className="botones izquierda">
          <button className="primario" onClick={alCargarDemo}>Cargar datos de prueba</button>
          <button className="peligro" onClick={alBorrarDemo}>Borrar datos de prueba</button>
        </div>
        {mensaje && <p className="ok-texto">{mensaje}</p>}
      </div>
    </section>
  )
}

// Fila de venta que se expande para ver el detalle del ticket
function FilaVenta({ venta, abierta, alternar }) {
  const f = new Date(venta.fecha)
  return (
    <>
      <tr className="clicable" onClick={alternar}>
        <td className="codigo">#{String(venta.folio).padStart(5, '0')}</td>
        <td>
          {f.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}{' '}
          {f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
        </td>
        <td className="num">{dinero.format(venta.total)}</td>
      </tr>
      {abierta && (
        <tr className="detalle">
          <td colSpan={3}>
            {venta.partidas.map((p, i) => (
              <div key={i} className="linea-ticket">
                <span>
                  {p.unidad === 'kg' ? formatoKg(p.cantidad) : `${p.cantidad} ×`} {p.nombre}
                </span>
                <span>{dinero.format(p.importe)}</span>
              </div>
            ))}
            <div className="linea-ticket sub">
              <span>Pagó {dinero.format(venta.pago)}</span>
              <span>Cambio {dinero.format(venta.cambio)}</span>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// Gráfica de barras verticales con tooltip al pasar el mouse
function Barras({ serie, mostrarCada }) {
  const [activa, setActiva] = useState(null)
  const max = Math.max(...serie.map((d) => d.valor), 1)
  return (
    <div className="grafica">
      <div className="eje-y">
        <span>{dineroCorto.format(max)}</span>
        <span>{dineroCorto.format(0)}</span>
      </div>
      <div className="area-barras" onMouseLeave={() => setActiva(null)}>
        {serie.map((d, i) => (
          <div key={i} className="columna" onMouseEnter={() => setActiva(i)}>
            {activa === i && (
              <div className="tooltip">
                <div>{d.detalle}</div>
                <strong>{dinero.format(d.valor)}</strong>
              </div>
            )}
            <div className="pista">
              <div
                className={`barra ${activa === i ? 'resaltada' : ''}`}
                style={{ height: `${(d.valor / max) * 100}%` }}
              />
            </div>
            <span className="etiqueta-x">{i % mostrarCada === 0 ? d.etiqueta : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Lista con barras horizontales (ranking)
function BarrasHorizontales({ filas }) {
  const max = Math.max(...filas.map((f) => f.valor), 1)
  return (
    <div className="ranking">
      {filas.map((f, i) => (
        <div key={i} className="fila-ranking" title={`${f.nombre}: ${dinero.format(f.valor)} (${f.detalle})`}>
          <div className="nombre-ranking">
            <span>{f.nombre}</span>
            <span className="unidad">{f.detalle}</span>
          </div>
          <div className="linea-ranking">
            <div className="pista-h">
              <div className="barra-h" style={{ width: `${(f.valor / max) * 100}%` }} />
            </div>
            <strong>{dinero.format(f.valor)}</strong>
          </div>
        </div>
      ))}
    </div>
  )
}
