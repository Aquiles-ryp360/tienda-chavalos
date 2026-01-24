# 🔧 Solución: Stepper de Cantidad en Carrito

## Problema Original

1. **Incrementos incorrectos**: El stepper usaba `0.001` para decimales, generando valores como `1.5000000002`
2. **Input bloqueado**: No permitía borrar el contenido para escribir un valor exacto
3. **Sin diferenciación por unidad**: Todos los productos fraccionables usaban el mismo step inadecuado

## Implementación

### 1. Funciones Auxiliares (Inicio del archivo)

```typescript
// Normalizar cantidades y evitar errores de punto flotante
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

// Determinar si una unidad permite decimales (kg, lt, m, etc.)
function determineAllowsDecimals(unit: string): boolean {
  const lowerUnit = unit.toLowerCase()
  return ['kg', 'kilo', 'lt', 'l', 'm', 'g', 'ml'].includes(lowerUnit)
}

// Determinar el step adecuado (1 para unidades, 0.5 para fraccionables)
function determineStep(unit: string, allowsDecimals: boolean): number {
  if (!allowsDecimals) return 1
  return 0.5 // Medio kilo, medio litro, etc.
}
```

**¿Por qué funciona?**
- `normalizeQty`: Cuantiza al múltiplo del step más cercano y usa `toFixed()` para eliminar errores de punto flotante
- `determineAllowsDecimals`: Detecta unidades fraccionables por heurística (kg, lt, m, etc.)
- `determineStep`: Retorna step lógico (1 para unidades, 0.5 para fraccionables)

### 2. Estado del Carrito

Agregado campo opcional `draftQty?: string` a la interfaz `CartItem`:

```typescript
interface CartItem {
  product: Product
  presentationId: string | null
  presentation: ProductPresentation | null
  soldQty: number  // Cantidad confirmada (numérica)
  draftQty?: string  // Estado temporal del input (permite "" mientras escribe)
  adjustedUnitPrice?: number
  priceAdjustNote?: string
  priceAdjusted?: boolean
}
```

**¿Por qué `draftQty`?**
- Permite al usuario borrar el input completamente (vacío = "")
- No fuerza validación hasta `onBlur` o `Enter`
- Se sincroniza con `soldQty` al confirmar

### 3. Input Mejorado

```typescript
<input
  type="text"  // Cambiado de "number" a "text" para mejor control
  inputMode={isDecimal ? 'decimal' : 'numeric'}  // Teclado correcto en móvil
  value={item.draftQty !== undefined ? item.draftQty : item.soldQty}
  
  onChange={(e) => {
    let value = e.target.value
    value = value.replace(',', '.')  // Soportar coma decimal europea
    
    // Permitir: vacío, números, punto decimal
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setCart(cart.map((cartItem, cartIdx) => 
        cartIdx === idx ? { ...cartItem, draftQty: value } : cartItem
      ))
    }
  }}
  
  onBlur={() => {
    // Validar y normalizar al perder el foco
    const allowsDecimals = determineAllowsDecimals(unit)
    const step = determineStep(unit, allowsDecimals)
    const min = step
    
    const normalized = normalizeQty(item.draftQty || '', { step, min })
    
    if (normalized && normalized >= min) {
      // Aplicar cantidad normalizada
      setCart(cart.map((cartItem, cartIdx) => 
        cartIdx === idx 
          ? { ...cartItem, soldQty: normalized, draftQty: String(normalized) }
          : cartItem
      ))
    } else {
      // Restaurar al mínimo si es inválido
      setCart(cart.map((cartItem, cartIdx) => 
        cartIdx === idx 
          ? { ...cartItem, soldQty: min, draftQty: String(min) }
          : cartItem
      ))
    }
  }}
  
  onKeyDown={(e) => {
    if (e.key === 'Enter') e.currentTarget.blur()  // Enter = confirmar
  }}
/>
```

**Flujo:**
1. Usuario escribe → `onChange` guarda en `draftQty` (sin validar)
2. Usuario hace blur o Enter → `onBlur` normaliza y actualiza `soldQty`
3. Si inválido o vacío → vuelve al mínimo

### 4. Botones +/-

```typescript
// Botón + (ejemplo)
<button
  onClick={() => {
    const allowsDecimals = determineAllowsDecimals(unit)
    const step = determineStep(unit, allowsDecimals)
    const min = step
    
    // Obtener cantidad actual (draftQty o soldQty)
    const currentQty = normalizeQty(item.draftQty || item.soldQty, { step, min }) || item.soldQty
    const newQty = currentQty + step
    const normalized = normalizeQty(newQty, { step, min })
    
    if (normalized) {
      setCart(cart.map((cartItem, cartIdx) => 
        cartIdx === idx 
          ? { ...cartItem, soldQty: normalized, draftQty: String(normalized) }
          : cartItem
      ))
    }
  }}
>
  +
</button>
```

**Lógica:**
- Usa `normalizeQty` para obtener cantidad actual limpia
- Incrementa/decrementa por `step` (1 o 0.5)
- Aplica normalización para evitar decimales raros
- Actualiza tanto `soldQty` como `draftQty`

### 5. Al Agregar Producto

```typescript
const unit = defaultPresentation?.unit || product.unit
const allowsDecimals = determineAllowsDecimals(unit)
const step = determineStep(unit, allowsDecimals)
const initialQty = step  // Comenzar con step mínimo (1 o 0.5)

setCart([
  ...cart,
  {
    product,
    presentationId: defaultPresentation?.id || null,
    presentation: defaultPresentation || null,
    soldQty: initialQty,
    draftQty: String(initialQty),  // Inicializar draftQty también
  },
])
```

## Casos de Prueba

### ✅ Producto por Unidad (Tornillos, Clavos)
- Step = 1
- Valores permitidos: 1, 2, 3, 4...
- Botón +: 1 → 2 → 3
- Botón -: 3 → 2 → 1
- Input manual: escribir "5" → blur → queda 5
- Input inválido: escribir "abc" → blur → vuelve a 1

### ✅ Producto Fraccionable (Cemento en kg)
- Step = 0.5
- Valores permitidos: 0.5, 1, 1.5, 2, 2.5...
- Botón +: 0.5 → 1 → 1.5 → 2
- Botón -: 2 → 1.5 → 1 → 0.5
- Input manual: escribir "2.5" → blur → queda 2.5
- Input cuantizado: escribir "1.3" → blur → queda 1.5 (múltiplo más cercano)
- Input vacío: borrar todo → blur → vuelve a 0.5

### ✅ Cambio de Presentación
- Producto: Pintura
- Presentaciones: "Galón (lt)" y "Cuarto (unidad)"
- Al cambiar de lt (step 0.5) a unidad (step 1):
  - Si qty = 1.5 → normaliza a 2 (múltiplo de 1)
  - `draftQty` se actualiza correctamente

## Evitar Bug de 0.001

**Antes:**
```typescript
// ❌ INCORRECTO
onClick={() => updateQuantity(item.product.id, item.presentationId, isDecimal ? 0.001 : 1)}
```
- Incrementaba en 0.001 → acumulaba errores de punto flotante
- Resultado: 1.5000000002, 2.003, etc.

**Ahora:**
```typescript
// ✅ CORRECTO
const step = determineStep(unit, allowsDecimals) // 1 o 0.5
const newQty = currentQty + step
const normalized = normalizeQty(newQty, { step, min })
```
- Incrementa en step lógico (1 o 0.5)
- `normalizeQty` cuantiza y usa `toFixed()` para eliminar basura decimal
- Resultado: 1, 1.5, 2, 2.5 (valores limpios)

## Archivos Modificados

- **`ui/pages/caja/CajaView.tsx`**:
  - Agregadas funciones `normalizeQty`, `determineAllowsDecimals`, `determineStep`
  - Modificada interfaz `CartItem` (campo `draftQty`)
  - Reescrito input de cantidad (type="text", onChange sin validación, onBlur con normalización)
  - Reescritos botones +/- (usan step dinámico y normalización)
  - Actualizado `addToCart` (inicializa `draftQty`)
  - Actualizado selector de presentación (recalcula qty con nuevo step)

## Beneficios

1. ✅ **Sin decimales raros**: `normalizeQty` garantiza valores limpios
2. ✅ **UX flexible**: Permite borrar input y escribir libremente
3. ✅ **Steps lógicos**: 1 para unidades, 0.5 para fraccionables
4. ✅ **Validación inteligente**: Solo al confirmar (blur/Enter)
5. ✅ **Teclado correcto**: `inputMode="decimal"` en móvil para fraccionables
6. ✅ **Sin cambios en lógica de negocio**: Solo mejora el control UI

---

**Compilación exitosa**: ✓ `npm run build` sin errores
