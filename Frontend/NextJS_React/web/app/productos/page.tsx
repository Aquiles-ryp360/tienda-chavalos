import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth-session'
import { ProductosView } from '@/ui/pages/productos/ProductosView'
import * as productsAPI from '@backend/API/products'

const PAGE_SIZE = 30

export default async function ProductosPage() {
  let user
  try {
    user = await requireAdmin()
  } catch {
    redirect('/dashboard')
  }

  const { products, total } = await productsAPI.searchProducts({
    isActive: true,
    limit: PAGE_SIZE,
    offset: 0,
  })

  return <ProductosView user={user} initialProducts={products} initialTotal={total} />
}
