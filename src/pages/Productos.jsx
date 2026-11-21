import { useEffect, useMemo, useRef, useState } from 'react'
import { obtenerProductos, guardarProducto, eliminarProducto } from '../data/productos.js'

// Formulario vacío para un producto nuevo
const VACIO = {
  codigo: '',
  nombre: '',
  categoria: '',
  unidad: 'pieza', // 'pieza' o 'kg' (granel)
  precio: '',
  existencia: '',
  minimo: '',
}

const dinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

function formatoCantidad(valor, unidad) {
  const n = Number(valor) || 0
  if (unidad === 'kg') {
    return `${n.toLocaleString('es-MX', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg`
  }
  return `${n.toLocaleString('es-MX')} pz`
}

// Estado del inventario de un producto
function estado(p) {
  const existencia = Number(p.existencia) || 0
  const minimo = Number(p.minimo) || 0
  if (existencia <= 0) return { texto: 'Agotado', clase: 'agotado' }
  if (minimo > 0 && existencia <= minimo) return { texto: 'Bajo', clase: 'bajo' }
  return { texto: 'OK', clase: 'ok' }
}

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [form, setForm] = useState(null) // null = formulario cerrado
  const [error, setError] = useState('')
  const buscadorRef = useRef(null)
  const nombreRef = useRef(null)

  // Cargar productos al abrir la pantalla
  useEffect(() => {
    obtenerProductos()
      .then(setProductos)
      .catch((e) => window.alert(`No se pudieron cargar los productos: ${e.message}`))
  }, [])

  // Lista filtrada por la búsqueda y ordenada por nombre
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const lista = q
      ? productos.filter(
          (p) =>
            p.nombre.toLowerCase().includes(q) ||
            (p.codigo || '').includes(q) ||
            (p.categoria || '').toLowerCase().includes(q),
        )
      : productos
    return [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [productos, busqueda])

  const categorias = useMemo(
    () => [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort(),
    [productos],
  )

  const conAlerta = productos.filter((p) => estado(p).clase !== 'ok').length

  function abrirNuevo(codigo = '') {
    setError('')
    setForm({ ...VACIO, codigo })
  }

  function abrirEditar(p) {
    setError('')
    setForm({
      ...p,
      precio: String(p.precio),
      existencia: String(p.existencia),
      minimo: p.minimo ? String(p.minimo) : '',
    })
  }

  function cerrar() {
    setForm(null)
    setError('')
    setTimeout(() => buscadorRef.current?.focus(), 0)
  }

  // Si escaneas un código en el buscador y das Enter:
  // - si el producto existe, se abre para editarlo
  // - si no existe, se abre el formulario de producto nuevo con ese código
  function alPresionarTeclaBuscador(e) {
    if (e.key !== 'Enter') return
    const texto = busqueda.trim()
    if (!texto) return
    const encontrado = productos.find((p) => p.codigo === texto)
    if (encontrado) {
      abrirEditar(encontrado)
      setBusqueda('')
    } else if (/^\d{4,}$/.test(texto)) {
      abrirNuevo(texto)
      setBusqueda('')
    }
  }

  function cambiar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  async function alGuardar(e) {
    e.preventDefault()
    const nombre = form.nombre.trim()
    const codigo = form.codigo.trim()
    const precio = Number(form.precio)
    const existencia = Number(form.existencia || 0)
    const minimo = Number(form.minimo || 0)

    if (!nombre) return setError('Escribe el nombre del producto.')
    if (!(precio > 0)) return setError('El precio debe ser mayor a 0.')
    if (existencia < 0 || minimo < 0) return setError('La existencia y el mínimo no pueden ser negativos.')
    if (form.unidad === 'pieza' && (!Number.isInteger(existencia) || !Number.isInteger(minimo))) {
      return setError('Los productos por pieza no llevan decimales en existencia ni en mínimo.')
    }
    if (codigo && productos.some((p) => p.codigo === codigo && p.id !== form.id)) {
      return setError('Ya existe otro producto con ese código de barras.')
    }

    try {
      const lista = await guardarProducto({
        ...form,
        codigo,
        nombre,
        categoria: form.categoria.trim(),
        precio,
        existencia,
        minimo,
      })
      setProductos(lista)
      cerrar()
    } catch (err) {
      setError(err.message)
    }
  }

  async function alEliminar(p) {
    if (!window.confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      setProductos(await eliminarProducto(p.id))
    } catch (err) {
      window.alert(`No se pudo eliminar: ${err.message}`)
    }
  }

  const esGranel = form?.unidad === 'kg'

  return (
    <section>
      <div className="encabezado">
        <div>
          <h1>Productos</h1>
          <p className="sub">
            {productos.length} productos
            {conAlerta > 0 && <span className="aviso"> · {conAlerta} con existencia baja o agotados</span>}
          </p>
        </div>
        <button className="primario" onClick={() => abrirNuevo()}>
          + Nuevo producto
        </button>
      </div>

      <input
        ref={buscadorRef}
        className="buscador"
        autoFocus
        placeholder="Buscar por nombre, categoría o escanear código de barras…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        onKeyDown={alPresionarTeclaBuscador}
      />

      {filtrados.length === 0 ? (
        <div className="vacio">
          {productos.length === 0
            ? 'Aún no hay productos. Agrega el primero con "+ Nuevo producto" o escanea un código en el buscador.'
            : 'Ningún producto coincide con la búsqueda.'}
        </div>
      ) : (
        <table className="tabla">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Categoría</th>
              <th className="num">Precio</th>
              <th className="num">Existencia</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => {
              const est = estado(p)
              return (
                <tr key={p.id}>
                  <td className="codigo">{p.codigo || '—'}</td>
                  <td>
                    {p.nombre}
                    {p.unidad === 'kg' && <span className="etiqueta">granel</span>}
                  </td>
                  <td>{p.categoria || '—'}</td>
                  <td className="num">
                    {dinero.format(p.precio)}
                    <span className="unidad">{p.unidad === 'kg' ? ' /kg' : ' c/u'}</span>
                  </td>
                  <td className="num">{formatoCantidad(p.existencia, p.unidad)}</td>
                  <td>
                    <span className={`estado ${est.clase}`}>{est.texto}</span>
                  </td>
                  <td className="acciones">
                    <button onClick={() => abrirEditar(p)}>Editar</button>
                    <button className="peligro" onClick={() => alEliminar(p)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {form && (
        <div className="fondo" onKeyDown={(e) => e.key === 'Escape' && cerrar()}>
          <form className="ventana" onSubmit={alGuardar}>
            <h2>{form.id ? 'Editar producto' : 'Nuevo producto'}</h2>

            <label>
              Código de barras <small>(opcional, puedes escanearlo)</small>
              <input
                autoFocus={!form.codigo}
                value={form.codigo}
                onChange={(e) => cambiar('codigo', e.target.value)}
                onKeyDown={(e) => {
                  // El lector manda "Enter" al terminar: pasamos al nombre en vez de guardar
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    nombreRef.current?.focus()
                  }
                }}
              />
            </label>

            <label>
              Nombre *
              <input
                ref={nombreRef}
                autoFocus={!!form.codigo}
                value={form.nombre}
                onChange={(e) => cambiar('nombre', e.target.value)}
                placeholder="Ej. Coca-Cola 600 ml"
              />
            </label>

            <label>
              Categoría
              <input
                list="lista-categorias"
                value={form.categoria}
                onChange={(e) => cambiar('categoria', e.target.value)}
                placeholder="Ej. Refrescos, Granos, Lácteos"
              />
              <datalist id="lista-categorias">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <div className="fila">
              <span className="etiqueta-campo">Se vende por</span>
              <label className="opcion">
                <input
                  type="radio"
                  checked={!esGranel}
                  onChange={() => cambiar('unidad', 'pieza')}
                />
                Pieza
              </label>
              <label className="opcion">
                <input type="radio" checked={esGranel} onChange={() => cambiar('unidad', 'kg')} />
                Kilo (granel)
              </label>
            </div>

            <div className="columnas">
              <label>
                Precio {esGranel ? 'por kg' : 'por pieza'} *
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.precio}
                  onChange={(e) => cambiar('precio', e.target.value)}
                />
              </label>
              <label>
                Existencia ({esGranel ? 'kg' : 'piezas'})
                <input
                  type="number"
                  step={esGranel ? '0.001' : '1'}
                  min="0"
                  value={form.existencia}
                  onChange={(e) => cambiar('existencia', e.target.value)}
                />
              </label>
              <label>
                Mínimo para alerta
                <input
                  type="number"
                  step={esGranel ? '0.001' : '1'}
                  min="0"
                  value={form.minimo}
                  onChange={(e) => cambiar('minimo', e.target.value)}
                />
              </label>
            </div>

            {error && <p className="error">{error}</p>}

            <div className="botones">
              <button type="button" onClick={cerrar}>
                Cancelar
              </button>
              <button type="submit" className="primario">
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
