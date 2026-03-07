import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth-session'
import { VentasView } from '@/ui/pages/ventas/VentasView'
import * as salesAPI from '@backend/API/sales'

export default async function VentasPage() {
  let user
  try {
    user = await requireAuth()
  } catch {
    redirect('/login')
  }

  const result = await salesAPI.listSales({
    userId: user.role === 'CAJERO' ? user.id : undefined,
    limit: 50,
    offset: 0,
  })

  const initialSales = result.sales.map((sale: any) => ({
    ...sale,
    total: Number(sale.total ?? 0),
  }))

  return <VentasView user={user} initialSales={initialSales} />
}
