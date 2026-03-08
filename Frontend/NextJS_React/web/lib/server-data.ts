import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { getBusinessDayKey, getBusinessDayRange } from '@/lib/business-time'
import * as productsAPI from '@backend/API/products'
import { getLowStockProducts } from '@backend/Validaciones/stock'

const ADMIN_PRODUCTS_PAGE_SIZE = 30
const CAJA_PRODUCTS_PAGE_SIZE = 20

const getInitialAdminProductsCached = unstable_cache(
  async () =>
    productsAPI.searchProducts({
      includePresentations: true,
      limit: ADMIN_PRODUCTS_PAGE_SIZE,
      offset: 0,
    }),
  ['products:admin:first-page'],
  {
    revalidate: 30,
    tags: [CACHE_TAGS.productsList],
  }
)

const getInitialCajaProductsCached = unstable_cache(
  async () =>
    productsAPI.searchProducts({
      isActive: true,
      inStockOnly: true,
      includePresentations: true,
      limit: CAJA_PRODUCTS_PAGE_SIZE,
      offset: 0,
    }),
  ['products:caja:first-page'],
  {
    revalidate: 15,
    tags: [CACHE_TAGS.productsList],
  }
)

const getDashboardSummaryCached = unstable_cache(
  async (dayKey: string) => {
    const { start, endExclusive } = getBusinessDayRange(dayKey)

    const [productsCount, lowStockProducts, salesSummary] = await Promise.all([
      prisma.product.count({ where: { isActive: true } }),
      getLowStockProducts(),
      prisma.sale.aggregate({
        where: {
          createdAt: {
            gte: start,
            lt: endExclusive,
          },
        },
        _count: {
          _all: true,
        },
        _sum: {
          total: true,
        },
      }),
    ])

    return {
      productsCount,
      lowStockProducts: lowStockProducts.map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        stock: Number(product.stock),
        minStock: Number(product.minStock),
      })),
      todaySales: salesSummary._count._all,
      todayRevenue: Number(salesSummary._sum.total ?? 0),
    }
  },
  ['dashboard:summary'],
  {
    revalidate: 15,
    tags: [
      CACHE_TAGS.dashboardSummary,
      CACHE_TAGS.productsList,
      CACHE_TAGS.salesList,
    ],
  }
)

export async function getInitialAdminProducts() {
  return getInitialAdminProductsCached()
}

export async function getInitialCajaProducts() {
  return getInitialCajaProductsCached()
}

export async function getDashboardSummary() {
  return getDashboardSummaryCached(getBusinessDayKey(new Date()))
}
