# 📚 DOCUMENTACIÓN TÉCNICA: FASE 2 - PRESENTACIONES

## 🔍 ARQUITECTURA DE PRESENTACIONES

### Relaciones de Base de Datos

```
Product
  ├── id (PK)
  ├── sku, name
  ├── price: Decimal(12,2)
  ├── stock: Decimal(12,3)          ← SIEMPRE en unidades base
  │
  └── presentations[] (1..N relación)
       │
       └── ProductPresentation
            ├── id (PK)
            ├── productId (FK)
            ├── name: string
            ├── unit: ProductUnit
            ├── factorToBase: Decimal(12,3)
            ├── isDefault: boolean
            └── saleItems[]

Sale
  └── items[]
       └── SaleItem
            ├── productId (FK)
            ├── presentationId (FK nullable)
            ├── soldUnit: ProductUnit        ← Unidad de venta
            ├── soldQty: Decimal(12,3)       ← Cantidad vendida
            ├── baseQty: Decimal(12,3)       ← Cantidad en base
            ├── unitPrice: Decimal(12,2)
            └── subtotal: Decimal(12,2)
```

---

## 🔢 ARITMÉTICA DE PRESENTACIONES

### Concepto: Unidad Base

Todos los productos almacenan stock en una **unidad base única**:
- **Para productos METRO:** metro = unidad base
- **Para productos KILO:** kilo = unidad base
- **Para productos UNIDAD:** unidad = unidad base

### Conversión: Vendida → Base

Cuando usuario vende en una presentación con factor > 1:

```
soldQty = 2.5          (cantidad que el usuario vende)
factorToBase = 100     (ROLLO = 100 METRO)
baseQty = 2.5 × 100 = 250  (stock decrementado)

Validación: product.stock (500) >= baseQty (250) ✅
```

### Ejemplo: Cable ROLLO

```
Product:
  - stock = 500 METRO (unidad base)
  - price = $1.25/metro

Presentation METRO:
  - factorToBase = 1
  - unitPrice = $1.25 × 1 = $1.25

Presentation ROLLO 100m:
  - factorToBase = 100
  - unitPrice = $1.25 × 100 = $125.00
  - 1 ROLLO = 100 METRO (para cálculo de stock)
```

**Venta: Usuario compra 2.5 ROLLO**
```
SaleItem:
  - soldUnit = METRO
  - soldQty = 2.5
  - baseQty = 2.5 × 100 = 250 METRO
  - unitPrice = $125.00
  - subtotal = 2.5 × $125.00 = $312.50

Stock actualizado:
  - ANTES: 500 METRO
  - DESPUÉS: 500 - 250 = 250 METRO ✅
```

---

## 💾 TIPOS DECIMAL: PRECISIÓN

### ¿Por qué Decimal?

```typescript
// Problema con Float (JavaScript número nativo)
0.1 + 0.2 = 0.30000000000000004  ❌

// Solución con Prisma Decimal
new Prisma.Decimal(0.1).add(new Prisma.Decimal(0.2))
  = Decimal(0.3)  ✅
```

### Definiciones en Schema

```prisma
// Dinero: 2 decimales
price Decimal(12,2)      ← $1.25, $125.00
unitPrice Decimal(12,2)  ← $1.25
subtotal Decimal(12,2)   ← $312.50

// Cantidades: 3 decimales (máximo para granel)
stock Decimal(12,3)      ← 500.000
soldQty Decimal(12,3)    ← 2.500
baseQty Decimal(12,3)    ← 250.000
factorToBase Decimal(12,3) ← 100.000
```

### Operaciones Prisma

```typescript
// Suma
product.price.add(otherPrice)

// Multiplicación
soldQty.mul(unitPrice)

// Redondeo a N decimales
result.toDecimalPlaces(2)

// Conversión a number para JSON
Number(decimal)
```

---

## 🔐 VALIDACIONES POR UNIDAD

### Categoría A: Decimales Permitidos
```
METRO, LITRO, KILO

✅ Aceptados:
  - 1
  - 1.5
  - 2.333
  - 10.1

❌ Rechazados:
  - (aceptan todos)
```

### Categoría B: Solo Enteros
```
UNIDAD, CAJA, PAQUETE, ROLLO

✅ Aceptados:
  - 1
  - 10
  - 999

❌ Rechazados:
  - 1.5
  - 2.3
  - 0.5
```

### Código de Validación

```typescript
function unitAllowsDecimals(unit: ProductUnit): boolean {
  return ['METRO', 'LITRO', 'KILO'].includes(unit)
}

function validateQuantity(qty: number, unit: ProductUnit): { valid: boolean; error?: string } {
  if (qty <= 0) {
    return { valid: false, error: 'Cantidad debe ser mayor a 0' }
  }

  if (!unitAllowsDecimals(unit)) {
    // Verificar que sea entero
    if (!Number.isInteger(qty)) {
      return { 
        valid: false, 
        error: `${unit} solo permite cantidades enteras (recibido: ${qty})` 
      }
    }
  }

  // Para decimales, verificar máximo 3 decimales
  const decimalPlaces = (qty.toString().split('.')[1] || '').length
  if (decimalPlaces > 3) {
    return { 
      valid: false, 
      error: `Máximo 3 decimales permitidos (recibido: ${qty})` 
    }
  }

  return { valid: true }
}
```

---

## 📤 SERIALIZACIÓN JSON

### Problema: Prisma Decimal en JSON

```typescript
const product = await prisma.product.findUnique({ id })
JSON.stringify(product)
// Error: Decimal is not JSON serializable
```

### Solución: Conversión Explícita

```typescript
// En Backend/API/products.ts
const result = {
  ...product,
  price: Number(product.price),           // $1.25
  stock: Number(product.stock),           // 500
  presentations: product.presentations.map(p => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
    factorToBase: Number(p.factorToBase),  // 100
    isDefault: p.isDefault,
    isActive: p.isActive
  }))
}
return JSON.stringify(result)
```

---

## 🛒 FLUJO EN CAJA

### Estado del Carrito (CartItem)

```typescript
interface CartItem {
  product: Product
  presentationId: string | null
  presentation: ProductPresentation | null
  soldQty: number              // ← Usuario ingresa aquí
}
```

### Cambio de Presentación

```
Usuario selecciona "ROLLO 100m"
  ↓
presentationId = "pres-rollo"
presentation = { id, name: "ROLLO 100m", factorToBase: 100, ... }
  ↓
Re-renderizar con:
  - unitPrice = $1.25 × 100 = $125.00
  - Input step = "1" (METRO es decimal permitido) 
  - Mostrar "(1 ROLLO = 100 METRO)"
```

### Cálculo de Total

```typescript
function calculateCartTotal(cart: CartItem[]): { subtotal, tax, total } {
  let subtotal = new Decimal(0)
  
  for (const item of cart) {
    // 1. Obtener precio unitario
    const unitPrice = new Prisma.Decimal(item.product.price)
      .mul(item.presentation?.factorToBase || 1)
    
    // 2. Multiplicar por cantidad
    const itemSubtotal = new Prisma.Decimal(item.soldQty)
      .mul(unitPrice)
      .toDecimalPlaces(2)
    
    // 3. Sumar
    subtotal = subtotal.add(itemSubtotal)
  }
  
  const tax = new Prisma.Decimal(0)  // Aún sin impuestos
  const total = subtotal.add(tax)
  
  return { subtotal, tax, total }
}
```

---

## 🔄 TRANSACCIÓN DE VENTA

### Pseudocódigo de createSale

```typescript
async function createSale(input: CreateSaleInput) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Obtener usuario
    const user = await tx.user.findUnique({ where: { id: userId } })
    
    // 2. Para cada item en carrito
    for (const item of input.items) {
      // 2a. Obtener producto con presentaciones
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        include: { presentations: { where: { isActive: true } } }
      })
      
      // 2b. Obtener presentación seleccionada
      const presentation = product.presentations.find(p => p.id === item.presentationId)
      
      // 2c. Validar cantidad
      const qtyValidation = validateQuantity(item.soldQty, presentation.unit)
      if (!qtyValidation.valid) throw new Error(qtyValidation.error)
      
      // 2d. Calcular baseQty
      const baseQty = roundDecimal(
        item.soldQty * Number(presentation.factorToBase), 
        3
      )
      
      // 2e. Validar stock
      if (product.stock < baseQty) {
        throw new Error(`Stock insuficiente: disponible ${product.stock}, necesita ${baseQty}`)
      }
      
      // 2f. Calcular precios
      const unitPrice = new Prisma.Decimal(product.price)
        .mul(presentation.factorToBase)
      const itemSubtotal = new Prisma.Decimal(item.soldQty)
        .mul(unitPrice)
        .toDecimalPlaces(2)
    }
    
    // 3. Crear Sale
    const sale = await tx.sale.create({
      data: {
        userId,
        saleNumber: generateSaleNumber(),
        paymentMethod: input.paymentMethod,
        subtotal,
        tax: 0,
        total: subtotal
      }
    })
    
    // 4. Crear SaleItems y actualizar stock (en mismo tx)
    for (const item of input.items) {
      // ... crear SaleItem ...
      // ... actualizar product.stock -= baseQty ...
      // ... crear StockMovement ...
    }
    
    return sale
  })
  // Si algo falla, TODO se rollback (transacción atómica)
  return result
}
```

---

## 📑 PDF: REPRESENTACIÓN EN BOLETA

### Tabla de Productos

```
CANTIDAD        UNIDAD VTA.       DESCRIPCIÓN              UNITARIO    SUBTOTAL
────────────────────────────────────────────────────────────────────────────
2.5             METRO             Cable #12 AWG            $125.00     $312.50
                                  (ROLLO 100m)
────────────────────────────────────────────────────────────────────────────
```

### Código de Generación

```typescript
const rowsData = sale.items.map(item => [
  item.soldQty.toFixed(3),                    // 2.5
  item.soldUnit,                              // METRO
  `${item.product.name}\n(${item.presentation?.name})`,  // Cable #12 AWG\n(ROLLO 100m)
  `$${Number(item.unitPrice).toFixed(2)}`,    // $125.00
  `$${Number(item.subtotal).toFixed(2)}`      // $312.50
])

table.addRows(rowsData)
```

---

## 🌱 SEED: CREACIÓN DE PRESENTACIONES

### Patrón General

```typescript
for (const prodData of productos) {
  const { presentations, ...productData } = prodData
  
  // 1. Crear producto sin presentaciones aún
  const product = await prisma.product.create({
    data: productData
  })
  
  // 2. Crear presentaciones
  for (const presData of presentations) {
    await prisma.productPresentation.create({
      data: {
        productId: product.id,
        ...presData
      }
    })
  }
}
```

### Datos Ejemplo: Clavos

```typescript
{
  sku: 'CLA-001',
  name: 'Clavos 2.5"',
  unit: ProductUnit.KILO,
  price: 2.3,                      // Base price per KILO
  stock: 150,                      // 150 KILO total
  minStock: 40,
  presentations: [
    { 
      name: 'KILO', 
      unit: ProductUnit.KILO, 
      factorToBase: 1,             // 1 KILO = 1 base
      isDefault: true 
    },
    { 
      name: 'CAJA 5kg', 
      unit: ProductUnit.KILO, 
      factorToBase: 5,             // 1 CAJA = 5 KILO
      isDefault: false 
    },
    { 
      name: 'CAJA 25kg', 
      unit: ProductUnit.KILO, 
      factorToBase: 25,            // 1 CAJA = 25 KILO
      isDefault: false 
    }
  ]
}
```

---

## 📊 CASOS EDGE

### Edge Case 1: Producto sin presentaciones

**Problema:** Usuario compra antes de que exista presentación

**Solución:**
```typescript
const presentation = product.presentations.find(p => p.id === presentationId) 
  || product.presentations[0]  // Fallback a primera
  || { id: null, factorToBase: 1, unit: product.unit }  // Default temporal
```

### Edge Case 2: Cambio de presentación default

**Problema:** Admin cambia cuál presentación es default

**Solución:**
```sql
-- Permitir UPDATE isDefault
UPDATE product_presentations 
SET "isDefault" = false 
WHERE "productId" = $1

UPDATE product_presentations 
SET "isDefault" = true 
WHERE id = $2
```

### Edge Case 3: Presentación con factor decimal

**Ejemplo:** Pintura en galones

```typescript
{
  name: 'GALON (3.785L)',
  unit: ProductUnit.LITRO,
  factorToBase: 3.785        // ← Decimal permitido
}

// Venta: 2 galones
// baseQty = 2 × 3.785 = 7.57 LITRO
// Stock validación: product.stock >= 7.57
```

---

## 🔍 DEBUGGING

### Query para inspeccionar presentaciones

```sql
SELECT 
  p.name as "Producto",
  pp.name as "Presentación",
  pp."factorToBase" as "Factor",
  pp."isDefault" as "Es Default",
  COUNT(si.id) as "Veces Vendida"
FROM products p
LEFT JOIN product_presentations pp ON p.id = pp."productId"
LEFT JOIN sale_items si ON pp.id = si."presentationId"
WHERE p."isActive" = true
GROUP BY p.id, pp.id
ORDER BY p.name, pp."factorToBase" DESC;
```

### Query para auditar baseQty

```sql
-- Verificar que baseQty × presentation.factorToBase ≈ soldQty
SELECT 
  si."soldUnit",
  si."soldQty",
  si."baseQty",
  pp."factorToBase",
  si."baseQty" / pp."factorToBase" as "Calc Qty",
  p.name
FROM sale_items si
JOIN product_presentations pp ON si."presentationId" = pp.id
JOIN products p ON si."productId" = p.id
WHERE si."soldQty" != si."baseQty"
LIMIT 10;
```

---

## 🚨 ERRORES COMUNES

### Error 1: "Cannot read property 'factorToBase' of undefined"

**Causa:** presentation es null  
**Solución:**
```typescript
const factor = presentation?.factorToBase || 1
```

### Error 2: "Decimal is not JSON serializable"

**Causa:** Olvidó `Number()` en serialización  
**Solución:**
```typescript
const response = {
  price: Number(product.price),  // ← Importante
  stock: Number(product.stock)
}
```

### Error 3: "Stock insuficiente" aunque hay stock

**Causa:** Comparación entre Decimal y number  
**Solución:**
```typescript
if (Number(product.stock) < Number(baseQty)) {
  // O mejor: usar Decimal.gte()
  if (!product.stock.gte(new Prisma.Decimal(baseQty))) {
```

---

## ✅ CHECKLIST DE VALIDACIÓN

- [ ] Migraciones ejecutadas sin errores
- [ ] ProductPresentation creadas para 25 productos
- [ ] Stock es Decimal(12,3) en base de datos
- [ ] Seed crea presentaciones automáticamente
- [ ] CajaView renderiza dropdown de presentaciones
- [ ] Cantidad input es decimal o entero según presentación
- [ ] unitPrice se recalcula al cambiar presentación
- [ ] baseQty es correcto en SaleItem
- [ ] Stock se decrementa en unidades base
- [ ] PDF muestra nombre de presentación
- [ ] API retorna presentaciones serializadas
- [ ] Validación rechaza decimales para UNIDAD/CAJA

---

**FIN DE DOCUMENTACIÓN TÉCNICA**
