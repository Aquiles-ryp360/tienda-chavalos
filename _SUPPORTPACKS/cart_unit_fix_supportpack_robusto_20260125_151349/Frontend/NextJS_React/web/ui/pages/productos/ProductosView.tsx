'use client'

import { useState, useEffect, useRef } from 'react'
import { Header } from '@/ui/components/Header'
import { BottomNav } from '@/ui/components/BottomNav'
import { Button } from '@/ui/components/Button'
import { formatMoneyPEN } from '@/lib/format-money'
import { generateFullSku, slugToSkuPrefix } from '@/lib/sku-generator'
import { useToast } from '@/ui/components/Toast/ToastContext'
import styles from './productos.module.css'

interface Product {
  id: string
  sku: string
  name: string
  description?: string
  unit: string
  price: number
  stock: number
  minStock: number
  isActive: boolean
}

interface ProductosViewProps {
  user: {
    fullName: string
    role: string
  }
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

interface FormState {
  formData: FormData
  skuTouched: boolean
}

interface FormErrors {
  sku?: string
  name?: string
  price?: string
  stock?: string
  minStock?: string
  unit?: string
}

function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}



export function ProductosView({ user }: ProductosViewProps) {
  const { notify } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
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
  const modalRef = useRef<HTMLDivElement>(null)

  type NameSuggestion = Pick<Product, 'id' | 'sku' | 'name' | 'isActive'>

  const [nameSuggestions, setNameSuggestions] = useState<NameSuggestion[]>([])
  const [nameDuplicate, setNameDuplicate] = useState<NameSuggestion | null>(null)
  const [nameCheckLoading, setNameCheckLoading] = useState(false)

  const normalizeName = (s: string) => s.trim().replace(/\s+/g, ' ')

  useEffect(() => {
    loadProducts()
  }, [search])

  // Sugerencias / alerta de duplicado por nombre (solo cuando el modal está abierto)
  useEffect(() => {
    if (!showModal) return
    const q = normalizeName(formData.name)
    const currentId = editingProduct?.id || null

    if (q.length < 2) {
      setNameSuggestions([])
      setNameDuplicate(null)
      return
    }

    let cancelled = false
    const t = setTimeout(async () => {
      setNameCheckLoading(true)
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=8&offset=0`)
        const data = await res.json()
        if (cancelled) return

        const list: NameSuggestion[] = (data.products || []).map((p: any) => ({
          id: String(p.id),
          sku: String(p.sku),
          name: String(p.name),
          isActive: Boolean(p.isActive),
        }))
        setNameSuggestions(list)

        const qKey = q.toLowerCase()
        const exact = list.find((p) => normalizeName(p.name).toLowerCase() === qKey && p.id !== currentId)
        setNameDuplicate(exact || null)
      } catch {
        if (!cancelled) {
          setNameSuggestions([])
          setNameDuplicate(null)
        }
      } finally {
        if (!cancelled) setNameCheckLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [showModal, formData.name, editingProduct?.id])

  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [saveSuccess])

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

  const loadProducts = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      params.append('isActive', 'true')

      const res = await fetch(`/api/products?${params}`)
      const data = await res.json()
      setProducts(data.products)
    } catch (error) {
      console.error('Error cargando productos:', error)
    } finally {
      setLoading(false)
    }
  }

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
      await fetch(`/api/products/${id}`, { method: 'DELETE' })
      loadProducts()
    } catch (error) {
      console.error('Error eliminando producto:', error)
    }
  }

  const handleSaveProduct = async () => {
    if (!validateForm()) {
      return
    }

    const normalizedName = normalizeName(formData.name)
    if (
      nameDuplicate &&
      normalizeName(nameDuplicate.name).toLowerCase() === normalizedName.toLowerCase() &&
      nameDuplicate.id !== (editingProduct?.id || null)
    ) {
      setFormErrors((prev) => ({ ...prev, name: `Ya existe: ${nameDuplicate.name} (SKU ${nameDuplicate.sku}).` }))
      return
    }

    try {
      const priceNum = parseFloat(formData.price.replace(',', '.'))
      const stockNum = parseFloat(formData.stock.replace(',', '.'))
      const minStockNum = parseFloat(formData.minStock.replace(',', '.'))

      const payload = {
        sku: String(formData.sku).trim(),
      name: normalizeName(String(formData.name)),
      description: formData.description ? String(formData.description).trim() : null,
        unit: formData.unit,
        price: priceNum,
        stock: stockNum,
        minStock: minStockNum,
      }

      console.log('[ProductosView] Enviando payload:', payload)

      if (editingProduct) {
        await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      closeModal()
      setSaveSuccess(true)
      loadProducts()
    } catch (error) {
      console.error('Error guardando producto:', error)
      notify({ type: 'error', title: 'Error al guardar', message: 'No se pudo guardar el producto' })
    }
  }

  return (
    <>
      <Header user={user} />

      {saveSuccess && (
        <div className={styles.successBanner}>
          <span className={styles.successBannerIcon}>✓</span>
          <span>Producto {editingProduct ? 'actualizado' : 'creado'} correctamente</span>
        </div>
      )}

      <div className={styles.container}>
        <div className={styles.headerSection}>
          <div className={styles.headerContent}>
            <h1 className={styles.pageTitle}>Gestión de Productos</h1>
            <p className={styles.pageSubtitle}>Administra el catálogo de productos de la ferretería</p>
          </div>
          <Button variant="primary" onClick={handleCreate} className={styles.newProductBtn}>
            <span className={styles.btnIcon}>+</span>
            <span>Nuevo Producto</span>
          </Button>
        </div>

        <div className={styles.searchSection}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Buscar por SKU o nombre de producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
              aria-label="Buscar productos"
            />
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Cargando productos...</p>
          </div>
        ) : products.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyIcon}>📦</p>
            <h3>No hay productos</h3>
            <p>Comienza creando tu primer producto</p>
            <Button variant="primary" onClick={handleCreate}>
              + Nuevo Producto
            </Button>
          </div>
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className={styles.productsGrid}>
              {products.map((product) => {
                const isLowStock = product.stock <= product.minStock
                const isOutOfStock = product.stock === 0
                let statusBadge
                
                if (isOutOfStock) {
                  statusBadge = <span className={`${styles.badge} ${styles.badgeDanger}`}>Sin stock</span>
                } else if (isLowStock) {
                  statusBadge = <span className={`${styles.badge} ${styles.badgeWarning}`}>Bajo stock</span>
                } else {
                  statusBadge = <span className={`${styles.badge} ${styles.badgeSuccess}`}>OK</span>
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
                      <button
                        className={styles.cardActionBtn}
                        onClick={() => handleEdit(product)}
                        aria-label={`Editar ${product.name}`}
                      >
                        <span>✏️</span>
                        <span>Editar</span>
                      </button>
                      <button
                        className={`${styles.cardActionBtn} ${styles.danger}`}
                        onClick={() => handleDeleteProduct(product.id)}
                        aria-label={`Eliminar ${product.name}`}
                      >
                        <span>🗑️</span>
                        <span>Eliminar</span>
                      </button>
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
                          {isOutOfStock && (
                            <span className={`${styles.badge} ${styles.badgeDanger}`}>
                              Sin stock
                            </span>
                          )}
                          {isLowStock && !isOutOfStock && (
                            <span className={`${styles.badge} ${styles.badgeWarning}`}>
                              Bajo stock
                            </span>
                          )}
                          {!isLowStock && (
                            <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                              OK
                            </span>
                          )}
                        </td>
                        <td className={styles.actionsCell}>
                          <div className={styles.actionsGroup}>
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleEdit(product)}
                              aria-label={`Editar producto ${product.name}`}
                              title="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                              onClick={() => handleDeleteProduct(product.id)}
                              aria-label={`Eliminar producto ${product.name}`}
                              title="Eliminar"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
                    SKU <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="sku"
                    type="text"
                    placeholder="Ej: ALAM-001"
                    value={formData.sku}
                    onChange={(e) => handleInputChange('sku', e.target.value)}
                    className={`${styles.formInput} ${formErrors.sku ? styles.inputError : ''}`}
                    aria-invalid={!!formErrors.sku}
                    aria-describedby={formErrors.sku ? 'sku-error' : undefined}
                  />
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
                    Nombre del Producto <span className={styles.required}>*</span>
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
                      ⚠ Ya existe este nombre: <b>{nameDuplicate.name}</b> (SKU {nameDuplicate.sku}) — {nameDuplicate.isActive ? 'Activo' : 'Inactivo'}.
                    </div>
                  )}

                  {nameCheckLoading && normalizeName(formData.name).length >= 2 && (
                    <div className={styles.suggestHint}>Buscando coincidencias…</div>
                  )}

                  {!nameDuplicate && nameSuggestions.length > 0 && normalizeName(formData.name).length >= 2 && (
                    <div className={styles.suggestBox}>
                      <div className={styles.suggestTitle}>Coincidencias</div>
                      <div className={styles.suggestList}>
                        {nameSuggestions.slice(0, 6).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className={styles.suggestItem}
                            onClick={() => setFormData((prev) => ({ ...prev, name: p.name }))}
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
                    Descripción
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
                    Unidad de Medida <span className={styles.required}>*</span>
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
                    Precio (S/) <span className={styles.required}>*</span>
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
                      Stock Actual <span className={styles.required}>*</span>
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
                      Stock Mínimo <span className={styles.required}>*</span>
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
              >
                {editingProduct ? 'Actualizar' : 'Guardar'} Producto
              </button>
            </div>
          </div>
        </div>
      )}
      
      <BottomNav userRole={user.role} />
    </>
  )
}
