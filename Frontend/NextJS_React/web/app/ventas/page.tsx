import type { ComponentProps } from 'react'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth-session'
import { VentasView } from '@/ui/pages/ventas/VentasView'
import * as salesAPI from '@backend/API/sales'

type InitialSale = NonNullable<ComponentProps<typeof VentasView>['initialSales']>[number]

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

  const initialSales: InitialSale[] = result.sales.map((sale) => ({
    ...sale,
    createdAt: sale.createdAt.toISOString(),
    customerName: sale.customerName ?? undefined,
    total: Number(sale.total ?? 0),
  }))

  return <VentasView user={user} initialSales={initialSales} />
}
