# 🚀 GUÍA RÁPIDA: EJECUTAR FASE 2 (PRESENTACIONES)

## 📋 REQUISITOS PREVIOS

- PostgreSQL 16 corriendo (Docker o local)
- Node.js 18+
- Proyecto FASE 1 funcional

---

## ⚡ PASOS PARA EJECUTAR

### 1️⃣ Sincronizar Schema (Automático)

```powershell
cd d:\Aquiles\Tienda_Chavalos_Virtual_web\Frontend\NextJS_React\web

# El sync-schema.mjs copia automáticamente desde Base_de_datos/
npm run db:migrate
```

O manualmente:
```powershell
# Copiar schema actualizado
Copy-Item -Path "..\..\..\Base_de_datos\Prisma\schema.prisma" `
          -Destination ".\prisma\schema.prisma" -Force
```

---

### 2️⃣ Ejecutar Migraciones Prisma

```powershell
cd d:\Aquiles\Tienda_Chavalos_Virtual_web\Frontend\NextJS_React\web

# Crear migración con los nuevos cambios
npx prisma migrate dev --name add_presentations

# Esperar a que complete (crea tablas Decimal, ProductPresentation, etc.)
```

**¿Qué hace?**
- ✅ Cambia tipos Int/Float → Decimal
- ✅ Crea tabla `product_presentations`
- ✅ Agrega columnas a `sale_items` (presentationId, soldUnit, soldQty, baseQty)
- ✅ Actualiza relaciones

---

### 3️⃣ Limpiar y Regenerar Seed

```powershell
cd d:\Aquiles\Tienda_Chavalos_Virtual_web\Frontend\NextJS_React\web

# Regenerar Prisma Client con nuevos tipos
npx prisma generate

# Ejecutar seed actualizado
npm run db:seed
```

**Output esperado:**
```
🌱 Iniciando seed...
✅ Base de datos limpia
✅ Usuarios creados: { admin: 'admin', cajero: 'cajero1' }
✅ 25 productos con presentaciones creados
✅ Movimientos de stock iniciales creados
🎉 Seed completado exitosamente!

🛒 Ejemplos de presentaciones múltiples:
   • Tubo PVC (METRO / ROLLO 100m)
   • Cable (METRO / ROLLO 100m)
   • Clavos (KILO / CAJA 5kg / CAJA 25kg)
   • Pintura (LITRO / GALON 3.785L)
   • Foco LED (UNIDAD / PAQUETE 10u)
```

---

### 4️⃣ Iniciar Servidor

```powershell
cd d:\Aquiles\Tienda_Chavalos_Virtual_web\Frontend\NextJS_React\web

npm run dev
```

Abrir en navegador: **http://localhost:3000**

---

## 🧪 TESTING RÁPIDO

### Test 1: Login
```
Usuario: cajero1
Contraseña: cajero123
```

### Test 2: Ir a CAJA y vender Cable con ROLLO

1. **Buscar "Cable"** en panel de productos
2. **Click en Card** → Se agrega al carrito con METRO (default)
3. **Click Dropdown** en el carrito → Cambiar a "ROLLO 100m"
4. **Cambiar cantidad** a 2.5
5. **Ver cálculo:**
   - unitPrice: $1.25 × 100 = $125.00
   - subtotal: 2.5 × $125.00 = $312.50
6. **Finalizar Venta** → PDF muestra "ROLLO 100m"

### Test 3: Verificar Stock

En Prisma Studio:
```powershell
npx prisma studio
```

Ir a tabla `products`, verificar:
- Cable stock anterior: 500
- Cable stock después de venta 2.5 ROLLO (100m factor): 500 - 250 = 250 ✅

---

## 🐛 TROUBLESHOOTING

### Error: "Cannot find module '@web/lib/db'"
**Solución:** Regenerar Prisma Client
```powershell
npx prisma generate
```

### Error: "No presentations found"
**Solución:** Ejecutar seed de nuevo
```powershell
npm run db:seed
```

### Error en migración: "column already exists"
**Solución:** Limpiar y recrear BD
```powershell
npx prisma migrate reset --force
npm run db:seed
```

### Decimal values showing as strings
**Solución:** Asegurar serialización en API
```typescript
// En Backend/API/products.ts
presentations: prod.presentations.map(p => ({
  id: p.id,
  name: p.name,
  unit: p.unit,
  factorToBase: Number(p.factorToBase)  // ← Importante
}))
```

---

## 📊 ESTADO POST-EJECUCIÓN

Una vez completados los pasos:

### Base de datos
- ✅ 25 productos con múltiples presentaciones
- ✅ Tipos Decimal en lugar de Int/Float
- ✅ 1-3 presentaciones por producto según ejemplos del seed

### Frontend
- ✅ CajaView con selector de presentaciones
- ✅ Cantidad decimal/entero según unidad
- ✅ Cálculo automático de unitPrice

### Backend
- ✅ Validación de decimales por unidad
- ✅ Cálculo de baseQty automático
- ✅ Stock validado en unidades base

---

## 📁 ARCHIVOS IMPORTANTES PARA REVISAR

```
Frontend/NextJS_React/web/
├── prisma/schema.prisma              ← Actualizado con Decimal + ProductPresentation
├── scripts/seed.ts                   ← 25 productos + presentaciones
├── app/api/sales/route.ts            ← Acepta nuevo formato
├── app/api/products/route.ts         ← Devuelve presentaciones
├── ui/pages/caja/CajaView.tsx        ← Selector + decimales
├── ui/pages/caja/caja.module.css     ← Estilos nuevos
└── lib/pdf-generator.ts              ← Muestra presentación en boleta

Backend/
├── API/sales.ts                      ← Lógica completa de presentaciones
├── API/products.ts                   ← Retorna presentaciones
└── Validaciones/stock.ts             ← Usa baseQty

Base_de_datos/
└── Prisma/schema.prisma              ← Source of truth actualizado
```

---

## ✅ VALIDACIÓN FINAL

Ejecutar en Prisma Studio para verificar integridad:

```sql
-- Debería mostrar 25 productos
SELECT COUNT(*) FROM products;

-- Debería mostrar 50+ presentaciones (algunas tienen 3)
SELECT COUNT(*) FROM product_presentations;

-- Ejemplo de presentaciones para Cable
SELECT name, unit, "factorToBase" 
FROM product_presentations 
WHERE "productId" = (SELECT id FROM products WHERE sku = 'CAB-001');

-- Resultado esperado:
-- METRO    | METRO  | 1
-- ROLLO 100m | METRO | 100
```

---

## 🎯 CASOS DE USO VALIDADOS

### ✅ Vender cable por METRO (decimales)
- Usuario: Busca "Cable", agrega 5.5 metros
- Sistema: Calcula 5.5 × $1.25 = $6.875
- Stock: Disminuye 5.5 metros de los 500

### ✅ Vender cable por ROLLO (decimales)
- Usuario: Cambia a "ROLLO 100m", ingresa 2.5
- Sistema: Calcula 2.5 × $125 = $312.50
- Stock: Disminuye 250 metros (2.5 × 100) de los 500

### ✅ Vender clavos por KILO (decimales)
- Usuario: Agrega 2.3 kilos
- Sistema: Calcula 2.3 × $2.30 = $5.29
- Stock: Disminuye 2.3 kilos

### ✅ Vender clavos por CAJA (entero)
- Usuario: Cambia a "CAJA 5kg", ingresa 3
- Sistema: Solo acepta enteros, rechaza 3.5
- Stock: Disminuye 15 kilos (3 × 5)

### ✅ Vender foco (unidad)
- Usuario: Caja tiene "PAQUETE 10u", vende 2.5 paquetes
- Sistema: Rechaza 2.5 (UNIDAD solo acepta enteros)
- Usuario cambia a 2 paquetes: OK

---

## 📞 SOPORTE

Si hay errores:
1. Revisar logs en terminal (`npm run dev`)
2. Abrir Prisma Studio: `npx prisma studio`
3. Verificar que `DATABASE_URL` apunta a PostgreSQL correcto
4. Revisar archivo `FASE_2_PRESENTACIONES.md` para detalles técnicos

---

**¡LISTO PARA EJECUTAR!** 🚀
