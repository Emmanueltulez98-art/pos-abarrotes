import { useEffect, useState } from 'react'
import { supabase, configurado } from './lib/supabase.js'
import { setTienda } from './data/sesion.js'
import { obtenerMiTienda, crearTienda } from './data/tienda.js'
import Acceso, { CrearTienda } from './pages/Acceso.jsx'
import Productos from './pages/Productos.jsx'
import Caja from './pages/Caja.jsx'
import Reportes from './pages/Reportes.jsx'

const SECCIONES = [
  { id: 'caja', nombre: 'Caja' },
  { id: 'productos', nombre: 'Productos' },
  { id: 'reportes', nombre: 'Reportes' },
]

export default function App() {
  const [sesion, setSesion] = useState(undefined) // undefined = aún no sabemos
  const [estado, setEstado] = useState(configurado ? 'cargando' : 'sin-config')
  const [tienda, setTiendaActual] = useState(null)
  const [error, setError] = useState('')
  const [seccion, setSeccion] = useState('caja')

  // Escuchar si el usuario entra o sale
  useEffect(() => {
    if (!configurado) return
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const usuarioId = sesion?.user?.id
  const sesionConocida = sesion !== undefined

  // Cuando cambia el usuario, cargar su tienda
  useEffect(() => {
    if (!configurado || !sesionConocida) return
    if (!usuarioId) {
      setTienda(null)
      setTiendaActual(null)
      setEstado('acceso')
      return
    }
    setEstado('cargando')
    obtenerMiTienda()
      .then((t) => {
        if (t) {
          setTienda(t)
          setTiendaActual(t)
          setSeccion('caja')
          setEstado('listo')
        } else {
          setEstado('crear-tienda')
        }
      })
      .catch((e) => {
        setError(e.message)
        setEstado('error')
      })
  }, [usuarioId, sesionConocida])

  async function alCrearTienda(nombre) {
    const t = await crearTienda(nombre)
    setTienda(t)
    setTiendaActual(t)
    setEstado('listo')
  }

  const salir = () => supabase.auth.signOut()

  if (estado === 'sin-config') {
    return (
      <div className="acceso">
        <div className="ventana">
          <h2>Falta conectar Supabase</h2>
          <p>
            No encontré los datos en el archivo <code>.env.local</code>. Revisa que exista en la carpeta
            <code> pos-abarrotes</code>, que tenga <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>,
            y después detén la app (Ctrl + C) y vuelve a correr <code>npm run dev</code>.
          </p>
        </div>
      </div>
    )
  }
  if (estado === 'cargando') return <div className="acceso"><p className="sub">Cargando…</p></div>
  if (estado === 'error') {
    return (
      <div className="acceso">
        <div className="ventana">
          <h2>No se pudo conectar</h2>
          <p className="error">{error}</p>
          <button onClick={salir}>Salir</button>
        </div>
      </div>
    )
  }
  if (estado === 'acceso') return <Acceso />
  if (estado === 'crear-tienda') return <CrearTienda alCrear={alCrearTienda} alSalir={salir} />

  return (
    <div className="app">
      <header className="barra">
        <div className="marca">
          {tienda?.nombre} <span>Punto de Venta</span>
        </div>
        <nav>
          {SECCIONES.map((s) => (
            <button key={s.id} className={seccion === s.id ? 'activo' : ''} onClick={() => setSeccion(s.id)}>
              {s.nombre}
            </button>
          ))}
        </nav>
        <div className="usuario">
          <span>{sesion?.user?.email}</span>
          <button onClick={salir}>Salir</button>
        </div>
      </header>

      <main className="contenido">
        {seccion === 'caja' && <Caja />}
        {seccion === 'productos' && <Productos />}
        {seccion === 'reportes' && <Reportes />}
      </main>
    </div>
  )
}
