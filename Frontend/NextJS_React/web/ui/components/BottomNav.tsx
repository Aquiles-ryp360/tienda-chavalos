'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './bottomNav.module.css'

interface BottomNavProps {
  userRole: string
  isCartOpen?: boolean
}

export function BottomNav({ userRole, isCartOpen = false }: BottomNavProps) {
  const pathname = usePathname()

  return (
    <nav className={`${styles.bottomNav} ${isCartOpen ? styles.hidden : ''}`}>
      <Link
        href="/dashboard"
        className={`${styles.navItem} ${
          pathname === '/dashboard' ? styles.active : ''
        }`}
      >
        <span className={styles.icon}>📊</span>
        <span className={styles.label}>Inicio</span>
      </Link>

      {userRole === 'ADMIN' && (
        <Link
          href="/productos"
          className={`${styles.navItem} ${
            pathname === '/productos' ? styles.active : ''
          }`}
        >
          <span className={styles.icon}>📦</span>
          <span className={styles.label}>Productos</span>
        </Link>
      )}

      <Link
        href="/caja"
        className={`${styles.navItem} ${
          pathname === '/caja' ? styles.active : ''
        }`}
      >
        <span className={styles.icon}>💰</span>
        <span className={styles.label}>Caja</span>
      </Link>

      <Link
        href="/ventas"
        className={`${styles.navItem} ${
          pathname === '/ventas' ? styles.active : ''
        }`}
      >
        <span className={styles.icon}>🧾</span>
        <span className={styles.label}>Ventas</span>
      </Link>
    </nav>
  )
}
