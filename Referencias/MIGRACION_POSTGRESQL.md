# 🔄 GUÍA DE MIGRACIÓN A POSTGRESQL EN LA NUBE

## 📋 Estado Actual

✅ **Ya estás usando PostgreSQL local con Docker**

Este proyecto actualmente utiliza:
- PostgreSQL 16 corriendo en Docker
- Base de datos: `ferreteria`
- Usuario: `ferre`
- Contenedor: `ferreteria_db`

Esta guía te ayudará a migrar de PostgreSQL local a PostgreSQL en la nube (producción).

---

## 🎯 PASO 1: Preparar PostgreSQL en la Nube

### Opción A: PostgreSQL en Neon (Recomendado)
```
1. Ir a https://neon.tech
2. Crear cuenta gratuita
3. Crear nuevo proyecto
4. Copiar connection string:
   postgresql://usuario:password@host.neon.tech/dbname?sslmode=require
```

### Opción B: PostgreSQL en Supabase
```
1. Ir a https://supabase.com
2. Crear proyecto
3. Settings → Database → Connection String (URI)
4. Copiar connection string
```

### Opción C: PostgreSQL Local
```powershell
# Instalar PostgreSQL (Windows)
choco install postgresql

# Crear base de datos
psql -U postgres
CREATE DATABASE tienda_ferretera;
\q

# Connection string:
postgresql://postgres:tupassword@localhost:5432/tienda_ferretera
```

---

## 🎯 PASO 2: Actualizar .env para Producción

**Ubicación:** `Frontend/NextJS_React/web/.env`

**ANTES (PostgreSQL Local):**
```env
DATABASE_URL="postgresql://ferre:ferre123@localhost:5432/ferreteria?schema=public"
```

**DESPUÉS (PostgreSQL en Nube):**
```env
# PostgreSQL en Neon (ejemplo)
DATABASE_URL="postgresql://usuario:password@host.neon.tech/dbname?sslmode=require"

# O Supabase
# DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"

# Mantener local comentado para desarrollo:
# DATABASE_URL="postgresql://ferre:ferre123@localhost:5432/ferreteria?schema=public"
```

**⚠️ IMPORTANTE:** No subir este archivo a Git si tiene credenciales reales.

---

## 🎯 PASO 3: NO hay cambios en schema.prisma

✅ **El archivo ya está configurado para PostgreSQL:**

```prisma
datasource db {
  provider = "postgresql"  // ✅ Ya está correcto
  url      = env("DATABASE_URL")
}
```

**No necesitas cambiar nada en schema.prisma**

---

## 🎯 PASO 4: Ejecutar Migraciones en Producción

```powershell
# 1. Navegar al proyecto
cd Frontend/NextJS_React/web

# 2. Aplicar migraciones existentes a la nube
npx prisma migrate deploy

# 3. (Opcional) Cargar datos iniciales si es una BD nueva
npm run db:seed
```

**Nota:** `migrate deploy` aplica las migraciones sin preguntar nombres (ideal para producción).
# Nombre sugerido: "migrate_to_postgresql"

# 4. Verificar que se crearon las tablas
npx prisma studio
# Abrir navegador y ver tablas vacías
```

---

## 🎯 PASO 5: Cargar Datos Iniciales

```powershell
# Cargar usuarios y productos demo
npm run db:seed
```

**Resultado:** Base de datos PostgreSQL con datos iniciales idénticos a SQLite.

---

## 🎯 PASO 6: Probar Localmente

```powershell
# Iniciar servidor
npm run dev

# Abrir navegador
# http://localhost:3000

# Probar login
# admin / admin123
```

**Verificar:**
- ✅ Login funciona
- ✅ Dashboard muestra estadísticas
- ✅ Productos se listan correctamente
- ✅ Ventas se pueden crear
- ✅ PDF se genera

---

## 🎯 PASO 7: Deploy a Vercel (Opcional)

### 7.1 Preparar Repositorio Git

```powershell
# En la raíz del proyecto
git init
git add .
git commit -m "Initial commit - Sistema Ferretería Chavalos"

# Subir a GitHub
git remote add origin https://github.com/tu-usuario/ferreteria-chavalos.git
git push -u origin main
```

### 7.2 Configurar Vercel

```
1. Ir a https://vercel.com
2. Import Git Repository
3. Seleccionar tu repo
4. Framework Preset: Next.js
5. Root Directory: Frontend/NextJS_React/web
6. Environment Variables:
   - DATABASE_URL = (tu connection string PostgreSQL)
   - JWT_SECRET = (generar uno nuevo)
   - NODE_ENV = production
7. Deploy
```

### 7.3 Ejecutar Seed en Producción

```powershell
# Opción A: Desde Vercel CLI
vercel env pull
npx prisma migrate deploy
tsx prisma/seed.ts

# Opción B: Script directo en producción
# Crear archivo deploy-commands.sh en Vercel
```

---

## 📊 COMPARACIÓN: SQLITE VS POSTGRESQL

| Característica | SQLite | PostgreSQL |
|----------------|--------|------------|
| **Ubicación** | Archivo local | Servidor remoto |
| **Concurrencia** | Limitada | Excelente |
| **Escalabilidad** | Baja | Alta |
| **Backups** | Copiar archivo | pg_dump |
| **Performance** | Buena (pequeño) | Excelente (grande) |
| **Costo** | Gratis | Gratis tier + pago |
| **Uso recomendado** | Desarrollo | Producción |

---

## 🔧 DIFERENCIAS EN PRISMA

### SQLite
```prisma
model Product {
  id Int @id @default(autoincrement())
  stock Float @default(0)
}
```

### PostgreSQL
```prisma
model Product {
  id Int @id @default(autoincrement())
  stock Decimal @default(0) // Más preciso para dinero
}
```

**Nota:** En tu schema ya usamos `Float` que funciona en ambos. Si quieres mayor precisión en PostgreSQL, cambia a `Decimal`.

---

## 🚨 TROUBLESHOOTING

### Error: "SSL required"
```env
DATABASE_URL="postgresql://...?sslmode=require"
```

### Error: "Connection timeout"
- Verificar que tu IP está en whitelist (Neon/Supabase)
- Verificar firewall local

### Error: "Migration failed"
```powershell
# Resetear migraciones (CUIDADO: borra datos)
npx prisma migrate reset

# O crear nueva migración
npx prisma migrate dev --name fix_migration
```

### Error: "Cannot find @prisma/client"
```powershell
npm run prisma:generate
```

---

## 📦 BACKUP DE DATOS

### SQLite → PostgreSQL (Migración de datos)

Si tienes datos en SQLite que quieres conservar:

```powershell
# 1. Exportar datos de SQLite
npx prisma studio
# Exportar manualmente cada tabla a CSV

# 2. O usar script personalizado (crear archivo migrate-data.ts)
```

**Script de ejemplo:**
```typescript
// migrate-data.ts
import { PrismaClient } from '@prisma/client';

const sqliteClient = new PrismaClient({
  datasources: { db: { url: 'file:../../../Base_de_datos/Data/dev.db' } }
});

const postgresClient = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL } }
});

async function migrate() {
  // Obtener datos de SQLite
  const users = await sqliteClient.user.findMany();
  const products = await sqliteClient.product.findMany();
  
  // Insertar en PostgreSQL
  for (const user of users) {
    await postgresClient.user.create({ data: user });
  }
  
  for (const product of products) {
    await postgresClient.product.create({ data: product });
  }
  
  console.log('Migración completada!');
}

migrate();
```

---

## 🔐 SEGURIDAD EN PRODUCCIÓN

### Variables de Entorno Seguras

```env
# ❌ NO HACER:
DATABASE_URL="postgresql://admin:12345@..."

# ✅ HACER:
DATABASE_URL="postgresql://user:$(generatedSecurePassword)@..."
JWT_SECRET="$(generatedRandomString64chars)"
```

### Generar Secrets Seguros

```powershell
# PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})
```

---

## 📈 MONITOREO POST-MIGRACIÓN

### Verificar Performance

1. **Prisma Studio:**
   ```powershell
   npx prisma studio
   ```
   - Verificar que datos se muestran
   - Crear/editar registros manualmente

2. **Logs de Vercel:**
   - Ver logs de deployment
   - Verificar errores de conexión

3. **Testing de Endpoints:**
   ```bash
   curl https://tu-app.vercel.app/api/products
   ```

---

## ✅ CHECKLIST POST-MIGRACIÓN

- [ ] Schema actualizado a PostgreSQL
- [ ] .env con connection string de PostgreSQL
- [ ] Migraciones ejecutadas exitosamente
- [ ] Seed ejecutado correctamente
- [ ] Login funciona
- [ ] Crear producto funciona
- [ ] Crear venta funciona
- [ ] PDF se genera
- [ ] Historial se muestra
- [ ] No hay errores en consola
- [ ] Performance es aceptable

---

## 🎉 ¡MIGRACIÓN COMPLETADA!

Tu sistema ahora está:
- ✅ Usando PostgreSQL en la nube
- ✅ Escalable para producción
- ✅ Con backups automáticos (según proveedor)
- ✅ Accesible desde cualquier lugar
- ✅ Listo para múltiples usuarios concurrentes

---

## 📞 PROVEEDORES RECOMENDADOS

| Proveedor | Plan Gratuito | Límites |
|-----------|---------------|---------|
| **Neon** | ✅ | 512MB DB, 3 proyectos |
| **Supabase** | ✅ | 500MB DB, 2 org |
| **Railway** | ✅ | $5 crédito/mes |
| **Vercel** | ✅ | Ideal para Next.js |

---

**¡PostgreSQL configurado y funcionando! 🎊**

Ahora tu sistema puede manejar cientos de usuarios concurrentes.
