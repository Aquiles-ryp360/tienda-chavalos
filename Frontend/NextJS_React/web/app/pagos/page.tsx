import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth-session'
import { PagosView } from '@/ui/pages/pagos/PagosView'

export default async function PagosPage() {
  let user
  try {
    user = await requireAuth()
  } catch {
    redirect('/login')
  }

  return <PagosView user={user} />
}
