'use client'

import { useState, useRef, FormEvent } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import styles from './panel.module.css'

interface Stats {
  totalUsuarios:  number
  totalProductos: number
  totalVentas:    number
  totalForo:      number
}

interface Props {
  user:  { fullName: string; role: string }
  stats: Stats
}

interface ImportResult {
  procesados:    number
  creados:       number
  actualizados:  number
  errores:       string[]
  ok:            boolean
}

export function PanelView({ user, stats }: Props) {
  const [csvFile,       setCsvFile]       = useState<File | null>(null)
  const [importing,     setImporting]     = useState(false)
  const [importResult,  setImportResult]  = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = async (e: FormEvent) => {
    e.preventDefault()
    if (!csvFile) return
    setImporting(true)
    setImportResult(null)

    const form = new FormData()
    form.append('archivo', csvFile)

    try {
      const res = await fetch('/api/superadmin/importar-productos', { method: 'POST', body: form })
      const data: ImportResult = await res.json()
      setImportResult(data)
      if (data.ok) { setCsvFile(null); if (fileRef.current) fileRef.current.value = '' }
    } catch {
      setImportResult({ procesados: 0, creados: 0, actualizados: 0, errores: ['Error de red'], ok: false })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.badge}>SUPERADMIN</span>
          <div>
            <h1 className={styles.headerTitle}>Panel de Control</h1>
            <p className={styles.headerSub}>Bienvenido, {user.fullName}</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <Link href="/dashboard" className={styles.btnDash}>
            📊 Dashboard
          </Link>
          <button
            className={styles.btnLogout}
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            Salir
          </button>
        </div>
      </header>

      <main className={styles.main}>

        {/* ── Stats ── */}
        <section className={styles.statsGrid}>
          {[
            { label: 'Usuarios',   val: stats.totalUsuarios,  icon: '👥', color: '#6366f1' },
            { label: 'Productos',  val: stats.totalProductos, icon: '📦', color: '#0ea5e9' },
            { label: 'Ventas',     val: stats.totalVentas,    icon: '🧾', color: '#10b981' },
            { label: 'Posts foro', val: stats.totalForo,      icon: '💬', color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} className={styles.statCard} style={{ '--accent': s.color } as React.CSSProperties}>
              <span className={styles.statIcon}>{s.icon}</span>
              <span className={styles.statVal}>{s.val}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </section>

        {/* ── Herramientas ── */}
        <section className={styles.toolsGrid}>

          {/* Control de Acceso */}
          <div className={styles.toolCard}>
            <div className={styles.toolHeader}>
              <span className={styles.toolIcon}>🔑</span>
              <div>
                <h2 className={styles.toolTitle}>Control de Acceso</h2>
                <p className={styles.toolDesc}>Asigna correos Google, roles y activa/desactiva usuarios</p>
              </div>
            </div>
            <div className={styles.toolLinks}>
              <Link href="/dashboard/acceso" className={styles.btnPrimary}>
                Gestionar usuarios →
              </Link>
            </div>
          </div>

          {/* Importación masiva */}
          <div className={styles.toolCard}>
            <div className={styles.toolHeader}>
              <span className={styles.toolIcon}>📦</span>
              <div>
                <h2 className={styles.toolTitle}>Importar Productos en Masa</h2>
                <p className={styles.toolDesc}>Sube un CSV para crear o actualizar muchos productos a la vez</p>
              </div>
            </div>

            <form onSubmit={handleImport} className={styles.importForm}>
              <div className={styles.csvFormat}>
                <strong>Formato del CSV:</strong>
                <code>sku, nombre, precio, stock, stock_minimo, unidad, descripcion</code>
                <small>Unidades: UNIDAD · METRO · LITRO · KILO · CAJA · PAQUETE · ROLLO</small>
                <small>Si el SKU ya existe, el producto se <em>actualiza</em>. Si no, se <em>crea</em>.</small>
              </div>

              <label className={styles.fileLabel}>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className={styles.fileInput}
                  onChange={e => { setCsvFile(e.target.files?.[0] ?? null); setImportResult(null) }}
                />
                <span className={styles.fileTrigger}>
                  {csvFile ? `✓ ${csvFile.name}` : '📂 Seleccionar archivo CSV'}
                </span>
              </label>

              <button
                type="submit"
                className={styles.btnImport}
                disabled={!csvFile || importing}
              >
                {importing ? 'Importando...' : 'Importar productos'}
              </button>
            </form>

            {importResult && (
              <div className={`${styles.importResult} ${importResult.ok ? styles.resultOk : styles.resultWarn}`}>
                <p><strong>{importResult.procesados}</strong> procesados — <strong className={styles.green}>{importResult.creados}</strong> creados — <strong className={styles.blue}>{importResult.actualizados}</strong> actualizados</p>
                {importResult.errores.length > 0 && (
                  <ul className={styles.errorList}>
                    {importResult.errores.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Catálogo público */}
          <div className={styles.toolCard}>
            <div className={styles.toolHeader}>
              <span className={styles.toolIcon}>🛒</span>
              <div>
                <h2 className={styles.toolTitle}>Tienda Pública</h2>
                <p className={styles.toolDesc}>Ver el catálogo como lo ven los clientes</p>
              </div>
            </div>
            <div className={styles.toolLinks}>
              <Link href="/tienda" target="_blank" className={styles.btnSecondary}>
                Abrir tienda →
              </Link>
            </div>
          </div>

          {/* Dashboard operativo */}
          <div className={styles.toolCard}>
            <div className={styles.toolHeader}>
              <span className={styles.toolIcon}>⚙️</span>
              <div>
                <h2 className={styles.toolTitle}>Panel Operativo</h2>
                <p className={styles.toolDesc}>Ventas, caja, productos e inventario</p>
              </div>
            </div>
            <div className={styles.toolLinks}>
              <Link href="/dashboard" className={styles.btnSecondary}>Inicio</Link>
              <Link href="/productos"  className={styles.btnSecondary}>Productos</Link>
              <Link href="/ventas"     className={styles.btnSecondary}>Ventas</Link>
            </div>
          </div>

        </section>
      </main>
    </div>
  )
}
