import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth-session'
import { CajaView } from '@/ui/pages/caja/CajaView'

export default async function CajaPage() {
  let user
  try {
    user = await requireAuth()
  } catch {
    redirect('/login')
  }

  return <CajaView user={user} />
}
