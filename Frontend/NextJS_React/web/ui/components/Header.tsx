'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
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

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const isAdmin      = user.role === 'ADMIN' || user.role === 'SUPERADMIN'
  const isSuperAdmin = user.role === 'SUPERADMIN'

  const isActive = (path: string) => mounted && pathname === path ? styles.active : ''

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
          <Link href="/dashboard" className={`${styles.navLink} ${isActive('/dashboard')}`}>Dashboard</Link>
          <Link href="/productos" className={`${styles.navLink} ${isActive('/productos')}`}>Productos</Link>
          <Link href="/caja" className={`${styles.navLink} ${isActive('/caja')}`}>Caja</Link>
          <Link href="/ventas" className={`${styles.navLink} ${isActive('/ventas')}`}>Ventas</Link>
          <Link href="/pagos" className={`${styles.navLink} ${isActive('/pagos')}`}>Pagos</Link>

          {isAdmin && (
            <Link href="/dashboard/acceso" className={`${styles.navLink} ${isActive('/dashboard/acceso')}`}>Acceso</Link>
          )}

          {isSuperAdmin && (
            <Link href="/panel" className={`${styles.navLink} ${isActive('/panel')}`}>⚙️ Panel</Link>
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
