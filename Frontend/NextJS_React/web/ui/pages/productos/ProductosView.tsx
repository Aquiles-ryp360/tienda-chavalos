'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Header } from '@/ui/components/Header'
import { BottomNav } from '@/ui/components/BottomNav'
import { Button } from '@/ui/components/Button'
import { SearchBar } from '@/ui/components/SearchBar'
import { formatMoneyPEN } from '@/lib/format-money'
import { generateFullSku } from '@/lib/sku-generator'
import { useToast } from '@/ui/components/Toast/ToastContext'
import type { CatalogProduct as Product } from '@/ui/catalog/product-catalog.types'
import { useBackgroundCatalogSync } from '@/ui/hooks/useBackgroundCatalogSync'
import { useSmartProductSearch } from '@/ui/hooks/useSmartProductSearch'
import styles from './productos.module.css'

function normalizeProductName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

interface ProductosViewProps {
  user: {
    fullName: string
    role: string
  }
  initialProducts?: Product[]
  initialTotal?: number
}

interface FormData {
  sku: string
  name: string
  description: string
  unit: string
  price: string
  stock: string
  minStock: string
}

interface FormErrors {
  sku?: string
  name?: string
  price?: string
  stock?: string
  minStock?: string
  unit?: string
}

export function ProductosView({ user, initialProducts = [], initialTotal = 0 }: ProductosViewProps) {
  const canEdit = user.role === 'ADMIN' || user.role === 'SUPERADMIN'
  const { notify } = useToast()
  const [search, setSearch] = useState('')

  useBackgroundCatalogSync({
    initialProducts,
    activeOnly: false,
    inStockOnly: false,
    includePresentations: true,
    chunkSize: 50,
  })

  const {
    products,
    catalogProducts,
    total,
    isLoading: loading,
    isStale,
    isSearching,
    isFallbackLoading,
    hasMore,
    skip,
    loadMore,
    refresh,
  } = useSmartProductSearch(search, {
    activeOnly: false,
    includePresentations: false,
    limit: 30,
    debounceMs: 300,
    bootstrapProducts: initialProducts,
    bootstrapTotal: initialTotal,
    remoteFallbackThreshold: 2,
  })

  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [createSuccessVisible, setCreateSuccessVisible] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    sku: '',
    name: '',
    description: '',
    unit: 'UNIDAD',
    price: '',
    stock: '',
    minStock: '',
  })
  const [skuTouched, setSkuTouched] = useState(false)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  type NameSuggestion = Pick<Product, 'id' | 'sku' | 'name' | 'isActive'>

  const [editingSuggestionId, setEditingSuggestionId] = useState<string | null>(null)
  const catalogProductsById = useMemo(
    () => new Map(catalogProducts.map((product) => [product.id, product])),
    [catalogProducts]
  )
  const normalizedFormName = useMemo(() => normalizeProductName(formData.name), [formData.name])
  const {
    products: modalMatches,
    isSearching: isCheckingNameSearch,
    isStale: isCheckingNameStale,
    isFallbackLoading: isCheckingNameFallback,
  } = useSmartProductSearch(showModal ? normalizedFormName : '', {
    activeOnly: false,
    includePresentations: false,
    limit: 8,
    debounceMs: 250,
    bootstrapProducts: initialProducts,
    remoteFallbackThreshold: 0,
    enableEmptyQueryFallback: false,
  })
  const nameSuggestions = useMemo<NameSuggestion[]>(() => {
    if (!showModal || normalizedFormName.length < 2) return []

    return modalMatches
      .filter((product) => product.id !== editingProduct?.id)
      .map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        isActive: product.isActive,
      }))
  }, [editingProduct?.id, modalMatches, normalizedFormName.length, showModal])
  const nameDuplicate = useMemo<NameSuggestion | null>(() => {
    if (!showModal || normalizedFormName.length < 2) return null

    const nameKey = normalizedFormName.toLowerCase()
    return (
      nameSuggestions.find((product) => normalizeProductName(product.name).toLowerCase() === nameKey) ??
      null
    )
  }, [nameSuggestions, normalizedFormName, showModal])
  const nameCheckLoading =
    showModal &&
    normalizedFormName.length >= 2 &&
    (isCheckingNameSearch || isCheckingNameStale || isCheckingNameFallback)
  const loadingMore = hasMore && !isSearching && (isFallbackLoading || isStale)

  useEffect(() => {
    if (!createSuccessVisible) return
    const timer = setTimeout(() => setCreateSuccessVisible(false), 3500)
    return () => clearTimeout(timer)
  }, [createSuccessVisible])

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        closeModal()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [showModal])

  // Block scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showModal])

  const handleCreate = () => {
    setEditingProduct(null)
    setFormData({
      sku: '',
      name: '',
      description: '',
      unit: 'UNIDAD',
      price: '',
      stock: '',
      minStock: '',
    })
    setSkuTouched(false)
    setFormErrors({})
    setShowModal(true)
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      unit: product.unit,
      price: product.price.toString(),
      stock: product.stock.toString(),
      minStock: product.minStock.toString(),
    })
    setSkuTouched(true) // When editing, SKU is already set, so mark as touched
    setFormErrors({})
    setShowModal(true)
  }

  const handleEditFromSuggestion = async (suggestion: NameSuggestion) => {
    setEditingSuggestionId(suggestion.id)
    try {
      const cachedProduct = catalogProductsById.get(suggestion.id)
      if (cachedProduct) {
        handleEdit(cachedProduct)

        if (!cachedProduct.isActive) {
          notify({
            type: 'info',
            title: 'Producto inactivo',
            message: 'Edita y guarda para reactivarlo automáticamente.',
          })
        }
        return
      }

      const res = await fetch(`/api/products/${suggestion.id}`, {
        cache: 'no-store',
        credentials: 'include',
      })
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      if (!data?.id) {
        throw new Error('Producto no encontrado')
      }

      const productToEdit: Product = {
        id: String(data.id),
        sku: String(data.sku),
        name: String(data.name),
        description: data.description ?? '',
        unit: String(data.unit),
        price: Number(data.price ?? 0),
        stock: Number(data.stock ?? 0),
        minStock: Number(data.minStock ?? 0),
        isActive: Boolean(data.isActive),
      }

      handleEdit(productToEdit)

      if (!productToEdit.isActive) {
        notify({
          type: 'info',
          title: 'Producto inactivo',
          message: 'Edita y guarda para reactivarlo automáticamente.',
        })
      }
    } catch (error) {
      console.error('Error cargando producto para edición:', error)
      notify({ type: 'error', title: 'No se pudo abrir', message: 'Intenta nuevamente' })
    } finally {
      setEditingSuggestionId(null)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingProduct(null)
    setFormData({
      sku: '',
      name: '',
      description: '',
      unit: 'UNIDAD',
      price: '',
      stock: '',
      minStock: '',
    })
    setSkuTouched(false)
    setFormErrors({})
  }

  const handleModalBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === modalRef.current) {
      closeModal()
    }
  }

  const validateForm = (): boolean => {
    const errors: FormErrors = {}

    if (!formData.sku.trim()) {
      errors.sku = 'El SKU es requerido'
    }

    if (!formData.name.trim()) {
      errors.name = 'El nombre es requerido'
    }

    const priceNum = parseFloat(formData.price.replace(',', '.'))
    if (!formData.price || isNaN(priceNum) || priceNum <= 0) {
      errors.price = 'El precio debe ser mayor a 0'
    }

    const stockNum = parseFloat(formData.stock.replace(',', '.'))
    if (formData.stock === '' || isNaN(stockNum) || stockNum < 0) {
      errors.stock = 'El stock no puede ser negativo'
    }

    const minStockNum = parseFloat(formData.minStock.replace(',', '.'))
    if (formData.minStock === '' || isNaN(minStockNum) || minStockNum < 0) {
      errors.minStock = 'El stock mínimo no puede ser negativo'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error for this field when user starts typing
    if (formErrors[field as keyof FormErrors]) {
      setFormErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field as keyof FormErrors]
        return newErrors
      })
    }

    // Handle SKU auto-generation logic
    if (field === 'sku') {
      // When user edits SKU field directly, mark as touched
      if (value.trim().length > 0) {
        setSkuTouched(true)
      } else {
        // If user clears the SKU, mark as not touched to regenerate from name
        setSkuTouched(false)
      }
    }

    // Auto-generate SKU from name
    if (field === 'name' && !skuTouched) {
      handleAutoGenerateSku(value)
    }
  }

  const handleAutoGenerateSku = async (productName: string) => {
    if (!productName || productName.trim().length === 0) {
      setFormData(prev => ({ ...prev, sku: '' }))
      return
    }

    try {
      const suggestedSku = await generateFullSku(productName)
      setFormData(prev => ({ ...prev, sku: suggestedSku }))
    } catch (error) {
      console.error('Error generating SKU:', error)
    }
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      refresh()
    } catch (error) {
      console.error('Error eliminando producto:', error)
    }
  }

  const handleSaveProduct = async () => {
    if (saving) return
    if (!validateForm()) {
      return
    }
    const isEditing = Boolean(editingProduct)

    const normalizedName = normalizeProductName(formData.name)
    if (
      nameDuplicate &&
      normalizeProductName(nameDuplicate.name).toLowerCase() === normalizedName.toLowerCase() &&
      nameDuplicate.id !== (editingProduct?.id || null)
    ) {
      setFormErrors((prev) => ({ ...prev, name: `Ya existe: ${nameDuplicate.name} (SKU ${nameDuplicate.sku}).` }))
      return
    }
    setSaving(true)

    try {
      const priceNum = parseFloat(formData.price.replace(',', '.'))
      const stockNum = parseFloat(formData.stock.replace(',', '.'))
      const minStockNum = parseFloat(formData.minStock.replace(',', '.'))

      const payload = {
        sku: String(formData.sku).trim(),
      name: normalizeProductName(String(formData.name)),
      description: formData.description ? String(formData.description).trim() : null,
        unit: formData.unit,
        price: priceNum,
        stock: stockNum,
        minStock: minStockNum,
        ...(isEditing ? { isActive: true } : {}),
      }

      console.log('[ProductosView] Enviando payload:', payload)

      if (isEditing && editingProduct) {
        const res = await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.status === 401) {
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
          return
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.status === 401) {
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
          return
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
      }

      closeModal()
      if (isEditing) {
        notify({
          type: 'success',
          title: 'Producto actualizado',
          message: 'Los cambios se guardaron correctamente.',
        })
      } else {
        setCreateSuccessVisible(true)
      }
      refresh()
    } catch (error) {
      console.error('Error guardando producto:', error)
      notify({ type: 'error', title: 'Error al guardar', message: 'No se pudo guardar el producto' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Header user={user} />

      {createSuccessVisible && (
        <div className={styles.successBanner} role="status" aria-live="polite">
          <span className={styles.successBannerIcon}>✓</span>
          <div className={styles.successBannerContent}>
            <span className={styles.successBannerTitle}>Producto creado</span>
            <span className={styles.successBannerText}>Se agregó al catálogo correctamente.</span>
          </div>
        </div>
      )}

      <div className={styles.container}>
        <div className={styles.headerSection}>
          <div className={styles.headerContent}>
            <h1 className={styles.pageTitle}>Gestión de Productos</h1>
            <p className={styles.pageSubtitle}>Administra el catálogo de productos de la ferretería</p>
          </div>
          {canEdit && (
            <Button variant="primary" onClick={handleCreate} className={styles.newProductBtn}>
              <span className={styles.btnIcon}>+</span>
              <span>Nuevo Producto</span>
            </Button>
          )}
        </div>

        <div className={styles.searchSection}>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por SKU o nombre de producto..."
            loading={isSearching || isStale}
          />
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Cargando productos...</p>
          </div>
        ) : products.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyIcon}>📦</p>
            <h3>{search ? 'No se encontraron productos' : 'No hay productos'}</h3>
            <p>{search ? 'Prueba con otro nombre o SKU.' : 'Comienza creando tu primer producto'}</p>
            {!search && canEdit && (
              <Button variant="primary" onClick={handleCreate}>
                + Nuevo Producto
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className={`${styles.resultsMeta} ${isStale ? styles.resultsStale : ''}`}>
              <span>{skip} de {total} productos</span>
              {hasMore && (
                <button
                  type="button"
                  className={styles.loadMoreSmall}
                  onClick={loadMore}
                  disabled={loadingMore || isSearching}
                >
                  {loadingMore ? 'Cargando…' : 'Cargar más'}
                </button>
              )}
            </div>

            {/* Mobile Cards View */}
            <div className={styles.productsGrid}>
              {products.map((product) => {
                const isInactive = !product.isActive
                const isLowStock = product.stock <= product.minStock
                const isOutOfStock = product.stock === 0
                let statusBadge
                
                if (isInactive) {
                  statusBadge = <span className={`${styles.badge} ${styles.badgeWarning}`}><span className={styles.stockDot} style={{ background: '#6b7280' }} />Inactivo</span>
                } else if (isOutOfStock) {
                  statusBadge = <span className={`${styles.badge} ${styles.badgeDanger}`}><span className={styles.stockDot} style={{ background: 'var(--stock-out)' }} />Agotado</span>
                } else if (isLowStock) {
                  statusBadge = <span className={`${styles.badge} ${styles.badgeWarning}`}><span className={styles.stockDot} style={{ background: 'var(--stock-reorder)' }} />Reordenar</span>
                } else {
                  statusBadge = <span className={`${styles.badge} ${styles.badgeSuccess}`}><span className={styles.stockDot} style={{ background: 'var(--stock-available)' }} />Disponible</span>
                }

                return (
                  <div key={product.id} className={styles.productCard}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardHeaderLeft}>
                        <span className={styles.cardSku}>{product.sku}</span>
                        <h3 className={styles.cardName}>{product.name}</h3>
                      </div>
                      <div className={styles.cardBadge}>
                        {statusBadge}
                      </div>
                    </div>

                    <div className={styles.cardDetails}>
                      <div className={styles.cardDetailItem}>
                        <span className={styles.cardDetailLabel}>Precio</span>
                        <span className={`${styles.cardDetailValue} ${styles.price}`}>
                          {formatMoneyPEN(product.price)}
                        </span>
                      </div>
                      <div className={styles.cardDetailItem}>
                        <span className={styles.cardDetailLabel}>Unidad</span>
                        <span className={styles.cardDetailValue}>{product.unit}</span>
                      </div>
                      <div className={styles.cardDetailItem}>
                        <span className={styles.cardDetailLabel}>Stock</span>
                        <span className={`${styles.cardDetailValue} ${isLowStock ? styles.warning : ''}`}>
                          {product.stock}
                        </span>
                      </div>
                      <div className={styles.cardDetailItem}>
                        <span className={styles.cardDetailLabel}>Mín.</span>
                        <span className={styles.cardDetailValue}>{product.minStock}</span>
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      {canEdit && (
                        <button
                          className={styles.cardActionBtn}
                          onClick={() => handleEdit(product)}
                          aria-label={`Editar ${product.name}`}
                        >
                          <span>✏️</span>
                          <span>Editar</span>
                        </button>
                      )}
                      {canEdit && (
                        <button
                          className={`${styles.cardActionBtn} ${styles.danger}`}
                          onClick={() => handleDeleteProduct(product.id)}
                          aria-label={`Eliminar ${product.name}`}
                        >
                          <span>🗑️</span>
                          <span>Eliminar</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop Table View */}
            <div className={styles.tableWrapper}>
              <table className={styles.productsTable}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Nombre</th>
                    <th>Unidad</th>
                    <th>Precio</th>
                    <th>Stock</th>
                    <th>Mín.</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const isInactive = !product.isActive
                    const isLowStock = product.stock <= product.minStock
                    const isOutOfStock = product.stock === 0

                    return (
                      <tr key={product.id} className={styles.tableRow}>
                        <td className={styles.skuCell}>
                          <span className={styles.skuBadge}>{product.sku}</span>
                        </td>
                        <td className={styles.nameCell}>{product.name}</td>
                        <td className={styles.unitCell}>{product.unit}</td>
                        <td className={styles.priceCell}>
                          <span className={styles.currencyValue}>
                            {formatMoneyPEN(product.price)}
                          </span>
                        </td>
                        <td className={styles.stockCell}>
                          <span className={isLowStock ? styles.stockWarning : ''}>
                            {product.stock}
                          </span>
                        </td>
                        <td className={styles.minStockCell}>{product.minStock}</td>
                        <td className={styles.statusCell}>
                          {isInactive && (
                            <span className={`${styles.badge} ${styles.badgeWarning}`}>
                              <span className={styles.stockDot} style={{ background: '#6b7280' }} />
                              Inactivo
                            </span>
                          )}
                          {isOutOfStock && !isInactive && (
                            <span className={`${styles.badge} ${styles.badgeDanger}`}>
                              <span className={styles.stockDot} style={{ background: 'var(--stock-out)' }} />
                              Agotado
                            </span>
                          )}
                          {isLowStock && !isOutOfStock && !isInactive && (
                            <span className={`${styles.badge} ${styles.badgeWarning}`}>
                              <span className={styles.stockDot} style={{ background: 'var(--stock-reorder)' }} />
                              Reordenar
                            </span>
                          )}
                          {!isLowStock && !isInactive && (
                            <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                              <span className={styles.stockDot} style={{ background: 'var(--stock-available)' }} />
                              Disponible
                            </span>
                          )}
                        </td>
                        <td className={styles.actionsCell}>
                          <div className={styles.actionsGroup}>
                            {canEdit && (
                              <button
                                className={styles.actionBtn}
                                onClick={() => handleEdit(product)}
                                aria-label={`Editar producto ${product.name}`}
                                title="Editar"
                              >
                                ✏️
                              </button>
                            )}
                            {canEdit && (
                              <button
                                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                                onClick={() => handleDeleteProduct(product.id)}
                                aria-label={`Eliminar producto ${product.name}`}
                                title="Eliminar"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className={styles.loadMoreRow}>
                <button
                  className={styles.loadMoreBtn}
                  onClick={loadMore}
                  disabled={loadingMore || isSearching}
                >
                  {loadingMore ? 'Cargando…' : 'Cargar más'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay} ref={modalRef} onClick={handleModalBackdropClick}>
          <div className={styles.modalContent}>
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <button
                className={styles.modalCloseBtn}
                onClick={closeModal}
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className={styles.modalBody}>
              {/* Identification Section */}
              <fieldset className={styles.formSection}>
                <legend className={styles.sectionTitle}>Identificación</legend>
                <div className={styles.formGroup}>
                  <label htmlFor="sku" className={styles.formLabel}>
                    SKU {editingProduct ? <span className={styles.labelOptional}>(Automático)</span> : <span className={styles.labelRequired}>(Obligatorio)</span>}
                  </label>
                  <input
                    id="sku"
                    type="text"
                    placeholder="Ej: ALAM-001"
                    value={formData.sku}
                    onChange={(e) => handleInputChange('sku', e.target.value)}
                    className={`${styles.formInput} ${formErrors.sku ? styles.inputError : ''} ${editingProduct ? styles.inputReadonly : ''}`}
                    aria-invalid={!!formErrors.sku}
                    aria-describedby={formErrors.sku ? 'sku-error' : 'sku-hint'}
                    readOnly={!!editingProduct}
                  />
                  {editingProduct && (
                    <span id="sku-hint" className={styles.fieldHint}>
                      ID de sistema, no requiere edición
                    </span>
                  )}
                  {!skuTouched && formData.sku && !editingProduct && (
                    <span className={styles.skuAutoGenerated}>
                      💡 SKU sugerido automáticamente (puedes editarlo)
                    </span>
                  )}
                  {formErrors.sku && (
                    <span id="sku-error" className={styles.errorMessage}>
                      {formErrors.sku}
                    </span>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="name" className={styles.formLabel}>
                    Nombre del Producto <span className={styles.labelRequired}>(Obligatorio)</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    placeholder="Ej: Alambre de Construcción"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={`${styles.formInput} ${formErrors.name ? styles.inputError : ''}`}
                    aria-invalid={!!formErrors.name}
                    aria-describedby={formErrors.name ? 'name-error' : undefined}
                  />
                  {formErrors.name && (
                    <span id="name-error" className={styles.errorMessage}>
                      {formErrors.name}
                    </span>
                  )}
                  {nameDuplicate && (
                    <div className={styles.dupWarning}>
                      <span>
                        ⚠ Ya existe este nombre: <b>{nameDuplicate.name}</b> (SKU {nameDuplicate.sku}) — {nameDuplicate.isActive ? 'Activo' : 'Inactivo'}.
                      </span>
                      <button
                        type="button"
                        className={styles.dupActionBtn}
                        onClick={() => handleEditFromSuggestion(nameDuplicate)}
                        disabled={editingSuggestionId === nameDuplicate.id}
                      >
                        {editingSuggestionId === nameDuplicate.id ? 'Cargando…' : 'Editar este producto'}
                      </button>
                    </div>
                  )}

                  {nameCheckLoading && normalizeProductName(formData.name).length >= 2 && (
                    <div className={styles.suggestHint}>Buscando coincidencias…</div>
                  )}

                  {!nameDuplicate && nameSuggestions.length > 0 && normalizeProductName(formData.name).length >= 2 && (
                    <div className={styles.suggestBox}>
                      <div className={styles.suggestTitle}>Coincidencias</div>
                      <div className={styles.suggestList}>
                        {nameSuggestions.slice(0, 6).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className={styles.suggestItem}
                            onClick={() => handleEditFromSuggestion(p)}
                            disabled={editingSuggestionId === p.id}
                          >
                            <span className={styles.suggestName}>{p.name}</span>
                            <span className={styles.suggestMeta}>SKU {p.sku} · {p.isActive ? 'Activo' : 'Inactivo'}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </fieldset>

              {/* Details Section */}
              <fieldset className={styles.formSection}>
                <legend className={styles.sectionTitle}>Detalles</legend>
                <div className={styles.formGroup}>
                  <label htmlFor="description" className={styles.formLabel}>
                    Descripción <span className={styles.labelOptional}>(Opcional)</span>
                  </label>
                  <textarea
                    id="description"
                    placeholder="Ej: Alambre para construcción de 4mm..."
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className={styles.formTextarea}
                    rows={3}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="unit" className={styles.formLabel}>
                    Unidad de Medida <span className={styles.labelRequired}>(Obligatorio)</span>
                  </label>
                  <select
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => handleInputChange('unit', e.target.value)}
                    className={styles.formSelect}
                  >
                    <option value="UNIDAD">Unidad</option>
                    <option value="DOCENA">Docena</option>
                    <option value="METRO">Metro</option>
                    <option value="LITRO">Litro</option>
                    <option value="KILO">Kilo</option>
                    <option value="CAJA">Caja</option>
                    <option value="ROLLO">Rollo</option>
                    <option value="PAQUETE">Paquete</option>
                  </select>
                </div>
              </fieldset>

              {/* Inventory and Price Section */}
              <fieldset className={styles.formSection}>
                <legend className={styles.sectionTitle}>Inventario y Precio</legend>
                <div className={styles.formGroup}>
                  <label htmlFor="price" className={styles.formLabel}>
                    Precio (S/) <span className={styles.labelRequired}>(Obligatorio)</span>
                  </label>
                  <div className={styles.inputWithPrefix}>
                    <span className={styles.inputPrefix}>S/</span>
                    <input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="15.00"
                      value={formData.price}
                      onChange={(e) => handleInputChange('price', e.target.value)}
                      className={`${styles.formInput} ${formErrors.price ? styles.inputError : ''}`}
                      aria-invalid={!!formErrors.price}
                      aria-describedby={formErrors.price ? 'price-error' : undefined}
                    />
                  </div>
                  {formErrors.price && (
                    <span id="price-error" className={styles.errorMessage}>
                      {formErrors.price}
                    </span>
                  )}
                </div>

                <div className={styles.twoColumns}>
                  <div className={styles.formGroup}>
                    <label htmlFor="stock" className={styles.formLabel}>
                      Stock Actual <span className={styles.labelRequired}>(Obligatorio)</span>
                    </label>
                    <input
                      id="stock"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="50"
                      value={formData.stock}
                      onChange={(e) => handleInputChange('stock', e.target.value)}
                      className={`${styles.formInput} ${formErrors.stock ? styles.inputError : ''}`}
                      aria-invalid={!!formErrors.stock}
                      aria-describedby={formErrors.stock ? 'stock-error' : undefined}
                    />
                    {formErrors.stock && (
                      <span id="stock-error" className={styles.errorMessage}>
                        {formErrors.stock}
                      </span>
                    )}
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="minStock" className={styles.formLabel}>
                      Stock Mínimo <span className={styles.labelRequired}>(Obligatorio)</span>
                    </label>
                    <input
                      id="minStock"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="5"
                      value={formData.minStock}
                      onChange={(e) => handleInputChange('minStock', e.target.value)}
                      className={`${styles.formInput} ${formErrors.minStock ? styles.inputError : ''}`}
                      aria-invalid={!!formErrors.minStock}
                      aria-describedby={formErrors.minStock ? 'minStock-error' : undefined}
                    />
                    {formErrors.minStock && (
                      <span id="minStock-error" className={styles.errorMessage}>
                        {formErrors.minStock}
                      </span>
                    )}
                  </div>
                </div>
              </fieldset>
            </div>

            {/* Modal Footer */}
            <div className={styles.modalFooter}>
              <button
                onClick={closeModal}
                className={`${styles.modalBtn} ${styles.modalBtnSecondary}`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProduct}
                className={`${styles.modalBtn} ${styles.modalBtnPrimary}`}
                disabled={saving}
              >
                {saving ? 'Guardando...' : `${editingProduct ? 'Actualizar' : 'Guardar'} Producto`}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <BottomNav userRole={user.role} />
    </>
  )
}
