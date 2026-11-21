import { useState } from 'react'
import Productos from './pages/Productos.jsx'
import Caja from './pages/Caja.jsx'
import Reportes from './pages/Reportes.jsx'

// Secciones de la app. Las que tienen listo: false se irán activando.
const SECCIONES = [
  { id: 'caja', nombre: 'Caja', listo: true },
  { id: 'productos', nombre: 'Productos', listo: true },
  { id: 'reportes', nombre: 'Reportes', listo: true },
]

export default function App() {
  const [seccion, setSeccion] = useState('caja')

  return (
    <div className="app">
      <header className="barra">
        <div className="marca">
          Punto de Venta <span>Abarrotes</span>
        </div>
        <nav>
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              className={seccion === s.id ? 'activo' : ''}
              disabled={!s.listo}
              title={s.listo ? '' : 'Próximamente'}
              onClick={() => setSeccion(s.id)}
            >
              {s.nombre}
              {!s.listo && <small> pronto</small>}
            </button>
          ))}
        </nav>
      </header>

      <main className="contenido">
        {seccion === 'caja' && <Caja />}
        {seccion === 'productos' && <Productos />}
        {seccion === 'reportes' && <Reportes />}
      </main>
    </div>
  )
}
