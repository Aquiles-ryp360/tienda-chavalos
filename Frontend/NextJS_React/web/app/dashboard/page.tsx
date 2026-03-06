import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth-session'
import { prisma } from '@/lib/prisma'
import { getLowStockProducts } from '@backend/Validaciones/stock'
import { DashboardView } from '@/ui/pages/dashboard/DashboardView'
import { toPlain } from '@/lib/toPlain'

export default async function DashboardPage() {
  let user
  try {
    user = await requireAuth()
  } catch {
    redirect('/login')
  }

  // Obtener estadísticas
  const [productsCount, lowStockProducts, todaySalesData] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    getLowStockProducts(),
    prisma.sale.findMany({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      select: { total: true },
    }),
  ])

  // 👇 total puede venir como Prisma.Decimal (dependiendo de tu schema),
  // así que lo convertimos a "plain" antes de usarlo.
  const todaySalesPlain = toPlain(todaySalesData)
  const lowStockPlain = toPlain(lowStockProducts)

  const todaySales = todaySalesPlain.length
  const todayRevenue = todaySalesPlain.reduce((sum, sale) => sum + Number(sale.total), 0)

  // Convert lowStockPlain to proper numbers
  const lowStockFormatted = lowStockPlain.map((p: any) => ({
    ...p,
    stock: Number(p.stock),
    minStock: Number(p.minStock),
  }))

  return (
    <DashboardView
      user={user}
      data={{
        productsCount,
        lowStockCount: lowStockFormatted.length,
        todaySales,
        todayRevenue,
        lowStockProducts: lowStockFormatted,
      }}
    />
  )
}
