import { useEffect, useState } from 'react'
import { supabase, configurado, diagnostico } from './lib/supabase.js'
import { setTienda } from './data/sesion.js'
import { obtenerMiTienda, crearTienda } from './data/tienda.js'
import Acceso, { CrearTienda, NuevaContrasena } from './pages/Acceso.jsx'
import Productos from './pages/Productos.jsx'
import Caja from './pages/Caja.jsx'
import Reportes from './pages/Reportes.jsx'
import Entradas from './pages/Entradas.jsx'

const SECCIONES = [
  { id: 'caja', nombre: 'Caja' },
  { id: 'productos', nombre: 'Productos' },
  { id: 'entradas', nombre: 'Entradas' },
  { id: 'reportes', nombre: 'Reportes' },
]

export default function App() {
  const [sesion, setSesion] = useState(undefined) // undefined = aún no sabemos
  const [estado, setEstado] = useState(configurado ? 'cargando' : 'sin-config')
  const [tienda, setTiendaActual] = useState(null)
  const [error, setError] = useState('')
  const [seccion, setSeccion] = useState('caja')
  const [recuperando, setRecuperando] = useState(false) // true al abrir el enlace de recuperación

  // Escuchar si el usuario entra o sale
  useEffect(() => {
    if (!configurado) return
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      setSesion(s)
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
    })
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
    const enLinea = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    return (
      <div className="acceso">
        <div className="ventana">
          <h2>Falta conectar Supabase</h2>
          <table className="tabla compacta">
            <tbody>
              <tr>
                <td><code>VITE_SUPABASE_URL</code></td>
                <td className={diagnostico.url === 'ok' ? 'ok-texto' : 'error'}>
                  {diagnostico.url === 'ok' ? `OK (${diagnostico.inicioUrl})` : diagnostico.url}
                </td>
              </tr>
              <tr>
                <td><code>VITE_SUPABASE_ANON_KEY</code></td>
                <td className={diagnostico.llave === 'ok' ? 'ok-texto' : 'error'}>
                  {diagnostico.llave === 'ok' ? 'OK' : diagnostico.llave}
                </td>
              </tr>
            </tbody>
          </table>
          {enLinea ? (
            <p className="sub">
              Estás en la versión publicada. Revisa estos nombres en Netlify → Site configuration → Environment
              variables, y luego en Deploys usa "Trigger deploy → Clear cache and deploy site".
            </p>
          ) : (
            <p className="sub">
              Estás en tu computadora. Revisa el archivo <code>.env.local</code> en la carpeta <code>pos-abarrotes</code>,
              y después detén la app (Ctrl + C) y vuelve a correr <code>npm run dev</code>.
            </p>
          )}
        </div>
      </div>
    )
  }
  if (recuperando) return <NuevaContrasena alTerminar={() => setRecuperando(false)} />
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
        {seccion === 'entradas' && <Entradas />}
        {seccion === 'reportes' && <Reportes />}
      </main>
    </div>
  )
}
