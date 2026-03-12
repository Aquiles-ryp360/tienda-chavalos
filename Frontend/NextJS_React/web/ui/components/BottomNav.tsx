'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import styles from './bottomNav.module.css'

interface BottomNavProps {
  userRole: string
  isCartOpen?: boolean
}

export function BottomNav({ userRole, isCartOpen = false }: BottomNavProps) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const isActive = (path: string) => mounted && pathname === path ? styles.active : ''

  return (
    <nav className={`${styles.bottomNav} ${isCartOpen ? styles.hidden : ''}`}>
      <Link href="/dashboard" className={`${styles.navItem} ${isActive('/dashboard')}`}>
        <span className={styles.icon}>📊</span>
        <span className={styles.label}>Inicio</span>
      </Link>

      <Link href="/productos" className={`${styles.navItem} ${isActive('/productos')}`}>
        <span className={styles.icon}>📦</span>
        <span className={styles.label}>Productos</span>
      </Link>

      <Link href="/caja" className={`${styles.navItem} ${isActive('/caja')}`}>
        <span className={styles.icon}>💰</span>
        <span className={styles.label}>Caja</span>
      </Link>

      <Link href="/ventas" className={`${styles.navItem} ${isActive('/ventas')}`}>
        <span className={styles.icon}>🧾</span>
        <span className={styles.label}>Ventas</span>
      </Link>

      <Link href="/pagos" className={`${styles.navItem} ${isActive('/pagos')}`}>
        <span className={styles.icon}>💳</span>
        <span className={styles.label}>Pagos</span>
      </Link>

      {(userRole === 'ADMIN' || userRole === 'SUPERADMIN') && (
        <Link href="/dashboard/acceso" className={`${styles.navItem} ${isActive('/dashboard/acceso')}`}>
          <span className={styles.icon}>🔑</span>
          <span className={styles.label}>Acceso</span>
        </Link>
      )}

      {userRole === 'SUPERADMIN' && (
        <Link href="/panel" className={`${styles.navItem} ${isActive('/panel')}`}>
          <span className={styles.icon}>⚙️</span>
          <span className={styles.label}>Panel</span>
        </Link>
      )}
    </nav>
  )
}
