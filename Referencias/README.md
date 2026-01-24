# Sistema de Ferretería Chavalos

Sistema web completo para gestión de tienda ferretera con inventario, ventas y reportes.

## 🏗️ Arquitectura del Proyecto

```
Tienda_Chavalos_Virtual_web/
├── Frontend/
│   ├── HTML_CSS_basico/          # (Reservado para prototipos HTML/CSS)
│   ├── JavaScript/               # (Reservado para scripts JS standalone)
│   └── NextJS_React/web/         # 🚀 Aplicación Next.js principal
│       ├── app/                  # App Router de Next.js
│       │   ├── api/              # API Routes (endpoints)
│       │   ├── login/            # Página de login
│       │   ├── dashboard/        # Panel de control
│       │   ├── productos/        # Gestión de productos
│       │   ├── caja/             # Punto de venta
│       │   └── ventas/           # Historial de ventas
│       ├── lib/                  # Utilidades (Prisma, Auth, PDF)
│       ├── next.config.js
│       ├── package.json
│       ├── tailwind.config.ts
│       └── tsconfig.json
│
├── Backend/
│   ├── API/                      # Servicios de negocio
│   │   ├── products.ts           # CRUD de productos
│   │   └── sales.ts              # Gestión de ventas
│   ├── Autenticacion/            # Sistema de autenticación
│   │   └── auth.ts               # Login, sesiones, roles
│   └── Validaciones/             # Reglas de negocio
│       └── stock.ts              # Validaciones de stock
│
├── Base_de_datos/
│   ├── Prisma/                   # Schema y migraciones
│   │   └── schema.prisma         # ⚙️ Definición de modelos (PostgreSQL)
│   ├── Data/                     # (Depreciado - ahora usa PostgreSQL)
│   └── Tablas/                   # Documentación de tablas
│
└── Despliegue/
    ├── Hosting/
    │   └── postgres-local/       # 🐳 Docker Compose para PostgreSQL
    └── Backups_automaticos/      # Scripts de respaldo
```

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js 18+ instalado
- npm o pnpm
- Docker Desktop instalado y corriendo

### Pasos de instalación

**Opción A: Setup automático (recomendado)**

1. **Ejecutar script de setup:**
   ```bash
   .\setup-postgres.ps1
   ```

**Opción B: Setup manual**

1. **Levantar PostgreSQL con Docker:**
   ```bash
   cd Despliegue/Hosting/postgres-local
   docker compose up -d
   ```

2. **Navegar al proyecto Next.js:**
   ```bash
   cd ../../../Frontend/NextJS_React/web
   ```

3. **Instalar dependencias:**
   ```bash
   npm install
   ```

4. **Generar cliente de Prisma:**
   ```bash
   npm run prisma:generate
   ```

5. **Ejecutar migraciones (crear base de datos):**
   ```bash
   npx prisma migrate dev --name init_pg
   ```

6. **Poblar datos iniciales (seed):**
   ```bash
   npm run db:seed
   ```
   - Esto creará usuarios y productos de ejemplo

7. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

8. **Abrir en el navegador:**
   - Ir a: http://localhost:3000
   - Login con: `admin` / `admin123` o `cajero` / `cajero123`

## 📦 Tecnologías Utilizadas

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript
- **Estilos:** Tailwind CSS
- **Base de datos:** PostgreSQL (local con Docker)
- **ORM:** Prisma
- **Autenticación:** Bcrypt + Cookies
- **PDF:** jsPDF + jspdf-autotable
- **Containerización:** Docker Compose

## 🔐 Usuarios Demo

| Usuario | Contraseña | Rol    |
|---------|------------|--------|
| admin   | admin123   | ADMIN  |
| cajero  | cajero123  | CAJERO |

## 🎯 Funcionalidades MVP

### ✅ Implementado
- [x] Login con roles (ADMIN, CAJERO)
- [x] Gestión de productos (CRUD)
- [x] Búsqueda de productos por SKU/nombre
- [x] Punto de venta (caja)
- [x] Carrito de compras con validación de stock
- [x] Registro de ventas con movimiento de stock
- [x] Generación de boleta en PDF
- [x] Historial de ventas
- [x] Detalle de ventas
- [x] Reporte simple del día

### 📊 Modelos de Base de Datos

1. **User** - Usuarios del sistema
2. **Product** - Catálogo de productos
3. **Sale** - Ventas realizadas
4. **SaleItem** - Detalle de productos por venta
5. **StockMovement** - Auditoría de inventario

## � PostgreSQL con Docker

### Gestión del contenedor

```bash
# Levantar PostgreSQL
cd Despliegue/Hosting/postgres-local
docker compose up -d

# Ver estado
docker compose ps

# Ver logs
docker compose logs -f

# Detener
docker compose stop

# Conectarse a la base de datos
docker exec -it ferreteria_db psql -U ferre -d ferreteria

# Backup
docker exec ferreteria_db pg_dump -U ferre -d ferreteria > backup.sql
```

Ver documentación completa en: [Despliegue/Hosting/postgres-local/README.md](Despliegue/Hosting/postgres-local/README.md)

## 🔄 Migración a PostgreSQL en la Nube

Para migrar a PostgreSQL en servicios como Neon, Supabase o Railway:

1. **Obtener connection string del proveedor cloud**

2. **Actualizar `.env`:**
   ```
   DATABASE_URL="postgresql://usuario:password@host:5432/dbname?schema=public"
   ```

3. **Ejecutar migraciones:**
   ```bash
   npm run prisma:migrate
   npm run db:seed
   ```

## 🛠️ Scripts Disponibles

```bash
npm run dev            # Iniciar servidor de desarrollo
npm run build          # Compilar para producción
npm run start          # Iniciar servidor de producción
npm run lint           # Ejecutar linter
npm run prisma:generate   # Generar cliente de Prisma
npm run prisma:migrate    # Ejecutar migraciones
npm run prisma:studio     # Abrir Prisma Studio (GUI)
npm run db:seed           # Poblar datos iniciales
```

## 📝 Estructura de Archivos Clave

- `Base_de_datos/Prisma/schema.prisma` - Definición de modelos
- `Backend/API/` - Lógica de negocio
- `Backend/Validaciones/` - Reglas de validación
- `Backend/Autenticacion/` - Sistema de login
- `app/api/` - Endpoints de Next.js (delgados, llaman a Backend/)
- `lib/` - Utilidades (Prisma client, Auth session, PDF)

## 🎨 Diseño y UX

- Sistema de diseño con Tailwind CSS
- Responsive (mobile-first)
- Interfaz simple y funcional
- Alertas de stock bajo (productos en rojo)

## 🔒 Seguridad

- Contraseñas hasheadas con bcrypt
- Sesiones en cookies httpOnly
- Validación de roles en endpoints
- Validación de stock antes de vender

## 📧 Contacto y Soporte

Sistema desarrollado para Ferretería Chavalos.

---

**Versión:** 1.0.0 (MVP)  
**Fecha:** Enero 2026
