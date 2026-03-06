import { formatMoneyPEN } from '@/lib/format-money'
import styles from './receiptPreview.module.css'

interface ReceiptPreviewProps {
  sale: {
    saleNumber: string
    createdAt: string
    customerName?: string | null
    customerDocType?: string | null
    customerDocNumber?: string | null
    customerAddress?: string | null
    institutionName?: string | null
    observations?: string | null
    paymentMethod: string
    subtotal: number
    tax: number
    total: number
    items: Array<{
      soldUnit: string
      soldQty: number
      product: {
        name: string
      }
      presentation?: {
        name: string
      } | null
      unitPrice: number
      subtotal: number
    }>
    user: {
      fullName: string
    }
  }
}

export function ReceiptPreview({ sale }: ReceiptPreviewProps) {
  const to2 = (n: number) => Math.round(n * 100) / 100

  return (
    <div className={styles.preview}>
      {/* Encabezado */}
      <div className={styles.header}>
        <h2 className={styles.businessName}>FERRETERÍA CHAVALOS</h2>
        <p className={styles.businessInfo}>Dirección: Av. Principal #123, Ciudad</p>
        <p className={styles.businessInfo}>Teléfono: (505) 1234-5678</p>
      </div>

      <h3 className={styles.title}>NOTA DE VENTA</h3>
      <p className={styles.subtitle}>(Documento interno - No válido para efectos tributarios)</p>

      <div className={styles.divider} />

      {/* Info de venta */}
      <div className={styles.saleInfo}>
        <div className={styles.infoRow}>
          <span className={styles.label}>N° Venta:</span>
          <span>{sale.saleNumber}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Fecha:</span>
          <span>
            {new Date(sale.createdAt).toLocaleString('es-PE', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>Atendido por:</span>
          <span>{sale.user.fullName}</span>
        </div>
      </div>

      {/* Datos del cliente */}
      <div className={styles.sectionTitle}>DATOS DEL CLIENTE</div>
      <div className={styles.customerData}>
        <div className={styles.customerRow}>
          <div className={styles.customerField}>
            <span className={styles.label}>Cliente:</span>
            <span className={styles.value}>
              {sale.customerName || <span className={styles.empty}>No especificado</span>}
            </span>
          </div>
          <div className={styles.customerField}>
            <span className={styles.label}>Institución/Empresa:</span>
            <span className={styles.value}>
              {sale.institutionName || <span className={styles.empty}>—</span>}
            </span>
          </div>
        </div>

        <div className={styles.customerRow}>
          <div className={styles.customerField}>
            <span className={styles.label}>
              {sale.customerDocType || 'DNI'}:
            </span>
            <span className={styles.value}>
              {sale.customerDocNumber || <span className={styles.empty}>—</span>}
            </span>
          </div>
          <div className={styles.customerField}>
            <span className={styles.label}>Método de Pago:</span>
            <span className={styles.value}>{sale.paymentMethod}</span>
          </div>
        </div>

        <div className={styles.customerRow}>
          <div className={styles.customerFieldFull}>
            <span className={styles.label}>Dirección:</span>
            <span className={styles.value}>
              {sale.customerAddress || <span className={styles.empty}>—</span>}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Detalle / Tabla */}
      <div className={styles.sectionTitle}>DETALLE</div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Cant.</th>
            <th>U.M.</th>
            <th>Descripción</th>
            <th>P. Unit</th>
            <th>Importe</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, index) => {
            const qty = item.soldQty
            const qtyStr = qty % 1 === 0 ? qty.toFixed(0) : qty.toFixed(2).replace(/\.?0+$/, '')

            let description = item.product.name
            if (item.presentation) {
              description += ` (${item.presentation.name})`
            }

            return (
              <tr key={index}>
                <td className={styles.center}>{qtyStr}</td>
                <td className={styles.center}>{item.soldUnit}</td>
                <td>{description}</td>
                <td className={styles.right}>{formatMoneyPEN(to2(item.unitPrice))}</td>
                <td className={styles.right}>{formatMoneyPEN(to2(item.subtotal))}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Totales */}
      <div className={styles.totals}>
        <div className={styles.totalRow}>
          <span className={styles.label}>Subtotal:</span>
          <span className={styles.amount}>{formatMoneyPEN(to2(sale.subtotal))}</span>
        </div>
        {sale.tax > 0 && (
          <div className={styles.totalRow}>
            <span className={styles.label}>IGV (18%):</span>
            <span className={styles.amount}>{formatMoneyPEN(to2(sale.tax))}</span>
          </div>
        )}
        <div className={`${styles.totalRow} ${styles.grandTotal}`}>
          <span className={styles.label}>TOTAL:</span>
          <span className={styles.amount}>{formatMoneyPEN(to2(sale.total))}</span>
        </div>
      </div>

      {/* Observaciones */}
      {sale.observations && (
        <>
          <div className={styles.sectionTitle}>OBSERVACIONES</div>
          <div className={styles.observations}>{sale.observations}</div>
        </>
      )}

      {/* Pie */}
      <div className={styles.footer}>
        <p className={styles.thanks}>¡Gracias por su compra!</p>
        <p className={styles.disclaimer}>Documento interno / Nota de venta (no electrónica)</p>
      </div>
    </div>
  )
}
