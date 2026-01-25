'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/ui/components/Header'
import { BottomNav } from '@/ui/components/BottomNav'
import { Button } from '@/ui/components/Button'
import { formatMoneyPEN, roundToDecimals } from '@/lib/format-money'
import { useToast } from '@/ui/components/Toast/ToastContext'
import styles from './caja.module.css'

// Utilidad para normalizar cantidades y evitar errores de punto flotante
function normalizeQty(value: string | number, options: { step: number; min: number }): number | null {
  const { step, min } = options
  const parsed = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(parsed)) return null

  // Clamp al mínimo
  let qty = Math.max(min, parsed)

  // Cuantizar a múltiplos del step
  qty = Math.round(qty / step) * step

  // Redondear para evitar errores de punto flotante
  const decimals = step % 1 === 0 ? 0 : String(step).split('.')[1]?.length || 0
  qty = parseFloat(qty.toFixed(decimals))

  return qty
}

// Determinar si una unidad permite decimales
function determineAllowsDecimals(unit: string): boolean {
  const lowerUnit = unit.toLowerCase()
  return ['kg', 'kilo', 'lt', 'l', 'm', 'g', 'ml'].includes(lowerUnit)
}

// Determinar el step adecuado para una unidad
function determineStep(unit: string, allowsDecimals: boolean): number {
  if (!allowsDecimals) return 1
  
  // Para unidades fraccionables, usar 0.5 (medio kilo, medio litro, etc.)
  return 0.5
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
  unit: string
  presentations?: ProductPresentation[]
}

interface CartItem {
  product: Product
  presentationId: string | null
  presentation: ProductPresentation | null
  soldQty: number
  adjustedUnitPrice?: number
  priceAdjustNote?: string
  priceAdjusted?: boolean
  draftQty?: string // Estado temporal del input para permitir edición
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
}

export function CajaView({ user }: CajaViewProps) {
  const { notify } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO')
  const [loading, setLoading] = useState(false)
  const [insufficientStockError, setInsufficientStockError] = useState<InsufficientStockError | null>(null)
  const [overrideNote, setOverrideNote] = useState('')
  const [cartOpen, setCartOpen] = useState(false) // Estado para abrir/cerrar carrito en móvil

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
  })

  useEffect(() => {
    loadProducts()
  }, [search])

  const loadProducts = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      params.append('isActive', 'true')
      params.append('limit', '20')

      const res = await fetch(`/api/products?${params}`)
      const data = await res.json()
      setProducts(data.products.filter((p: Product) => p.stock > 0))
    } catch (error) {
      console.error('Error cargando productos:', error)
    }
  }

  const unitAllowsDecimals = (unit: string): boolean => {
    return ['METRO', 'LITRO', 'KILO'].includes(unit)
  }

  const addToCart = (product: Product) => {
    // Obtener presentación por defecto
    const defaultPresentation = product.presentations?.find((p) => p.isDefault) || product.presentations?.[0] || null

    const existing = cart.find(
      (item) => item.product.id === product.id && item.presentationId === (defaultPresentation?.id || null)
    )

    if (existing) {
      // Incrementar cantidad existente
      const unit = defaultPresentation?.unit || product.unit
      const allowsDecimals = determineAllowsDecimals(unit)
      const step = determineStep(unit, allowsDecimals)
      
      const currentQty = existing.soldQty
      const newQty = currentQty + step
      const normalized = normalizeQty(newQty, { step, min: step })
      
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
      const unit = defaultPresentation?.unit || product.unit
      const allowsDecimals = determineAllowsDecimals(unit)
      const step = determineStep(unit, allowsDecimals)
      const initialQty = step // Comenzar con el step mínimo
      
      setCart([
        ...cart,
        {
          product,
          presentationId: defaultPresentation?.id || null,
          presentation: defaultPresentation || null,
          soldQty: initialQty,
          draftQty: String(initialQty),
        },
      ])
    }
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
    const originalPrice = item.presentation?.computedUnitPrice || 0
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

  // Calcular unitPrice basado en presentación (usando computedUnitPrice del backend)
  const getUnitPrice = (item: CartItem): number => {
    // Si hay precio ajustado manualmente, usar ese
    if (item.adjustedUnitPrice !== undefined) {
      return item.adjustedUnitPrice
    }
    // Sino, usar el precio calculado de la presentación
    if (!item.presentation) return 0
    return item.presentation.computedUnitPrice
  }

  const subtotal = cart.reduce((sum, item) => {
    const unitPrice = getUnitPrice(item)
    return sum + unitPrice * item.soldQty
  }, 0)
  const tax = 0
  const total = subtotal + tax

  const handleCheckout = async (forcePhysicalStock: boolean = false) => {
    if (cart.length === 0) {
      notify({ type: 'warning', title: 'Carrito vacío', message: 'Agrega productos antes de finalizar' })
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName || undefined,
          paymentMethod,
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
      loadProducts()
    } catch (error) {
      console.error('Error en checkout:', error)
      notify({ type: 'error', title: 'Error al procesar', message: 'No se pudo completar la venta' })
    } finally {
      setLoading(false)
    }
  }

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
        <h1 className={styles.title}>Punto de Venta</h1>

        <div className={styles.layout}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Productos</h2>

            <div className={styles.searchBox}>
              <input
                type="text"
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <div className={styles.productsGrid}>
              {products.map((product) => (
                <div
                  key={product.id}
                  className={styles.productCard}
                  onClick={() => addToCart(product)}
                >
                  <div className={styles.productSku}>{product.sku}</div>
                  <div className={styles.productName}>{product.name}</div>
                  <div className={styles.productPrice}>
                    {formatMoneyPEN(product.price)}
                  </div>
                  <div className={styles.productStock}>
                    Stock: {product.stock} {product.unit}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Botón flotante para abrir carrito en móvil */}
          <button 
            className={styles.floatingCartBtn}
            onClick={() => setCartOpen(true)}
          >
            <span className={styles.floatingCartIcon}>🛒</span>
            <span className={styles.floatingCartBadge}>{cart.length}</span>
          </button>

          {/* Cart Wrapper - Bottom Sheet en móvil, normal en desktop */}
          <div className={`${styles.cartWrapper} ${cartOpen ? styles.open : ''}`} onClick={() => setCartOpen(false)}>
            <div className={styles.cartSection} onClick={(e) => e.stopPropagation()}>
              
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
                  <div className={styles.emptyCartIcon}>🛒</div>
                  <p className={styles.emptyCartText}>Tu carrito está vacío</p>
                  <p className={styles.emptyCartSubtext}>Agrega productos para comenzar</p>
                </div>
              ) : (
                <>
                  {/* Body scrolleable - SOLO productos */}
                  <div className={styles.cartBody}>
                    <div className={styles.cartItemsList}>
                      {cart.map((item, idx) => {
                        const unitPrice = getUnitPrice(item)
                        const originalUnitPrice = item.presentation?.computedUnitPrice || 0
                        const unit = item.presentation?.unit || item.product.unit
                        const isDecimal = unitAllowsDecimals(unit)
                        const subtotalItem = roundToDecimals(unitPrice * item.soldQty, 2)

                        return (
                          <div key={`${item.product.id}-${item.presentationId}-${idx}`} className={styles.cartItem}>
                            
                            {/* Header del item: nombre y botón eliminar */}
                            <div className={styles.cartItemHeader}>
                              <div className={styles.cartItemName}>
                                {item.product.name}
                                {item.presentation && item.presentation.name !== item.product.unit && (
                                  <span className={styles.cartItemPresentation}> · {item.presentation.name}</span>
                                )}
                              </div>
                              <button
                                className={styles.cartItemRemove}
                                onClick={() => removeFromCart(item.product.id, item.presentationId)}
                                aria-label="Eliminar producto"
                                title="Eliminar"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Badges de estado */}
                            {item.priceAdjusted && (
                              <div className={styles.badgeAdjusted} title={item.priceAdjustNote}>
                                🏷️ Precio ajustado
                              </div>
                            )}

                            {/* Selector de presentación si hay múltiples */}
                            {item.product.presentations && item.product.presentations.length > 1 && (
                              <div className={styles.presentationSelector}>
                                <select
                                  value={item.presentationId || ''}
                                  onChange={(e) => {
                                    const newPresentationId = e.target.value
                                    const newPresentation =
                                      item.product.presentations?.find((p) => p.id === newPresentationId) || null
                                    
                                    // Al cambiar presentación, recalcular qty basado en nueva unidad
                                    const newUnit = newPresentation?.unit || item.product.unit
                                    const allowsDecimals = determineAllowsDecimals(newUnit)
                                    const step = determineStep(newUnit, allowsDecimals)
                                    
                                    // Normalizar la cantidad actual con el nuevo step
                                    const normalized = normalizeQty(item.soldQty, { step, min: step }) || step
                                    
                                    setCart(
                                      cart.map((cartItem, cartIdx) => {
                                        if (cartIdx === idx) {
                                          return {
                                            ...cartItem,
                                            presentationId: newPresentationId || null,
                                            presentation: newPresentation,
                                            soldQty: normalized,
                                            draftQty: String(normalized),
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

                            {/* Precio y cantidad */}
                            <div className={styles.cartItemPricing}>
                              <div className={styles.priceInfo}>
                                {item.priceAdjusted && (
                                  <div className={styles.priceOriginal}>
                                    {formatMoneyPEN(originalUnitPrice)}
                                  </div>
                                )}
                                <div className={styles.priceUnit}>
                                  {formatMoneyPEN(unitPrice)} / unidad
                                </div>
                              </div>
                              <div className={styles.priceSubtotal}>
                                {formatMoneyPEN(subtotalItem)}
                              </div>
                            </div>

                            {/* Controles de cantidad - botones grandes táctiles */}
                            <div className={styles.quantityControls}>
                              <button
                                className={styles.quantityBtn}
                                onClick={() => {
                                  const allowsDecimals = determineAllowsDecimals(unit)
                                  const step = determineStep(unit, allowsDecimals)
                                  const min = step
                                  
                                  // Obtener cantidad actual (usar draftQty si existe y es válido, sino soldQty)
                                  const currentQty = normalizeQty(item.draftQty || item.soldQty, { step, min }) || item.soldQty
                                  const newQty = Math.max(min, currentQty - step)
                                  const normalized = normalizeQty(newQty, { step, min })
                                  
                                  if (normalized && normalized >= min) {
                                    setCart(
                                      cart.map((cartItem, cartIdx) => {
                                        if (cartIdx === idx) {
                                          return {
                                            ...cartItem,
                                            soldQty: normalized,
                                            draftQty: String(normalized),
                                          }
                                        }
                                        return cartItem
                                      })
                                    )
                                  }
                                }}
                                aria-label="Disminuir cantidad"
                              >
                                −
                              </button>
                              <div className={styles.quantityDisplay}>
                                <input
                                  type="text"
                                  inputMode={isDecimal ? 'decimal' : 'numeric'}
                                  value={item.draftQty !== undefined ? item.draftQty : item.soldQty}
                                  onChange={(e) => {
                                    let value = e.target.value
                                    
                                    // Reemplazar coma por punto
                                    value = value.replace(',', '.')
                                    
                                    // Permitir: vacío, números, punto decimal, cero
                                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                      setCart(
                                        cart.map((cartItem, cartIdx) => {
                                          if (cartIdx === idx) {
                                            return {
                                              ...cartItem,
                                              draftQty: value,
                                            }
                                          }
                                          return cartItem
                                        })
                                      )
                                    }
                                  }}
                                  onBlur={() => {
                                    const allowsDecimals = determineAllowsDecimals(unit)
                                    const step = determineStep(unit, allowsDecimals)
                                    const min = step
                                    
                                    const currentDraft = item.draftQty
                                    
                                    // Si está vacío o inválido, restaurar a soldQty actual o mínimo
                                    if (!currentDraft || currentDraft.trim() === '') {
                                      setCart(
                                        cart.map((cartItem, cartIdx) => {
                                          if (cartIdx === idx) {
                                            return {
                                              ...cartItem,
                                              draftQty: String(item.soldQty),
                                            }
                                          }
                                          return cartItem
                                        })
                                      )
                                      return
                                    }
                                    
                                    // Normalizar y aplicar
                                    const normalized = normalizeQty(currentDraft, { step, min })
                                    
                                    if (normalized && normalized >= min) {
                                      setCart(
                                        cart.map((cartItem, cartIdx) => {
                                          if (cartIdx === idx) {
                                            return {
                                              ...cartItem,
                                              soldQty: normalized,
                                              draftQty: String(normalized),
                                            }
                                          }
                                          return cartItem
                                        })
                                      )
                                    } else {
                                      // Si no es válido, volver al mínimo
                                      setCart(
                                        cart.map((cartItem, cartIdx) => {
                                          if (cartIdx === idx) {
                                            return {
                                              ...cartItem,
                                              soldQty: min,
                                              draftQty: String(min),
                                            }
                                          }
                                          return cartItem
                                        })
                                      )
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur()
                                    }
                                  }}
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
                                  const min = step
                                  
                                  // Obtener cantidad actual (usar draftQty si existe y es válido, sino soldQty)
                                  const currentQty = normalizeQty(item.draftQty || item.soldQty, { step, min }) || item.soldQty
                                  const newQty = currentQty + step
                                  const normalized = normalizeQty(newQty, { step, min })
                                  
                                  if (normalized) {
                                    setCart(
                                      cart.map((cartItem, cartIdx) => {
                                        if (cartIdx === idx) {
                                          return {
                                            ...cartItem,
                                            soldQty: normalized,
                                            draftQty: String(normalized),
                                          }
                                        }
                                        return cartItem
                                      })
                                    )
                                  }
                                }}
                                aria-label="Aumentar cantidad"
                              >
                                +
                              </button>
                            </div>

                            {/* Botones de ajuste de precio (solo ADMIN) */}
                            {user.role === 'ADMIN' && (
                              <div className={styles.adminActions}>
                                {!item.priceAdjusted ? (
                                  <button
                                    className={styles.btnAdjustPrice}
                                    onClick={() => openPriceAdjustModal(idx)}
                                    title="Ajustar precio"
                                  >
                                    💰 Ajustar precio
                                  </button>
                                ) : (
                                  <button
                                    className={styles.btnRemoveAdjust}
                                    onClick={() => removePriceAdjust(idx)}
                                    title="Quitar ajuste de precio"
                                  >
                                    ✕ Quitar ajuste
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Footer sticky - SIEMPRE visible */}
                  <div className={styles.cartFooter}>
                    
                    {/* Resumen de totales */}
                    <div className={styles.totalsSection}>
                      <div className={styles.totalRow}>
                        <span className={styles.totalLabel}>Subtotal</span>
                        <span className={styles.totalValue}>{formatMoneyPEN(subtotal)}</span>
                      </div>
                      {tax > 0 && (
                        <div className={styles.totalRow}>
                          <span className={styles.totalLabel}>IVA</span>
                          <span className={styles.totalValue}>{formatMoneyPEN(tax)}</span>
                        </div>
                      )}
                      <div className={styles.totalRowFinal}>
                        <span className={styles.totalLabelFinal}>Total</span>
                        <span className={styles.totalValueFinal}>{formatMoneyPEN(total)}</span>
                      </div>
                    </div>

                    {/* Formulario de checkout */}
                    <div className={styles.checkoutFormSection}>
                      <div className={styles.formGroup}>
                        <label htmlFor="customerName" className={styles.formLabel}>
                          Cliente (opcional)
                        </label>
                        <input
                          id="customerName"
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className={styles.formInput}
                          placeholder="Nombre del cliente"
                        />
                      </div>

                      <div className={styles.formGroup}>
                        <label htmlFor="paymentMethod" className={styles.formLabel}>
                          Método de pago
                        </label>
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
                            className={`${styles.paymentMethodBtn} ${paymentMethod === 'TARJETA' ? styles.active : ''}`}
                            onClick={() => setPaymentMethod('TARJETA')}
                          >
                            💳 Tarjeta
                          </button>
                          <button
                            type="button"
                            className={`${styles.paymentMethodBtn} ${paymentMethod === 'TRANSFERENCIA' ? styles.active : ''}`}
                            onClick={() => setPaymentMethod('TRANSFERENCIA')}
                          >
                            🏦 Transfer.
                          </button>
                        </div>
                      </div>

                      <Button
                        variant="success"
                        disabled={loading || cart.length === 0}
                        onClick={() => handleCheckout(false)}
                        className={styles.btnCheckout}
                      >
                        {loading ? 'Procesando...' : '💳 Finalizar Compra'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

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
                const originalPrice = item.presentation?.computedUnitPrice || 0
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
    </>
  )
}
