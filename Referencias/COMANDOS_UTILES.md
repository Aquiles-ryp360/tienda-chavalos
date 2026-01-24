# 📟 COMANDOS ÚTILES - Referencia Rápida

## � DOCKER + POSTGRESQL

```powershell
# Levantar PostgreSQL
cd Despliegue\Hosting\postgres-local
docker compose up -d

# Ver estado
docker compose ps

# Ver logs
docker compose logs -f

# Detener (mantiene datos)
docker compose stop

# Reiniciar
docker compose restart

# Detener y eliminar contenedor (mantiene datos)
docker compose down

# Conectarse a PostgreSQL
docker exec -it ferreteria_db psql -U ferre -d ferreteria

# Backup de base de datos
docker exec ferreteria_db pg_dump -U ferre -d ferreteria > backup_$(Get-Date -Format "yyyyMMdd_HHmmss").sql
```

---

## 🚀 INSTALACIÓN Y SETUP

```powershell
# Setup automático (TODO EN UNO)
cd d:\Aquiles\Tienda_Chavalos_Virtual_web
.\setup-postgres.ps1

# --- O manualmente: ---

# 1. Levantar PostgreSQL
cd Despliegue\Hosting\postgres-local
docker compose up -d

# 2. Navegar al proyecto Next.js
cd ..\..\..\Frontend\NextJS_React\web

# 3. Instalar todas las dependencias
npm install

# 4. Generar cliente de Prisma
npm run prisma:generate

# 5. Crear base de datos (primera vez)
npx prisma migrate dev --name init_pg

# 6. Cargar datos demo
npm run db:seed
```

---

## 🏃 DESARROLLO

```powershell
# Iniciar servidor de desarrollo
npm run dev
# Acceder: http://localhost:3000

# Iniciar en puerto diferente
$env:PORT=3001; npm run dev

# Ver logs en tiempo real
# (Ya se muestran automáticamente con npm run dev)
```

---

## 🗄️ BASE DE DATOS

```powershell
# Ver base de datos en GUI (Prisma Studio)
npm run prisma:studio
# Acceder: http://localhost:5555

# Crear nueva migración
npx prisma migrate dev --name descripcion_del_cambio

# Generar cliente después de cambios en schema
npm run prisma:generate

# Ver estado de migraciones
npx prisma migrate status

# Aplicar migraciones pendientes
npx prisma migrate deploy

# Resetear base de datos (CUIDADO: borra todo)
npx prisma migrate reset

# --- Comandos PostgreSQL directos: ---

# Conectarse a psql
docker exec -it ferreteria_db psql -U ferre -d ferreteria

# Listar tablas (dentro de psql)
\dt

# Ver estructura de tabla (dentro de psql)
\d nombre_tabla

# Ver enums (dentro de psql)
\dT

# Ejecutar query directamente
docker exec -it ferreteria_db psql -U ferre -d ferreteria -c "SELECT * FROM users;"

# Ver tamaño de base de datos
docker exec ferreteria_db psql -U ferre -d ferreteria -c "SELECT pg_size_pretty(pg_database_size('ferreteria'));"
```

# Aplicar migraciones sin crear nuevas
npx prisma migrate deploy

# Recargar datos demo
npm run db:seed
```

---

## 🔍 DIAGNÓSTICO

```powershell
# Verificar versión de Node
node --version
# Debe ser 18+

# Verificar instalación de Prisma
npx prisma --version

# Ver estructura de BD
npx prisma db push --preview-feature

# Validar schema de Prisma
npx prisma validate

# Ver logs de Next.js
# (Ya se muestran en consola durante npm run dev)
```

---

## 🏗️ BUILD Y PRODUCCIÓN

```powershell
# Compilar para producción
npm run build

# Iniciar servidor de producción
npm run start
# Acceder: http://localhost:3000

# Análisis de build
npm run build
# Ver .next/trace para análisis
```

---

## 🧹 LIMPIEZA

```powershell
# Limpiar node_modules y reinstalar
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install

# Limpiar caché de Next.js
Remove-Item -Recurse -Force .next

# Limpiar caché de Prisma
Remove-Item -Recurse -Force node_modules\.prisma
npm run prisma:generate
```

---

## 📦 GESTIÓN DE DEPENDENCIAS

```powershell
# Actualizar todas las dependencias
npm update

# Verificar vulnerabilidades
npm audit

# Corregir vulnerabilidades
npm audit fix

# Ver dependencias instaladas
npm list --depth=0

# Agregar nueva dependencia
npm install nombre-paquete

# Agregar dependencia de desarrollo
npm install -D nombre-paquete
```

---

## 🔐 SEGURIDAD

```powershell
# Generar nuevo JWT_SECRET
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | % {[char]$_})

# Ver variables de entorno
Get-Content .env

# Copiar .env de ejemplo
Copy-Item .env.example .env
```

---

## 🐛 TROUBLESHOOTING

```powershell
# Error: Puerto ocupado
# Solución: Cambiar puerto o matar proceso
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process

# Error: Prisma Client no encontrado
npm run prisma:generate

# Error: Migraciones pendientes
npm run prisma:migrate

# Error: node_modules corrupto
Remove-Item -Recurse -Force node_modules
npm install

# Error: Caché de Next.js corrupta
Remove-Item -Recurse -Force .next
npm run dev
```

---

## 📊 PRISMA STUDIO AVANZADO

```powershell
# Abrir Prisma Studio
npm run prisma:studio

# Operaciones en Studio:
# - Ver todas las tablas
# - Editar registros
# - Agregar registros
# - Eliminar registros
# - Ver relaciones
# - Ejecutar queries
```

---

## 🔄 MIGRACIONES

```powershell
# Crear migración desde cambios en schema
npx prisma migrate dev --name nombre_migracion

# Aplicar migraciones en producción
npx prisma migrate deploy

# Ver historial de migraciones
npx prisma migrate status

# Resolver conflictos de migración
npx prisma migrate resolve --applied "nombre_migracion"
```

---

## 🎨 TAILWIND CSS

```powershell
# Generar clases Tailwind
# (Se genera automáticamente durante dev)

# Ver config de Tailwind
Get-Content tailwind.config.ts

# Purgar CSS no usado (automático en build)
npm run build
```

---

## 📝 TYPESCRIPT

```powershell
# Verificar errores de TypeScript
npx tsc --noEmit

# Ver configuración de TypeScript
Get-Content tsconfig.json
```

---

## 🔗 GIT (Preparación para Deploy)

```powershell
# Inicializar repositorio
git init

# Agregar archivos
git add .

# Commit inicial
git commit -m "Initial commit - Sistema Ferretería Chavalos"

# Agregar remote
git remote add origin https://github.com/tu-usuario/repo.git

# Push a GitHub
git push -u origin main

# Ver status
git status

# Ver cambios
git diff
```

---

## 🌐 DEPLOY A VERCEL

```powershell
# Instalar Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Deploy a producción
vercel --prod

# Ver logs
vercel logs
```

---

## 📦 BACKUP

```powershell
# Backup de base de datos SQLite
$fecha = Get-Date -Format "yyyyMMdd"
Copy-Item "..\..\..\Base_de_datos\Data\dev.db" "backups\dev_$fecha.db"

# Restaurar backup
Copy-Item "backups\dev_20260114.db" "..\..\..\Base_de_datos\Data\dev.db"

# Backup de PostgreSQL (si migraste)
pg_dump -h host -U usuario -d dbname > backup.sql

# Restaurar PostgreSQL
psql -h host -U usuario -d dbname < backup.sql
```

---

## 🧪 TESTING (Futuro)

```powershell
# Instalar Jest (no incluido en MVP)
npm install -D jest @testing-library/react

# Correr tests
npm test

# Tests con cobertura
npm test -- --coverage
```

---

## 📊 MONITOREO

```powershell
# Ver uso de puertos
netstat -ano | findstr :3000

# Ver procesos Node
Get-Process node

# Matar proceso específico
Stop-Process -Id XXXX

# Ver logs de errores
# (Revisar consola de npm run dev)
```

---

## 🎯 COMANDOS ESPECÍFICOS DEL PROYECTO

```powershell
# Crear nuevo usuario (ejemplo)
# Requiere crear endpoint o usar Prisma Studio

# Crear nuevo producto (ejemplo)
# POST /api/products con body JSON

# Ver ventas del día
# GET /api/sales?today=true

# Ver todos los productos
# GET /api/products

# Buscar producto
# GET /api/products?search=martillo
```

---

## ⚙️ VARIABLES DE ENTORNO

```powershell
# Ver variables de entorno actuales
$env:DATABASE_URL
$env:JWT_SECRET
$env:NODE_ENV

# Establecer variable temporal
$env:PORT=3001

# Establecer variable de sesión
$env:NODE_ENV="production"
```

---

## 🎓 RECURSOS ÚTILES

```powershell
# Documentación de Next.js
Start-Process "https://nextjs.org/docs"

# Documentación de Prisma
Start-Process "https://www.prisma.io/docs"

# Documentación de Tailwind
Start-Process "https://tailwindcss.com/docs"

# Documentación de React
Start-Process "https://react.dev"
```

---

## 🆘 COMANDOS DE EMERGENCIA

```powershell
# Reiniciar todo desde cero
Remove-Item -Recurse -Force node_modules, .next, package-lock.json
npm install
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run dev

# Forzar actualización de Prisma
Remove-Item -Recurse -Force node_modules\.prisma
Remove-Item -Recurse -Force node_modules\@prisma
npm run prisma:generate

# Resolver problemas de caché
Remove-Item -Recurse -Force .next, node_modules\.cache
npm run dev
```

---

## ⌨️ SHORTCUTS EN TERMINAL

| Comando | Descripción |
|---------|-------------|
| `Ctrl + C` | Detener servidor |
| `Ctrl + L` | Limpiar terminal |
| `↑ / ↓` | Historial de comandos |
| `Tab` | Autocompletar |

---

## 📱 ACCESOS RÁPIDOS

```
- Aplicación local: http://localhost:3000
- Prisma Studio: http://localhost:5555
- Login: http://localhost:3000/login
- Dashboard: http://localhost:3000/dashboard
```

---

## ✅ CHECKLIST DIARIO

```powershell
# Antes de empezar a trabajar:
cd Frontend/NextJS_React/web
git pull
npm install
npm run dev

# Al terminar el día:
git add .
git commit -m "Descripción de cambios"
git push
```

---

**¡Referencia completa de comandos! 🎉**

Guarda este archivo para consulta rápida durante el desarrollo.
