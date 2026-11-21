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

// Pantalla para entrar o crear cuenta
export default function Acceso() {
  const [modo, setModo] = useState('entrar') // 'entrar' | 'registro'
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function alEnviar(e) {
    e.preventDefault()
    setError('')
    setAviso('')
    setEnviando(true)
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: contrasena })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email: correo.trim(), password: contrasena })
        if (error) throw error
        if (!data.session) {
          setAviso('Te enviamos un correo para confirmar tu cuenta. Ábrelo, da clic en el enlace y luego entra aquí.')
          setModo('entrar')
        }
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
        <h2>{modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}</h2>

        <label>
          Correo
          <input type="email" autoFocus value={correo} onChange={(e) => setCorreo(e.target.value)} required />
        </label>
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

        {error && <p className="error">{error}</p>}
        {aviso && <p className="ok-texto">{aviso}</p>}

        <button type="submit" className="primario grande" disabled={enviando}>
          {enviando ? 'Un momento…' : modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </button>
        <button
          type="button"
          className="enlace centro"
          onClick={() => {
            setModo(modo === 'entrar' ? 'registro' : 'entrar')
            setError('')
          }}
        >
          {modo === 'entrar' ? '¿No tienes cuenta? Crea una' : '¿Ya tienes cuenta? Entra'}
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
