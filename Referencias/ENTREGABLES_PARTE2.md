# 📋 ENTREGABLES PARTE 2 - Código Backend y Endpoints

## 6️⃣ CÓDIGO BACKEND (Continuación)

### C) Backend/API/sales.ts

**Ubicación:** `Backend/API/sales.ts`

```typescript
// Backend/API/sales.ts
// Servicios para gestión de ventas y caja

import { PrismaClient, PaymentMethod } from '@prisma/client';
import { validateProductForSale } from '../Validaciones/stock';

const prisma = new PrismaClient();

export interface SaleItemInput {
  productId: number;
  qty: number;
  unitPrice: number;
}

export interface CreateSaleRequest {
  userId: number;
  items: SaleItemInput[];
  paymentMethod: PaymentMethod;
  notes?: string;
}

/**
 * Genera el número de venta único (formato: V-YYYYMMDD-NNNN)
 */
async function generateSaleNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  
  // Contar ventas del día
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  
  const salesCount = await prisma.sale.count({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });
  
  const nextNumber = (salesCount + 1).toString().padStart(4, '0');
  return `V-${dateStr}-${nextNumber}`;
}

/**
 * Crea una nueva venta con validaciones completas
 */
export async function createSale(data: CreateSaleRequest) {
  try {
    const { userId, items, paymentMethod, notes } = data;

    // Validar que hay items
    if (!items || items.length === 0) {
      return { success: false, error: 'La venta debe tener al menos un producto' };
    }

    // Obtener productos y validar stock
    const productIds = items.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    // Validar cada item
    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        return { success: false, error: `Producto ${item.productId} no encontrado` };
      }

      const validation = validateProductForSale(
        item.qty,
        product.stock,
        product.unit,
        product.name
      );

      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
    }

    // Calcular total
    const total = items.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);

    // Generar número de venta
    const saleNumber = await generateSaleNumber();

    // Crear venta con transacción atómica
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Crear venta
      const newSale = await tx.sale.create({
        data: {
          saleNumber,
          userId,
          total,
          paymentMethod,
          notes: notes || null,
        },
      });

      // 2. Crear items de venta
      for (const item of items) {
        await tx.saleItem.create({
          data: {
            saleId: newSale.id,
            productId: item.productId,
            qty: item.qty,
            unitPrice: item.unitPrice,
            subtotal: item.qty * item.unitPrice,
          },
        });

        // 3. Registrar movimiento de stock (salida)
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'OUT',
            qty: item.qty,
            reason: `Venta ${saleNumber}`,
            refSaleId: newSale.id,
          },
        });

        // 4. Actualizar stock del producto
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.qty,
            },
          },
        });
      }

      return newSale;
    });

    // Obtener venta completa con relaciones
    const completeSale = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: {
        user: {
          select: {
            username: true,
            role: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return { success: true, sale: completeSale };
  } catch (error) {
    console.error('Error en createSale:', error);
    return { success: false, error: 'Error al crear venta' };
  }
}

/**
 * Obtiene ventas del día actual
 */
export async function getTodaySales() {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        user: { select: { username: true } },
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalAmount = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalSales = sales.length;

    return { 
      success: true, 
      sales,
      summary: {
        totalSales,
        totalAmount,
      }
    };
  } catch (error) {
    console.error('Error en getTodaySales:', error);
    return { 
      success: false, 
      error: 'Error al obtener ventas del día',
      sales: [],
      summary: { totalSales: 0, totalAmount: 0 }
    };
  }
}
```

**Funciones críticas:**
- `createSale()` - Proceso completo con transacción atómica (Sale + SaleItems + StockMovements + actualizar stock)
- `generateSaleNumber()` - Genera código único por día (V-20260114-0001)
- `getTodaySales()` - Reporte del día con resumen

---

### D) Backend/Autenticacion/auth.ts

**Ubicación:** `Backend/Autenticacion/auth.ts`

```typescript
// Backend/Autenticacion/auth.ts
// Servicios de autenticación y manejo de sesiones

import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: {
    id: number;
    username: string;
    role: UserRole;
  };
  error?: string;
}

/**
 * Autentica un usuario con credenciales
 */
export async function loginUser(credentials: LoginRequest): Promise<LoginResponse> {
  try {
    const { username, password } = credentials;

    // Buscar usuario por username
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return { success: false, error: 'Usuario o contraseña incorrectos' };
    }

    if (!user.active) {
      return { success: false, error: 'Usuario inactivo' };
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return { success: false, error: 'Usuario o contraseña incorrectos' };
    }

    // Login exitoso
    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  } catch (error) {
    console.error('Error en loginUser:', error);
    return { success: false, error: 'Error interno del servidor' };
  }
}

/**
 * Crea un nuevo usuario (solo ADMIN puede ejecutar)
 */
export async function createUser(userData: CreateUserRequest): Promise<LoginResponse> {
  try {
    const { username, password, role } = userData;

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return { success: false, error: 'El usuario ya existe' };
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario
    const newUser = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role,
      },
    });

    return {
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
      },
    };
  } catch (error) {
    console.error('Error en createUser:', error);
    return { success: false, error: 'Error al crear usuario' };
  }
}

/**
 * Verifica si un usuario tiene un rol específico
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  if (userRole === 'ADMIN') return true; // Admin tiene acceso a todo
  return userRole === requiredRole;
}
```

**Características de seguridad:**
- Passwords hasheados con bcrypt (10 rounds)
- Validación de usuario activo
- Verificación de roles
- ADMIN tiene acceso completo

---

## 7️⃣ ENDPOINTS API DE NEXT.JS

### A) POST /api/auth/login

**Ubicación:** `Frontend/NextJS_React/web/app/api/auth/login/route.ts`

```typescript
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@backend/Autenticacion/auth';
import { setUserSession } from '@/lib/auth-session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuario y contraseña son requeridos' },
        { status: 400 }
      );
    }

    const result = await loginUser({ username, password });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    // Guardar sesión en cookie
    await setUserSession(result.user!);

    return NextResponse.json({ success: true, user: result.user });
  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
```

---

### B) GET/POST /api/products

**Ubicación:** `Frontend/NextJS_React/web/app/api/products/route.ts`

```typescript
// app/api/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllProducts, searchProductsByName, createProduct } from '@backend/API/products';
import { getUserSession } from '@/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const onlyActive = searchParams.get('onlyActive') !== 'false';

    let result;
    if (search) {
      result = await searchProductsByName(search);
    } else {
      result = await getAllProducts(onlyActive);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error en GET /api/products:', error);
    return NextResponse.json(
      { error: 'Error al obtener productos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const body = await request.json();
    const result = await createProduct(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/products:', error);
    return NextResponse.json(
      { error: 'Error al crear producto' },
      { status: 500 }
    );
  }
}
```

**Características:**
- Endpoint delgado (llama a Backend/API/products.ts)
- Validación de autenticación
- Control de permisos por rol (POST solo ADMIN)

---

### C) GET/POST /api/sales

**Ubicación:** `Frontend/NextJS_React/web/app/api/sales/route.ts`

```typescript
// app/api/sales/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSale, getAllSales, getTodaySales } from '@backend/API/sales';
import { getUserSession } from '@/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const today = searchParams.get('today') === 'true';

    let result;
    if (today) {
      result = await getTodaySales();
    } else {
      result = await getAllSales();
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error en GET /api/sales:', error);
    return NextResponse.json(
      { error: 'Error al obtener ventas' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const result = await createSale({
      userId: session.id,
      items: body.items,
      paymentMethod: body.paymentMethod,
      notes: body.notes,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/sales:', error);
    return NextResponse.json(
      { error: 'Error al crear venta' },
      { status: 500 }
    );
  }
}
```

**Flujo de venta:**
1. Frontend envía items + paymentMethod
2. Endpoint obtiene userId de la sesión
3. Llama a `createSale()` en Backend
4. Backend valida, crea venta, descuenta stock
5. Retorna venta completa al frontend
6. Frontend genera PDF

---

## 8️⃣ GENERACIÓN DE PDF

**Ubicación:** `Frontend/NextJS_React/web/lib/pdf-generator.ts`

```typescript
// lib/pdf-generator.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateSaleReceipt(saleData: SaleData): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');

  // Título
  doc.setFontSize(18);
  doc.text('FERRETERÍA CHAVALOS', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text('Boleta de Venta', 105, 28, { align: 'center' });

  // Información de la venta
  doc.setFontSize(10);
  doc.text(`No. Venta: ${saleData.saleNumber}`, 20, 40);
  doc.text(`Fecha: ${new Date(saleData.createdAt).toLocaleString('es-NI')}`, 20, 46);
  doc.text(`Cajero: ${saleData.cashier}`, 20, 52);

  // Tabla de productos
  const tableData = saleData.items.map(item => [
    item.product.sku,
    item.product.name,
    item.qty.toFixed(2),
    `C$ ${item.unitPrice.toFixed(2)}`,
    `C$ ${item.subtotal.toFixed(2)}`,
  ]);

  autoTable(doc, {
    head: [['SKU', 'Producto', 'Cantidad', 'Precio Unit.', 'Subtotal']],
    body: tableData,
    startY: 65,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185] },
  });

  // Total
  const finalY = (doc as any).lastAutoTable.finalY || 65;
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(`TOTAL: C$ ${saleData.total.toFixed(2)}`, 190, finalY + 10, { align: 'right' });

  return doc;
}

export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}
```

**Librería usada:** jsPDF + jspdf-autotable
**Formato:** A4 vertical
**Contenido:** Encabezado, detalle de productos (tabla), total

---

## 🎯 RESUMEN DE ARQUITECTURA

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │  UI (React + Tailwind)                          │   │
│  │  /login, /dashboard, /productos, /caja, /ventas │   │
│  └──────────────────┬──────────────────────────────┘   │
│                     │ Fetch API                         │
│  ┌──────────────────▼──────────────────────────────┐   │
│  │  API Routes (app/api/*)                         │   │
│  │  Delgados - solo autenticación y llamadas      │   │
│  └──────────────────┬──────────────────────────────┘   │
└────────────────────┼───────────────────────────────────┘
                     │ Import @backend
┌────────────────────▼───────────────────────────────────┐
│                BACKEND (Lógica de Negocio)            │
│  ┌───────────────────────────────────────────────┐   │
│  │  API/                                          │   │
│  │  - products.ts (CRUD)                         │   │
│  │  - sales.ts (Ventas + Stock)                  │   │
│  └───────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────┐   │
│  │  Validaciones/                                 │   │
│  │  - stock.ts (Reglas de negocio)              │   │
│  └───────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────┐   │
│  │  Autenticacion/                                │   │
│  │  - auth.ts (Login + Roles)                    │   │
│  └──────────────────┬────────────────────────────┘   │
└────────────────────┼───────────────────────────────────┘
                     │ Prisma Client
┌────────────────────▼───────────────────────────────────┐
│            BASE DE DATOS (SQLite/PostgreSQL)          │
│  User | Product | Sale | SaleItem | StockMovement     │
└───────────────────────────────────────────────────────┘
```

---

## ✅ CHECKLIST COMPLETO

- [x] Estructura de carpetas según especificación
- [x] Schema Prisma con 5 modelos
- [x] Backend modular (API + Validaciones + Auth)
- [x] Endpoints API delgados que llaman a Backend
- [x] UI funcional con 5 páginas
- [x] Sistema de login con roles
- [x] CRUD de productos con validaciones
- [x] Punto de venta con carrito
- [x] Validación de stock antes de vender
- [x] Transacciones atómicas (venta + stock + items)
- [x] Generación de PDF con jsPDF
- [x] Historial y detalle de ventas
- [x] Reporte simple del día
- [x] Preparado para migrar a PostgreSQL
- [x] Documentación completa
- [x] Scripts de seed con datos demo

---

**¡Sistema completo y listo para usar! 🎉**

Ver `INICIO_RAPIDO.md` para instrucciones de ejecución.
