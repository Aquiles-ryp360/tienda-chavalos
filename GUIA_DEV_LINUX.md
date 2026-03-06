# Guía: Ejecutar el Proyecto en Modo Desarrollo (Linux)

> **Proyecto:** Ferretería Chavalos — Next.js + PostgreSQL + Prisma  
> **Ruta principal:** `Frontend/NextJS_React/web/`  
> **Fecha:** Febrero 2026

---

## Requisitos Previos

| Herramienta | Versión mínima | Verificar con |
|-------------|---------------|---------------|
| Node.js     | 18+           | `node -v`     |
| npm         | 9+            | `npm -v`      |
| Docker      | 24+           | `docker -v`   |
| Docker Compose | v2+       | `docker compose version` |

---

## Paso 0 — Posicionarse en el proyecto

```bash
cd /ruta/a/Tienda_Chavalos_Virtual_web
```

---

## Paso 1 — Levantar la Base de Datos (PostgreSQL con Docker)

### 1.1 Crear el volumen externo (solo la primera vez)

```bash
docker volume create postgres-local_ferreteria_pgdata
```

### 1.2 Levantar el contenedor de PostgreSQL

```bash
docker compose -f Despliegue/Hosting/postgres-local/docker-compose.yml up -d
```

### 1.3 Verificar que está corriendo

```bash
docker compose -f Despliegue/Hosting/postgres-local/docker-compose.yml ps
```

Debe aparecer el contenedor `ferreteria_chavalos_db` con estado `Up (healthy)`.

### 1.4 Verificar conexión

```bash
docker exec -it ferreteria_chavalos_db psql -U ferre -d ferreteria -c "SELECT 1;"
```

> **Credenciales de la BD:**  
> - **Usuario:** `ferre`  
> - **Contraseña:** `ferre123`  
> - **Base de datos:** `ferreteria`  
> - **Puerto:** `5432`

---

## Paso 2 — Entrar al directorio del Frontend

```bash
cd Frontend/NextJS_React/web
```

---

## Paso 3 — Crear archivos de entorno

Si no existen `.env` y `.env.local`, créalos:

```bash
cat > .env << 'EOF'
DATABASE_URL="postgresql://ferre:ferre123@localhost:5432/ferreteria?schema=public"
SESSION_SECRET="kiles-ferreteria-dev-2026-01-15-una-clave-larga-1234567890"
NODE_ENV="development"
NEXT_PUBLIC_APP_NAME="Ferretería Chavalos"
EOF
```

```bash
cat > .env.local << 'EOF'
DATABASE_URL="postgresql://ferre:ferre123@localhost:5432/ferreteria?schema=public"
SESSION_SECRET="cambiar-por-secret-seguro-en-produccion-min-32-caracteres"
NODE_ENV="development"
NEXT_PUBLIC_APP_NAME="Ferretería Chavalos"
EOF
```

---

## Paso 4 — Instalar dependencias

```bash
npm install
```

> **Nota importante:** El `package.json` tiene `@next/swc-win32-x64-msvc` como  
> `optionalDependencies`. En Linux se ignorará automáticamente (es normal ver  
> un warning). npm instalará los binarios SWC correctos para Linux  
> (`@next/swc-linux-x64-gnu` o `@next/swc-linux-x64-musl`) automáticamente.

Si ves errores con `sharp` (procesamiento de imágenes), ejecuta:

```bash
npm rebuild sharp
```

---

## Paso 5 — Sincronizar Schema de Prisma y generar cliente

```bash
npm run prisma:generate
```

Esto ejecuta `scripts/sync-schema.mjs` que copia el schema desde  
`Base_de_datos/Prisma/schema.prisma` → `prisma/schema.prisma`  
y luego genera el cliente de Prisma.

---

## Paso 6 — Ejecutar migraciones de la BD

```bash
npm run db:migrate
```

Si es la **primera vez**, esto creará todas las tablas en PostgreSQL.

> Si tienes problemas con migraciones existentes, puedes forzar un push directo:
> ```bash
> npx prisma db push --schema=prisma/schema.prisma
> ```

---

## Paso 7 — Importar datos de producción desde Windows

Si ya tienes datos reales (productos, ventas, usuarios) en tu Docker de Windows,
usa los scripts de `Base_de_datos/Respaldos/`.

> Guía completa de respaldos: `Base_de_datos/GUIA_RESPALDOS.md`

### 7.1 En Windows — Respaldar

```powershell
cd Base_de_datos\Respaldos
.\respaldar.ps1
```

Genera `ferreteria_dump.sql` y `ferreteria_dump.dump` en esa misma carpeta.

### 7.2 Llevar los archivos a Linux

Copia la carpeta `Base_de_datos/Respaldos/` a la máquina Linux (USB, SCP, red):

```bash
# Ejemplo con USB
cp /media/usb/ferreteria_dump.dump Base_de_datos/Respaldos/

# Ejemplo con SCP
scp usuario@IP_WINDOWS:/ruta/proyecto/Base_de_datos/Respaldos/ferreteria_dump.dump \
    Base_de_datos/Respaldos/
```

### 7.3 En Linux — Restaurar

**Asegúrate de que PostgreSQL esté corriendo** (Paso 1) y las tablas creadas (Paso 6).

```bash
cd Base_de_datos/Respaldos
bash restaurar.sh
```

### 7.4 Regenerar el cliente Prisma

```bash
cd Frontend/NextJS_React/web
npm run prisma:generate
```

---

## Paso 7b — (Alternativa) Poblar datos de prueba (Seed)

Si **no** tienes datos de Windows y quieres empezar con datos de ejemplo:

```bash
npm run db:seed
```

Esto crea:
- **Usuario admin:** `admin` / `admin123`
- **Usuario cajero:** `cajero1` / `cajero123`
- Productos de ejemplo

---

## Paso 8 — Ejecutar en modo desarrollo

```bash
npm run dev
```

La aplicación estará disponible en:  
- **Local:** http://localhost:3000  
- **Red LAN:** http://<TU_IP>:3000 (accesible desde otros dispositivos)

---

## Resumen Rápido (Copiar y Pegar)

Script completo para ejecutar todo de una vez (después de la primera configuración):

```bash
#!/bin/bash
# === Inicio rápido: Ferretería Chavalos (Linux Dev) ===

# 1. Ir al proyecto
cd /ruta/a/Tienda_Chavalos_Virtual_web

# 2. Levantar PostgreSQL
docker volume create postgres-local_ferreteria_pgdata 2>/dev/null
docker compose -f Despliegue/Hosting/postgres-local/docker-compose.yml up -d

# 3. Esperar a que PostgreSQL esté listo
echo "Esperando a PostgreSQL..."
sleep 5
until docker exec ferreteria_chavalos_db pg_isready -U ferre -d ferreteria 2>/dev/null; do
  sleep 2
done
echo "PostgreSQL listo!"

# 4. Ir al frontend
cd Frontend/NextJS_React/web

# 5. Instalar dependencias (si no existen)
[ ! -d "node_modules" ] && npm install

# 6. Generar Prisma y migrar
npm run prisma:generate
npm run db:migrate

# 7. Importar datos de Windows (si tienes el dump)
# Descomenta las siguientes líneas si necesitas importar:
# cd Base_de_datos/Respaldos && bash restaurar.sh && cd ../../Frontend/NextJS_React/web

# 8. Iniciar dev
npm run dev
```

---

## Solución de Problemas Comunes

### Error: `@next/swc-win32-x64-msvc` no encontrado
**Causa:** Se copió `node_modules` desde Windows.  
**Solución:** Borrar y reinstalar:
```bash
rm -rf node_modules .next
npm install
```

### Error: conexión a PostgreSQL rechazada
**Causa:** El contenedor no está corriendo.  
**Solución:**
```bash
docker compose -f Despliegue/Hosting/postgres-local/docker-compose.yml up -d
docker compose -f Despliegue/Hosting/postgres-local/docker-compose.yml logs
```

### Error: volumen externo no existe
**Causa:** El volumen Docker no fue creado.  
**Solución:**
```bash
docker volume create postgres-local_ferreteria_pgdata
```

### Error: `prisma generate` falla con "schema not found"
**Causa:** El script `sync-schema.mjs` usa rutas relativas.  
**Solución:** Asegúrate de ejecutar desde `Frontend/NextJS_React/web/`:
```bash
cd Frontend/NextJS_React/web
npm run prisma:generate
```

### Error: `bcrypt` falla al compilar
**Causa:** Faltan dependencias de compilación nativas.  
**Solución (Debian/Ubuntu):**
```bash
sudo apt install build-essential python3
npm rebuild bcrypt
```
**Solución (Fedora/RHEL):**
```bash
sudo dnf install gcc-c++ make python3
npm rebuild bcrypt
```

### Error: Puerto 3000 ya en uso
**Solución:**
```bash
# Ver qué proceso usa el puerto
lsof -i :3000
# O cambiar el puerto
npx next dev -H 0.0.0.0 -p 3001
```

### Error: Puerto 5432 ya en uso (PostgreSQL local)
**Causa:** Tienes PostgreSQL instalado localmente además de Docker.  
**Solución:**
```bash
# Detener PostgreSQL local
sudo systemctl stop postgresql
# O cambiar el puerto en docker-compose.yml y .env
```

---

## Detener Todo

```bash
# Detener Next.js: Ctrl+C en la terminal donde corre

# Detener PostgreSQL
cd /ruta/a/Tienda_Chavalos_Virtual_web
docker compose -f Despliegue/Hosting/postgres-local/docker-compose.yml down
```

Para eliminar también los datos de la BD:
```bash
docker compose -f Despliegue/Hosting/postgres-local/docker-compose.yml down
docker volume rm postgres-local_ferreteria_pgdata
```

---

## Acceso a Herramientas

| Herramienta    | Comando                               | URL                  |
|----------------|---------------------------------------|----------------------|
| App Dev        | `npm run dev`                         | http://localhost:3000 |
| Prisma Studio  | `npm run prisma:studio`               | http://localhost:5555 |
| PostgreSQL CLI | `docker exec -it ferreteria_chavalos_db psql -U ferre -d ferreteria` | — |
