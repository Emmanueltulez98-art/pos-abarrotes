import { useEffect, useMemo, useRef, useState } from 'react'
import { obtenerProductos, guardarProducto } from '../data/productos.js'
import { obtenerEntradas, registrarEntrada } from '../data/entradas.js'

const dinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
const redondear = (n) => Math.round(n * 100) / 100
const formatoCantidad = (n, unidad) =>
  unidad === 'kg'
    ? `${Number(n).toLocaleString('es-MX', { maximumFractionDigits: 3 })} kg`
    : `${Number(n).toLocaleString('es-MX')} pz`

const NUEVO_VACIO = { codigo: '', nombre: '', categoria: '', unidad: 'pieza', precio: '' }

export default function Entradas() {
  const [productos, setProductos] = useState([])
  const [historial, setHistorial] = useState([])
  const [lista, setLista] = useState([]) // { producto, cantidad (texto), costo (texto) }
  const [entrada, setEntrada] = useState('')
  const [seleccion, setSeleccion] = useState(0)
  const [proveedor, setProveedor] = useState('')
  const [notas, setNotas] = useState('')
  const [aviso, setAviso] = useState('')
  const [exito, setExito] = useState('')
  const [nuevo, setNuevo] = useState(null) // formulario de producto nuevo
  const [errorNuevo, setErrorNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [abierta, setAbierta] = useState(null)
  const entradaRef = useRef(null)
  const cantidadRefs = useRef({})

  async function recargar() {
    try {
      const [p, h] = await Promise.all([obtenerProductos(), obtenerEntradas()])
      setProductos(p)
      setHistorial(h)
    } catch (e) {
      setAviso(`No se pudieron cargar los datos: ${e.message}`)
    }
  }

  useEffect(() => {
    recargar()
  }, [])

  const proveedores = useMemo(
    () => [...new Set(historial.map((h) => h.proveedor).filter(Boolean))].sort(),
    [historial],
  )
  const categorias = useMemo(
    () => [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort(),
    [productos],
  )

  const sugerencias = useMemo(() => {
    const q = entrada.trim().toLowerCase()
    if (q.length < 2 || /^\d+$/.test(q)) return []
    return productos.filter((p) => p.nombre.toLowerCase().includes(q)).slice(0, 8)
  }, [entrada, productos])

  function enfocar() {
    setTimeout(() => entradaRef.current?.focus(), 0)
  }

  function agregar(producto) {
    setEntrada('')
    setAviso('')
    setExito('')
    setSeleccion(0)
    const i = lista.findIndex((x) => x.producto.id === producto.id)
    if (i >= 0) {
      // Ya estaba: si es por pieza suma 1, si es granel enfoca su cantidad
      if (producto.unidad === 'pieza') {
        setLista((l) => l.map((x, j) => (j === i ? { ...x, cantidad: String((Number(x.cantidad) || 0) + 1) } : x)))
        enfocar()
      } else {
        setTimeout(() => cantidadRefs.current[producto.id]?.focus(), 0)
      }
      return
    }
    setLista((l) => [
      ...l,
      {
        producto,
        cantidad: producto.unidad === 'pieza' ? '1' : '',
        costo: producto.costo ? String(producto.costo) : '',
      },
    ])
    if (producto.unidad === 'kg') setTimeout(() => cantidadRefs.current[producto.id]?.focus(), 0)
    else enfocar()
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
      if (/^\d{4,}$/.test(texto)) {
        // Código que no existe: ofrecer darlo de alta
        setErrorNuevo('')
        setNuevo({ ...NUEVO_VACIO, codigo: texto })
        setEntrada('')
        return
      }
      setAviso(`No se encontró ningún producto con "${texto}".`)
      setEntrada('')
    }
  }

  function cambiar(indice, campo, valor) {
    setLista((l) => l.map((x, j) => (j === indice ? { ...x, [campo]: valor } : x)))
  }

  function quitar(indice) {
    setLista((l) => l.filter((_, j) => j !== indice))
    enfocar()
  }

  async function guardarNuevo(e) {
    e.preventDefault()
    const nombre = nuevo.nombre.trim()
    const precio = Number(nuevo.precio)
    if (!nombre) return setErrorNuevo('Escribe el nombre del producto.')
    if (!(precio > 0)) return setErrorNuevo('Escribe el precio de venta.')
    try {
      const actualizados = await guardarProducto({
        ...nuevo,
        nombre,
        codigo: nuevo.codigo.trim(),
        categoria: nuevo.categoria.trim(),
        precio,
        existencia: 0,
        minimo: 0,
      })
      setProductos(actualizados)
      const creado = actualizados.find((p) => (nuevo.codigo ? p.codigo === nuevo.codigo.trim() : p.nombre === nombre))
      setNuevo(null)
      if (creado) agregar(creado)
    } catch (err) {
      setErrorNuevo(err.message)
    }
  }

  // Totales y validación
  const partidas = lista.map((x) => {
    const cantidad = Number(x.cantidad)
    const costo = x.costo === '' ? null : Number(x.costo)
    return {
      productoId: x.producto.id,
      nombre: x.producto.nombre,
      unidad: x.producto.unidad,
      cantidad,
      costo,
      importe: costo === null ? null : redondear(cantidad * costo),
    }
  })
  const totalCosto = redondear(partidas.reduce((s, p) => s + (p.importe || 0), 0))
  const problema = partidas.find(
    (p) => !(p.cantidad > 0) || (p.unidad === 'pieza' && !Number.isInteger(p.cantidad)) || (p.costo !== null && !(p.costo >= 0)),
  )

  async function alRegistrar() {
    if (!lista.length || guardando) return
    if (problema) {
      setAviso(
        `Revisa "${problema.nombre}": la cantidad debe ser mayor a 0${problema.unidad === 'pieza' ? ' y sin decimales' : ''}.`,
      )
      return
    }
    setGuardando(true)
    setAviso('')
    try {
      const registrada = await registrarEntrada({ proveedor, notas, partidas })
      setExito(
        `Entrada #${String(registrada.folio).padStart(5, '0')} registrada: ${partidas.length} ${
          partidas.length === 1 ? 'producto' : 'productos'
        }. Las existencias ya se actualizaron.`,
      )
      setLista([])
      setProveedor('')
      setNotas('')
      await recargar()
      enfocar()
    } catch (err) {
      setAviso(`No se pudo registrar la entrada: ${err.message}`)
    } finally {
      setGuardando(false)
    }
  }

  function cancelar() {
    if (lista.length && !window.confirm('¿Descartar esta entrada? Se quitarán los productos de la lista.')) return
    setLista([])
    setAviso('')
    enfocar()
  }

  return (
    <section>
      <div className="encabezado">
        <div>
          <h1>Entradas de mercancía</h1>
          <p className="sub">Registra lo que llega del proveedor y las existencias suben solas.</p>
        </div>
      </div>

      <div className="caja">
        <div className="caja-izq">
          <div className="entrada-caja">
            <input
              ref={entradaRef}
              className="buscador"
              autoFocus
              placeholder="Escanea el código o escribe el nombre del producto que llegó…"
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
                    <span className="unidad">Hay {formatoCantidad(p.existencia, p.unidad)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {aviso && <p className="error">{aviso}</p>}
          {exito && <p className="ok-texto">{exito}</p>}

          {lista.length === 0 ? (
            <div className="vacio">
              Escanea los productos que llegaron. Si un código no está registrado, podrás darlo de alta aquí mismo.
            </div>
          ) : (
            <table className="tabla tarjetas">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Hay</th>
                  <th className="num">Llegaron</th>
                  <th className="num">Costo unitario</th>
                  <th className="num">Importe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((x, i) => {
                  const p = partidas[i]
                  return (
                    <tr key={x.producto.id}>
                      <td className="celda-titulo">
                        {x.producto.nombre}
                        {x.producto.unidad === 'kg' && <span className="etiqueta">granel</span>}
                      </td>
                      <td className="num unidad" data-label="Hay">{formatoCantidad(x.producto.existencia, x.producto.unidad)}</td>
                      <td className="num" data-label="Llegaron">
                        <input
                          ref={(el) => (cantidadRefs.current[x.producto.id] = el)}
                          className="input-chico"
                          type="number"
                          min="0"
                          step={x.producto.unidad === 'kg' ? '0.001' : '1'}
                          value={x.cantidad}
                          placeholder={x.producto.unidad === 'kg' ? 'kg' : 'pz'}
                          onChange={(e) => cambiar(i, 'cantidad', e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && enfocar()}
                        />
                      </td>
                      <td className="num" data-label="Costo unitario">
                        <input
                          className="input-chico"
                          type="number"
                          min="0"
                          step="0.01"
                          value={x.costo}
                          placeholder="opcional"
                          onChange={(e) => cambiar(i, 'costo', e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && enfocar()}
                        />
                      </td>
                      <td className="num" data-label="Importe">{p.importe === null || isNaN(p.importe) ? '—' : dinero.format(p.importe)}</td>
                      <td className="acciones esquina">
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
          <label className="campo">
            Proveedor
            <input
              list="lista-proveedores"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              placeholder="Ej. Bimbo, Sabritas…"
            />
            <datalist id="lista-proveedores">
              {proveedores.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label className="campo">
            Notas
            <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" />
          </label>
          <div className="total-etiqueta">Costo total</div>
          <div className="total">{dinero.format(totalCosto)}</div>
          <div className="sub">
            {lista.length} {lista.length === 1 ? 'producto' : 'productos'}
          </div>
          <button className="primario grande" disabled={!lista.length || guardando} onClick={alRegistrar}>
            {guardando ? 'Guardando…' : 'Registrar entrada'}
          </button>
          <button disabled={!lista.length} onClick={cancelar}>
            Descartar
          </button>
        </aside>
      </div>

      <div className="tarjeta" style={{ marginTop: '1.2rem' }}>
        <h3>Entradas recientes</h3>
        {historial.length === 0 ? (
          <p className="sub">Aún no hay entradas registradas.</p>
        ) : (
          <table className="tabla compacta">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th className="num">Productos</th>
                <th className="num">Costo</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((h) => {
                const f = new Date(h.fecha)
                return [
                  <tr key={h.id} className="clicable" onClick={() => setAbierta(abierta === h.id ? null : h.id)}>
                    <td className="codigo">#{String(h.folio).padStart(5, '0')}</td>
                    <td>
                      {f.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}{' '}
                      {f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>{h.proveedor || '—'}</td>
                    <td className="num">{h.partidas.length}</td>
                    <td className="num">{h.total ? dinero.format(h.total) : '—'}</td>
                  </tr>,
                  abierta === h.id && (
                    <tr key={`${h.id}-d`} className="detalle">
                      <td colSpan={5}>
                        {h.partidas.map((p, i) => (
                          <div key={i} className="linea-ticket">
                            <span>
                              {formatoCantidad(p.cantidad, p.unidad)} · {p.nombre}
                            </span>
                            <span>{p.importe !== null ? dinero.format(p.importe) : ''}</span>
                          </div>
                        ))}
                        {h.notas && <div className="sub">Notas: {h.notas}</div>}
                      </td>
                    </tr>
                  ),
                ]
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Alta rápida de producto nuevo */}
      {nuevo && (
        <div className="fondo" onKeyDown={(e) => e.key === 'Escape' && (setNuevo(null), enfocar())}>
          <form className="ventana angosta" onSubmit={guardarNuevo}>
            <h2>Producto nuevo</h2>
            <p className="sub">
              El código <strong>{nuevo.codigo}</strong> no está registrado. Dalo de alta y se agrega a la entrada.
            </p>
            <label>
              Nombre *
              <input
                autoFocus
                value={nuevo.nombre}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                placeholder="Ej. Sabritas Adobadas 45 g"
              />
            </label>
            <label>
              Categoría
              <input
                list="lista-categorias-entrada"
                value={nuevo.categoria}
                onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })}
              />
              <datalist id="lista-categorias-entrada">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <div className="fila">
              <span className="etiqueta-campo">Se vende por</span>
              <label className="opcion">
                <input type="radio" checked={nuevo.unidad === 'pieza'} onChange={() => setNuevo({ ...nuevo, unidad: 'pieza' })} />
                Pieza
              </label>
              <label className="opcion">
                <input type="radio" checked={nuevo.unidad === 'kg'} onChange={() => setNuevo({ ...nuevo, unidad: 'kg' })} />
                Kilo
              </label>
            </div>
            <label>
              Precio de venta {nuevo.unidad === 'kg' ? 'por kg' : 'por pieza'} *
              <input
                type="number"
                min="0"
                step="0.01"
                value={nuevo.precio}
                onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })}
              />
            </label>
            {errorNuevo && <p className="error">{errorNuevo}</p>}
            <div className="botones">
              <button
                type="button"
                onClick={() => {
                  setNuevo(null)
                  enfocar()
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="primario">
                Guardar y agregar
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
