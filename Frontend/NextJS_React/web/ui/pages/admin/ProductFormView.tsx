/**
 * ProductFormView.tsx - Formulario para crear/editar productos con presentaciones y tab de cambios de precio
 */
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/ui/components/Header'
import { Button } from '@/ui/components/Button'
import { formatMoneyPEN, roundToDecimals } from '@/lib/format-money'
import { useToast } from '@/ui/components/Toast/ToastContext'
import { CenteredAlertModal } from '@/ui/components/CenteredAlertModal'
import styles from './product-form.module.css'

const PRODUCT_UNITS = ['UNIDAD', 'METRO', 'LITRO', 'KILO', 'CAJA', 'PAQUETE', 'ROLLO']

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
  description?: string
  unit: string
  price: number
  stock: number
  minStock: number
  isActive: boolean
  presentations?: ProductPresentation[]
}

interface PriceChange {
  id: string
  productName: string
  presentationName?: string
  oldPrice: number
  newPrice: number
  changeValue: number
  reason: string
  user: {
    fullName: string
  }
  createdAt: Date
}

interface ProductFormViewProps {
  user: {
    fullName: string
    role: string
  }
  productId?: string
}

type Tab = 'general' | 'presentations' | 'price-history'

function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export function ProductFormView({ user, productId }: ProductFormViewProps) {
  const router = useRouter()
  const { notify } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')

  type NameSuggestion = Pick<Product, 'id' | 'sku' | 'name' | 'isActive'>
  const [nameSuggestions, setNameSuggestions] = useState<NameSuggestion[]>([])
  const [nameDuplicate, setNameDuplicate] = useState<NameSuggestion | null>(null)
  const [nameCheckLoading, setNameCheckLoading] = useState(false)

  const normalizeName = (s: string) => s.trim().replace(/\s+/g, ' ')

  const [description, setDescription] = useState('')
  const [unit, setUnit] = useState('UNIDAD')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [minStock, setMinStock] = useState('5')

  // Presentaciones
  const [presentations, setPresentations] = useState<ProductPresentation[]>([])
  const [newPresentation, setNewPresentation] = useState({
    name: '',
    unit: 'UNIDAD' as string,
    factorToBase: '1',
    priceOverride: '',
    isDefault: false,
  })

  // Cambios de precio
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([])
  const [showPriceChangeForm, setShowPriceChangeForm] = useState(false)
  const [priceChangeForm, setPriceChangeForm] = useState({
    presentationId: '',
    changeType: 'SUBIR',
    changeMode: 'PORCENTAJE',
    changeValue: '',
    reason: '',
  })

  const [alert, setAlert] = useState<{ open: boolean; type: 'success' | 'error'; message: string }>({
    open: false,
    type: 'success',
    message: '',
  })

  useEffect(() => {
    if (productId) {
      loadProduct()
      loadPriceHistory()
    }
  }, [productId])

  // Sugerencias / alerta de duplicado por nombre (case-insensitive)

  const debouncedName = useDebouncedValue(name, 350)

  useEffect(() => {
    const q = normalizeName(debouncedName)
    if (q.length < 2) {
      setNameSuggestions([])
      setNameDuplicate(null)
      return
    }

    const controller = new AbortController()
    setNameCheckLoading(true)

    fetch(`/api/products?search=${encodeURIComponent(q)}&limit=6&suggest=1`, {
      signal: controller.signal,
    })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await r.text())))
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.items ?? [])
        setNameSuggestions(items)

        const key = normalizeName(name).toLowerCase()
        const dup = items.find((p: any) => normalizeName(p.name).toLowerCase() === key) ?? null
        setNameDuplicate(dup)
      })
      .catch((e) => {
        if (e?.name !== 'AbortError') console.error(e)
      })
      .finally(() => setNameCheckLoading(false))

    return () => controller.abort()
  }, [debouncedName])

  //.................................................................

  useEffect(() => {
    const q = normalizeName(name)
    const currentId = productId || null

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
  }, [name, productId])

  const loadProduct = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/products/${productId}`, { cache: 'no-store' })
      const data = await res.json()

      if (data.id) {
        setProduct(data)
        setSku(data.sku)
        setName(data.name)
        setDescription(data.description || '')
        setUnit(data.unit)
        setPrice(data.price.toString())
        setStock(data.stock.toString())
        setMinStock(data.minStock.toString())
        setPresentations(data.presentations || [])
      }
    } catch (error) {
      console.error('Error cargando producto:', error)
      notify({ type: 'error', title: 'Error al cargar', message: 'No se pudo cargar el producto' })
    } finally {
      setLoading(false)
    }
  }

  const loadPriceHistory = async () => {
    try {
      const res = await fetch(`/api/price-changes?productId=${productId}&limit=50`)
      const data = await res.json()
      setPriceChanges(data.changes || [])
    } catch (error) {
      console.error('Error cargando historial de precios:', error)
    }
  }

  const handleSaveProduct = async () => {
    const normalizedName = normalizeName(name)

    if (!sku.trim() || !name.trim() || !price || !unit) {
      setAlert({ open: true, type: 'error', message: 'Completa SKU, nombre, unidad y precio.' })
      return
    }

    const priceN = parseFloat(price)
    const stockN = parseFloat(stock || '0')
    const minStockN = parseFloat(minStock || '0')

    if (Number.isNaN(priceN) || priceN < 0) {
      setAlert({ open: true, type: 'error', message: 'Precio debe ser un número mayor o igual a 0.' })
      return
    }
    if (Number.isNaN(stockN) || stockN < 0) {
      setAlert({ open: true, type: 'error', message: 'Stock debe ser un número mayor o igual a 0.' })
      return
    }
    if (Number.isNaN(minStockN) || minStockN < 0) {
      setAlert({ open: true, type: 'error', message: 'Stock mínimo debe ser >= 0.' })
      return
    }

    setSaving(true)

    try {
      const method = productId ? 'PUT' : 'POST'
      const url = productId ? `/api/products/${productId}` : '/api/products'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          sku: sku.trim(),
          name: normalizedName,
          description: description.trim() || null,
          unit,
          price: priceN,
          stock: stockN,
          minStock: minStockN,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        const msg =
          res.status === 409 && data?.existing
            ? `Ya existe: ${data.existing.name} (SKU ${data.existing.sku}).`
            : data.error || 'No se pudo guardar el producto'
        setAlert({ open: true, type: 'error', message: msg })
        return
      }

      setAlert({
        open: true,
        type: 'success',
        message: productId ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.',
      })
      router.refresh()
      if (!productId && data.id) {
        window.location.href = `/admin/productos/${data.id}`
      } else if (productId) {
        loadProduct()
      }
    } catch (error) {
      console.error('Error guardando producto:', error)
      setAlert({ open: true, type: 'error', message: 'No se pudo completar la operación' })
    } finally {
      setSaving(false)
    }
  }

  const handleAddPresentation = async () => {
    if (!newPresentation.name.trim() || !newPresentation.factorToBase) {
      notify({ type: 'warning', title: 'Campos incompletos', message: 'Por favor completa los campos de la presentación' })
      return
    }

    if (parseFloat(newPresentation.factorToBase) <= 0) {
      notify({ type: 'warning', title: 'Factor inválido', message: 'El factor debe ser mayor a 0' })
      return
    }

    try {
      const res = await fetch(`/api/products/${productId}/presentations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPresentation.name,
          unit: newPresentation.unit,
          factorToBase: parseFloat(newPresentation.factorToBase),
          priceOverride: newPresentation.priceOverride
            ? parseFloat(newPresentation.priceOverride)
            : undefined,
          isDefault: newPresentation.isDefault,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        notify({ type: 'error', title: 'Error al crear', message: data.error || 'No se pudo crear la presentación' })
        return
      }

      setPresentations([...presentations, data])
      setNewPresentation({
        name: '',
        unit: 'UNIDAD',
        factorToBase: '1',
        priceOverride: '',
        isDefault: false,
      })
      notify({ type: 'success', title: 'Presentación agregada', message: 'La presentación se agregó correctamente' })
    } catch (error) {
      console.error('Error agregando presentación:', error)
      notify({ type: 'error', title: 'Error al crear', message: 'No se pudo crear la presentación' })
    }
  }

  const handleApplyPriceChange = async () => {
    if (!priceChangeForm.changeValue || !priceChangeForm.reason.trim()) {
      notify({ type: 'warning', title: 'Campos incompletos', message: 'Por favor completa todos los campos' })
      return
    }

    try {
      const res = await fetch('/api/price-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          presentationId: priceChangeForm.presentationId || undefined,
          changeType: priceChangeForm.changeType,
          changeMode: priceChangeForm.changeMode,
          changeValue: parseFloat(priceChangeForm.changeValue),
          reason: priceChangeForm.reason,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        notify({ type: 'error', title: 'Error al aplicar cambio', message: data.error || 'No se pudo aplicar el cambio de precio' })
        return
      }

      notify({ type: 'success', title: 'Cambio aplicado', message: 'El cambio de precio se registró correctamente' })
      setShowPriceChangeForm(false)
      setPriceChangeForm({
        presentationId: '',
        changeType: 'SUBIR',
        changeMode: 'PORCENTAJE',
        changeValue: '',
        reason: '',
      })
      loadProduct()
      loadPriceHistory()
    } catch (error) {
      console.error('Error aplicando cambio:', error)
      notify({ type: 'error', title: 'Error al aplicar', message: 'No se pudo completar la operación' })
    }
  }

  if (!productId) {
    // Crear nuevo producto
    return (
      <>
        <Header user={user} />
        <div className={styles.container}>
          <div className={styles.formCard}>
            <h1 className={styles.title}>Crear Producto</h1>

            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.label}>SKU *</label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className={styles.input}
                  placeholder="Ej: CAB-001"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Nombre *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={styles.input}
                  placeholder="Nombre del producto"
                />
                              {nameDuplicate && (
                  <div className={styles.dupWarning}>
                    ⚠ Ya existe este nombre: <b>{nameDuplicate.name}</b> (SKU {nameDuplicate.sku}) — {nameDuplicate.isActive ? 'Activo' : 'Inactivo'}.{' '}
                    <a className={styles.dupLink} href={`/admin/productos/${nameDuplicate.id}`}>Abrir</a>
                  </div>
                )}

                {nameCheckLoading && normalizeName(name).length >= 2 && (
                  <div className={styles.suggestHint}>Buscando coincidencias…</div>
                )}

                {!nameDuplicate && nameSuggestions.length > 0 && normalizeName(name).length >= 2 && (
                  <div className={styles.suggestBox}>
                    <div className={styles.suggestTitle}>Coincidencias</div>
                    <div className={styles.suggestList}>
                      {nameSuggestions.slice(0, 6).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={styles.suggestItem}
                          onClick={() => setName(p.name)}
                        >
                          <span className={styles.suggestName}>{p.name}</span>
                          <span className={styles.suggestMeta}>SKU {p.sku} · {p.isActive ? 'Activo' : 'Inactivo'}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Descripción</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={styles.textarea}
                  placeholder="Descripción opcional"
                  rows={3}
                />
              </div>

              <div className={styles.gridTwoColumns}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Unidad Base *</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className={styles.select}
                  >
                    {PRODUCT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Precio Base (S/) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className={styles.input}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className={styles.gridTwoColumns}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Stock Inicial</label>
                  <input
                    type="number"
                    step="0.001"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className={styles.input}
                    placeholder="0"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Stock Mínimo</label>
                  <input
                    type="number"
                    step="0.001"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className={styles.input}
                    placeholder="5"
                  />
                </div>
              </div>

              <Button
                variant="success"
                disabled={saving}
                onClick={handleSaveProduct}
                className={styles.fullWidth}
              >
                {saving ? 'Guardando...' : 'Crear Producto'}
              </Button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Editar producto existente
  if (loading) {
    return (
      <>
        <Header user={user} />
        <div className={styles.container}>
          <p>Cargando...</p>
        </div>
      </>
    )
  }

  return (
    <>
      <Header user={user} />
      <CenteredAlertModal
        open={alert.open}
        type={alert.type}
        title={alert.type === 'success' ? 'Éxito' : 'Error'}
        message={alert.message}
        onClose={() => setAlert((p) => ({ ...p, open: false }))}
      />
      <div className={styles.container}>
        <div className={styles.formCard}>
          <h1 className={styles.title}>Editar Producto: {name}</h1>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'general' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('general')}
            >
              General
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'presentations' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('presentations')}
            >
              Presentaciones ({presentations.length})
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'price-history' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('price-history')}
            >
              Cambios de Precio ({priceChanges.length})
            </button>
          </div>

          {activeTab === 'general' && (
            <div className={styles.tabContent}>
              <div className={styles.form}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>SKU</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className={styles.input}
                    disabled
                  />
                  <small>El SKU no puede ser modificado</small>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Nombre *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Descripción</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={styles.textarea}
                    rows={3}
                  />
                </div>

                <div className={styles.gridTwoColumns}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Unidad Base</label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className={styles.select}
                    >
                      {PRODUCT_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Precio Base (S/) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className={styles.input}
                    />
                    <small>{formatMoneyPEN(parseFloat(price) || 0)}</small>
                  </div>
                </div>

                <div className={styles.gridTwoColumns}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Stock Actual</label>
                    <input
                      type="number"
                      step="0.001"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Stock Mínimo</label>
                    <input
                      type="number"
                      step="0.001"
                      value={minStock}
                      onChange={(e) => setMinStock(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                </div>

                <Button
                  variant="success"
                  disabled={saving}
                  onClick={handleSaveProduct}
                  className={styles.fullWidth}
                >
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'presentations' && (
            <div className={styles.tabContent}>
              <div className={styles.presentationsList}>
                {presentations.map((pres) => (
                  <div key={pres.id} className={styles.presentationCard}>
                    <div className={styles.presentationInfo}>
                      <div className={styles.presentationName}>
                        {pres.name}
                        {pres.isDefault && <span className={styles.badge}>Default</span>}
                      </div>
                      <div className={styles.presentationDetails}>
                        <span>1 {pres.name} = {pres.factorToBase} {pres.unit}</span>
                        <span>Precio: {formatMoneyPEN(pres.computedUnitPrice)}</span>
                        {pres.priceOverride && (
                          <span className={styles.override}>
                            Override: {formatMoneyPEN(pres.priceOverride)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.addPresentationForm}>
                <h3>Agregar Presentación</h3>
                <div className={styles.form}>
                  <div className={styles.gridTwoColumns}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Nombre *</label>
                      <input
                        type="text"
                        value={newPresentation.name}
                        onChange={(e) =>
                          setNewPresentation({ ...newPresentation, name: e.target.value })
                        }
                        className={styles.input}
                        placeholder="Ej: ROLLO, CAJA"
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Unidad</label>
                      <select
                        value={newPresentation.unit}
                        onChange={(e) =>
                          setNewPresentation({ ...newPresentation, unit: e.target.value })
                        }
                        className={styles.select}
                      >
                        {PRODUCT_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.gridTwoColumns}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Factor a Unidad Base *</label>
                      <input
                        type="number"
                        step="0.001"
                        value={newPresentation.factorToBase}
                        onChange={(e) =>
                          setNewPresentation({
                            ...newPresentation,
                            factorToBase: e.target.value,
                          })
                        }
                        className={styles.input}
                        placeholder="1"
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Precio Override (S/)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newPresentation.priceOverride}
                        onChange={(e) =>
                          setNewPresentation({
                            ...newPresentation,
                            priceOverride: e.target.value,
                          })
                        }
                        className={styles.input}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={newPresentation.isDefault}
                        onChange={(e) =>
                          setNewPresentation({
                            ...newPresentation,
                            isDefault: e.target.checked,
                          })
                        }
                      />
                      Presentación por defecto
                    </label>
                  </div>

                  <Button variant="secondary" onClick={handleAddPresentation}>
                    + Agregar Presentación
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'price-history' && (
            <div className={styles.tabContent}>
              <Button
                variant="secondary"
                onClick={() => setShowPriceChangeForm(!showPriceChangeForm)}
                className={styles.marginBottom}
              >
                {showPriceChangeForm ? '✕ Cancelar' : '+ Nuevo Ajuste de Precio'}
              </Button>

              {showPriceChangeForm && (
                <div className={styles.priceChangeForm}>
                  <div className={styles.gridTwoColumns}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Aplicar a</label>
                      <select
                        value={priceChangeForm.presentationId}
                        onChange={(e) =>
                          setPriceChangeForm({
                            ...priceChangeForm,
                            presentationId: e.target.value,
                          })
                        }
                        className={styles.select}
                      >
                        <option value="">Precio Base</option>
                        {presentations.map((pres) => (
                          <option key={pres.id} value={pres.id}>
                            {pres.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Tipo</label>
                      <select
                        value={priceChangeForm.changeType}
                        onChange={(e) =>
                          setPriceChangeForm({
                            ...priceChangeForm,
                            changeType: e.target.value,
                          })
                        }
                        className={styles.select}
                      >
                        <option value="SUBIR">Subir</option>
                        <option value="BAJAR">Bajar</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.gridTwoColumns}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Modo</label>
                      <select
                        value={priceChangeForm.changeMode}
                        onChange={(e) =>
                          setPriceChangeForm({
                            ...priceChangeForm,
                            changeMode: e.target.value,
                          })
                        }
                        className={styles.select}
                      >
                        <option value="PORCENTAJE">Porcentaje (%)</option>
                        <option value="MONTO">Monto (S/)</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.label}>Valor</label>
                      <input
                        type="number"
                        step="0.01"
                        value={priceChangeForm.changeValue}
                        onChange={(e) =>
                          setPriceChangeForm({
                            ...priceChangeForm,
                            changeValue: e.target.value,
                          })
                        }
                        className={styles.input}
                        placeholder={priceChangeForm.changeMode === 'PORCENTAJE' ? '10' : '5.00'}
                      />
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Razón *</label>
                    <textarea
                      value={priceChangeForm.reason}
                      onChange={(e) =>
                        setPriceChangeForm({
                          ...priceChangeForm,
                          reason: e.target.value,
                        })
                      }
                      className={styles.textarea}
                      placeholder="Razón del cambio de precio"
                      rows={2}
                    />
                  </div>

                  <Button
                    variant="success"
                    onClick={handleApplyPriceChange}
                    className={styles.fullWidth}
                  >
                    Aplicar Cambio
                  </Button>
                </div>
              )}

              {priceChanges.length === 0 ? (
                <p className={styles.empty}>Sin cambios de precio aún</p>
              ) : (
                <div className={styles.priceChangeList}>
                  {priceChanges.map((change) => (
                    <div key={change.id} className={styles.priceChangeItem}>
                      <div>
                        <strong>{change.productName}</strong>
                        {change.presentationName && (
                          <span className={styles.presentationRef}> - {change.presentationName}</span>
                        )}
                        <br />
                        <small>{change.reason}</small>
                      </div>
                      <div>
                        <span className={change.changeValue > 0 ? styles.increase : styles.decrease}>
                          {formatMoneyPEN(change.oldPrice)} → {formatMoneyPEN(change.newPrice)}
                          <br />
                          ({change.changeValue > 0 ? '+' : ''}{formatMoneyPEN(change.changeValue)})
                        </span>
                        <br />
                        <small>{change.user.fullName}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
