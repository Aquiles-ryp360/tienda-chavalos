'use client'

import { useState, useEffect, useCallback, FormEvent } from 'react'
import { Header } from '@/ui/components/Header'
import { BottomNav } from '@/ui/components/BottomNav'
import styles from './acceso.module.css'

interface UsuarioAcceso {
  id:          string
  username:    string
  fullName:    string
  role:        'ADMIN' | 'CAJERO'
  googleEmail: string | null
  isActive:    boolean
}

interface Props {
  user: { fullName: string; role: string }
}

export function AccesoView({ user }: Props) {
  const [usuarios,      setUsuarios]      = useState<UsuarioAcceso[]>([])
  const [loading,       setLoading]       = useState(true)
  const [toast,         setToast]         = useState('')

  // Form nuevo usuario
  const [showForm, setShowForm]         = useState(false)
  const [nuevoNombre, setNuevoNombre]   = useState('')
  const [nuevoEmail,  setNuevoEmail]    = useState('')
  const [nuevoRol,    setNuevoRol]      = useState<'ADMIN' | 'CAJERO'>('CAJERO')
  const [saving,      setSaving]        = useState(false)

  // Edición inline de email
  const [editingId,    setEditingId]    = useState<string | null>(null)
  const [editingEmail, setEditingEmail] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/usuarios')
    if (res.ok) setUsuarios(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const actualizarUsuario = async (id: string, data: Partial<UsuarioAcceso>) => {
    const res = await fetch(`/api/admin/usuarios/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    })
    if (res.ok) {
      const updated: UsuarioAcceso = await res.json()
      setUsuarios(prev => prev.map(u => u.id === id ? updated : u))
      showToast('✓ Guardado')
    } else {
      const e = await res.json().catch(() => ({}))
      showToast(`Error: ${e.error ?? 'No se pudo guardar'}`)
    }
  }

  const quitarAcceso = async (id: string) => {
    const res = await fetch(`/api/admin/usuarios/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const updated: UsuarioAcceso = await res.json()
      setUsuarios(prev => prev.map(u => u.id === id ? updated : u))
      showToast('✓ Acceso Google revocado')
    } else {
      showToast('Error al revocar acceso')
    }
  }

  const guardarEmail = async (id: string) => {
    if (!editingEmail.includes('@')) { showToast('Correo inválido'); return }
    await actualizarUsuario(id, { googleEmail: editingEmail.trim().toLowerCase() })
    setEditingId(null)
  }

  const crearNuevo = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/admin/usuarios', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fullName: nuevoNombre, googleEmail: nuevoEmail, role: nuevoRol }),
    })
    if (res.ok) {
      showToast('✓ Usuario creado')
      setNuevoNombre(''); setNuevoEmail(''); setNuevoRol('CAJERO'); setShowForm(false)
      cargar()
    } else {
      const e = await res.json().catch(() => ({}))
      showToast(`Error: ${e.error ?? 'No se pudo crear'}`)
    }
    setSaving(false)
  }

  const ROLE_LABELS: Record<string, string> = { ADMIN: 'Admin', CAJERO: 'Cajero' }

  return (
    <div className={styles.page}>
      <Header user={user} />

      <main className={styles.main}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.title}>Control de Acceso</h1>
            <p className={styles.subtitle}>Administra quién puede entrar con Google</p>
          </div>
          <button className={styles.btnAdd} onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Cancelar' : '+ Nuevo acceso'}
          </button>
        </div>

        {/* Formulario nuevo usuario Google */}
        {showForm && (
          <form className={styles.form} onSubmit={crearNuevo}>
            <h3 className={styles.formTitle}>Nuevo usuario con Google</h3>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Nombre completo</label>
                <input
                  type="text" required
                  placeholder="María López"
                  value={nuevoNombre}
                  onChange={e => setNuevoNombre(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>Correo Google</label>
                <input
                  type="email" required
                  placeholder="maria@gmail.com"
                  value={nuevoEmail}
                  onChange={e => setNuevoEmail(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>Rol</label>
                <select value={nuevoRol} onChange={e => setNuevoRol(e.target.value as 'ADMIN' | 'CAJERO')}>
                  <option value="CAJERO">Cajero</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            <button type="submit" className={styles.btnSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Crear usuario'}
            </button>
          </form>
        )}

        {/* Tabla de usuarios */}
        {loading ? (
          <p className={styles.loading}>Cargando...</p>
        ) : (
          <div className={styles.tableWrap}>
            {usuarios.map(u => (
              <div key={u.id} className={`${styles.row} ${!u.isActive ? styles.rowInactive : ''}`}>
                {/* Identidad */}
                <div className={styles.rowMain}>
                  <span className={styles.rowName}>{u.fullName}</span>
                  <span className={styles.rowUser}>@{u.username}</span>
                </div>

                {/* Rol */}
                <select
                  className={`${styles.roleSelect} ${styles[`role${u.role}`]}`}
                  value={u.role}
                  onChange={e => actualizarUsuario(u.id, { role: e.target.value as 'ADMIN' | 'CAJERO' })}
                >
                  <option value="CAJERO">Cajero</option>
                  <option value="ADMIN">Admin</option>
                </select>

                {/* Google Email */}
                <div className={styles.emailCell}>
                  {editingId === u.id ? (
                    <div className={styles.emailEdit}>
                      <input
                        type="email"
                        autoFocus
                        value={editingEmail}
                        onChange={e => setEditingEmail(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') guardarEmail(u.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        placeholder="correo@gmail.com"
                      />
                      <button className={styles.btnOk} onClick={() => guardarEmail(u.id)}>✓</button>
                      <button className={styles.btnCancel} onClick={() => setEditingId(null)}>✕</button>
                    </div>
                  ) : u.googleEmail ? (
                    <div className={styles.emailSet}>
                      <span className={styles.googleDot}>G</span>
                      <span
                        className={styles.emailText}
                        onClick={() => { setEditingId(u.id); setEditingEmail(u.googleEmail!) }}
                        title="Clic para editar"
                      >
                        {u.googleEmail}
                      </span>
                      <button
                        className={styles.btnRevoke}
                        onClick={() => quitarAcceso(u.id)}
                        title="Quitar acceso Google"
                      >✕</button>
                    </div>
                  ) : (
                    <button
                      className={styles.btnAssign}
                      onClick={() => { setEditingId(u.id); setEditingEmail('') }}
                    >
                      + Asignar correo Google
                    </button>
                  )}
                </div>

                {/* Activo/Inactivo */}
                <label className={styles.toggle} title={u.isActive ? 'Activo' : 'Inactivo'}>
                  <input
                    type="checkbox"
                    checked={u.isActive}
                    onChange={e => actualizarUsuario(u.id, { isActive: e.target.checked })}
                  />
                  <span className={styles.toggleSlider} />
                </label>
              </div>
            ))}
          </div>
        )}

        <p className={styles.hint}>
          💡 Solo los correos asignados aquí pueden entrar con Google. Cualquier otro será redirigido a la tienda pública.
        </p>
      </main>

      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}

      <BottomNav userRole={user.role} />
    </div>
  )
}
