import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth-session'
import { VentasView } from '@/ui/pages/ventas/VentasView'

export default async function VentasPage() {
  let user
  try {
    user = await requireAuth()
  } catch {
    redirect('/login')
  }

  return <VentasView user={user} />
}
