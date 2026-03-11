import { redirect } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/auth-session'
import { prisma } from '@/lib/prisma'
import { PanelView } from '@/ui/pages/panel/PanelView'

export const metadata = { title: 'Panel de Control — Aquiles' }

export default async function PanelPage() {
  let user
  try {
    user = await requireSuperAdmin()
  } catch {
    redirect('/login')
  }

  // Stats del sistema
  const [totalUsuarios, totalProductos, totalVentas, totalForo] = await Promise.all([
    prisma.user.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.sale.count(),
    prisma.forumPost.count({ where: { isHidden: false } }),
  ])

  return (
    <PanelView
      user={user}
      stats={{ totalUsuarios, totalProductos, totalVentas, totalForo }}
    />
  )
}
