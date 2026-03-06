import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatMoneyPEN } from './format-money'

/**
 * Datos de la venta para generar PDF
 */
interface SaleData {
  saleNumber: string
  createdAt: Date
  customerName?: string | null
  customerDocType?: string | null
  customerDocNumber?: string | null
  customerAddress?: string | null
  institutionName?: string | null
  observations?: string | null
  paymentMethod: string
  subtotal: number | string
  tax: number | string
  total: number | string
  items: Array<{
    product: {
      sku: string
      name: string
      unit: string
    }
    soldUnit: string
    soldQty: number | string
    baseQty: number | string
    unitPrice: number | string
    subtotal: number | string
    presentation?: {
      name: string
      factorToBase: number | string
    } | null
  }>
  user: {
    fullName: string
  }
}

/**
 * Opciones para generar el PDF
 */
interface PDFOptions {
  format?: 'A4' | 'TICKET'
}

/**
 * Helper: redondea a 2 decimales
 */
function to2(n: number): number {
  return Math.round(n * 100) / 100
}

function num(v: number | string | null | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function txt(v: string | null | undefined, fallback = 'S/N'): string {
  const s = (v ?? '').toString().trim()
  return s.length ? s : fallback
}

function formatDateTime(d: Date): string {
  try {
    return new Date(d).toLocaleString('es-PE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'S/N'
  }
}

/**
 * Formatea cantidades:
 * - enteros: "2"
 * - decimales: hasta 3 decimales, sin ceros extra (0.5, 1.25, 2.125)
 */
function formatQty(q: number): string {
  if (!Number.isFinite(q)) return '0'
  if (Math.abs(q % 1) < 1e-9) return q.toFixed(0)
  return q
    .toFixed(3)
    .replace(/\.?0+$/, '') // quita ceros finales
}

/**
 * Evita que el contenido choque con el footer o se salga
 */
function ensureSpace(doc: jsPDF, yPos: number, minSpace: number, topY = 18): number {
  const pageH = doc.internal.pageSize.getHeight()
  if (yPos + minSpace > pageH - 20) {
    doc.addPage()
    return topY
  }
  return yPos
}

/**
 * Genera un PDF de Nota de Venta estilo ferretería
 * NO es boleta electrónica, NO tiene elementos SUNAT
 */
export function generateSalePDF(sale: SaleData, options?: PDFOptions): jsPDF {
  const format = options?.format || 'A4'
  if (format === 'TICKET') return generateTicketPDF(sale)
  return generateA4PDF(sale)
}

/**
 * Genera PDF en formato A4 (vertical)
 */
function generateA4PDF(sale: SaleData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - 2 * margin
  let yPos = 18

  // ==================== ENCABEZADO ====================
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('FERRETERÍA CHAVALOS', pageWidth / 2, yPos, { align: 'center' })
  yPos += 6

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Dirección: Jr. Libertad 121, Limbani', pageWidth / 2, yPos, { align: 'center' })
  yPos += 4
  doc.text('Teléfono: +51 965 470 064 / +51 965 777 130', pageWidth / 2, yPos, { align: 'center' })
  yPos += 8

  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 7

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('NOTA DE PRE-VENTA', pageWidth / 2, yPos, { align: 'center' })
  yPos += 5

  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  doc.text('(Documento interno - No válido para efectos tributarios)', pageWidth / 2, yPos, {
    align: 'center',
  })
  doc.setTextColor(0, 0, 0)
  yPos += 8

  // ==================== INFO DE VENTA (AUTO TABLE) ====================
  yPos = ensureSpace(doc, yPos, 22)

  const dateStr = formatDateTime(sale.createdAt)

  autoTable(doc, {
    startY: yPos,
    theme: 'grid',
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 2,
      overflow: 'linebreak',
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      valign: 'middle',
    },
    body: [
      [
        { content: 'N° Venta:', styles: { fontStyle: 'bold' } },
        { content: txt(sale.saleNumber) },
        { content: 'Fecha:', styles: { fontStyle: 'bold' } },
        { content: txt(dateStr) },
      ],
      [
        { content: 'Atendido por:', styles: { fontStyle: 'bold' } },
        { content: txt(sale.user?.fullName), colSpan: 3 },
      ],
    ],
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 58 },
      2: { cellWidth: 16 },
      3: { cellWidth: contentWidth - (22 + 58 + 16) },
    },
  })

  yPos = (doc as any).lastAutoTable.finalY + 8

  // ==================== DATOS DEL CLIENTE ====================
  yPos = ensureSpace(doc, yPos, 30)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('DATOS DEL CLIENTE', margin, yPos)
  yPos += 4

  const customerText = txt(sale.customerName)
  const institutionText = txt(sale.institutionName)
  const docTypeLabel = txt(sale.customerDocType || 'DNI')
  const docNumberText = txt(sale.customerDocNumber)
  const addressText = txt(sale.customerAddress)
  const paymentText = txt(sale.paymentMethod)

  autoTable(doc, {
    startY: yPos,
    theme: 'grid',
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 2,
      overflow: 'linebreak',
      valign: 'middle',
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
    },
    body: [
      [
        { content: 'Cliente:', styles: { fontStyle: 'bold' } },
        { content: customerText },
        { content: 'Institución/Empresa:', styles: { fontStyle: 'bold' } },
        { content: institutionText },
      ],
      [
        { content: `${docTypeLabel}:`, styles: { fontStyle: 'bold' } },
        { content: docNumberText },
        { content: 'Método de Pago:', styles: { fontStyle: 'bold' } },
        { content: paymentText },
      ],
      [
        { content: 'Dirección:', styles: { fontStyle: 'bold' } },
        { content: addressText, colSpan: 3 },
      ],
    ],
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 55 },
      2: { cellWidth: 35 },
      3: { cellWidth: contentWidth - (28 + 55 + 35) },
    },
  })

  yPos = (doc as any).lastAutoTable.finalY + 8

  // ==================== DETALLE ====================
  yPos = ensureSpace(doc, yPos, 30)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('DETALLE', margin, yPos)
  yPos += 6

  const tableData = sale.items.map((item) => {
    const qty = num(item.soldQty)
    const qtyStr = formatQty(qty)

    let description = txt(item.product?.name)
    if (item.presentation?.name) {
      description += ` (${txt(item.presentation.name)})`
    }

    return [
      qtyStr,
      txt(item.soldUnit),
      description,
      formatMoneyPEN(to2(num(item.unitPrice))),
      formatMoneyPEN(to2(num(item.subtotal))),
    ]
  })

  autoTable(doc, {
    startY: yPos,
    head: [['Cant.', 'U.M.', 'Descripción', 'P. Unit', 'Importe']],
    body: tableData,
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: {
      overflow: 'linebreak',
      cellPadding: 2,
      fontSize: 9,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      valign: 'top',
    },
    headStyles: {
      fillColor: [60, 60, 60],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
      cellPadding: 3,
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 80, halign: 'left' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
  })

  yPos = (doc as any).lastAutoTable.finalY + 8

  // ==================== TOTALES (autoTable para que quede fino) ====================
  yPos = ensureSpace(doc, yPos, 26)

  const totalsBoxWidth = 70
  const totalsX = pageWidth - margin - totalsBoxWidth

  const taxNum = to2(num(sale.tax))
  const rows: any[] = [
    [
      { content: 'Subtotal:', styles: { fontStyle: 'normal' } },
      { content: formatMoneyPEN(to2(num(sale.subtotal))), styles: { halign: 'right' } },
    ],
  ]

  if (taxNum > 0) {
    rows.push([
      { content: 'IGV (18%):', styles: { fontStyle: 'normal' } },
      { content: formatMoneyPEN(taxNum), styles: { halign: 'right' } },
    ])
  }

  rows.push([
    { content: 'TOTAL:', styles: { fontStyle: 'bold', fontSize: 11 } },
    {
      content: formatMoneyPEN(to2(num(sale.total))),
      styles: { fontStyle: 'bold', fontSize: 11, halign: 'right' },
    },
  ])

  autoTable(doc, {
    startY: yPos,
    theme: 'plain',
    margin: { left: totalsX, right: margin },
    tableWidth: totalsBoxWidth,
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 1.2 },
    body: rows,
    didDrawPage: () => {},
  })

  yPos = (doc as any).lastAutoTable.finalY + 8

  // ==================== OBSERVACIONES ====================
  const obs = (sale.observations ?? '').toString().trim()
  if (obs.length) {
    yPos = ensureSpace(doc, yPos, 25)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('OBSERVACIONES', margin, yPos)
    yPos += 4

    autoTable(doc, {
      startY: yPos,
      theme: 'grid',
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        valign: 'top',
        fillColor: [255, 250, 240],
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
      },
      body: [[{ content: obs }]],
    })

    yPos = (doc as any).lastAutoTable.finalY + 6
  }

  // ==================== PIE DE PÁGINA ====================
  // Si por alguna razón el contenido llegó muy abajo, movemos a otra página
  if (yPos > pageHeight - 30) {
    doc.addPage()
  }

  const footerY = doc.internal.pageSize.getHeight() - 20

  doc.setFontSize(10)
  doc.setFont('helvetica', 'italic')
  doc.text('¡Gracias por su compra!', pageWidth / 2, footerY, { align: 'center' })

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Documento interno / Nota de venta (no electrónica)', pageWidth / 2, footerY + 5, {
    align: 'center',
  })

  return doc
}

/**
 * Genera PDF en formato TICKET (80mm aprox)
 * Diseño simplificado para impresoras térmicas
 * (lo dejé casi igual, pero con wrap seguro en descripción)
 */
function generateTicketPDF(sale: SaleData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 297],
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 5
  let yPos = 8

  const ensureTicketSpace = (minSpace: number) => {
    const pageH = doc.internal.pageSize.getHeight()
    if (yPos + minSpace > pageH - 8) {
      doc.addPage()
      yPos = 8
    }
  }

  // ==================== ENCABEZADO ====================
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('FERRETERÍA', pageWidth / 2, yPos, { align: 'center' })
  yPos += 5
  doc.text('CHAVALOS', pageWidth / 2, yPos, { align: 'center' })
  yPos += 6

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Av. Principal #123', pageWidth / 2, yPos, { align: 'center' })
  yPos += 3
  doc.text('Tel: (505) 1234-5678', pageWidth / 2, yPos, { align: 'center' })
  yPos += 5

  doc.setLineWidth(0.2)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 4

  // ==================== NOTA DE VENTA ====================
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('NOTA DE VENTA', pageWidth / 2, yPos, { align: 'center' })
  yPos += 5

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`N°: ${txt(sale.saleNumber)}`, margin, yPos)
  yPos += 4

  const dateStr = formatDateTime(sale.createdAt)
  doc.text(`Fecha: ${txt(dateStr)}`, margin, yPos)
  yPos += 4

  if (sale.customerName) {
    const cLines = doc.splitTextToSize(`Cliente: ${txt(sale.customerName)}`, pageWidth - 2 * margin)
    doc.text(cLines, margin, yPos)
    yPos += cLines.length * 3
  }

  doc.text(`Atendió: ${txt(sale.user?.fullName)}`, margin, yPos)
  yPos += 5

  doc.setLineWidth(0.2)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 4

  // ==================== DETALLE ====================
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('DETALLE', margin, yPos)
  yPos += 4

  doc.setFont('helvetica', 'normal')

  sale.items.forEach((item) => {
    ensureTicketSpace(14)

    const qty = num(item.soldQty)
    const qtyStr = formatQty(qty)

    let description = txt(item.product?.name)
    if (item.presentation?.name) description += ` (${txt(item.presentation.name)})`

    const descLines = doc.splitTextToSize(description, pageWidth - 2 * margin)
    doc.text(descLines, margin, yPos)
    yPos += descLines.length * 3

    const itemLine = `${qtyStr} ${txt(item.soldUnit)} x ${formatMoneyPEN(
      to2(num(item.unitPrice))
    )} = ${formatMoneyPEN(to2(num(item.subtotal)))}`
    const itemLines = doc.splitTextToSize(itemLine, pageWidth - 2 * margin)
    doc.text(itemLines, margin + 2, yPos)
    yPos += itemLines.length * 3 + 1
  })

  yPos += 2
  doc.setLineWidth(0.2)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 4

  // ==================== TOTALES ====================
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  doc.text('Subtotal:', margin, yPos)
  doc.text(formatMoneyPEN(to2(num(sale.subtotal))), pageWidth - margin, yPos, { align: 'right' })
  yPos += 4

  const taxNum = to2(num(sale.tax))
  if (taxNum > 0) {
    doc.text('IGV (18%):', margin, yPos)
    doc.text(formatMoneyPEN(taxNum), pageWidth - margin, yPos, { align: 'right' })
    yPos += 4
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('TOTAL:', margin, yPos)
  doc.text(formatMoneyPEN(to2(num(sale.total))), pageWidth - margin, yPos, { align: 'right' })
  yPos += 6

  doc.setLineWidth(0.2)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 5

  // ==================== PIE ====================
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.text('¡Gracias por su compra!', pageWidth / 2, yPos, { align: 'center' })
  yPos += 3
  doc.setFont('helvetica', 'normal')
  doc.text('Documento interno', pageWidth / 2, yPos, { align: 'center' })

  return doc
}
