export const PAYMENT_INFO = {
  businessName: 'Ferretería Chavalos',
  yapeNumber: '999888777',
  yapeHolderName: 'Ferretería Chavalos',
  holder: 'Ferretería Chavalos',
  yapeQrPath: '/payments/yape-qr.jpeg',
  accountBcp: '40505313888051',
  cci: '00240510531388805191',
  slogan: 'Ferretería y acabados',
}

export type PaymentMethodUi = 'EFECTIVO' | 'YAPE' | 'TRANSFERENCIA' | 'TARJETA'

export function sanitizePhoneE164Peru(input: string): string {
  const digits = (input || '').replace(/\D+/g, '')
  if (!digits) return ''
  if (digits.startsWith('51')) return digits
  if (digits.length === 9 && digits.startsWith('9')) return `51${digits}`
  return digits
}

export function formatWhatsAppPaymentText({
  amountSoles,
  context,
}: {
  amountSoles?: number
  context: 'caja' | 'pagos'
}): string {
  const lines: string[] = []
  lines.push(`*${PAYMENT_INFO.businessName.toUpperCase()}*`)
  lines.push(`Pago por *Yape*`)
  if (typeof amountSoles === 'number') {
    lines.push('')
    lines.push(`*Monto:* S/ ${amountSoles.toFixed(2)}`)
  }
  lines.push('')
  lines.push(`*Yape:* ${PAYMENT_INFO.yapeNumber} (${PAYMENT_INFO.yapeHolderName})`)
  lines.push('')
  lines.push(`_Cuenta BCP (S/.):_`)
  lines.push(`N°: \`\`\`${PAYMENT_INFO.accountBcp}\`\`\``)
  lines.push(`CCI: \`\`\`${PAYMENT_INFO.cci}\`\`\``)
  lines.push('')
  lines.push('Adjunto QR y datos para el pago.')
  if (context === 'caja') {
    lines.push('Gracias por tu compra.')
  }
  return lines.join('\n')
}
