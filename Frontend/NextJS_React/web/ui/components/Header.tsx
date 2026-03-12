'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import styles from './header.module.css'
import { Button } from './Button'

interface HeaderProps {
  user: {
    fullName: string
    role: string
  }
}

export function Header({ user }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()

  const isAdmin      = user.role === 'ADMIN' || user.role === 'SUPERADMIN'
  const isSuperAdmin = user.role === 'SUPERADMIN'

  const handleLogout = async () => {
    try {
      // Cerrar cookie HMAC propia (login usuario/contraseña)
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      // Cerrar sesión de NextAuth (Google OAuth) — redirige a /login
      await signOut({ callbackUrl: '/login' })
    } catch {
      router.push('/login')
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/dashboard" className={styles.brand}>
          🔧 Ferretería Chavalos
        </Link>

        {/* Desktop Navigation - Oculto en móvil */}
        <nav className={styles.nav}>
          <Link
            href="/dashboard"
            className={`${styles.navLink} ${
              pathname === '/dashboard' ? styles.active : ''
            }`}
          >
            Dashboard
          </Link>

          {isAdmin && (
            <Link
              href="/productos"
              className={`${styles.navLink} ${
                pathname === '/productos' ? styles.active : ''
              }`}
            >
              Productos
            </Link>
          )}

          <Link
            href="/caja"
            className={`${styles.navLink} ${
              pathname === '/caja' ? styles.active : ''
            }`}
          >
            Caja
          </Link>

          <Link
            href="/ventas"
            className={`${styles.navLink} ${
              pathname === '/ventas' ? styles.active : ''
            }`}
          >
            Ventas
          </Link>

          <Link
            href="/pagos"
            className={`${styles.navLink} ${
              pathname === '/pagos' ? styles.active : ''
            }`}
          >
            Pagos
          </Link>

          {isAdmin && (
            <Link
              href="/dashboard/acceso"
              className={`${styles.navLink} ${
                pathname === '/dashboard/acceso' ? styles.active : ''
              }`}
            >
              Acceso
            </Link>
          )}

          {isSuperAdmin && (
            <Link
              href="/panel"
              className={`${styles.navLink} ${
                pathname === '/panel' ? styles.active : ''
              }`}
            >
              ⚙️ Panel
            </Link>
          )}
        </nav>

        <div className={styles.userInfo}>
          <div className={styles.userDetails}>
            <div className={styles.userName}>{user.fullName}</div>
            <div className={styles.userRole}>{user.role}</div>
          </div>
          <Button variant="outline" size="small" onClick={handleLogout}>
            Salir
          </Button>
        </div>
      </div>
    </header>
  )
}
