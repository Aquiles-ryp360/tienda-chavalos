'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/ui/components/Header'
import { BottomNav } from '@/ui/components/BottomNav'
import { Button } from '@/ui/components/Button'
import { ReceiptPreview } from '@/ui/components/ReceiptPreview'
import { EditReceiptModal } from '@/ui/components/EditReceiptModal'
import { generateSalePDF } from '@/lib/pdf-generator'
import { formatMoneyPEN } from '@/lib/format-money'
import styles from './ventas.module.css'

interface Sale {
  id: string
  saleNumber: string
  createdAt: string
  customerName?: string
  customerDocType?: string | null
  customerDocNumber?: string | null
  customerAddress?: string | null
  institutionName?: string | null
  observations?: string | null
  paymentMethod: string
  total: number
  user: {
    fullName: string
  }
}

interface SaleDetail extends Sale {
  subtotal: number
  tax: number
  items: Array<{
    id: string
    soldUnit: string
    soldQty: number
    baseQty: number
    unitPrice: number
    subtotal: number
    product: {
      sku: string
      name: string
      unit: string
    }
    presentation?: {
      name: string
      factorToBase: number
    }
  }>
}

interface VentasViewProps {
  user: {
    fullName: string
    role: string
  }
  initialSales?: Sale[]
}

export function VentasView({ user, initialSales = [] }: VentasViewProps) {
  const [sales, setSales] = useState<Sale[]>(initialSales)
  const [loading, setLoading] = useState(initialSales.length === 0)
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  const docTypeLabels: Record<string, string> = {
    DNI: 'DNI',
    RUC: 'RUC',
    PASAPORTE: 'Pasaporte',
    OTRO: 'Otro',
  }

  const formatDocType = (docType?: string | null) => {
    if (!docType) return '-'
    return docTypeLabels[docType] ?? docType
  }

  useEffect(() => {
    if (initialSales.length === 0) {
      loadSales()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSales = async () => {
    try {
      const res = await fetch('/api/sales?limit=50', {
        credentials: 'include',
      })
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      // Normalizar totales a number
      const normalizedSales = (data.sales || []).map((sale: any) => ({
        ...sale,
        total: Number(sale.total ?? 0),
      }))
      setSales(normalizedSales)
    } catch (error) {
      console.error('Error cargando ventas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetail = async (saleId: string) => {
    try {
      const res = await fetch(`/api/sales/${saleId}`, {
        credentials: 'include',
      })
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      // Normalizar todos los campos numéricos
      const normalized = {
        ...data,
        total: Number(data.total ?? 0),
        subtotal: Number(data.subtotal ?? 0),
        tax: Number(data.tax ?? 0),
        items: (data.items || []).map((item: any) => ({
          ...item,
          soldQty: Number(item.soldQty ?? 0),
          baseQty: Number(item.baseQty ?? 0),
          unitPrice: Number(item.unitPrice ?? 0),
          subtotal: Number(item.subtotal ?? 0),
          presentation: item.presentation ? {
            ...item.presentation,
            factorToBase: Number(item.presentation.factorToBase ?? 0),
          } : undefined,
        })),
      }
      setSelectedSale(normalized)
      setShowEditModal(false)
    } catch (error) {
      console.error('Error cargando detalle:', error)
    }
  }

  const handleDownloadPDF = () => {
    if (!selectedSale) return

    // Use most recent selectedSale data to ensure edits are included
    const saleData = {
      ...selectedSale,
      createdAt: new Date(selectedSale.createdAt),
      items: selectedSale.items.map(item => ({
        ...item,
        product: item.product,
      }))
    }

    const pdf = generateSalePDF(saleData)
    pdf.save(`Venta_${saleData.saleNumber}.pdf`)
  }

  const handleSaveReceipt = (updatedSale: Partial<SaleDetail>) => {
    setSelectedSale((prev) => (prev ? { ...prev, ...updatedSale } as SaleDetail : prev))
    setShowEditModal(false)
    loadSales()
  }

  return (
    <>
      <Header user={user} />

      <div className={styles.container}>
        <h1 className={styles.title}>Historial de Ventas</h1>

        {loading ? (
          <div className={styles.loading}>Cargando ventas...</div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className={styles.salesGrid}>
              {sales.map((sale) => (
                <div 
                  key={sale.id} 
                  className={styles.saleCard}
                  onClick={() => handleViewDetail(sale.id)}
                >
                  <div className={styles.saleCardHeader}>
                    <div className={styles.saleNumber}>{sale.saleNumber}</div>
                    <div className={styles.saleDate}>
                      {new Date(sale.createdAt).toLocaleDateString('es-NI', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                      <br />
                      {new Date(sale.createdAt).toLocaleTimeString('es-NI', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  
                  <div className={styles.saleCardBody}>
                    <div className={styles.saleInfo}>
                      <span className={styles.saleInfoLabel}>Cliente</span>
                      <span className={styles.saleInfoValue}>{sale.customerName || 'No especificado'}</span>
                    </div>
                    <div className={styles.saleInfo}>
                      <span className={styles.saleInfoLabel}>Método</span>
                      <span className={styles.saleInfoValue}>{sale.paymentMethod}</span>
                    </div>
                    <div className={styles.saleInfo}>
                      <span className={styles.saleInfoLabel}>Vendedor</span>
                      <span className={styles.saleInfoValue}>{sale.user.fullName}</span>
                    </div>
                  </div>

                  <div className={styles.saleTotal}>
                    <span className={styles.saleTotalLabel}>Total</span>
                    <span className={styles.saleTotalValue}>{formatMoneyPEN(sale.total)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className={styles.table}>
              <table>
                <thead>
                  <tr>
                    <th>Nº Venta</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Método de Pago</th>
                    <th>Total</th>
                    <th>Vendedor</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.saleNumber}</td>
                      <td>
                        {new Date(sale.createdAt).toLocaleString('es-NI')}
                      </td>
                      <td>{sale.customerName || '-'}</td>
                      <td>{sale.paymentMethod}</td>
                      <td>{formatMoneyPEN(sale.total)}</td>
                      <td>{sale.user.fullName}</td>
                      <td>
                        <div className={styles.actions}>
                          <Button
                            size="small"
                            variant="outline"
                            onClick={() => handleViewDetail(sale.id)}
                          >
                            Ver Detalle
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {selectedSale && (
          <div className={styles.modal} onClick={() => setSelectedSale(null)}>
            <div
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>
                  Detalle de Venta {selectedSale.saleNumber}
                </h2>
                <span
                  className={styles.closeBtn}
                  onClick={() => setSelectedSale(null)}
                >
                  ×
                </span>
              </div>

              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Fecha</span>
                  <span className={styles.detailValue}>
                    {new Date(selectedSale.createdAt).toLocaleString('es-NI')}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Vendedor</span>
                  <span className={styles.detailValue}>
                    {selectedSale.user.fullName}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Cliente</span>
                  <span className={styles.detailValue}>
                    {selectedSale.customerName || '-'}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Doc. Cliente</span>
                  <span className={styles.detailValue}>
                    {formatDocType(selectedSale.customerDocType)}
                    {selectedSale.customerDocNumber ? ` • ${selectedSale.customerDocNumber}` : ''}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Método de Pago</span>
                  <span className={styles.detailValue}>
                    {selectedSale.paymentMethod}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Dirección</span>
                  <span className={styles.detailValue}>
                    {selectedSale.customerAddress || '-'}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Institución</span>
                  <span className={styles.detailValue}>
                    {selectedSale.institutionName || '-'}
                  </span>
                </div>

                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Observaciones</span>
                  <span className={styles.detailValue}>
                    {selectedSale.observations || '-'}
                  </span>
                </div>
              </div>

              <div className={styles.itemsTable}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Unidad</th>
                      <th>Precio Unit.</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSale.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.product.sku}</td>
                        <td>{item.product.name}</td>
                        <td>{item.soldQty.toFixed(3)}</td>
                        <td>{item.soldUnit}</td>
                        <td>{formatMoneyPEN(item.unitPrice)}</td>
                        <td>{formatMoneyPEN(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.totalsSection}>
                <div className={styles.totalRow}>
                  <span className={styles.totalLabel}>Subtotal:</span>
                  <span className={styles.totalValue}>
                    {formatMoneyPEN(selectedSale.subtotal)}
                  </span>
                </div>

                {selectedSale.tax > 0 && (
                  <div className={styles.totalRow}>
                    <span className={styles.totalLabel}>IVA:</span>
                    <span className={styles.totalValue}>
                      {formatMoneyPEN(selectedSale.tax)}
                    </span>
                  </div>
                )}

                <div className={`${styles.totalRow} ${styles.grandTotal}`}>
                  <span className={styles.totalLabel}>Total:</span>
                  <span className={styles.totalValue}>
                    {formatMoneyPEN(selectedSale.total)}
                  </span>
                </div>
              </div>

              <div className={styles.itemsTable} style={{ marginTop: '1.5rem' }}>
                <div className={styles.modalHeader} style={{ padding: 0, marginBottom: '0.5rem' }}>
                  <h3 className={styles.modalTitle} style={{ fontSize: '1rem' }}>Vista previa de boleta</h3>
                </div>

                <ReceiptPreview
                  sale={{
                    ...selectedSale,
                  }}
                />
              </div>

              <div className={styles.modalActions}>
                <Button variant="outline" onClick={() => setSelectedSale(null)}>
                  Cerrar
                </Button>
                <Button variant="secondary" onClick={() => setShowEditModal(true)}>
                  ✏️ Editar boleta
                </Button>
                <Button variant="primary" onClick={handleDownloadPDF}>
                  📄 Descargar PDF
                </Button>
              </div>
            </div>
          </div>
        )}

        {showEditModal && selectedSale && (
          <EditReceiptModal
            saleId={selectedSale.id}
            initialData={{
              customerName: selectedSale.customerName,
              customerDocType: selectedSale.customerDocType,
              customerDocNumber: selectedSale.customerDocNumber,
              customerAddress: selectedSale.customerAddress,
              institutionName: selectedSale.institutionName,
              observations: selectedSale.observations,
            }}
            onSave={handleSaveReceipt}
            onClose={() => setShowEditModal(false)}
          />
        )}
      </div>
      
      <BottomNav userRole={user.role} />
    </>
  )
}
