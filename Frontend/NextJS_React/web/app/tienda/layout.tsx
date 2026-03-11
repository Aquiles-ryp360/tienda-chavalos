import type { Metadata } from 'next'
import Link from 'next/link'
import styles from './tienda.module.css'

export const metadata: Metadata = {
  title: 'Tienda — Ferretería Chavalos',
  description: 'Catálogo de productos de Ferretería Chavalos. Encuentra herramientas, materiales y más.',
}

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/tienda" className={styles.logo}>
            <span className={styles.logoIcon}>🔧</span>
            <div className={styles.logoText}>
              <span className={styles.logoName}>Ferretería Chavalos</span>
              <span className={styles.logoTagline}>Catálogo de productos</span>
            </div>
          </Link>
          <nav className={styles.nav}>
            <Link href="/login" className={styles.navLink}>
              Panel admin →
            </Link>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        {children}
      </main>

      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} Ferretería Chavalos · Todos los derechos reservados</p>
      </footer>
    </div>
  )
}
