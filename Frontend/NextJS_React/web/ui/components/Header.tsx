'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      router.push('/login')
    } catch (error) {
      console.error('Error al cerrar sesión:', error)
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

          {user.role === 'ADMIN' && (
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
