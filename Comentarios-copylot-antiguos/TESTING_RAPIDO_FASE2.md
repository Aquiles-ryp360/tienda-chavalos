# 🧪 TESTING RÁPIDO - FASE 2

## ✅ Estado del Servidor

```
✅ Servidor ejecutándose en: http://localhost:3000
✅ Database migrada correctamente
✅ Seed data cargado (25 productos + 50+ presentaciones)
✅ Usuarios de prueba creados
```

---

## 👥 Credenciales de Prueba

| Rol | Usuario | Contraseña |
|-----|---------|-----------|
| Administrador | admin | admin123 |
| Cajero | cajero1 | cajero123 |

---

## 🧪 CHECKLIST DE TESTING

### 1️⃣ Login y Navegación
- [ ] Ir a http://localhost:3000
- [ ] Login como **cajero1** / **cajero123**
- [ ] Verificar que accede a dashboard
- [ ] Navegar a **Caja** (`/caja`)

### 2️⃣ Búsqueda de Productos
En la sección **Búsqueda**:
- [ ] Buscar "Cable" 
- [ ] Verificar que aparece con **2 presentaciones**:
  - METRO (1m)
  - ROLLO 100m

### 3️⃣ Agregar Producto sin Presentación
- [ ] Buscar "Tuerca"
- [ ] Agregar 10 unidades
- [ ] Verificar que se agregó al carrito
- [ ] Ver que **unitPrice = precio base**
- [ ] Subtotal debe ser **cantidad × precio**

### 4️⃣ Agregar Producto CON Presentación (Decimales)
**Producto: Cable**
- [ ] Buscar "Cable"
- [ ] En presentación selector, debería ver:
  - `METRO (factor: 1.000) - DEFAULT`
  - `ROLLO 100m (factor: 100.000)`
- [ ] Seleccionar **ROLLO 100m**
- [ ] El input de cantidad debe permitir **decimales** (step=0.1)
- [ ] Ingresar **0.5** (significa 0.5 rollos = 50 metros)
- [ ] Precio unitario debe ser: **precio_base × 100**
- [ ] Subtotal debe ser: **0.5 × (precio × 100)**
- [ ] Verificar texto: `0.500 ROLLO (ROLLO 100m)`

### 5️⃣ Agregar Producto CON Presentación (Enteros)
**Producto: Foco LED**
- [ ] Buscar "Foco"
- [ ] En presentación selector, debería ver:
  - `UNIDAD (factor: 1.000) - DEFAULT`
  - `PAQUETE 10u (factor: 10.000)`
- [ ] Seleccionar **PAQUETE 10u**
- [ ] El input de cantidad debe **SOLO permitir enteros** (step=1)
- [ ] Si intenta ingresar decimal (ej: 2.5), debe rechazar
- [ ] Ingresar **2** (significa 2 paquetes = 20 focos)
- [ ] Precio unitario debe ser: **precio_base × 10**
- [ ] Subtotal debe ser: **2 × (precio × 10)**
- [ ] Verificar texto: `2.000 PAQUETE (PAQUETE 10u)`

### 6️⃣ Producto Líquido (LITRO)
**Producto: Pintura**
- [ ] Buscar "Pintura"
- [ ] En presentación selector, debería ver:
  - `LITRO (factor: 1.000) - DEFAULT`
  - `GALON 3.785L (factor: 3.785)`
- [ ] Seleccionar **GALON 3.785L**
- [ ] El input debe permitir **decimales** (step=0.1)
- [ ] Ingresar **2.5** (significa 2.5 galones ≈ 9.4625 litros)
- [ ] Precio unitario debe ser: **precio_base × 3.785**
- [ ] Subtotal debe ser: **2.5 × (precio × 3.785)**

### 7️⃣ Carrito Múltiple
- [ ] Agregar 2-3 productos diferentes con distintas presentaciones
- [ ] Verificar que cada línea muestra:
  - Nombre producto
  - Presentación (si tiene más de 1)
  - Cantidad + unidad (ej: "0.500 ROLLO")
  - Precio unitario
  - Subtotal
- [ ] Total debe ser suma correcta de todos

### 8️⃣ Checkout/Venta
- [ ] Click en **Procesar Venta**
- [ ] Debería generar PDF con:
  - Productos
  - **NUEVA COLUMNA: Unidad Vta.** (mostrando soldUnit)
  - Cantidad como decimales (ej: 0.500)
  - Presentación (ej: "ROLLO 100m")
  - Precio y subtotal correctos
- [ ] Verificar en consola que POST incluye:
  ```json
  {
    "items": [
      { "productId": "...", "presentationId": "...", "soldQty": 0.5 }
    ]
  }
  ```

### 9️⃣ Validaciones
**Test: Cantidad Decimal en Unidad UNIDAD**
- [ ] Agregar "Tuerca"
- [ ] Intentar ingresar 5.5 unidades
- [ ] Debería **RECHAZAR** con error visual/consola
- [ ] Solo permitir enteros

**Test: Cantidad Entero en Unidad METRO**
- [ ] Agregar "Cable" con presentación "METRO"
- [ ] El input debería permitir decimales
- [ ] Ingresar 2.5 metros (válido)

### 🔟 Stock Base
- [ ] Antes de venta, verificar stock inicial (en DB)
- [ ] Hacer venta de Cable 0.5 ROLLO 100m = 50 metros en stock base
- [ ] Verificar en BD que stock decrementó en **50 unidades**:
  ```sql
  SELECT stock FROM products WHERE name LIKE 'Cable%' LIMIT 1;
  ```
- [ ] Verificar en tabla `stock_movements`:
  ```sql
  SELECT * FROM stock_movements ORDER BY "createdAt" DESC LIMIT 1;
  ```

---

## 🔍 Ejemplos de Productos con Presentaciones

### Decimales Permitidos (METRO/LITRO/KILO)
- **Tubo PVC**: METRO / ROLLO 100m
- **Cable**: METRO / ROLLO 100m
- **Clavos**: KILO / CAJA 5kg / CAJA 25kg
- **Pintura**: LITRO / GALON 3.785L

### Enteros Solo (UNIDAD/CAJA/PAQUETE)
- **Foco LED**: UNIDAD / PAQUETE 10u
- **Bisagra**: UNIDAD / CAJA 12u
- **Tornillo**: UNIDAD / CAJA 100u

---

## 📊 Verificación de Datos

### Query para ver Productos con Presentaciones
```sql
SELECT p.name, p.price, p.stock, 
       pp.name as presentation, pp.unit, pp."factorToBase", pp."isDefault"
FROM products p
LEFT JOIN product_presentations pp ON p.id = pp."productId"
ORDER BY p.name, pp."isDefault" DESC
LIMIT 50;
```

### Query para ver Últimas Ventas
```sql
SELECT s.id, s."createdAt", 
       si."soldUnit", si."soldQty", si."baseQty", 
       si."unitPrice", si.subtotal,
       pp.name as presentation
FROM sales s
JOIN sale_items si ON s.id = si."saleId"
LEFT JOIN product_presentations pp ON si."presentationId" = pp.id
ORDER BY s."createdAt" DESC
LIMIT 10;
```

---

## ⚠️ Errores Comunes

### ❌ Error 1: "Column 'quantity' does not exist"
- Significa que la migración no se ejecutó
- **Solución**: `npx prisma migrate dev`

### ❌ Error 2: "soldUnit is required"
- Significa que la migracion se aplico parcialmente
- **Solución**: Verificar en BD que sale_items tiene las columnas nuevas
- Si no: eliminar la BD y rehacer seed

### ❌ Error 3: Input no permite decimales en Cable
- Significa que no se está leyendo factorToBase correctamente
- **Solución**: Ver console del navegador (F12) por errores de JS

### ❌ Error 4: PDF no muestra presentación
- Significa que presentationId es null en SaleItem
- **Solución**: Verificar que en CajaView se envía presentationId en POST

---

## 🎯 Casos de Uso Completos

### Use Case 1: Venta de Cable por Metro
```
1. Buscar "Cable"
2. Presentación: "METRO" (default)
3. Cantidad: 5 metros
4. Click agregar
5. En carrito: "5.000 METRO"
6. Precio = 5 × precio_metro
7. Venta exitosa
```

### Use Case 2: Venta de Cable por Rollo
```
1. Buscar "Cable"
2. Cambiar presentación a "ROLLO 100m"
3. Cantidad: 0.5 rollos
4. Click agregar
5. En carrito: "0.500 ROLLO (ROLLO 100m)"
6. Precio = 0.5 × precio_metro × 100
7. Stock decrementó en 50 metros
8. Venta exitosa
```

### Use Case 3: Venta Mixta
```
1. Agregar Tuerca × 50 unidades
2. Agregar Cable × 2.5 metros (METRO)
3. Agregar Pintura × 1.25 galones (GALON)
4. Carrito muestra:
   - Tuerca: 50 UNIDAD
   - Cable: 2.500 METRO
   - Pintura: 1.250 GALON (GALON 3.785L)
5. Total correcto
6. PDF muestra todo
7. Stock actualizado correctamente (50 tuercas, 2.5 metros, 4.7 litros)
```

---

## 📱 Browsers Testeados

- [x] Chrome/Edge (Windows)
- [ ] Firefox
- [ ] Safari

---

## ✅ SIGN-OFF CHECKLIST

Antes de pasar a producción, verificar:

- [ ] ✅ Migración ejecutada sin errores
- [ ] ✅ Seed data cargado
- [ ] ✅ Servidor iniciado correctamente
- [ ] ✅ Login funciona
- [ ] ✅ Búsqueda de productos funciona
- [ ] ✅ Presentaciones se muestran
- [ ] ✅ Input dinámico (decimales/enteros)
- [ ] ✅ Carrito actualiza precios
- [ ] ✅ Validación de cantidades funciona
- [ ] ✅ Checkout procesa correctamente
- [ ] ✅ PDF genera con presentación
- [ ] ✅ Stock se actualiza en BD
- [ ] ✅ No hay errores en console

---

**Status:** 🟢 LISTO PARA TESTING

**Próximos Pasos:** Ejecutar checklist anterior y reportar resultados
