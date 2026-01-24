'use client'

import { useRouter } from 'next/navigation'
import { Header } from '@/ui/components/Header'
import { BottomNav } from '@/ui/components/BottomNav'
import { formatMoneyPEN } from '@/lib/format-money'
import styles from './dashboard.module.css'

interface DashboardData {
  productsCount: number
  lowStockCount: number
  todaySales: number
  todayRevenue: number
  lowStockProducts: Array<{
    id: string
    sku: string
    name: string
    stock: number
    minStock: number
    unit: string | any
  }>
}

interface DashboardViewProps {
  user: {
    fullName: string
    role: string
  }
  data: DashboardData
}

export function DashboardView({ user, data }: DashboardViewProps) {
  const router = useRouter()

  const handleGenerateLowStockPDF = () => {
    if (data.lowStockProducts.length === 0) {
      return
    }

    // Generar PDF simple con window.print y CSS
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte de Stock Bajo</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }
          h1 {
            text-align: center;
            color: #1f2937;
            margin-bottom: 30px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #f3f4f6;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
          }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Reporte de Productos con Stock Bajo</h1>
        <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-PE')}</p>
        <p><strong>Total de productos:</strong> ${data.lowStockProducts.length}</p>
        
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Nombre</th>
              <th>Stock Actual</th>
              <th>Stock Mínimo</th>
              <th>Unidad</th>
            </tr>
          </thead>
          <tbody>
            ${data.lowStockProducts
              .map(
                (p) => `
              <tr>
                <td>${p.sku}</td>
                <td>${p.name}</td>
                <td style="color: #ef4444; font-weight: bold;">${p.stock}</td>
                <td>${p.minStock}</td>
                <td>${p.unit}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>Ferretería Chavalos - Sistema de Gestión</p>
        </div>
        
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
  }

  const handleNavigateToTodaySales = () => {
    const today = new Date().toISOString().split('T')[0]
    router.push(`/ventas?date=${today}`)
  }

  const handleNavigateToProducts = () => {
    router.push('/productos')
  }

  return (
    <>
      <Header user={user} />

      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Dashboard</h1>
            <p className={styles.subtitle}>Resumen general del sistema</p>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <button
            className={`${styles.statCard} ${styles.clickable}`}
            onClick={handleNavigateToProducts}
            title="Ver todos los productos"
          >
            <div className={styles.statIcon}>📦</div>
            <div className={styles.statValue}>{data.productsCount}</div>
            <div className={styles.statLabel}>Productos Activos</div>
            <div className={styles.statAction}>Ver productos →</div>
          </button>

          <button
            className={`${styles.statCard} ${
              data.lowStockCount > 0 ? styles.clickable : ''
            } ${data.lowStockCount > 0 ? styles.warning : ''}`}
            onClick={data.lowStockCount > 0 ? handleGenerateLowStockPDF : undefined}
            disabled={data.lowStockCount === 0}
            title={
              data.lowStockCount > 0
                ? 'Generar PDF de stock bajo'
                : 'No hay productos con stock bajo'
            }
          >
            <div className={styles.statIcon}>⚠️</div>
            <div className={styles.statValue}>{data.lowStockCount}</div>
            <div className={styles.statLabel}>Stock Bajo</div>
            {data.lowStockCount > 0 && (
              <div className={styles.statAction}>Generar PDF →</div>
            )}
          </button>

          <button
            className={`${styles.statCard} ${
              data.todaySales > 0 ? styles.clickable : ''
            }`}
            onClick={data.todaySales > 0 ? handleNavigateToTodaySales : undefined}
            disabled={data.todaySales === 0}
            title={
              data.todaySales > 0
                ? 'Ver ventas de hoy'
                : 'No hay ventas hoy'
            }
          >
            <div className={styles.statIcon}>🛒</div>
            <div className={styles.statValue}>{data.todaySales}</div>
            <div className={styles.statLabel}>Ventas Hoy</div>
            {data.todaySales > 0 && (
              <div className={styles.statAction}>Ver ventas →</div>
            )}
          </button>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>💰</div>
            <div className={styles.statValue}>{formatMoneyPEN(data.todayRevenue)}</div>
            <div className={styles.statLabel}>Ingresos Hoy</div>
          </div>
        </div>

        {data.lowStockProducts.length > 0 && (
          <div className={styles.alertsSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Alertas de Stock Bajo</h2>
              <button
                className={styles.btnSecondary}
                onClick={handleGenerateLowStockPDF}
              >
                📄 Generar PDF
              </button>
            </div>

            <div className={styles.alertsList}>
              {data.lowStockProducts.slice(0, 5).map((product) => (
                <div key={product.id} className={styles.alertCard}>
                  <div className={styles.alertIcon}>⚠️</div>
                  <div className={styles.alertContent}>
                    <div className={styles.alertTitle}>
                      {product.sku} - {product.name}
                    </div>
                    <div className={styles.alertText}>
                      Stock: {product.stock} {product.unit} | Mínimo:{' '}
                      {product.minStock} {product.unit}
                    </div>
                  </div>
                </div>
              ))}
              {data.lowStockProducts.length > 5 && (
                <div className={styles.alertMore}>
                  +{data.lowStockProducts.length - 5} productos más
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNav userRole={user.role} />
    </>
  )
}
