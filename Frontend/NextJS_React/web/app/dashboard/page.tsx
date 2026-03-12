import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth-session'
import { DashboardView } from '@/ui/pages/dashboard/DashboardView'
import { getDashboardSummary } from '@/lib/server-data'

export default async function DashboardPage() {
  let user
  try {
    user = await requireAuth()
  } catch {
    redirect('/login')
  }

  // SUPERADMIN siempre va al panel de control
  if (user!.role === 'SUPERADMIN') {
    redirect('/panel')
  }

  const {
    productsCount,
    lowStockProducts,
    todaySales,
    todayRevenue,
  } = await getDashboardSummary()

  return (
    <DashboardView
      user={user}
      data={{
        productsCount,
        lowStockCount: lowStockProducts.length,
        todaySales,
        todayRevenue,
        lowStockProducts,
      }}
    />
  )
}
