'use client'

import { PAYMENT_INFO } from './payment-info'

interface GeneratePaymentCardOptions {
  amountSoles?: number
}

export async function generatePaymentCardPng({
  amountSoles,
}: GeneratePaymentCardOptions): Promise<Blob> {
  const width = 1080
  const height = 1350
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear canvas')

  // Fondo
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // Utilidades
  const drawText = (
    text: string,
    x: number,
    y: number,
    options: { size?: number; weight?: string; align?: CanvasTextAlign; color?: string } = {}
  ) => {
    const size = options.size ?? 40
    const weight = options.weight ?? '600'
    ctx.font = `${weight} ${size}px "Segoe UI", "Inter", Arial, sans-serif`
    ctx.fillStyle = options.color ?? '#111827'
    ctx.textAlign = options.align ?? 'left'
    ctx.fillText(text, x, y)
  }

  // Encabezado
  drawText(PAYMENT_INFO.businessName.toUpperCase(), width / 2, 120, {
    size: 54,
    align: 'center',
  })
  drawText('Pago por Yape', width / 2, 180, { size: 38, align: 'center', color: '#4b5563' })

  if (typeof amountSoles === 'number') {
    drawText(`Monto: S/ ${amountSoles.toFixed(2)}`, width / 2, 260, {
      size: 46,
      align: 'center',
      color: '#111827',
    })
  }

  // Cajas
  const cardWidth = width - 160
  const cardX = 80
  let currentY = 310

  // Yape block
  ctx.fillStyle = '#f8fafc'
  roundRect(ctx, cardX, currentY, cardWidth, 220, 24)
  ctx.fill()
  drawText('Yape', cardX + 40, currentY + 60, { size: 36 })
  drawText(`Número: ${PAYMENT_INFO.yapeNumber}`, cardX + 40, currentY + 115, {
    size: 34,
  })
  drawText(`Titular: ${PAYMENT_INFO.yapeHolderName}`, cardX + 40, currentY + 165, {
    size: 30,
    color: '#4b5563',
  })
  currentY += 250

  // QR
  const qrSize = 520
  const qrX = (width - qrSize) / 2
  const qrY = currentY
  const qrImg = await loadImage(PAYMENT_INFO.yapeQrPath)
  ctx.fillStyle = '#eef2ff'
  roundRect(ctx, qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 28)
  ctx.fill()
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)
  currentY += qrSize + 80

  // BCP block
  ctx.fillStyle = '#f8fafc'
  roundRect(ctx, cardX, currentY, cardWidth, 200, 24)
  ctx.fill()
  drawText('Cuenta BCP (S/.)', cardX + 40, currentY + 60, { size: 34 })
  drawText(`N°: ${PAYMENT_INFO.accountBcp}`, cardX + 40, currentY + 110, { size: 30 })
  drawText(`CCI: ${PAYMENT_INFO.cci}`, cardX + 40, currentY + 155, { size: 30 })

  // Footer
  drawText(new Date().toLocaleString('es-PE'), cardX, height - 40, {
    size: 26,
    color: '#6b7280',
  })

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('No se pudo generar la imagen'))
    }, 'image/png')
  })
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src.startsWith('http') ? src : `${window.location.origin}${src}`
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
