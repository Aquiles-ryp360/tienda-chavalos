import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth-session'
import { CajaView } from '@/ui/pages/caja/CajaView'
import * as productsAPI from '@backend/API/products'

const INITIAL_LIMIT = 20

export default async function CajaPage() {
  let user
  try {
    user = await requireAuth()
  } catch {
    redirect('/login')
  }

  const { products } = await productsAPI.searchProducts({
    isActive: true,
    limit: INITIAL_LIMIT,
    offset: 0,
  })

  return <CajaView user={user} initialProducts={products} />
}
