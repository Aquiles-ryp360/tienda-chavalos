'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Image from 'next/image'
import { Header } from '@/ui/components/Header'
import { BottomNav } from '@/ui/components/BottomNav'
import { Button } from '@/ui/components/Button'
import { SearchBar } from '@/ui/components/SearchBar'
import { formatMoneyPEN, roundToDecimals } from '@/lib/format-money'
import { useToast } from '@/ui/components/Toast/ToastContext'
import { ShareWhatsAppModal } from '@/ui/components/ShareWhatsAppModal'
import { PAYMENT_INFO, PaymentMethodUi, formatWhatsAppPaymentText } from '@/lib/payment-info'
import { generatePaymentCardPng } from '@/lib/payment-share-image'
import { shareWhatsAppWithImage } from '@/lib/share-whatsapp'
import { useProductSearch } from '@/ui/hooks/useProductSearch'
import styles from './caja.module.css'

// Unidades que permiten decimales (consistente con backend)
const FRACTIONABLE_UNITS = new Set(['KILO', 'LITRO', 'METRO', 'CAJA', 'PAQUETE', 'ROLLO'])

// Determinar si una unidad permite decimales
function unitAllowsDecimals(unit: string): boolean {
  return FRACTIONABLE_UNITS.has((unit || '').toUpperCase())
}

// Determinar el step para botones +/-
function getStep(unit: string): number {
  return unitAllowsDecimals(unit) ? 0.5 : 1
}

// Redondear de forma segura a 3 decimales para evitar errores de punto flotante
function roundTo3Decimals(num: number): number {
  return Math.round((num + Number.EPSILON) * 1000) / 1000
}

// Normalizar cantidades: permite opcionalmente mantener decimales sin forzar múltiplos de step
function normalizeQty(
  value: string | number,
  options: { step: number; min: number; allowAnyDecimal?: boolean }
): number | null {
  const { step, min, allowAnyDecimal = false } = options
  const parsed =
    typeof value === 'string' ? Number(String(value).replace(',', '.')) : Number(value)

  if (!Number.isFinite(parsed)) return null

  const allowsDecimals = step < 1
  let qty = Math.max(min, parsed)

  // Solo ajustar a múltiplos del step cuando no se permiten decimales libres (botones +/-)
  if (!allowAnyDecimal) {
    qty = Math.round(qty / step) * step
  }

  // Redondear siempre a 3 decimales para evitar ruido flotante
  qty = roundTo3Decimals(qty)

  // Para unidades discretas, forzar entero
  if (!allowsDecimals && !Number.isInteger(qty)) {
    qty = Math.round(qty)
  }

  if (qty < min) qty = min

  return qty > 0 ? qty : null
}

// Alias usados en el resto del archivo (legado)
const determineAllowsDecimals = (unit: string) => unitAllowsDecimals(unit)
const determineStep = (unit: string, allowsDecimals?: boolean) =>
  getStep(unit)

// Detectar si una presentación representa la unidad base del producto
function isBasePresentation(
  presentation: ProductPresentation | null | undefined,
  product?: Product
): boolean {
  if (!presentation || !product) return false
  return presentation.isDefault && Number(presentation.factorToBase ?? 1) === 1
}

interface ProductPresentation {
  id: string
  name: string
  unit: string
  factorToBase: number
  priceOverride: number | null
  computedUnitPrice: number
  isDefault: boolean
  isActive: boolean
}

interface Product {
  id: string
  sku: string
  name: string
  price: number
  stock: number
  minStock: number
  unit: string
  isActive: boolean
  presentations?: ProductPresentation[]
}

interface CartItem {
  product: Product
  productId?: string
  presentationId: string | null
  presentation: ProductPresentation | null
  soldQty: number
  draftQty?: string
  adjustedUnitPrice?: number
  priceAdjustNote?: string
  priceAdjusted?: boolean
  unitType?: string
  presentationUnit?: string
}

interface InsufficientStockError {
  code: string
  productId: string
  productName: string
  available: number
  requiredBaseQty: number
  soldQty: number
  unitBase: string
  presentationId?: string
}

interface CajaViewProps {
  user: {
    fullName: string
    role: string
  }
  initialProducts?: Product[]
}

export function CajaView({ user, initialProducts = [] }: CajaViewProps) {
  const { notify } = useToast()
  const [search, setSearch] = useState('')

  // ── SWR + Debounce + AbortController (búsqueda optimizada para LAN) ──
  const {
    products,
    isStale,
    isSearching,
    refresh,
  } = useProductSearch(search, {
    limit: 20,
    inStockOnly: true,
    includePresentations: true,
    debounceMs: 300,
    fallbackData: {
      products: initialProducts,
      total: initialProducts.length,
    },
  })

  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodUi>('EFECTIVO')
  const [loading, setLoading] = useState(false)
  const [insufficientStockError, setInsufficientStockError] = useState<InsufficientStockError | null>(null)
  const [overrideNote, setOverrideNote] = useState('')
  const [cartOpen, setCartOpen] = useState(false) // Estado para abrir/cerrar carrito en móvil
  const [cartHydrated, setCartHydrated] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareMethod, setShareMethod] = useState<PaymentMethodUi>('EFECTIVO')
  const [shareLoading, setShareLoading] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  // Flujo móvil de cobro en 2 pasos para optimizar espacio visual.
  const [cartStep, setCartStep] = useState<'list' | 'payment'>('list')
  // Parche de hidratación: evita render condicional dependiente de APIs del navegador en SSR.
  const [dynamicPadding, setDynamicPadding] = useState(0)
  const [isMounted, setIsMounted] = useState(false)
  const floatingCartBtnRef = useRef<HTMLButtonElement | null>(null)

  // Marca el montaje en cliente para habilitar mediciones de DOM sin mismatch SSR/CSR.
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Bloquear scroll del body cuando el carrito está abierto
  useEffect(() => {
    if (cartOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [cartOpen])

  // Resetear paso del carrito al cerrarse o vaciarse
  useEffect(() => {
    if (!cartOpen || cart.length === 0) {
      setCartStep('list')
    }
  }, [cartOpen, cart.length])

  useEffect(() => {
    if (!isMounted) return

    // Calcula espacio inferior real para que el scroll no quede tapado por BottomNav + botón flotante.
    const calculateDynamicPadding = () => {
      const isDesktop = window.matchMedia('(min-width: 1024px)').matches
      if (isDesktop) {
        setDynamicPadding(16)
        return
      }

      const floatingCartEl =
        floatingCartBtnRef.current ??
        document.querySelector<HTMLButtonElement>('button[class*="floatingCartBtn"]')

      const bottomNavEl =
        document.querySelector<HTMLElement>('nav[class*="bottomNav"]')

      const floatingCartHeight = floatingCartEl?.getBoundingClientRect().height ?? 0
      const bottomNavHeight = bottomNavEl?.getBoundingClientRect().height ?? 0
      const breathingSpace = 60

      setDynamicPadding(Math.ceil(floatingCartHeight + bottomNavHeight + breathingSpace))
    }

    const handleResize = () => {
      window.requestAnimationFrame(calculateDynamicPadding)
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [isMounted, cartOpen])
  
  // Estado para modal de ajuste de precio
  const [priceAdjustModal, setPriceAdjustModal] = useState<{
    show: boolean
    itemIndex: number | null
    mode: 'DESCUENTO_PORCENTAJE' | 'DESCUENTO_MONTO' | 'PRECIO_MANUAL'
    value: number
    reason: string
  }>({
    show: false,
    itemIndex: null,
    mode: 'DESCUENTO_PORCENTAJE',
    value: 0,
    reason: ''
  });

  // Estado para descuento global a la venta
  const [globalDiscount, setGlobalDiscount] = useState<{
    active: boolean
    mode: 'PORCENTAJE' | 'MONTO_FIJO'
    value: number
    reason: string
  }>({
    active: false,
    mode: 'PORCENTAJE',
    value: 0,
    reason: ''
  })
  const [globalDiscountModal, setGlobalDiscountModal] = useState<{
    show: boolean
    mode: 'PORCENTAJE' | 'MONTO_FIJO'
    value: number
    reason: string
  }>({
    show: false,
    mode: 'PORCENTAJE',
    value: 0,
    reason: ''
  })
  // Hidratar carrito desde localStorage (permite mantener items entre recargas)
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('cajaCart') : null
      const storedPayment = typeof window !== 'undefined' ? localStorage.getItem('cajaPaymentMethod') : null
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setCart(parsed)
        }
      }
      if (
        storedPayment === 'EFECTIVO' ||
        storedPayment === 'YAPE' ||
        storedPayment === 'TRANSFERENCIA' ||
        storedPayment === 'TARJETA'
      ) {
        setPaymentMethod(storedPayment)
      }
    } catch (error) {
      console.warn('No se pudo leer carrito de localStorage', error)
    } finally {
      setCartHydrated(true)
    }
  }, [])

  // Persistir carrito en localStorage
  useEffect(() => {
    if (!cartHydrated) return
    try {
      localStorage.setItem('cajaCart', JSON.stringify(cart))
      localStorage.setItem('cajaPaymentMethod', paymentMethod)
    } catch (error) {
      console.warn('No se pudo guardar carrito en localStorage', error)
    }
  }, [cart, paymentMethod, cartHydrated])

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  // Clave estable basada en el CONTENIDO de los productos (no en la referencia del array).
  // Esto evita que el useEffect se dispare infinitamente por cambios de referencia.
  const productsVersion = useMemo(
    () => products.map(p => `${p.id}:${p.price}:${p.stock}:${p.unit}`).join('|'),
    [products]
  )

  // Sincronizar carrito cuando se refresca la lista de productos (unidad/presentaciones pueden cambiar)
  useEffect(() => {
    if (!productsVersion || !cartHydrated) return

    setCart((current) => {
      if (!current.length) return current

      // Construir mapa dentro del callback para usar datos frescos sin depender de refs
      const pMap = new Map(products.map((p) => [p.id, p]))

      let changed = false
      const updatedCart = current.map((item) => {
        const updatedProduct = pMap.get(item.product.id)
        if (!updatedProduct) return item

        // Mantener presentación elegida; si no existe, caer a default del producto
        const updatedPresentation =
          item.presentationId
            ? updatedProduct.presentations?.find((p) => p.id === item.presentationId) ||
              item.presentation ||
              null
            : item.presentation ||
              updatedProduct.presentations?.find((p) => p.isDefault) ||
              updatedProduct.presentations?.[0] ||
              null

        const baseLike = isBasePresentation(updatedPresentation, updatedProduct)
        const effectiveUnit =
          baseLike
            ? updatedProduct.unit || item.unitType || item.product.unit || 'UNIDAD'
            : updatedPresentation?.unit ||
              item.presentationUnit ||
              item.unitType ||
              updatedProduct.unit ||
              item.product.unit ||
              'UNIDAD'

        // Comparar por VALOR, no por referencia — los objetos de localStorage nunca son === a los de la API
        if (
          item.product.price !== updatedProduct.price ||
          item.product.stock !== updatedProduct.stock ||
          item.product.unit !== updatedProduct.unit ||
          item.product.name !== updatedProduct.name ||
          item.presentation?.id !== updatedPresentation?.id ||
          item.unitType !== effectiveUnit
        ) {
          changed = true
        }

        return {
          ...item,
          product: updatedProduct,
          presentation: updatedPresentation,
          presentationId: updatedPresentation ? updatedPresentation.id : item.presentationId ?? null,
          unitType: effectiveUnit,
          presentationUnit: updatedPresentation?.unit ?? item.presentationUnit,
        }
      })

      // Si nada cambió por VALOR, devolver la misma referencia para evitar re-renders
      return changed ? updatedCart : current
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsVersion, cartHydrated])

  const getEffectivePresentation = (item: CartItem): ProductPresentation | null => {
    // Intentar primero con datos live del search, luego con datos almacenados en el cart item
    const liveProduct = productsById.get(item.product.id)
    const storedProduct = item.product

    if (item.presentationId) {
      return (
        liveProduct?.presentations?.find((p) => p.id === item.presentationId) ||
        storedProduct.presentations?.find((p) => p.id === item.presentationId) ||
        item.presentation ||
        null
      )
    }
    return (
      item.presentation ||
      liveProduct?.presentations?.find((p) => p.isDefault) ||
      storedProduct.presentations?.find((p) => p.isDefault) ||
      liveProduct?.presentations?.[0] ||
      storedProduct.presentations?.[0] ||
      null
    )
  }

  const getEffectiveUnit = (item: CartItem): string => {
    const liveProduct = productsById.get(item.product.id)
    const pres = getEffectivePresentation(item)
    const baseLike = pres ? isBasePresentation(pres, liveProduct || item.product) : false
    const hasChosenPresentation = !!pres && !baseLike

    if (hasChosenPresentation) {
      return (
        pres?.unit ||
        item.presentationUnit ||
        item.unitType ||
        liveProduct?.unit ||
        item.product.unit ||
        'UNIDAD'
      )
    }

    return (
      liveProduct?.unit ||
      item.product.unit ||
      item.unitType ||
      pres?.unit ||
      item.presentationUnit ||
      'UNIDAD'
    )
  }

  const addToCart = (product: Product) => {
    // Obtener presentación por defecto
    const defaultPresentation = product.presentations?.find((p) => p.isDefault) || product.presentations?.[0] || null
    const baseLike = isBasePresentation(defaultPresentation, product)
    const targetPresentationId = baseLike ? null : defaultPresentation?.id || null
    const targetPresentation = baseLike ? null : defaultPresentation || null

    const existing = cart.find((item) => {
      if (item.product.id !== product.id) return false
      if (targetPresentationId) return item.presentationId === targetPresentationId

      // Si buscamos la unidad base, considerar coincidencia aunque el item tenga la presentación default antigua
      const itemPresentation =
        item.presentationId && product.presentations
          ? product.presentations.find((p) => p.id === item.presentationId) || item.presentation
          : item.presentation

      return !item.presentationId || isBasePresentation(itemPresentation, product)
    })

    if (existing) {
      // Incrementar cantidad existente
      const unit = targetPresentation?.unit || product.unit
      const allowsDecimals = determineAllowsDecimals(unit)
      const step = determineStep(unit, allowsDecimals)
      const min = allowsDecimals ? 0.001 : 1

      const currentQty = existing.soldQty
      const newQty = currentQty + step
      const normalized = normalizeQty(newQty, { step, min })
      
      if (normalized) {
        setCart(
          cart.map((item) => {
            if (item.product.id === product.id && item.presentationId === (defaultPresentation?.id || null)) {
            return {
              ...item,
              soldQty: normalized,
              draftQty: String(normalized),
            }
            }
            return item
          })
        )
      }
    } else {
      // Agregar nueva línea al carrito
      const unit = targetPresentation?.unit || product.unit
      const allowsDecimals = determineAllowsDecimals(unit)
      const step = determineStep(unit, allowsDecimals)
      const initialQty = step // Comenzar con el step mínimo
      
      setCart([
        ...cart,
        {
          product,
          presentationId: targetPresentationId,
          presentation: targetPresentation,
          soldQty: initialQty,
          draftQty: String(initialQty),
          unitType: unit,
          presentationUnit: targetPresentation?.unit || undefined,
        },
      ])
    }

    notify({ type: 'success', title: 'Producto sumado al carrito', message: product.name })
  }

  const updateQuantity = (productId: string, presentationId: string | null, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.product.id === productId && item.presentationId === presentationId) {
            const newQty = roundToDecimals(item.soldQty + delta, 3)
            // Validar que cantidad sea > 0
            if (newQty <= 0) return null
            return { ...item, soldQty: newQty }
          }
          return item
        })
        .filter((item) => item !== null) as CartItem[]
    )
  }

  const removeFromCart = (productId: string, presentationId: string | null) => {
    setCart(cart.filter((item) => !(item.product.id === productId && item.presentationId === presentationId)))
  }

  // Calcular unitPrice: busca en presentación efectiva (live+stored) con múltiples fallbacks
  function getUnitPrice(item: CartItem): number {
    if (item.adjustedUnitPrice !== undefined) return item.adjustedUnitPrice
    const pres = getEffectivePresentation(item)
    if (pres && pres.computedUnitPrice != null) return pres.computedUnitPrice
    if (item.presentation?.computedUnitPrice != null) return item.presentation.computedUnitPrice
    const storedPres = item.product.presentations?.find(p => p.isDefault) || item.product.presentations?.[0]
    if (storedPres?.computedUnitPrice != null) return storedPres.computedUnitPrice
    return item.product.price || 0
  }

  const openPriceAdjustModal = (itemIndex: number) => {
    setPriceAdjustModal({
      show: true,
      itemIndex,
      mode: 'DESCUENTO_PORCENTAJE',
      value: 0,
      reason: ''
    })
  }

  const applyPriceAdjust = () => {
    const { itemIndex, mode, value, reason } = priceAdjustModal
    
    if (itemIndex === null) return
    if (!reason.trim()) {
      notify({ type: 'warning', title: 'Razón requerida', message: 'La razón del ajuste es obligatoria' })
      return
    }
    if (value === 0 && mode !== 'PRECIO_MANUAL') {
      notify({ type: 'warning', title: 'Valor inválido', message: 'El valor debe ser mayor a 0' })
      return
    }

    const item = cart[itemIndex]
    const originalPrice = getUnitPrice(item)
    let newPrice = originalPrice

    if (mode === 'DESCUENTO_PORCENTAJE') {
      newPrice = originalPrice * (1 - value / 100)
    } else if (mode === 'DESCUENTO_MONTO') {
      newPrice = originalPrice - value
    } else if (mode === 'PRECIO_MANUAL') {
      newPrice = value
    }

    // Validar que el nuevo precio sea positivo
    if (newPrice <= 0) {
      notify({ type: 'error', title: 'Precio inválido', message: 'El precio resultante debe ser mayor a 0' })
      return
    }

    // Actualizar el item en el carrito
    const updatedCart = [...cart]
    updatedCart[itemIndex] = {
      ...item,
      adjustedUnitPrice: roundToDecimals(newPrice, 2),
      priceAdjustNote: reason,
      priceAdjusted: true
    }
    setCart(updatedCart)

    // Cerrar modal
    setPriceAdjustModal({
      show: false,
      itemIndex: null,
      mode: 'DESCUENTO_PORCENTAJE',
      value: 0,
      reason: ''
    })
  }

  const removePriceAdjust = (itemIndex: number) => {
    const updatedCart = [...cart]
    delete updatedCart[itemIndex].adjustedUnitPrice
    delete updatedCart[itemIndex].priceAdjustNote
    delete updatedCart[itemIndex].priceAdjusted
    setCart(updatedCart)
  }

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => {
      // Inline price calc to avoid any function ordering issues
      let up = 0
      if (item.adjustedUnitPrice !== undefined) { up = item.adjustedUnitPrice }
      else if (item.presentation?.computedUnitPrice != null) { up = item.presentation.computedUnitPrice }
      else {
        const sp = item.product.presentations?.find(p => p.isDefault) || item.product.presentations?.[0]
        if (sp?.computedUnitPrice != null) { up = sp.computedUnitPrice }
        else { up = item.product.price || 0 }
      }
      return sum + up * item.soldQty
    }, 0)
  }, [cart])
  const tax = 0

  // Calcular descuento global
  const globalDiscountAmount = useMemo(() => {
    if (!globalDiscount.active) return 0
    if (globalDiscount.mode === 'PORCENTAJE') {
      return roundToDecimals(subtotal * (globalDiscount.value / 100), 2)
    }
    // MONTO_FIJO: no puede exceder el subtotal
    return Math.min(globalDiscount.value, subtotal)
  }, [globalDiscount, subtotal])

  const total = subtotal + tax - globalDiscountAmount
  const floatingCartCount = cart.length
  const floatingCartProductsLabel = floatingCartCount === 1 ? 'producto' : 'productos'
  const floatingCartAriaLabel = `Abrir carrito con ${floatingCartCount} ${floatingCartProductsLabel}`
  const floatingCartTotalText = formatMoneyPEN(total)
  const floatingCartBtnClassName = [
    styles.floatingCartBtn,
    cartOpen ? styles.floatingCartBtnHidden : '',
  ]
    .filter(Boolean)
    .join(' ')

  const openGlobalDiscountModal = () => {
    setGlobalDiscountModal({
      show: true,
      mode: globalDiscount.active ? globalDiscount.mode : 'PORCENTAJE',
      value: globalDiscount.active ? globalDiscount.value : 0,
      reason: globalDiscount.active ? globalDiscount.reason : ''
    })
  }

  const applyGlobalDiscount = () => {
    const { mode, value, reason } = globalDiscountModal

    if (!reason.trim()) {
      notify({ type: 'warning', title: 'Razón requerida', message: 'Indica el motivo de la bonificación' })
      return
    }
    if (value <= 0) {
      notify({ type: 'warning', title: 'Valor inválido', message: 'El descuento debe ser mayor a 0' })
      return
    }
    if (mode === 'PORCENTAJE' && value > 100) {
      notify({ type: 'warning', title: 'Porcentaje inválido', message: 'El porcentaje no puede superar 100%' })
      return
    }
    if (mode === 'MONTO_FIJO' && value > subtotal) {
      notify({ type: 'warning', title: 'Monto excede total', message: 'El descuento no puede superar el subtotal de la venta' })
      return
    }

    setGlobalDiscount({
      active: true,
      mode,
      value,
      reason
    })
    setGlobalDiscountModal({ show: false, mode: 'PORCENTAJE', value: 0, reason: '' })
    notify({ type: 'success', title: 'Descuento aplicado', message: `Bonificación de ${mode === 'PORCENTAJE' ? value + '%' : formatMoneyPEN(value)} aplicada a la venta` })
  }

  const removeGlobalDiscount = () => {
    setGlobalDiscount({ active: false, mode: 'PORCENTAJE', value: 0, reason: '' })
    notify({ type: 'info', title: 'Descuento removido', message: 'Se eliminó la bonificación de la venta' })
  }

  const handleSharePayment = (method: PaymentMethodUi) => {
    setShareMethod(method)
    setShareModalOpen(true)
    setShareLoading(false)
  }

  const handleShareModalConfirm = async (normalizedDigits: string) => {
    try {
      setShareLoading(true)
      const text = formatWhatsAppPaymentText({ amountSoles: total, context: 'caja' })
      const imgBlob = await generatePaymentCardPng({ amountSoles: total })
      const result = await shareWhatsAppWithImage({
        text,
        phone: normalizedDigits,
        imgBlob,
      })
      if (result === 'fallback') {
        notify({
          type: 'info',
          title: 'Imagen descargada',
          message: 'Se abrió WhatsApp con el mensaje. Adjunta la imagen descargada.',
        })
      }
    } catch (error) {
      console.error('Error al compartir por WhatsApp:', error)
      notify({ type: 'error', title: 'No se pudo compartir', message: 'Intenta nuevamente' })
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopyPayment = async (method: PaymentMethodUi) => {
    const payload = formatWhatsAppPaymentText({ amountSoles: total, context: 'caja' })
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload)
        setCopyStatus('copied')
        setTimeout(() => setCopyStatus('idle'), 2000)
      } else {
        setCopyStatus('error')
      }
    } catch {
      setCopyStatus('error')
    }
  }

  const handleCheckout = async (forcePhysicalStock: boolean = false) => {
    if (loading) return
    if (cart.length === 0) {
      notify({ type: 'warning', title: 'Carrito vacío', message: 'Agrega productos antes de finalizar' })
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName || undefined,
          paymentMethod:
            paymentMethod === 'TRANSFERENCIA' || paymentMethod === 'TARJETA'
              ? 'TRANSFERENCIA'
              : 'EFECTIVO', // backend enum no soporta YAPE/TARJETA; se normaliza
          items: cart.map((item) => ({
            productId: item.product.id,
            presentationId: item.presentationId,
            soldQty: item.soldQty,
            unitPriceOverride: item.adjustedUnitPrice,
            priceAdjustNote: item.priceAdjustNote,
          })),
          forcePhysicalStock,
          overrideNote: forcePhysicalStock ? overrideNote || undefined : undefined,
        }),
      })

      const data = await res.json()

      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return
      }

      if (!res.ok) {
        // Manejar error de stock insuficiente
        if (res.status === 409 && data.code === 'INSUFFICIENT_STOCK') {
          setInsufficientStockError(data)
          return
        }

        notify({ type: 'error', title: 'Error al crear venta', message: data.error || 'Intenta nuevamente' })
        return
      }

      notify({ type: 'success', title: '¡Venta creada!', message: `Venta ${data.saleNumber} registrada exitosamente` })
      setCart([])
      setCustomerName('')
      setInsufficientStockError(null)
      setOverrideNote('')
      setCartStep('list')
      setGlobalDiscount({ active: false, mode: 'PORCENTAJE', value: 0, reason: '' })
      refresh()
    } catch (error) {
      console.error('Error en checkout:', error)
      notify({ type: 'error', title: 'Error al procesar', message: 'No se pudo completar la venta' })
    } finally {
      setLoading(false)
    }
  }

  const renderGlobalDiscountActions = () => {
    if (user.role !== 'ADMIN') return null

    return (
      <div className={styles.globalDiscountActions}>
        {!globalDiscount.active ? (
          <button
            type="button"
            className={styles.btnGlobalDiscount}
            onClick={openGlobalDiscountModal}
          >
            🏷️ Aplicar Descuento a la Venta
          </button>
        ) : (
          <div className={styles.globalDiscountActive}>
            <span className={styles.globalDiscountNote} title={globalDiscount.reason}>
              📝 {globalDiscount.reason}
            </span>
            <div className={styles.globalDiscountBtns}>
              <button
                type="button"
                className={styles.btnEditDiscount}
                onClick={openGlobalDiscountModal}
              >
                ✏️ Editar
              </button>
              <button
                type="button"
                className={styles.btnRemoveDiscount}
                onClick={removeGlobalDiscount}
              >
                ✕ Quitar
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderCheckoutForm = (customerInputId: string) => (
    <div className={styles.checkoutFormSection}>
      <div className={styles.formGroup}>
        <label htmlFor={customerInputId} className={styles.formLabel}>
          Cliente <span className={styles.labelOptionalCaja}>(Opcional)</span>
        </label>
        <input
          id={customerInputId}
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className={styles.formInput}
          placeholder="Nombre del cliente"
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.formLabel}>Método de pago</label>
        <div className={styles.paymentMethodGrid}>
          <button
            type="button"
            className={`${styles.paymentMethodBtn} ${paymentMethod === 'EFECTIVO' ? styles.active : ''}`}
            onClick={() => setPaymentMethod('EFECTIVO')}
          >
            💵 Efectivo
          </button>
          <button
            type="button"
            className={`${styles.paymentMethodBtn} ${paymentMethod === 'YAPE' ? styles.active : ''}`}
            onClick={() => setPaymentMethod('YAPE')}
          >
            📱 Yape
          </button>
          <button
            type="button"
            className={`${styles.paymentMethodBtn} ${paymentMethod === 'TRANSFERENCIA' ? styles.active : ''}`}
            onClick={() => setPaymentMethod('TRANSFERENCIA')}
          >
            🏦 Transfer.
          </button>
          <button
            type="button"
            className={`${styles.paymentMethodBtn} ${paymentMethod === 'TARJETA' ? styles.active : ''}`}
            onClick={() => setPaymentMethod('TARJETA')}
          >
            💳 Tarjeta
          </button>
        </div>

        {(paymentMethod === 'YAPE' || paymentMethod === 'TRANSFERENCIA') && (
          <div className={styles.paymentInfoCard}>
            <div className={styles.paymentInfoHeader}>
              {paymentMethod === 'YAPE' ? 'Paga con Yape' : 'Transferencia BCP'}
            </div>
            {paymentMethod === 'YAPE' && (
              <div className={styles.paymentInfoContent}>
                <div className={styles.paymentInfoRow}>
                  <Image
                    src={PAYMENT_INFO.yapeQrPath}
                    alt="QR Yape"
                    width={180}
                    height={180}
                    quality={75}
                    sizes="180px"
                    className={styles.paymentQr}
                    loading="lazy"
                  />
                  <div className={styles.paymentInfoText}>
                    <div className={styles.paymentLabel}>Titular</div>
                    <div className={styles.paymentValue}>{PAYMENT_INFO.holder}</div>
                    <div className={styles.paymentNote}>Escanea el QR para pagar con Yape.</div>
                  </div>
                </div>
              </div>
            )}
            {paymentMethod === 'TRANSFERENCIA' && (
              <div className={styles.paymentInfoContent}>
                <div className={styles.paymentInfoRow}>
                  <div className={styles.paymentInfoText}>
                    <div className={styles.paymentLabel}>Cuenta BCP (S/)</div>
                    <div className={styles.paymentValue}>{PAYMENT_INFO.accountBcp}</div>
                  </div>
                </div>
                <div className={styles.paymentInfoRow}>
                  <div className={styles.paymentInfoText}>
                    <div className={styles.paymentLabel}>CCI</div>
                    <div className={styles.paymentValue}>{PAYMENT_INFO.cci}</div>
                  </div>
                </div>
                <div className={styles.paymentNote}>Confirma el monto antes de transferir.</div>
              </div>
            )}
            <div className={styles.paymentActions}>
              <button
                type="button"
                className={styles.paymentPrimaryBtn}
                onClick={() => handleSharePayment(paymentMethod)}
              >
                📤 Compartir por WhatsApp
              </button>
              <button
                type="button"
                className={styles.paymentSecondaryBtn}
                onClick={() => handleCopyPayment(paymentMethod)}
              >
                📋 Copiar datos
              </button>
              {copyStatus === 'copied' && <span className={styles.copyOk}>Copiado</span>}
              {copyStatus === 'error' && <span className={styles.copyError}>No se pudo copiar</span>}
            </div>
          </div>
        )}
      </div>

      <Button
        variant="success"
        disabled={loading || cart.length === 0}
        onClick={() => handleCheckout(false)}
        className={styles.btnCheckout}
      >
        {loading ? 'Procesando...' : `COBRAR ${formatMoneyPEN(total)}`}
      </Button>
    </div>
  )

  return (
    <>
      <Header user={user} />

      {/* Modal de stock insuficiente */}
      {insufficientStockError && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>⚠️ Stock Insuficiente</h2>
              <button
                className={styles.modalClose}
                onClick={() => {
                  setInsufficientStockError(null)
                  setOverrideNote('')
                }}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <p>
                <strong>{insufficientStockError.productName}</strong> no tiene stock suficiente.
              </p>
              <p>
                Disponible: {insufficientStockError.available} {insufficientStockError.unitBase}
                <br />
                Requiere: {insufficientStockError.requiredBaseQty} {insufficientStockError.unitBase}
              </p>

              {user.role === 'ADMIN' && (
                <>
                  <p className={styles.infoText}>
                    Como administrador, puedes confirmar esta venta igualmente (stock físico sí había).
                  </p>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Razón (opcional)</label>
                    <textarea
                      value={overrideNote}
                      onChange={(e) => setOverrideNote(e.target.value)}
                      className={styles.textarea}
                      placeholder="Ej: Stock físico verificado en almacén"
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>

            <div className={styles.modalFooter}>
              <Button
                variant="secondary"
                onClick={() => {
                  setInsufficientStockError(null)
                  setOverrideNote('')
                }}
              >
                Cancelar
              </Button>
              {user.role === 'ADMIN' && (
                <Button variant="success" onClick={() => handleCheckout(true)}>
                  Confirmar Venta (Stock Físico)
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={styles.container}>
        <div className={styles.layout}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>🔍 Productos</h2>

            <div className={styles.searchBox}>
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Nombre, código o SKU..."
                loading={isSearching || isStale}
              />
            </div>

            <div
              className={styles.productsGrid}
              style={isMounted ? { paddingBottom: `${dynamicPadding}px` } : undefined}
            >
              {products.length === 0 && search && (
                <div className={styles.noResults}>No se encontraron productos</div>
              )}
              {products.map((product) => (
                <div
                  key={product.id}
                  className={styles.productCard}
                  onClick={() => addToCart(product)}
                >
                  <div className={styles.productCardInfo}>
                    <div className={styles.productName}>{product.name}</div>
                    <div className={styles.productMeta}>
                      <span className={styles.productSku}>{product.sku}</span>
                      <span className={styles.productStock}>
                        Stock: {product.stock} {product.unit}
                      </span>
                    </div>
                  </div>
                  <div className={styles.productPrice}>
                    {formatMoneyPEN(product.price)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Carrito flotante para abrir panel en móvil */}
          {isMounted ? (
            <button
              ref={floatingCartBtnRef}
              className={floatingCartBtnClassName}
              onClick={() => {
                setCartStep('list')
                setCartOpen(true)
              }}
              aria-label={floatingCartAriaLabel}
            >
              <span className={styles.floatingCartIconWrap}>
                <span className={styles.floatingCartIcon}>🛒</span>
                <span className={styles.floatingCartBadge}>{floatingCartCount}</span>
              </span>
              <span className={styles.floatingCartInfo}>
                <span className={styles.floatingCartItems}>
                  {floatingCartCount} {floatingCartProductsLabel}
                </span>
                <span className={styles.floatingCartTotal}>{floatingCartTotalText}</span>
              </span>
              <span className={styles.floatingCartAction}>Ver carrito</span>
            </button>
          ) : null}

          {/* Cart Wrapper - Bottom Sheet en móvil, normal en desktop */}
          <div className={`${styles.cartWrapper} ${cartOpen ? styles.open : ''}`} onClick={() => setCartOpen(false)}>
            <div className={`${styles.cartSection} ${cartStep === 'payment' ? styles.cartPaymentActive : ''}`} onClick={(e) => e.stopPropagation()}>
              
              {/* Header sticky con drag handle visual */}
              <div className={styles.cartHeader}>
                <div className={styles.dragHandle} aria-hidden="true"></div>
                <div className={styles.cartHeaderContent}>
                  <h2 className={styles.cartTitle}>🛒 Carrito ({cart.length})</h2>
                  <button 
                    className={styles.cartCloseBtn} 
                    onClick={() => setCartOpen(false)}
                    aria-label="Cerrar carrito"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {cart.length === 0 ? (
                <div className={styles.emptyCartState}>
                  <svg className={styles.emptyCartIllustration} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="56" fill="var(--bg-alt)" stroke="var(--border)" strokeWidth="2"/>
                    <path d="M35 45h8l8 30h30l6-20H50" stroke="var(--text-muted)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <circle cx="55" cy="82" r="4" fill="var(--text-muted)"/>
                    <circle cx="78" cy="82" r="4" fill="var(--text-muted)"/>
                    <path d="M52 58h20M62 52v12" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" opacity="0.5"/>
                  </svg>
                  <p className={styles.emptyCartText}>Aún no hay productos</p>
                  <p className={styles.emptyCartSubtext}>¡Empieza buscando uno arriba!</p>
                </div>
              ) : (
                <>
                  {/* Paso 1: listado compacto de productos */}
                  <div className={styles.cartMobileListView}>
                    {/* Body scrolleable - SOLO productos */}
                    <div className={styles.cartBody}>
                      <div className={styles.cartItemsList}>
                        {cart.map((item, idx) => {
                          const effectivePresentation = getEffectivePresentation(item)
                          const unitPrice = getUnitPrice(item)
                          const originalUnitPrice = effectivePresentation?.computedUnitPrice ||
                            item.presentation?.computedUnitPrice ||
                            item.product.presentations?.find(p => p.isDefault)?.computedUnitPrice ||
                            item.product.price || 0
                          const unit = getEffectiveUnit(item)
                          const isDecimal = unitAllowsDecimals(unit)
                          const subtotalItem = roundToDecimals(unitPrice * item.soldQty, 2)

                          const selectedPresentationId =
                            item.presentationId ||
                            item.product.presentations?.find((p) => p.isDefault)?.id ||
                            item.product.presentations?.[0]?.id ||
                            ''

                          return (
                            <div key={`${item.product.id}-${item.presentationId}-${idx}`} className={styles.cartItem}>
                              <div className={styles.cartItemTop}>
                                <div className={styles.cartItemHeader}>
                                  <div className={styles.cartItemName}>
                                    {item.product.name}
                                    {item.presentation && item.presentation.name.toUpperCase() !== unit.toUpperCase() && (
                                      <span className={styles.cartItemPresentation}> · {item.presentation.name}</span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  className={styles.cartItemRemove}
                                  onClick={() => removeFromCart(item.product.id, item.presentationId)}
                                  aria-label="Eliminar producto"
                                  title="Eliminar"
                                >
                                  🗑
                                </button>
                              </div>

                              <div className={styles.cartItemMainRow}>
                                <div className={styles.cartItemControls}>
                                  <div className={styles.quantityControls}>
                                    <button
                                      className={styles.quantityBtn}
                                      onClick={() => {
                                        const allowsDecimals = determineAllowsDecimals(unit)
                                        const step = determineStep(unit, allowsDecimals)
                                        const min = allowsDecimals ? 0.001 : 1
                                        const currentQty = normalizeQty(item.draftQty || item.soldQty, { step, min, allowAnyDecimal: true }) || item.soldQty
                                        const newQty = Math.max(min, currentQty - step)
                                        const normalized = normalizeQty(newQty, { step, min })
                                        if (normalized && normalized >= min) {
                                          setCart(
                                            cart.map((cartItem, cartIdx) => {
                                              if (cartIdx === idx) {
                                                return { ...cartItem, soldQty: normalized, draftQty: String(normalized) }
                                              }
                                              return cartItem
                                            })
                                          )
                                        }
                                      }}
                                      aria-label="Disminuir cantidad"
                                    >−</button>
                                    <div className={styles.quantityDisplay}>
                                      <input
                                        type="text"
                                        inputMode={isDecimal ? 'decimal' : 'numeric'}
                                        value={item.draftQty !== undefined ? item.draftQty : item.soldQty}
                                        onChange={(e) => {
                                          let value = e.target.value
                                          value = value.replace(',', '.')
                                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                            setCart(
                                              cart.map((cartItem, cartIdx) => {
                                                if (cartIdx === idx) {
                                                  return { ...cartItem, draftQty: value }
                                                }
                                                return cartItem
                                              })
                                            )
                                          }
                                        }}
                                        onBlur={() => {
                                          const allowsDecimals = determineAllowsDecimals(unit)
                                          const step = determineStep(unit, allowsDecimals)
                                          const min = allowsDecimals ? 0.001 : 1
                                          const currentDraft = item.draftQty
                                          if (!currentDraft || currentDraft.trim() === '') {
                                            setCart(cart.map((cartItem, cartIdx) => {
                                              if (cartIdx === idx) return { ...cartItem, draftQty: String(item.soldQty) }
                                              return cartItem
                                            }))
                                            return
                                          }
                                          const normalized = normalizeQty(currentDraft, { step, min, allowAnyDecimal: true })
                                          if (normalized && normalized >= min) {
                                            setCart(cart.map((cartItem, cartIdx) => {
                                              if (cartIdx === idx) return { ...cartItem, soldQty: normalized, draftQty: String(normalized) }
                                              return cartItem
                                            }))
                                          } else {
                                            setCart(cart.map((cartItem, cartIdx) => {
                                              if (cartIdx === idx) return { ...cartItem, soldQty: min, draftQty: String(min) }
                                              return cartItem
                                            }))
                                          }
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                        className={styles.quantityInput}
                                        aria-label="Cantidad"
                                      />
                                      <span className={styles.quantityUnit}>{unit}</span>
                                    </div>
                                    <button
                                      className={styles.quantityBtn}
                                      onClick={() => {
                                        const allowsDecimals = determineAllowsDecimals(unit)
                                        const step = determineStep(unit, allowsDecimals)
                                        const min = allowsDecimals ? 0.001 : 1
                                        const currentQty = normalizeQty(item.draftQty || item.soldQty, { step, min, allowAnyDecimal: true }) || item.soldQty
                                        const newQty = currentQty + step
                                        const normalized = normalizeQty(newQty, { step, min })
                                        if (normalized) {
                                          setCart(
                                            cart.map((cartItem, cartIdx) => {
                                              if (cartIdx === idx) {
                                                return { ...cartItem, soldQty: normalized, draftQty: String(normalized) }
                                              }
                                              return cartItem
                                            })
                                          )
                                        }
                                      }}
                                      aria-label="Aumentar cantidad"
                                    >+</button>
                                  </div>

                                  {item.product.presentations && item.product.presentations.length > 1 && (
                                    <div className={styles.presentationSelector}>
                                      <select
                                        value={selectedPresentationId}
                                        onChange={(e) => {
                                          const newPresentationId = e.target.value
                                          const newPresentation =
                                            item.product.presentations?.find((p) => p.id === newPresentationId) || null
                                          const newUnit = newPresentation?.unit || item.product.unit
                                          const allowsDecimals = determineAllowsDecimals(newUnit)
                                          const step = determineStep(newUnit, allowsDecimals)
                                          const min = allowsDecimals ? 0.001 : 1
                                          const normalized = normalizeQty(item.soldQty, { step, min, allowAnyDecimal: true }) || min
                                          setCart(
                                            cart.map((cartItem, cartIdx) => {
                                              if (cartIdx === idx) {
                                                return {
                                                  ...cartItem,
                                                  presentationId: newPresentationId || null,
                                                  presentation: newPresentation,
                                                  soldQty: normalized,
                                                  draftQty: String(normalized),
                                                  unitType: newUnit,
                                                  presentationUnit: newPresentation?.unit || undefined,
                                                }
                                              }
                                              return cartItem
                                            })
                                          )
                                        }}
                                        className={styles.presentationSelect}
                                      >
                                        {item.product.presentations.map((pres) => (
                                          <option key={pres.id} value={pres.id}>
                                            {pres.name} {pres.factorToBase > 1 ? `(${pres.factorToBase} ${pres.unit})` : ''}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>

                                <div className={styles.cartItemPricing}>
                                  <span className={styles.priceSubtotal}>{formatMoneyPEN(subtotalItem)}</span>
                                  <div className={styles.priceMetaLine}>
                                    {item.priceAdjusted && (
                                      <>
                                        <span className={styles.badgeAdjusted} title={item.priceAdjustNote}>Desc.</span>
                                        <span className={styles.priceOriginal}>{formatMoneyPEN(originalUnitPrice)}</span>
                                      </>
                                    )}
                                    <span className={styles.priceUnit}>{formatMoneyPEN(unitPrice)}/{unit}</span>
                                    {user.role === 'ADMIN' && (
                                      <div className={styles.adminActions}>
                                        {!item.priceAdjusted ? (
                                          <button
                                            className={styles.btnAdjustPrice}
                                            onClick={() => openPriceAdjustModal(idx)}
                                            title="Ajustar precio"
                                          >💰</button>
                                        ) : (
                                          <button
                                            className={styles.btnRemoveAdjust}
                                            onClick={() => removePriceAdjust(idx)}
                                            title="Quitar ajuste de precio"
                                          >✕</button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className={styles.cartFooterMobile}>
                      <div className={styles.mobileTotalRow}>
                        <span className={styles.mobileTotalLabel}>Total a Pagar</span>
                        <span className={styles.mobileTotalValue}>{formatMoneyPEN(total)}</span>
                      </div>
                      <button
                        type="button"
                        className={styles.btnGoToPay}
                        onClick={() => setCartStep('payment')}
                        disabled={loading || cart.length === 0}
                      >
                        Siguiente: Pagar
                      </button>
                    </div>
                  </div>

                  {/* Paso 2: formulario y confirmación de pago */}
                  <div className={styles.cartMobilePaymentView}>
                    <div className={styles.cartPaymentHeaderMobile}>
                      <button
                        type="button"
                        className={styles.btnBackToList}
                        onClick={() => setCartStep('list')}
                      >
                        ← Volver atrás
                      </button>
                      <div className={styles.cartPaymentTotalMobile}>
                        <span className={styles.mobileTotalLabel}>Total a Pagar</span>
                        <span className={styles.mobileTotalValue}>{formatMoneyPEN(total)}</span>
                      </div>
                    </div>
                    <div className={styles.cartPaymentBodyMobile}>
                      {renderGlobalDiscountActions()}
                      {renderCheckoutForm('customerNameMobile')}
                    </div>
                  </div>

                  {/* Footer completo en desktop */}
                  <div className={styles.cartFooter}>

                    {/* Resumen de totales */}
                    <div className={styles.totalsSection}>
                      <div className={styles.totalRow}>
                        <span className={styles.totalLabel}>Subtotal</span>
                        <span className={styles.totalValue}>{formatMoneyPEN(subtotal)}</span>
                      </div>
                      {tax > 0 && (
                        <div className={styles.totalRow}>
                          <span className={styles.totalLabel}>Impuestos</span>
                          <span className={styles.totalValue}>{formatMoneyPEN(tax)}</span>
                        </div>
                      )}

                      {/* Línea de descuento global */}
                      {globalDiscount.active && (
                        <div className={`${styles.totalRow} ${styles.discountRow}`}>
                          <span className={styles.discountLabel}>
                            🏷️ Bonificación
                            <span className={styles.discountDetail}>
                              ({globalDiscount.mode === 'PORCENTAJE' ? `${globalDiscount.value}%` : 'Fijo'})
                            </span>
                          </span>
                          <span className={styles.discountValue}>- {formatMoneyPEN(globalDiscountAmount)}</span>
                        </div>
                      )}

                      {renderGlobalDiscountActions()}

                      <div className={styles.totalRowFinal}>
                        <span className={styles.totalLabelFinal}>Total a Pagar</span>
                        <span className={styles.totalValueFinal}>{formatMoneyPEN(total)}</span>
                      </div>
                    </div>

                    {renderCheckoutForm('customerNameDesktop')}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <ShareWhatsAppModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        onShare={handleShareModalConfirm}
        loading={shareLoading}
      />

      {/* Modal de ajuste de precio */}
      {priceAdjustModal.show && priceAdjustModal.itemIndex !== null && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>💰 Ajustar Precio</h2>
              <button
                className={styles.modalClose}
                onClick={() =>
                  setPriceAdjustModal({
                    show: false,
                    itemIndex: null,
                    mode: 'DESCUENTO_PORCENTAJE',
                    value: 0,
                    reason: ''
                  })
                }
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              {(() => {
                const item = cart[priceAdjustModal.itemIndex]
                const originalPrice = getUnitPrice(item)
                let previewPrice = originalPrice

                if (priceAdjustModal.mode === 'DESCUENTO_PORCENTAJE') {
                  previewPrice = originalPrice * (1 - priceAdjustModal.value / 100)
                } else if (priceAdjustModal.mode === 'DESCUENTO_MONTO') {
                  previewPrice = originalPrice - priceAdjustModal.value
                } else if (priceAdjustModal.mode === 'PRECIO_MANUAL') {
                  previewPrice = priceAdjustModal.value
                }

                return (
                  <>
                    <p>
                      <strong>{item.product.name}</strong>
                      {item.presentation && ` (${item.presentation.name})`}
                    </p>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Modo de ajuste</label>
                      <select
                        value={priceAdjustModal.mode}
                        onChange={(e) =>
                          setPriceAdjustModal({
                            ...priceAdjustModal,
                            mode: e.target.value as any
                          })
                        }
                        className={styles.select}
                      >
                        <option value="DESCUENTO_PORCENTAJE">Descuento %</option>
                        <option value="DESCUENTO_MONTO">Descuento S/</option>
                        <option value="PRECIO_MANUAL">Precio manual</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>
                        {priceAdjustModal.mode === 'DESCUENTO_PORCENTAJE'
                          ? 'Porcentaje de descuento'
                          : priceAdjustModal.mode === 'DESCUENTO_MONTO'
                          ? 'Monto a descontar (S/)'
                          : 'Nuevo precio (S/)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceAdjustModal.value}
                        onChange={(e) =>
                          setPriceAdjustModal({
                            ...priceAdjustModal,
                            value: parseFloat(e.target.value) || 0
                          })
                        }
                        className={styles.input}
                        placeholder={
                          priceAdjustModal.mode === 'DESCUENTO_PORCENTAJE'
                            ? 'Ej: 10'
                            : 'Ej: 5.00'
                        }
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Razón del ajuste *</label>
                      <textarea
                        value={priceAdjustModal.reason}
                        onChange={(e) =>
                          setPriceAdjustModal({
                            ...priceAdjustModal,
                            reason: e.target.value
                          })
                        }
                        className={styles.textarea}
                        placeholder="Ej: Cliente frecuente, promoción especial, producto dañado..."
                        rows={3}
                        required
                      />
                    </div>

                    <div className={styles.pricePreview}>
                      <div className={styles.previewRow}>
                        <span>Precio original:</span>
                        <span className={styles.originalPriceText}>
                          {formatMoneyPEN(originalPrice)}
                        </span>
                      </div>
                      <div className={styles.previewRow}>
                        <span>Precio final:</span>
                        <span
                          className={
                            previewPrice > 0
                              ? styles.finalPriceText
                              : styles.invalidPriceText
                          }
                        >
                          {formatMoneyPEN(previewPrice)}
                        </span>
                      </div>
                      {previewPrice <= 0 && (
                        <p className={styles.errorText}>
                          ⚠️ El precio resultante debe ser mayor a 0
                        </p>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>

            <div className={styles.modalFooter}>
              <Button
                variant="secondary"
                onClick={() =>
                  setPriceAdjustModal({
                    show: false,
                    itemIndex: null,
                    mode: 'DESCUENTO_PORCENTAJE',
                    value: 0,
                    reason: ''
                  })
                }
              >
                Cancelar
              </Button>
              <Button variant="primary" onClick={applyPriceAdjust}>
                Aplicar Ajuste
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <BottomNav userRole={user.role} isCartOpen={cartOpen} />

      {/* Modal de descuento global a la venta */}
      {globalDiscountModal.show && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>🏷️ Descuento a la Venta</h2>
              <button
                className={styles.modalClose}
                onClick={() =>
                  setGlobalDiscountModal({ show: false, mode: 'PORCENTAJE', value: 0, reason: '' })
                }
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              {(() => {
                let previewDiscount = 0
                if (globalDiscountModal.mode === 'PORCENTAJE') {
                  previewDiscount = roundToDecimals(subtotal * (globalDiscountModal.value / 100), 2)
                } else {
                  previewDiscount = Math.min(globalDiscountModal.value, subtotal)
                }
                const previewTotal = subtotal - previewDiscount

                return (
                  <>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Tipo de descuento</label>
                      <select
                        value={globalDiscountModal.mode}
                        onChange={(e) =>
                          setGlobalDiscountModal({
                            ...globalDiscountModal,
                            mode: e.target.value as 'PORCENTAJE' | 'MONTO_FIJO',
                            value: 0
                          })
                        }
                        className={styles.select}
                      >
                        <option value="PORCENTAJE">Descuento Porcentual (%)</option>
                        <option value="MONTO_FIJO">Descuento Fijo (Monto Exacto)</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>
                        {globalDiscountModal.mode === 'PORCENTAJE'
                          ? 'Porcentaje de descuento (%)'
                          : 'Monto a descontar (S/)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={globalDiscountModal.mode === 'PORCENTAJE' ? '100' : undefined}
                        step="0.01"
                        value={globalDiscountModal.value || ''}
                        onChange={(e) =>
                          setGlobalDiscountModal({
                            ...globalDiscountModal,
                            value: parseFloat(e.target.value) || 0
                          })
                        }
                        className={styles.input}
                        placeholder={
                          globalDiscountModal.mode === 'PORCENTAJE'
                            ? 'Ej: 10'
                            : 'Ej: 5.00'
                        }
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Motivo de la bonificación *</label>
                      <textarea
                        value={globalDiscountModal.reason}
                        onChange={(e) =>
                          setGlobalDiscountModal({
                            ...globalDiscountModal,
                            reason: e.target.value
                          })
                        }
                        className={styles.textarea}
                        placeholder="Ej: Cliente frecuente, compra al por mayor, promoción del día..."
                        rows={3}
                        required
                      />
                    </div>

                    <div className={styles.pricePreview}>
                      <div className={styles.previewRow}>
                        <span>Subtotal actual:</span>
                        <span>{formatMoneyPEN(subtotal)}</span>
                      </div>
                      <div className={styles.previewRow}>
                        <span>Descuento:</span>
                        <span className={styles.discountPreviewValue}>
                          - {formatMoneyPEN(previewDiscount)}
                        </span>
                      </div>
                      <div className={styles.previewRow}>
                        <span>Total resultante:</span>
                        <span
                          className={
                            previewTotal > 0
                              ? styles.finalPriceText
                              : styles.invalidPriceText
                          }
                        >
                          {formatMoneyPEN(previewTotal)}
                        </span>
                      </div>
                      {previewTotal <= 0 && (
                        <p className={styles.errorText}>
                          ⚠️ El total resultante debe ser mayor a 0
                        </p>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>

            <div className={styles.modalFooter}>
              <Button
                variant="secondary"
                onClick={() =>
                  setGlobalDiscountModal({ show: false, mode: 'PORCENTAJE', value: 0, reason: '' })
                }
              >
                Cancelar
              </Button>
              <Button variant="primary" onClick={applyGlobalDiscount}>
                Aplicar Bonificación
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
