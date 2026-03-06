# Generador PDF - Nota de Venta

## 📋 Descripción

Sistema de generación de PDFs con diseño profesional tipo **NOTA DE VENTA** para ferretería.

**IMPORTANTE:** Este NO es un documento de boleta electrónica. No tiene relación con SUNAT, no requiere QR obligatorio ni RUC del negocio.

## ✨ Características

### Diseño Visual
- ✅ Encabezado con nombre del negocio: **FERRETERÍA CHAVALOS**
- ✅ Título grande: **NOTA DE VENTA**
- ✅ Campos opcionales para cliente (DNI, RUC, Institución, Dirección)
- ✅ Tabla de productos con columnas: Cant., U.M., Descripción, P. Unit, Importe
- ✅ Sección de totales: Subtotal, IGV (opcional), Total
- ✅ Caja de observaciones
- ✅ Pie de página con agradecimiento y aclaración de documento interno

### Formatos Soportados
1. **A4 (vertical)**: Diseño completo para impresión en papel estándar
2. **TICKET (80mm)**: Diseño simplificado para impresoras térmicas tipo recibo

### Manejo de Datos Opcionales
- Si un dato no existe (DNI, RUC, Institución, Dirección), muestra líneas en blanco para completar a mano
- No crashea si faltan datos del cliente
- Formato de moneda: **S/** (Soles peruanos)

## 🔧 Uso

### Uso Básico (A4)
```typescript
import { generateSalePDF } from '@/lib/pdf-generator'

const sale = {
  saleNumber: 'VENTA-0001',
  createdAt: new Date(),
  customerName: 'Juan Pérez',
  customerDni: '12345678',
  paymentMethod: 'Efectivo',
  subtotal: 100.00,
  tax: 18.00,
  total: 118.00,
  items: [
    {
      product: {
        sku: 'PROD-001',
        name: 'Cemento Sol tipo I',
        unit: 'Bolsa'
      },
      soldUnit: 'Bolsa',
      soldQty: 10,
      baseQty: 10,
      unitPrice: 10.00,
      subtotal: 100.00,
      presentation: null
    }
  ],
  user: {
    fullName: 'María López'
  }
}

// Generar PDF en formato A4
const pdf = generateSalePDF(sale)
pdf.save('Venta_0001.pdf')
```

### Uso con Formato TICKET
```typescript
// Generar PDF formato TICKET (80mm)
const pdf = generateSalePDF(sale, { format: 'TICKET' })
pdf.save('Ticket_0001.pdf')
```

### Con Todos los Campos Opcionales
```typescript
const sale = {
  saleNumber: 'VENTA-0002',
  createdAt: new Date(),
  customerName: 'Constructora ABC S.A.C.',
  customerDni: '12345678',
  customerRuc: '20123456789',
  customerInstitution: 'Constructora ABC S.A.C.',
  customerAddress: 'Av. Los Constructores 456, Lima',
  paymentMethod: 'Crédito 30 días',
  observations: 'Entrega programada para el lunes 20/01/2026. Incluye flete.',
  subtotal: 500.00,
  tax: 90.00,
  total: 590.00,
  items: [...],
  user: { fullName: 'Carlos Ramírez' }
}

const pdf = generateSalePDF(sale, { format: 'A4' })
pdf.save('Venta_0002.pdf')
```

### Sin Datos Opcionales (Mínimo)
```typescript
const sale = {
  saleNumber: 'VENTA-0003',
  createdAt: new Date(),
  // NO customerName, NO customerDni, NO customerRuc, etc.
  paymentMethod: 'Efectivo',
  subtotal: 50.00,
  tax: 0,
  total: 50.00,
  items: [...],
  user: { fullName: 'Pedro Sánchez' }
}

// Mostrará líneas en blanco para completar a mano
const pdf = generateSalePDF(sale)
pdf.save('Venta_0003.pdf')
```

## 📝 Interface SaleData

```typescript
interface SaleData {
  saleNumber: string              // Obligatorio: Número de venta
  createdAt: Date                 // Obligatorio: Fecha/hora de venta
  customerName?: string           // Opcional: Nombre del cliente
  customerDni?: string            // Opcional: DNI del cliente
  customerRuc?: string            // Opcional: RUC del cliente
  customerInstitution?: string    // Opcional: Institución/Empresa
  customerAddress?: string        // Opcional: Dirección del cliente
  paymentMethod: string           // Obligatorio: Método de pago
  subtotal: number | string       // Obligatorio: Subtotal de la venta
  tax: number | string            // Obligatorio: IGV (puede ser 0)
  total: number | string          // Obligatorio: Total de la venta
  items: Array<{...}>             // Obligatorio: Items de la venta
  user: {                         // Obligatorio: Vendedor
    fullName: string
  }
  observations?: string           // Opcional: Observaciones adicionales
}

interface PDFOptions {
  format?: 'A4' | 'TICKET'        // Opcional: Formato del PDF (default: 'A4')
}
```

## 🎨 Detalles de Diseño

### Formato A4
- **Tamaño:** 210 x 297 mm
- **Márgenes:** 15mm
- **Fuentes:**
  - Título negocio: 20pt bold
  - Título "NOTA DE VENTA": 16pt bold
  - Labels: 10pt bold
  - Contenido: 9-10pt normal
  - Tabla: 9pt

### Formato TICKET
- **Tamaño:** 80 x 297 mm (altura ajustable)
- **Márgenes:** 5mm
- **Fuentes:**
  - Título negocio: 14pt bold
  - Título "NOTA DE VENTA": 11pt bold
  - Contenido: 8pt normal

### Tabla de Productos
- **Columnas:**
  1. Cant. (cantidad, alineada al centro)
  2. U.M. (unidad de medida, alineada al centro)
  3. Descripción (texto completo, alineada a la izquierda, con wrap)
  4. P. Unit (precio unitario, alineado a la derecha)
  5. Importe (subtotal, alineado a la derecha)

## 🛠️ Funciones Helper

### `to2(n: number): number`
Redondea un número a 2 decimales.

```typescript
to2(10.555) // 10.56
to2(10.554) // 10.55
```

### `formatMoneyPEN(value: number | string): string`
Formatea un valor como moneda peruana (Soles).

```typescript
formatMoneyPEN(100) // "S/ 100.00"
formatMoneyPEN(1234.56) // "S/ 1,234.56"
```

## 🔒 TypeScript Strict

El código está completamente tipado y cumple con `TypeScript strict mode`.

## ⚠️ Notas Importantes

1. **NO es boleta electrónica:** Este es un documento interno, no válido para efectos tributarios.
2. **Campos opcionales:** El PDF no falla si faltan datos. Muestra líneas en blanco para completar manualmente.
3. **IGV:** Si `tax = 0`, no muestra la línea de IGV en totales.
4. **Presentaciones:** Si un item tiene presentación (ej: Caja, Paquete), se muestra entre paréntesis en la descripción.
5. **Moneda:** Siempre en Soles (S/).

## 📦 Dependencias

- `jspdf`: Generación de PDFs
- `jspdf-autotable`: Tablas en PDFs
- `@/lib/format-money`: Formateo de moneda

## 🚀 Migración Futura

Si en el futuro se agregan campos al modelo de datos (ej: `customerEmail`, `customerPhone`), simplemente:

1. Agregar el campo opcional en la interface `SaleData`
2. Usar el campo en el generador con validación: `sale.customerEmail || '_______________'`

**No requiere migraciones de base de datos ni cambios en la lógica de ventas.**

## 📄 Archivos Relacionados

- **Generador:** `lib/pdf-generator.ts`
- **Formatter:** `lib/format-money.ts`
- **Vista Ventas:** `ui/pages/ventas/VentasView.tsx`

## ✅ Testing

Para probar el generador:

```typescript
// En la consola del navegador o en un componente de prueba
import { generateSalePDF } from '@/lib/pdf-generator'

const testSale = {
  saleNumber: 'TEST-001',
  createdAt: new Date(),
  customerName: 'Cliente de Prueba',
  customerDni: '87654321',
  paymentMethod: 'Efectivo',
  subtotal: 100,
  tax: 18,
  total: 118,
  items: [
    {
      product: {
        sku: 'TEST-001',
        name: 'Producto de Prueba',
        unit: 'Unidad'
      },
      soldUnit: 'Unidad',
      soldQty: 5,
      baseQty: 5,
      unitPrice: 20,
      subtotal: 100,
      presentation: null
    }
  ],
  user: { fullName: 'Vendedor Prueba' }
}

// Prueba A4
const pdfA4 = generateSalePDF(testSale, { format: 'A4' })
pdfA4.save('test_A4.pdf')

// Prueba TICKET
const pdfTicket = generateSalePDF(testSale, { format: 'TICKET' })
pdfTicket.save('test_ticket.pdf')
```

---

**Última actualización:** 15 de enero de 2026
