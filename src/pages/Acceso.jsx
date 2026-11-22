import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

function traducir(mensaje) {
  if (/invalid login credentials/i.test(mensaje)) return 'Correo o contraseña incorrectos.'
  if (/email not confirmed/i.test(mensaje)) return 'Primero confirma tu correo: revisa tu bandeja de entrada (y spam).'
  if (/already registered/i.test(mensaje)) return 'Ese correo ya tiene una cuenta. Usa "Entrar".'
  if (/at least 6 characters/i.test(mensaje)) return 'La contraseña debe tener al menos 6 caracteres.'
  if (/rate limit/i.test(mensaje)) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  return mensaje
}

const TITULOS = { entrar: 'Entrar', registro: 'Crear cuenta', recuperar: 'Recuperar contraseña' }
const BOTONES = { entrar: 'Entrar', registro: 'Crear cuenta', recuperar: 'Enviar enlace' }

// Pantalla para entrar, crear cuenta o pedir el enlace para recuperar la contraseña
export default function Acceso() {
  const [modo, setModo] = useState('entrar') // 'entrar' | 'registro' | 'recuperar'
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)

  function cambiarModo(nuevo) {
    setModo(nuevo)
    setError('')
    setAviso('')
  }

  async function alEnviar(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    setEnviando(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: contrasena })
        if (error) throw error
      } else if (modo === 'registro') {
        const { data, error } = await supabase.auth.signUp({ email: correo.trim(), password: contrasena })
        if (error) throw error
        if (!data.session) {
          setModo('entrar')
          setAviso('Te enviamos un correo para confirmar tu cuenta. Ábrelo, da clic en el enlace y luego entra aquí.')
        }
      } else {
        // El enlace del correo regresa a esta misma app, donde se pide la nueva contraseña
        const { error } = await supabase.auth.resetPasswordForEmail(correo.trim(), {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setAviso(
          'Si ese correo tiene una cuenta, te llegará un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.',
        )
      }
    } catch (err) {
      setError(traducir(err.message))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="acceso">
      <form className="ventana" onSubmit={alEnviar}>
        <div className="marca-acceso">
          Punto de Venta <span>Abarrotes</span>
        </div>
        <h2>{TITULOS[modo]}</h2>
        {modo === 'recuperar' && (
          <p className="sub">Escribe el correo de tu cuenta y te mandaremos un enlace para crear una contraseña nueva.</p>
        )}

        <label>
          Correo
          <input type="email" autoFocus value={correo} onChange={(e) => setCorreo(e.target.value)} required />
        </label>
        {modo !== 'recuperar' && (
          <label>
            Contraseña
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              minLength={6}
              required
            />
          </label>
        )}
        {modo === 'entrar' && (
          <button type="button" className="enlace derecha" onClick={() => cambiarModo('recuperar')}>
            ¿Olvidaste tu contraseña?
          </button>
        )}

        {error && <p className="error">{error}</p>}
        {aviso && <p className="ok-texto">{aviso}</p>}

        <button type="submit" className="primario grande" disabled={enviando}>
          {enviando ? 'Un momento…' : BOTONES[modo]}
        </button>
        {modo === 'entrar' && (
          <button type="button" className="enlace centro" onClick={() => cambiarModo('registro')}>
            ¿No tienes cuenta? Crea una
          </button>
        )}
        {modo !== 'entrar' && (
          <button type="button" className="enlace centro" onClick={() => cambiarModo('entrar')}>
            Regresar a Entrar
          </button>
        )}
      </form>
    </div>
  )
}

// Pantalla que aparece al abrir el enlace del correo de recuperación
export function NuevaContrasena({ alTerminar }) {
  const [contrasena, setContrasena] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function alEnviar(e) {
    e.preventDefault()
    setError('')
    if (contrasena.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (contrasena !== confirmar) return setError('Las contraseñas no coinciden.')
    setEnviando(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: contrasena })
      if (error) throw error
      window.history.replaceState(null, '', window.location.pathname)
      alTerminar()
    } catch (err) {
      const m = err.message || ''
      setError(
        /different from the old/i.test(m)
          ? 'La contraseña nueva debe ser diferente a la anterior.'
          : /expired|invalid/i.test(m)
            ? 'El enlace ya expiró. Pide uno nuevo desde "¿Olvidaste tu contraseña?".'
            : traducir(m),
      )
      setEnviando(false)
    }
  }

  return (
    <div className="acceso">
      <form className="ventana" onSubmit={alEnviar}>
        <div className="marca-acceso">
          Punto de Venta <span>Abarrotes</span>
        </div>
        <h2>Crea tu nueva contraseña</h2>
        <label>
          Nueva contraseña
          <input type="password" autoFocus value={contrasena} onChange={(e) => setContrasena(e.target.value)} />
        </label>
        <label>
          Repite la contraseña
          <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primario grande" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </div>
  )
}

// Pantalla para dar de alta la tienda la primera vez
export function CrearTienda({ alCrear, alSalir }) {
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function alEnviar(e) {
    e.preventDefault()
    if (!nombre.trim()) return setError('Escribe el nombre de la tienda.')
    setEnviando(true)
    try {
      await alCrear(nombre.trim())
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  return (
    <div className="acceso">
      <form className="ventana" onSubmit={alEnviar}>
        <h2>¡Bienvenido!</h2>
        <p className="sub">Para empezar, ¿cómo se llama tu tienda? Así aparecerá en los tickets.</p>
        <label>
          Nombre de la tienda
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Abarrotes Lupita" />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primario grande" disabled={enviando}>
          Continuar
        </button>
        <button type="button" className="enlace centro" onClick={alSalir}>
          Salir
        </button>
      </form>
    </div>
  )
}
