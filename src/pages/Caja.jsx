import { useEffect, useMemo, useRef, useState } from 'react'
import { obtenerProductos } from '../data/productos.js'
import { registrarVenta } from '../data/ventas.js'
import { nombreTienda } from '../data/sesion.js'

const dinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const redondear = (n) => Math.round(n * 100) / 100
const formatoKg = (n) =>
  `${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`

const ATAJOS_KG = [
  { texto: '¼ kg', valor: 0.25 },
  { texto: '½ kg', valor: 0.5 },
  { texto: '1 kg', valor: 1 },
]
const ATAJOS_DINERO = [10, 20, 50, 100]
const BILLETES = [20, 50, 100, 200, 500, 1000]

// Partida de pieza con nueva cantidad e importe recalculado
function conCantidad(partida, cantidad) {
  return { ...partida, cantidad, importe: redondear(partida.precio * cantidad) }
}

// Calcula kilos e importe de un producto a granel según el modo
function calcularGranel(granel) {
  const valor = Number(granel.valor)
  const precio = granel.producto.precio
  if (!(valor > 0)) return { cantidad: 0, importe: 0 }
  if (granel.modo === 'kg') return { cantidad: valor, importe: redondear(valor * precio) }
  return { cantidad: Math.round((valor / precio) * 1000) / 1000, importe: redondear(valor) }
}

export default function Caja() {
  const [productos, setProductos] = useState([])
  const [carrito, setCarrito] = useState([])
  const [entrada, setEntrada] = useState('')
  const [seleccion, setSeleccion] = useState(0)
  const [aviso, setAviso] = useState('')
  const [granel, setGranel] = useState(null) // { producto, modo: 'kg'|'dinero', valor, indice }
  const [cobro, setCobro] = useState(null) // { pago }
  const [ticket, setTicket] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const entradaRef = useRef(null)

  useEffect(() => {
    obtenerProductos()
      .then(setProductos)
      .catch((e) => setAviso(`No se pudieron cargar los productos: ${e.message}`))
  }, [])

  const total = redondear(carrito.reduce((s, p) => s + p.importe, 0))
  const articulos = carrito.reduce((s, p) => s + (p.unidad === 'kg' ? 1 : p.cantidad), 0)

  // Sugerencias al escribir un nombre (útil para granel sin código de barras)
  const sugerencias = useMemo(() => {
    const q = entrada.trim().toLowerCase()
    if (q.length < 2 || /^\d+$/.test(q)) return []
    return productos.filter((p) => p.nombre.toLowerCase().includes(q)).slice(0, 8)
  }, [entrada, productos])

  // Cuánto de cada producto hay en el carrito (para avisar si no alcanza la existencia)
  const enCarrito = useMemo(() => {
    const m = {}
    for (const p of carrito) m[p.productoId] = (m[p.productoId] || 0) + p.cantidad
    return m
  }, [carrito])

  function enfocar() {
    setTimeout(() => entradaRef.current?.focus(), 0)
  }

  function agregar(producto) {
    setEntrada('')
    setAviso('')
    setSeleccion(0)
    if (producto.unidad === 'kg') {
      setGranel({ producto, modo: 'kg', valor: '', indice: null })
      return
    }
    setCarrito((c) => {
      const i = c.findIndex((p) => p.productoId === producto.id)
      if (i >= 0) return c.map((p, j) => (j === i ? conCantidad(p, p.cantidad + 1) : p))
      return [
        ...c,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          unidad: 'pieza',
          precio: producto.precio,
          cantidad: 1,
          importe: redondear(producto.precio),
        },
      ]
    })
    enfocar()
  }

  function alPresionarTecla(e) {
    if (e.key === 'ArrowDown' && sugerencias.length) {
      e.preventDefault()
      setSeleccion((s) => Math.min(s + 1, sugerencias.length - 1))
    } else if (e.key === 'ArrowUp' && sugerencias.length) {
      e.preventDefault()
      setSeleccion((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const texto = entrada.trim()
      if (!texto) return
      const porCodigo = productos.find((p) => p.codigo === texto)
      if (porCodigo) return agregar(porCodigo)
      if (sugerencias.length) return agregar(sugerencias[seleccion] || sugerencias[0])
      setAviso(`No se encontró ningún producto con "${texto}".`)
      setEntrada('')
    }
  }

  function cambiarPiezas(indice, delta) {
    setCarrito((c) =>
      c.map((p, j) => (j === indice ? conCantidad(p, Math.max(1, p.cantidad + delta)) : p)),
    )
  }

  function quitar(indice) {
    setCarrito((c) => c.filter((_, j) => j !== indice))
    enfocar()
  }

  function editarGranel(indice) {
    const partida = carrito[indice]
    const producto = productos.find((p) => p.id === partida.productoId) || {
      id: partida.productoId,
      nombre: partida.nombre,
      precio: partida.precio,
    }
    setGranel({ producto, modo: 'kg', valor: String(partida.cantidad), indice })
  }

  function confirmarGranel(e) {
    e.preventDefault()
    const { cantidad, importe } = calcularGranel(granel)
    if (!(cantidad > 0)) return
    const { producto, indice } = granel
    const partida = {
      productoId: producto.id,
      nombre: producto.nombre,
      unidad: 'kg',
      precio: producto.precio,
      cantidad,
      importe,
    }
    setCarrito((c) => (indice === null ? [...c, partida] : c.map((p, j) => (j === indice ? partida : p))))
    setGranel(null)
    enfocar()
  }

  function cerrarGranel() {
    setGranel(null)
    enfocar()
  }

  function abrirCobro() {
    if (!carrito.length || granel || ticket) return
    setCobro({ pago: '' })
  }

  function cerrarCobro() {
    setCobro(null)
    enfocar()
  }

  async function confirmarCobro(e) {
    e.preventDefault()
    const pago = Number(cobro.pago)
    if (!(pago >= total)) return
    if (guardando) return
    setGuardando(true)
    try {
      const venta = await registrarVenta({ partidas: carrito, pago })
      setCobro(null)
      setTicket(venta)
      setProductos(await obtenerProductos())
    } catch (err) {
      window.alert(`No se pudo registrar la venta: ${err.message}`)
    } finally {
      setGuardando(false)
    }
  }

  function nuevaVenta() {
    setTicket(null)
    setCarrito([])
    enfocar()
  }

  function cancelarVenta() {
    if (!carrito.length) return
    if (!window.confirm('¿Cancelar la venta actual? Se vaciarán los productos.')) return
    setCarrito([])
    enfocar()
  }

  // Atajo de teclado: F2 para cobrar
  useEffect(() => {
    function alTeclear(e) {
      if (e.key === 'F2') {
        e.preventDefault()
        abrirCobro()
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  })

  const calculoGranel = granel ? calcularGranel(granel) : null
  const pagoNum = cobro ? Number(cobro.pago) : 0
  const alcanza = cobro ? pagoNum >= total : false

  return (
    <section className="caja">
      <div className="caja-izq">
        <div className="entrada-caja">
          <input
            ref={entradaRef}
            className="buscador"
            autoFocus
            placeholder="Escanea el código o escribe el nombre del producto…"
            value={entrada}
            onChange={(e) => {
              setEntrada(e.target.value)
              setSeleccion(0)
              setAviso('')
            }}
            onKeyDown={alPresionarTecla}
          />
          {sugerencias.length > 0 && (
            <ul className="sugerencias">
              {sugerencias.map((p, i) => (
                <li
                  key={p.id}
                  className={i === seleccion ? 'activa' : ''}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    agregar(p)
                  }}
                >
                  <span>
                    {p.nombre}
                    {p.unidad === 'kg' && <span className="etiqueta">granel</span>}
                  </span>
                  <span className="unidad">
                    {dinero.format(p.precio)}
                    {p.unidad === 'kg' ? ' /kg' : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {aviso && <p className="error">{aviso}</p>}

        {carrito.length === 0 ? (
          <div className="vacio">Escanea un producto para empezar la venta.</div>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="num">Precio</th>
                <th className="centro">Cantidad</th>
                <th className="num">Importe</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {carrito.map((p, i) => {
                const prod = productos.find((x) => x.id === p.productoId)
                const noAlcanza = prod && enCarrito[p.productoId] > Number(prod.existencia)
                return (
                  <tr key={i}>
                    <td>
                      {p.nombre}
                      {noAlcanza && (
                        <div className="advertencia">
                          Existencia registrada: {p.unidad === 'kg' ? formatoKg(prod.existencia) : `${prod.existencia} pz`}
                        </div>
                      )}
                    </td>
                    <td className="num">
                      {dinero.format(p.precio)}
                      <span className="unidad">{p.unidad === 'kg' ? ' /kg' : ''}</span>
                    </td>
                    <td className="centro">
                      {p.unidad === 'kg' ? (
                        <button className="enlace" onClick={() => editarGranel(i)} title="Cambiar cantidad">
                          {formatoKg(p.cantidad)}
                        </button>
                      ) : (
                        <span className="contador">
                          <button onClick={() => cambiarPiezas(i, -1)}>−</button>
                          <strong>{p.cantidad}</strong>
                          <button onClick={() => cambiarPiezas(i, 1)}>+</button>
                        </span>
                      )}
                    </td>
                    <td className="num">
                      <strong>{dinero.format(p.importe)}</strong>
                    </td>
                    <td className="acciones">
                      <button className="peligro" onClick={() => quitar(i)} title="Quitar">
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <aside className="caja-der">
        <div className="total-etiqueta">Total</div>
        <div className="total">{dinero.format(total)}</div>
        <div className="sub">
          {articulos} {articulos === 1 ? 'artículo' : 'artículos'}
        </div>
        <button className="primario grande" disabled={!carrito.length} onClick={abrirCobro}>
          Cobrar <small>(F2)</small>
        </button>
        <button disabled={!carrito.length} onClick={cancelarVenta}>
          Cancelar venta
        </button>
      </aside>

      {/* Ventana de granel */}
      {granel && (
        <div className="fondo" onKeyDown={(e) => e.key === 'Escape' && cerrarGranel()}>
          <form className="ventana angosta" onSubmit={confirmarGranel}>
            <h2>{granel.producto.nombre}</h2>
            <p className="sub">{dinero.format(granel.producto.precio)} por kg</p>

            <div className="pestanas">
              <button
                type="button"
                className={granel.modo === 'kg' ? 'activo' : ''}
                onClick={() => setGranel({ ...granel, modo: 'kg', valor: '' })}
              >
                Por kilos
              </button>
              <button
                type="button"
                className={granel.modo === 'dinero' ? 'activo' : ''}
                onClick={() => setGranel({ ...granel, modo: 'dinero', valor: '' })}
              >
                Por dinero ($)
              </button>
            </div>

            <label>
              {granel.modo === 'kg' ? 'Kilos' : 'Pesos'}
              <input
                autoFocus
                key={granel.modo}
                type="number"
                min="0"
                step={granel.modo === 'kg' ? '0.001' : '0.5'}
                value={granel.valor}
                onChange={(e) => setGranel({ ...granel, valor: e.target.value })}
                placeholder={granel.modo === 'kg' ? 'Ej. 0.750' : 'Ej. 20'}
              />
            </label>

            <div className="atajos">
              {granel.modo === 'kg'
                ? ATAJOS_KG.map((a) => (
                    <button type="button" key={a.texto} onClick={() => setGranel({ ...granel, valor: String(a.valor) })}>
                      {a.texto}
                    </button>
                  ))
                : ATAJOS_DINERO.map((m) => (
                    <button type="button" key={m} onClick={() => setGranel({ ...granel, valor: String(m) })}>
                      ${m}
                    </button>
                  ))}
            </div>

            <div className="resumen-granel">
              <span>{formatoKg(calculoGranel.cantidad)}</span>
              <strong>{dinero.format(calculoGranel.importe)}</strong>
            </div>

            <div className="botones">
              <button type="button" onClick={cerrarGranel}>
                Cancelar
              </button>
              <button type="submit" className="primario" disabled={!(calculoGranel.cantidad > 0)}>
                {granel.indice === null ? 'Agregar' : 'Actualizar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ventana de cobro */}
      {cobro && (
        <div className="fondo" onKeyDown={(e) => e.key === 'Escape' && cerrarCobro()}>
          <form className="ventana angosta" onSubmit={confirmarCobro}>
            <h2>Cobrar en efectivo</h2>
            <div className="total centro">{dinero.format(total)}</div>

            <label>
              Paga con
              <input
                autoFocus
                type="number"
                min="0"
                step="0.5"
                value={cobro.pago}
                onChange={(e) => setCobro({ pago: e.target.value })}
              />
            </label>

            <div className="atajos">
              <button type="button" onClick={() => setCobro({ pago: String(total) })}>
                Exacto
              </button>
              {BILLETES.filter((b) => b >= total).slice(0, 4).map((b) => (
                <button type="button" key={b} onClick={() => setCobro({ pago: String(b) })}>
                  ${b}
                </button>
              ))}
            </div>

            <div className={`cambio ${cobro.pago && !alcanza ? 'falta' : ''}`}>
              {cobro.pago === ''
                ? 'Escribe con cuánto paga el cliente'
                : alcanza
                  ? <>Cambio: <strong>{dinero.format(redondear(pagoNum - total))}</strong></>
                  : <>Faltan: <strong>{dinero.format(redondear(total - pagoNum))}</strong></>}
            </div>

            <div className="botones">
              <button type="button" onClick={cerrarCobro}>
                Regresar
              </button>
              <button type="submit" className="primario" disabled={!alcanza || guardando}>
                {guardando ? 'Guardando…' : 'Confirmar venta'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ticket */}
      {ticket && (
        <div className="fondo">
          <div className="ventana ticket">
            <div className="centro">
              <strong>{nombreTienda().toUpperCase()}</strong>
              <div className="sub">Folio #{String(ticket.folio).padStart(5, '0')}</div>
              <div className="sub">{new Date(ticket.fecha).toLocaleString('es-MX')}</div>
            </div>
            <hr />
            {ticket.partidas.map((p, i) => (
              <div key={i} className="linea-ticket">
                <div>
                  {p.nombre}
                  <div className="unidad">
                    {p.unidad === 'kg' ? formatoKg(p.cantidad) : `${p.cantidad} pz`} × {dinero.format(p.precio)}
                  </div>
                </div>
                <div>{dinero.format(p.importe)}</div>
              </div>
            ))}
            <hr />
            <div className="linea-ticket"><strong>TOTAL</strong><strong>{dinero.format(ticket.total)}</strong></div>
            <div className="linea-ticket"><span>Efectivo</span><span>{dinero.format(ticket.pago)}</span></div>
            <div className="linea-ticket"><span>Cambio</span><span>{dinero.format(ticket.cambio)}</span></div>
            <hr />
            <div className="centro sub">¡Gracias por su compra!</div>
            <button className="primario grande" autoFocus onClick={nuevaVenta}>
              Nueva venta
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
