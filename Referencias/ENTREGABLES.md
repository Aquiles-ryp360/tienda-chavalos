# 📋 RESUMEN COMPLETO DE ENTREGABLES

## 1️⃣ MAPA DE CARPETAS Y ARCHIVOS

Ver archivo: `ESTRUCTURA_PROYECTO.md` para el árbol visual completo.

**Resumen:**
- ✅ 40+ archivos creados
- ✅ 11 carpetas principales
- ✅ Frontend completo (Next.js + React + TypeScript + Tailwind)
- ✅ Backend modular (API + Validaciones + Autenticación)
- ✅ Base de datos (Prisma + SQLite)
- ✅ UI funcional (5 páginas)
- ✅ API REST (7 endpoints)

---

## 2️⃣ next.config.js

**Ubicación:** `Frontend/NextJS_React/web/next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  webpack: (config, { isServer }) => {
    // Permitir imports desde carpetas Backend/ fuera del directorio del proyecto Next
    config.resolve.alias['@backend'] = path.resolve(__dirname, '../../../Backend');
    config.resolve.alias['@database'] = path.resolve(__dirname, '../../../Base_de_datos');
    
    return config;
  },
  experimental: {
    // Permitir acceso a archivos fuera del directorio Next
    externalDir: true,
  },
};

module.exports = nextConfig;
```

**Propósito:** Permite importar módulos de Backend/ desde el código de Next.js usando aliases.

---

## 3️⃣ package.json (Sección Prisma)

**Ubicación:** `Frontend/NextJS_React/web/package.json`

```json
{
  "name": "tienda-ferretera",
  "version": "0.1.0",
  "private": true,
  "prisma": {
    "schema": "../../../Base_de_datos/Prisma/schema.prisma"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.20.0",
    "bcryptjs": "^2.4.3",
    "jspdf": "^2.5.2",
    "jspdf-autotable": "^3.8.3",
    "next": "14.2.0",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "prisma": "^5.20.0",
    "tailwindcss": "^3.4.1",
    "tsx": "^4.19.2",
    "typescript": "^5"
  }
}
```

**Clave importante:** La propiedad `"prisma.schema"` apunta al schema fuera del proyecto Next.js.

---

## 4️⃣ .env (Variables de Entorno)

**Ubicación:** `Frontend/NextJS_React/web/.env`

```env
# Base de datos SQLite local
DATABASE_URL="file:../../../Base_de_datos/Data/dev.db"

# Para PostgreSQL en producción (comentado por ahora):
# DATABASE_URL="postgresql://usuario:password@localhost:5432/tienda_ferretera?schema=public"

# Secret para JWT (cambiar en producción)
JWT_SECRET="tu-secreto-super-seguro-cambiar-en-produccion"

# Entorno
NODE_ENV="development"
```

**Nota:** El archivo `.env.example` contiene la misma estructura sin valores sensibles.

---

## 5️⃣ schema.prisma COMPLETO

**Ubicación:** `Base_de_datos/Prisma/schema.prisma`

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
  output   = "../../Frontend/NextJS_React/web/node_modules/.prisma/client"
}

datasource db {
  provider = "sqlite"  // Cambiar a "postgresql" para producción
  url      = env("DATABASE_URL")
}

// Enumeraciones
enum UserRole {
  ADMIN
  CAJERO
}

enum ProductUnit {
  UNIDAD
  CAJA
  BOLSA
  PAQUETE
  METRO
  KG
}

enum StockMovementType {
  IN      // Entrada (compra, ajuste positivo)
  OUT     // Salida (venta)
  ADJUST  // Ajuste manual
}

enum PaymentMethod {
  EFECTIVO
  TARJETA
  TRANSFERENCIA
  MIXTO
}

// Modelo de Usuario
model User {
  id           Int      @id @default(autoincrement())
  username     String   @unique
  passwordHash String
  role         UserRole @default(CAJERO)
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relaciones
  sales        Sale[]

  @@map("users")
}

// Modelo de Producto
model Product {
  id        Int         @id @default(autoincrement())
  sku       String      @unique
  name      String
  unit      ProductUnit @default(UNIDAD)
  price     Float       // Precio de venta
  cost      Float       // Costo de compra
  stock     Float       @default(0) // Stock actual (decimal para METRO/KG)
  minStock  Float       @default(0) // Stock mínimo (alerta)
  active    Boolean     @default(true)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  // Relaciones
  saleItems       SaleItem[]
  stockMovements  StockMovement[]

  @@map("products")
}

// Modelo de Venta
model Sale {
  id            Int           @id @default(autoincrement())
  saleNumber    String        @unique // Ej: "V-20260114-0001"
  total         Float
  paymentMethod PaymentMethod @default(EFECTIVO)
  notes         String?
  createdAt     DateTime      @default(now())
  
  // Relaciones
  userId        Int
  user          User          @relation(fields: [userId], references: [id])
  
  items         SaleItem[]
  stockMovements StockMovement[]

  @@map("sales")
}

// Modelo de Ítem de Venta (detalle)
model SaleItem {
  id        Int      @id @default(autoincrement())
  qty       Float    // Cantidad vendida (decimal para METRO/KG)
  unitPrice Float    // Precio unitario al momento de la venta
  subtotal  Float    // qty * unitPrice
  
  // Relaciones
  saleId    Int
  sale      Sale     @relation(fields: [saleId], references: [id])
  
  productId Int
  product   Product  @relation(fields: [productId], references: [id])

  @@map("sale_items")
}

// Modelo de Movimiento de Stock (auditoría)
model StockMovement {
  id        Int               @id @default(autoincrement())
  type      StockMovementType
  qty       Float             // Cantidad (positiva o negativa según type)
  reason    String            // Motivo del movimiento
  createdAt DateTime          @default(now())
  
  // Relaciones
  productId Int
  product   Product           @relation(fields: [productId], references: [id])
  
  refSaleId Int?              // Referencia a venta (si aplica)
  refSale   Sale?             @relation(fields: [refSaleId], references: [id])

  @@map("stock_movements")
}
```

**Modelos creados:**
1. User (usuarios con roles)
2. Product (inventario con unidades flexibles)
3. Sale (ventas con número único)
4. SaleItem (detalle de productos vendidos)
5. StockMovement (auditoría completa de inventario)

---

## 6️⃣ CÓDIGO ESQUELETO BACKEND

### A) Backend/Validaciones/stock.ts

**Ubicación:** `Backend/Validaciones/stock.ts`

```typescript
// Backend/Validaciones/stock.ts
// Validaciones de stock y cantidades para productos

import { ProductUnit } from '@prisma/client';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida que la cantidad sea mayor a 0
 */
export function validateQuantityPositive(qty: number): ValidationResult {
  if (qty <= 0) {
    return { valid: false, error: 'La cantidad debe ser mayor a 0' };
  }
  return { valid: true };
}

/**
 * Valida que para unidades discretas, la cantidad sea entera
 */
export function validateQuantityByUnit(qty: number, unit: ProductUnit): ValidationResult {
  const discreteUnits: ProductUnit[] = ['UNIDAD', 'CAJA', 'BOLSA', 'PAQUETE'];
  
  if (discreteUnits.includes(unit)) {
    if (!Number.isInteger(qty)) {
      return { 
        valid: false, 
        error: `Para ${unit}, la cantidad debe ser un número entero` 
      };
    }
  }
  
  return { valid: true };
}

/**
 * Valida que haya stock suficiente para la venta
 */
export function validateStockAvailable(
  requestedQty: number, 
  currentStock: number,
  productName: string
): ValidationResult {
  if (currentStock < requestedQty) {
    return { 
      valid: false, 
      error: `Stock insuficiente para ${productName}. Disponible: ${currentStock}, Solicitado: ${requestedQty}` 
    };
  }
  return { valid: true };
}

/**
 * Valida múltiples condiciones de stock para un producto
 */
export function validateProductForSale(
  qty: number,
  currentStock: number,
  unit: ProductUnit,
  productName: string
): ValidationResult {
  // 1. Validar cantidad positiva
  const positiveCheck = validateQuantityPositive(qty);
  if (!positiveCheck.valid) return positiveCheck;
  
  // 2. Validar unidad correcta
  const unitCheck = validateQuantityByUnit(qty, unit);
  if (!unitCheck.valid) return unitCheck;
  
  // 3. Validar stock disponible
  const stockCheck = validateStockAvailable(qty, currentStock, productName);
  if (!stockCheck.valid) return stockCheck;
  
  return { valid: true };
}

/**
 * Calcula el nuevo stock después de una operación
 */
export function calculateNewStock(
  currentStock: number,
  qty: number,
  operation: 'ADD' | 'SUBTRACT'
): number {
  if (operation === 'ADD') {
    return currentStock + qty;
  } else {
    return currentStock - qty;
  }
}

/**
 * Verifica si un producto está por debajo del stock mínimo
 */
export function isLowStock(currentStock: number, minStock: number): boolean {
  return currentStock <= minStock;
}
```

**Funciones clave:**
- `validateProductForSale()` - Validación completa antes de vender
- `validateQuantityByUnit()` - Valida que UNIDAD/CAJA/etc sean enteros
- `validateStockAvailable()` - Verifica stock suficiente

---

### B) Backend/API/products.ts

**Ubicación:** `Backend/API/products.ts`

```typescript
// Backend/API/products.ts
// Servicios para gestión de productos

import { PrismaClient, ProductUnit } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateProductRequest {
  sku: string;
  name: string;
  unit: ProductUnit;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
}

/**
 * Obtiene todos los productos (con filtro opcional)
 */
export async function getAllProducts(onlyActive: boolean = true) {
  try {
    const products = await prisma.product.findMany({
      where: onlyActive ? { active: true } : undefined,
      orderBy: { name: 'asc' },
    });

    return { success: true, products };
  } catch (error) {
    console.error('Error en getAllProducts:', error);
    return { success: false, error: 'Error al obtener productos', products: [] };
  }
}

/**
 * Busca productos por nombre (búsqueda parcial)
 */
export async function searchProductsByName(searchTerm: string) {
  try {
    const products = await prisma.product.findMany({
      where: {
        AND: [
          { active: true },
          {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { sku: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
        ],
      },
      orderBy: { name: 'asc' },
      take: 20, // Limitar resultados
    });

    return { success: true, products };
  } catch (error) {
    console.error('Error en searchProductsByName:', error);
    return { success: false, error: 'Error al buscar productos', products: [] };
  }
}

/**
 * Crea un nuevo producto
 */
export async function createProduct(data: CreateProductRequest) {
  try {
    // Verificar si el SKU ya existe
    const existing = await prisma.product.findUnique({
      where: { sku: data.sku },
    });

    if (existing) {
      return { success: false, error: 'El SKU ya existe' };
    }

    const product = await prisma.product.create({
      data: {
        sku: data.sku,
        name: data.name,
        unit: data.unit,
        price: data.price,
        cost: data.cost,
        stock: data.stock,
        minStock: data.minStock,
      },
    });

    // Registrar movimiento inicial de stock si hay stock > 0
    if (data.stock > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: 'IN',
          qty: data.stock,
          reason: 'Stock inicial al crear producto',
        },
      });
    }

    return { success: true, product };
  } catch (error) {
    console.error('Error en createProduct:', error);
    return { success: false, error: 'Error al crear producto' };
  }
}

// ... más funciones (updateProduct, deactivateProduct, etc.)
```

**Funciones principales:**
- `getAllProducts()` - Lista productos
- `searchProductsByName()` - Búsqueda por nombre/SKU
- `createProduct()` - Crea producto + movimiento de stock inicial

---

(Continúa en siguiente mensaje debido a límite de caracteres)
