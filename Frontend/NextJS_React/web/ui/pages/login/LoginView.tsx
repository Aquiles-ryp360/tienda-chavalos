'use client'

import { useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/ui/components/Button'
import styles from './login.module.css'

export function LoginView() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const oauthError   = searchParams.get('error')

  const [username,        setUsername]        = useState('')
  const [password,        setPassword]        = useState('')
  const [error,           setError]           = useState('')
  const [loading,         setLoading]         = useState(false)
  const [googleLoading,   setGoogleLoading]   = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión')
        return
      }

      router.push('/dashboard')
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>🔧 Ferretería Chavalos</h1>
          <p className={styles.subtitle}>Acceso al sistema</p>
        </div>

        {/* Error de OAuth (email no autorizado u otro) */}
        {oauthError && (
          <div className={styles.error}>
            {oauthError === 'oauth' || oauthError === 'OAuthCallbackError'
              ? 'Error en la autenticación con Google. Intenta de nuevo.'
              : oauthError === 'AccessDenied'
              ? 'Tu cuenta de Google no está autorizada. Contacta al administrador.'
              : 'Error al iniciar sesión con Google.'}
          </div>
        )}

        {/* Botón Google — navegación directa al endpoint de Auth.js */}
        <button
          type="button"
          className={styles.googleButton}
          disabled={googleLoading || loading}
          onClick={() => {
            setGoogleLoading(true)
            // Navega directamente al endpoint OAuth de Auth.js v5.
            // Más robusto que Server Action en todos los entornos (local, Vercel).
            window.location.href = '/api/auth/signin/google?callbackUrl=' + encodeURIComponent('/dashboard')
          }}
        >
          {googleLoading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Conectando...
            </span>
          ) : (
            <>
              <svg className={styles.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continuar con Google
            </>
          )}
        </button>

        {/* Divisor */}
        <div className={styles.divider}>
          <span>o ingresa con tu usuario</span>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formGroup}>
            <label className={styles.label}>Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={styles.input}
              required
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            className={styles.submitButton}
          >
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </Button>
        </form>

        <div className={styles.footer}>
          <p>Solo cuentas autorizadas pueden acceder</p>
        </div>
      </div>
    </div>
  )
}
