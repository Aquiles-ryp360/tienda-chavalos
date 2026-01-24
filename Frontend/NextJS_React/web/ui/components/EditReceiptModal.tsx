'use client'

import { useState } from 'react'
import { Button } from './Button'
import styles from './editReceiptModal.module.css'

interface EditReceiptModalProps {
  saleId: string
  initialData: {
    customerName?: string | null
    customerDocType?: string | null
    customerDocNumber?: string | null
    customerAddress?: string | null
    institutionName?: string | null
    observations?: string | null
  }
  onClose: () => void
  onSave: (updatedData: any) => void
}

export function EditReceiptModal({
  saleId,
  initialData,
  onClose,
  onSave,
}: EditReceiptModalProps) {
  const [formData, setFormData] = useState({
    customerName: initialData.customerName || '',
    customerDocType: initialData.customerDocType || 'DNI',
    customerDocNumber: initialData.customerDocNumber || '',
    customerAddress: initialData.customerAddress || '',
    institutionName: initialData.institutionName || '',
    observations: initialData.observations || '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/sales/${saleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: formData.customerName || null,
          customerDocType: formData.customerDocType || null,
          customerDocNumber: formData.customerDocNumber || null,
          customerAddress: formData.customerAddress || null,
          institutionName: formData.institutionName || null,
          observations: formData.observations || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar')
      }

      onSave(data)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al guardar cambios')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Editar Datos de Boleta</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formGrid}>
            {/* Cliente */}
            <div className={styles.formGroup}>
              <label htmlFor="customerName">Cliente</label>
              <input
                id="customerName"
                type="text"
                maxLength={200}
                value={formData.customerName}
                onChange={(e) =>
                  setFormData({ ...formData, customerName: e.target.value })
                }
                placeholder="Nombre del cliente"
              />
            </div>

            {/* Institución/Empresa */}
            <div className={styles.formGroup}>
              <label htmlFor="institutionName">Institución/Empresa</label>
              <input
                id="institutionName"
                type="text"
                maxLength={200}
                value={formData.institutionName}
                onChange={(e) =>
                  setFormData({ ...formData, institutionName: e.target.value })
                }
                placeholder="Nombre de la institución"
              />
            </div>

            {/* Tipo de documento */}
            <div className={styles.formGroup}>
              <label htmlFor="customerDocType">Tipo de Documento</label>
              <select
                id="customerDocType"
                value={formData.customerDocType}
                onChange={(e) =>
                  setFormData({ ...formData, customerDocType: e.target.value })
                }
              >
                <option value="DNI">DNI</option>
                <option value="RUC">RUC</option>
                <option value="PASAPORTE">Pasaporte</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>

            {/* Número de documento */}
            <div className={styles.formGroup}>
              <label htmlFor="customerDocNumber">Número de Documento</label>
              <input
                id="customerDocNumber"
                type="text"
                maxLength={20}
                value={formData.customerDocNumber}
                onChange={(e) =>
                  setFormData({ ...formData, customerDocNumber: e.target.value })
                }
                placeholder="Ej: 12345678"
              />
            </div>

            {/* Dirección (ancho completo) */}
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label htmlFor="customerAddress">Dirección</label>
              <input
                id="customerAddress"
                type="text"
                maxLength={500}
                value={formData.customerAddress}
                onChange={(e) =>
                  setFormData({ ...formData, customerAddress: e.target.value })
                }
                placeholder="Dirección completa del cliente"
              />
            </div>

            {/* Observaciones (ancho completo) */}
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label htmlFor="observations">Observaciones</label>
              <textarea
                id="observations"
                rows={4}
                maxLength={1000}
                value={formData.observations}
                onChange={(e) =>
                  setFormData({ ...formData, observations: e.target.value })
                }
                placeholder="Notas adicionales, condiciones de entrega, etc."
              />
              <span className={styles.charCount}>
                {formData.observations.length}/1000
              </span>
            </div>
          </div>

          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
