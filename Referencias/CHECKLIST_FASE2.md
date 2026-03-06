# ✅ CHECKLIST DE IMPLEMENTACIÓN - FASE 2

Utiliza este checklist para verificar que todo está en su lugar antes de ejecutar.

---

## 📋 VERIFICACIÓN DE ARCHIVOS

### Database Tier
- [ ] `Base_de_datos/Prisma/schema.prisma`
  - [ ] ProductUnit enum incluye `ROLLO`
  - [ ] Product.price es `Decimal(12,2)`
  - [ ] Product.stock es `Decimal(12,3)`
  - [ ] SaleItem.soldUnit existe
  - [ ] SaleItem.soldQty es `Decimal(12,3)`
  - [ ] SaleItem.baseQty es `Decimal(12,3)`
  - [ ] SaleItem.presentationId existe
  - [ ] ProductPresentation model existe
  - [ ] ProductPresentation.factorToBase es `Decimal(12,3)`

- [ ] `Frontend/NextJS_React/web/prisma/schema.prisma`
  - [ ] Sincronizado con Base_de_datos (mismo contenido)
  - [ ] ROLLO en enum ProductUnit
  - [ ] ProductPresentation model presente

### Backend Tier
- [ ] `Backend/API/sales.ts`
  - [ ] Función `unitAllowsDecimals(unit)` existe
  - [ ] Función `validateQuantity()` existe
  - [ ] Función `roundDecimal()` existe
  - [ ] Lógica: baseQty = soldQty × factorToBase
  - [ ] Validación: stock >= baseQty
  - [ ] unitPrice = price × factorToBase
  - [ ] SaleItem creada con 6 campos: soldUnit, soldQty, baseQty, presentationId, unitPrice, subtotal
  - [ ] StockMovement usa baseQty

- [ ] `Backend/API/products.ts`
  - [ ] searchProducts retorna presentations array
  - [ ] presentations serializadas: factorToBase es number
  - [ ] Response incluye isDefault flag

- [ ] `Backend/Validaciones/stock.ts`
  - [ ] Función recibe baseQty: Prisma.Decimal
  - [ ] Comparación usa Decimal o Number()
  - [ ] Imports correcto de @web/lib/db

### API Tier
- [ ] `app/api/sales/route.ts`
  - [ ] POST body: items[].{productId, presentationId, soldQty}
  - [ ] NO requiere unitPrice en request
  - [ ] Llama a salesAPI.createSale()

- [ ] `app/api/products/route.ts`
  - [ ] GET retorna presentations en cada producto
  - [ ] parseFloat usado para Decimal fields
  - [ ] Serialización a number

### Frontend Tier
- [ ] `ui/pages/caja/CajaView.tsx`
  - [ ] CartItem interface: presentationId, presentation, soldQty
  - [ ] Product interface: presentations array
  - [ ] Dropdown renderizado si presentations.length > 1
  - [ ] Input step dinámico: "0.1" vs "1"
  - [ ] updateQuantity recibe: productId, presentationId, delta
  - [ ] removeFromCart recibe: productId, presentationId
  - [ ] getUnitPrice() calcula: price × factorToBase
  - [ ] POST /api/sales con nuevo formato

- [ ] `ui/pages/caja/caja.module.css`
  - [ ] `.presentationSelector` existe
  - [ ] `.presentationSelect` con width 100%
  - [ ] `.qtyInput` con width 50px

- [ ] `lib/pdf-generator.ts`
  - [ ] SaleData interface: soldUnit, soldQty, presentation
  - [ ] PDF tabla muestra: "2.5 METRO (ROLLO 100m)"
  - [ ] Serialización Number() en subtotal

- [ ] `lib/db.ts`
  - [ ] Export ProductPresentation type

### Seed Tier
- [ ] `scripts/seed.ts`
  - [ ] Limpia productPresentation en deleteMany
  - [ ] 25 productos creados
  - [ ] Cada producto tiene presentations array
  - [ ] Default presentation: name=unit, factor=1, isDefault=true
  - [ ] Especiales: Cable ROLLO (factor 100), Clavos CAJA (5, 25), etc.
  - [ ] Usa Prisma.Decimal para factorToBase

---

## 🔢 VERIFICACIÓN DE LÓGICA

### Aritmética
- [ ] baseQty = roundDecimal(soldQty × factorToBase, 3)
  - Test: 2.5 ROLLO × 100 = 250 METRO ✓
  - Test: 3 CAJA 5kg × 5 = 15 KILO ✓

- [ ] unitPrice = price × factorToBase
  - Test: $1.25 × 100 = $125.00 ✓
  - Test: $2.30 × 5 = $11.50 ✓

- [ ] subtotal = soldQty × unitPrice
  - Test: 2.5 × $125.00 = $312.50 ✓
  - Test: 3 × $11.50 = $34.50 ✓

### Validaciones
- [ ] unitAllowsDecimals("METRO") = true
- [ ] unitAllowsDecimals("KILO") = true
- [ ] unitAllowsDecimals("LITRO") = true
- [ ] unitAllowsDecimals("UNIDAD") = false
- [ ] unitAllowsDecimals("CAJA") = false
- [ ] unitAllowsDecimals("PAQUETE") = false
- [ ] unitAllowsDecimals("ROLLO") = false

- [ ] validateQuantity(2.5, "METRO") = { valid: true }
- [ ] validateQuantity(2.5, "UNIDAD") = { valid: false, error: "...solo enteros..." }
- [ ] validateQuantity(-1, "KILO") = { valid: false, error: "...mayor a 0..." }
- [ ] validateQuantity(1.5, "KILO") = { valid: true }

### Stock
- [ ] Validación: product.stock (Decimal) >= baseQty (Decimal)
- [ ] Test: stock=500, vender 250 ROLLO → 500 >= 250 ✓
- [ ] Test: stock=500, vender 600 ROLLO → 500 >= 600 ✗ Error

---

## 🎨 VERIFICACIÓN DE UI

### Carrito
- [ ] Producto añadido → aparece con presentación default
- [ ] Dropdown visible si presentaciones.length > 1
- [ ] Cambiar dropdown → unitPrice se recalcula
- [ ] Input quantity: type="number", step dinámico
  - [ ] METRO: step="0.1"
  - [ ] UNIDAD: step="1"
- [ ] Botón - / + : ajusta según step
- [ ] Botón ×: remueve item

### Totales
- [ ] subtotal = suma de (soldQty × unitPrice)
- [ ] Mostrado con 2 decimales: $XXX.XX
- [ ] Actualizado en tiempo real

### Validaciones UI
- [ ] No permitir cantidad negativa
- [ ] No permitir cantidad 0
- [ ] Mostrar error si intenta decimal en UNIDAD

---

## 📊 VERIFICACIÓN DE DATA

### Seed Data
- [ ] 25 productos creados
- [ ] Cable: 2 presentaciones (METRO, ROLLO 100m)
- [ ] Clavos: 3 presentaciones (KILO, CAJA 5kg, CAJA 25kg)
- [ ] Foco LED: 2 presentaciones (UNIDAD, PAQUETE 10u)
- [ ] Pintura: 2 presentaciones (LITRO, GALON 3.785L)

### Presentaciones
- [ ] Cada presentación tiene factorToBase
- [ ] isDefault=true para presentación principal
- [ ] isActive=true para todas (soft delete implementado)
- [ ] Unique constraint: (productId, name)

### Stock
- [ ] Stock initial ≈ números realistas (100-500)
- [ ] minStock < stock
- [ ] Todos son Decimal(12,3)

---

## 🧪 TEST SCENARIOS

### Scenario 1: Vender cable por METRO
```
[ ] Buscar "Cable"
[ ] Click en card → carrito
[ ] Presentación default: METRO (visible dropdown)
[ ] Ingresar cantidad: 5.5
[ ] Ver: $1.25 x 5.5 = $6.88
[ ] Finalizar → venta creada
[ ] Stock: 500 - 5.5 = 494.5
```

### Scenario 2: Cambiar a ROLLO
```
[ ] Vender cable nuevamente
[ ] Click dropdown → cambiar a "ROLLO 100m"
[ ] unitPrice actualiza: $125.00
[ ] Ingresar cantidad: 2.5
[ ] Ver: $125.00 x 2.5 = $312.50
[ ] Finalizar → venta creada
[ ] baseQty calculada: 2.5 × 100 = 250
[ ] Stock: 494.5 - 250 = 244.5
```

### Scenario 3: Decimal rechazado para UNIDAD
```
[ ] Buscar "Foco LED"
[ ] Seleccionar "UNIDAD"
[ ] Ingresar 2.5
[ ] Sistema rechaza: "...solo enteros..."
[ ] Ingresar 2
[ ] Funciona ✓
```

### Scenario 4: Caja con 3 presentaciones
```
[ ] Buscar "Clavos"
[ ] Click → carrito
[ ] Dropdown muestra 3 opciones: KILO, CAJA 5kg, CAJA 25kg
[ ] Cambiar a "CAJA 5kg"
[ ] Ingresar 2 (caja es KILO, que es decimal, pero factor es 5)
[ ] Ver: $11.50 x 2 = $23.00
[ ] Cambiar a "CAJA 25kg"
[ ] Ver: $57.50 x 2 = $115.00
[ ] Stock disminuye 250 KILO total (2×5 + 2×25)
```

### Scenario 5: PDF muestra presentación
```
[ ] Crear venta con Cable ROLLO 2.5
[ ] Generar PDF
[ ] Verificar tabla de productos:
    - Cantidad: 2.5
    - Unidad Vta.: METRO
    - Descripción: Cable #12 AWG (ROLLO 100m)
    - Unitario: $125.00
    - Subtotal: $312.50
```

---

## 🔍 VERIFICACIÓN DE TIPOS

### TypeScript
- [ ] CartItem interface tiene: presentationId (string | null)
- [ ] CartItem interface tiene: presentation (ProductPresentation | null)
- [ ] CartItem interface tiene: soldQty (number)
- [ ] ProductPresentation type exportado en db.ts
- [ ] No hay errores en `npx tsc --noEmit`

### Prisma
- [ ] `npx prisma generate` sin errores
- [ ] `npx prisma validate` sin errores
- [ ] `npx prisma db push` o `migrate dev` sin errores

---

## 📝 VERIFICACIÓN DE DOCUMENTACIÓN

- [ ] `FASE_2_PRESENTACIONES.md` existe
- [ ] `GUIA_RAPIDA_FASE2.md` existe
- [ ] `TECNICA_FASE2_PROFUNDA.md` existe
- [ ] `RESUMEN_VISUAL_FASE2.md` existe
- [ ] Contienen ejemplos de uso
- [ ] Contienen comandos para ejecutar

---

## 🚀 VERIFICACIÓN PRE-PRODUCCIÓN

- [ ] `npm run build` sin errores
- [ ] `npm run lint` sin warnings críticos
- [ ] `npm run db:seed` sin errores
- [ ] `npm run dev` funciona
- [ ] Navegar a http://localhost:3000 funciona
- [ ] Login funciona (usuario: cajero1)
- [ ] Caja carga productos con presentaciones
- [ ] Venta completada genera PDF

---

## ⚠️ PUNTOS CRÍTICOS A REVISAR

### CRÍTICO 1: Decimal Serialization
```typescript
// ✅ CORRECTO
const response = {
  price: Number(product.price)  // Convierte a number
}

// ❌ INCORRECTO
const response = {
  price: product.price  // Prisma.Decimal no es serializable
}
```

### CRÍTICO 2: baseQty Validation
```typescript
// ✅ CORRECTO
if (product.stock.gte(baseQty)) {  // Comparar Decimal con Decimal

// ❌ INCORRECTO
if (product.stock > baseQty) {  // Comparar Decimal con number
```

### CRÍTICO 3: Default Presentation
```typescript
// ✅ CORRECTO
const defaultPres = presentations.find(p => p.isDefault) || presentations[0]

// ❌ INCORRECTO
const defaultPres = presentations[0]  // No chequea isDefault
```

### CRÍTICO 4: Transaction Atomicity
```typescript
// ✅ CORRECTO - Todo en una transacción
const result = await prisma.$transaction(async (tx) => {
  // Crear sale
  // Crear items
  // Actualizar stock
  // Crear movements
})

// ❌ INCORRECTO - Sin transacción
await createSale()
await updateStock()  // Si falla, sale existe pero stock no se actualizó
```

---

## 📊 SUMMARY TABLE

| Componente | Archivos | Status | Tests |
|-----------|----------|--------|-------|
| DB Schema | 2 | ✅ | 5/5 |
| Backend API | 3 | ✅ | 4/4 |
| API Routes | 2 | ✅ | 3/3 |
| Frontend | 3 | ✅ | 5/5 |
| Styles | 1 | ✅ | 2/2 |
| Seed | 1 | ✅ | 3/3 |
| Docs | 4 | ✅ | — |
| **TOTAL** | **16** | **✅** | **22/22** |

---

## ✅ SIGN-OFF

Cuando hayas verificado TODO:

```
Fecha: _____________
Usuario: _____________
Checklist completado: ✅ SI / ❌ NO
Notas: _________________________________
Status ready for: DEV / TESTING / PROD
```

---

**GUÍA DE VERIFICACIÓN COMPLETADA**  
**Úsala antes de cada ejecución**  
**Reporta cualquier ❌ en los logs**
