# 🚀 Guía de Despliegue — Chavalos Server

> Cómo hacer que tus cambios se reflejen en la app de escritorio.
> Todos los comandos se ejecutan desde la raíz del proyecto en PowerShell.

---

## 📌 Tabla de contenido

1. [Entender la arquitectura](#1-entender-la-arquitectura)
2. [Tipos de cambios y qué hacer](#2-tipos-de-cambios-y-qué-hacer)
3. [Modo desarrollo (vista previa rápida)](#3-modo-desarrollo-vista-previa-rápida)
4. [Parche rápido con patch-backend.ps1](#4-parche-rápido-con-patch-backendps1)
5. [Build completo con prepare-installer.ps1](#5-build-completo-con-prepare-installerps1)
6. [Generar el instalador (.exe)](#6-generar-el-instalador-exe)
7. [Verificar que los cambios se aplicaron](#7-verificar-que-los-cambios-se-aplicaron)
8. [Actualizar versión](#8-actualizar-versión)
9. [Flujos típicos paso a paso](#9-flujos-típicos-paso-a-paso)
10. [Solución de problemas comunes](#10-solución-de-problemas-comunes)

---

## 1. Entender la arquitectura

La app tiene **3 partes** que se compilan de forma diferente:

```
┌──────────────────────────────────────────────────────────────┐
│                    Chavalos Server (.exe)                     │
│                        (Tauri v2)                            │
├──────────────┬──────────────────┬────────────────────────────┤
│  Panel UI    │   Backend Web    │     Servicios              │
│  (React+Vite)│   (Next.js)     │     (Docker/PostgreSQL)    │
│              │                  │                            │
│  src/App.tsx │  Frontend/       │  resources/                │
│  src/main.tsx│  NextJS_React/   │    docker-compose.yml      │
│  src/*.css   │  web/            │    init-db.sql             │
│              │                  │    seed-data.sql           │
│  Se compila  │  Se compila a    │                            │
│  con Vite    │  standalone y se │  Se copia como             │
│              │  copia a:        │  recurso estático          │
│              │  resources/      │                            │
│              │  backend/        │                            │
├──────────────┴──────────────────┴────────────────────────────┤
│  Rust (src-tauri/src/lib.rs)                                 │
│  Maneja: iniciar/detener servidor, Docker, puertos, logs     │
└──────────────────────────────────────────────────────────────┘
```

### Ubicación de cada parte en el proyecto

| Parte                  | Código fuente                          | Se compila a                          |
|------------------------|----------------------------------------|---------------------------------------|
| Panel UI (escritorio)  | `ChavalosServerApp/src/`               | `ChavalosServerApp/dist/` (Vite)      |
| Backend web (Next.js)  | `Frontend/NextJS_React/web/`           | `src-tauri/resources/backend/`        |
| Lógica Rust            | `ChavalosServerApp/src-tauri/src/`     | Binario dentro del `.exe`             |
| Config Tauri           | `ChavalosServerApp/src-tauri/tauri.conf.json` | Empaquetado en el `.exe`       |
| Hooks del instalador   | `ChavalosServerApp/src-tauri/nsis/`    | Empaquetado en el `.exe`              |
| Esquema BD             | `Base_de_datos/Prisma/schema.prisma`   | Copia en resources + prisma generate  |
| Docker config          | `src-tauri/resources/docker-compose.yml` | Se copia como recurso               |

---

## 2. Tipos de cambios y qué hacer

### ⚡ Referencia rápida

| Cambio que hiciste                        | Qué ejecutar                     | Tiempo  |
|-------------------------------------------|----------------------------------|---------|
| Código web (páginas, componentes, API)    | `.\patch-backend.ps1`            | ~30-60s |
| Auth, sesiones (`lib/auth-session.ts`)    | `.\patch-backend.ps1`            | ~30-60s |
| CSS/estilos del sitio web                 | `.\patch-backend.ps1`            | ~30-60s |
| API routes (`app/api/*`)                  | `.\patch-backend.ps1`            | ~30-60s |
| `.env` del backend                        | `.\patch-backend.ps1 -SkipBuild` | ~10s    |
| Panel Tauri (React `.tsx`, `.css`)        | `.\patch-backend.ps1 -TauriOnly` | ~15s    |
| Código Rust (`lib.rs`)                    | `.\patch-backend.ps1 -TauriOnly` | ~15s    |
| Hooks NSIS / `tauri.conf.json`            | `.\patch-backend.ps1 -TauriOnly` | ~15s    |
| Nueva dependencia npm en backend          | `.\prepare-installer.ps1`        | ~5-15m  |
| Cambios en `schema.prisma`               | `.\prepare-installer.ps1`        | ~5-15m  |
| Actualizar `node.exe` sidecar            | `.\prepare-installer.ps1`        | ~5-15m  |
| Release / primera vez / desde cero       | `.\prepare-installer.ps1`        | ~5-15m  |

### ¿Necesito generar el instalador (.exe) cada vez?

**NO.** Solo necesitas generar el instalador cuando:
- Vas a distribuir la app a otra computadora
- Vas a hacer una actualización/release

Para **probar tus cambios localmente**, usa `npm run tauri dev` (ver sección 3).

---

## 3. Modo desarrollo (vista previa rápida)

El modo desarrollo es tu herramienta principal para probar cambios **sin generar instalador**.

### Iniciar modo desarrollo

```powershell
# Desde la carpeta ChavalosServerApp
cd ChavalosServerApp
npm run tauri dev
```

Esto abre la app de escritorio con:
- ✅ Hot-reload del panel UI (React/Vite) — los cambios se ven al instante
- ✅ Recompilación automática de Rust si cambias `lib.rs`
- ❌ **NO** recarga el backend Next.js automáticamente
- ❌ **NO** refleja cambios de `resources/backend/`

### ¿Qué se ve en tiempo real con `tauri dev`?

| Tipo de cambio               | ¿Se refleja automáticamente? | Qué hacer                      |
|------------------------------|------------------------------|--------------------------------|
| `src/App.tsx`, `src/*.css`   | ✅ Sí (hot-reload)           | Solo guardar el archivo        |
| `src/components/*.tsx`       | ✅ Sí (hot-reload)           | Solo guardar el archivo        |
| `src-tauri/src/lib.rs`       | ✅ Sí (recompila ~20s)       | Guardar, esperar recompilación |
| `tauri.conf.json`            | ❌ No                        | Reiniciar `tauri dev`          |
| Backend Next.js (web/)       | ❌ No                        | Rebuild + copiar (sección 4)   |

### Probar solo el backend web (sin Tauri)

```powershell
# Iniciar Next.js en modo desarrollo
cd Frontend\NextJS_React\web
npm run dev

# Abre http://localhost:3000 en el navegador
```

Aquí sí hay hot-reload para todo el web (páginas, API, componentes, CSS).

---

## 4. Parche rápido con patch-backend.ps1

Cuando haces cambios al backend web y necesitas que se reflejen en la app de escritorio.

### Uso básico

```powershell
# Desde la raíz del proyecto (Tienda_Chavalos_Virtual_web)

# Reconstruir Next.js y copiar a resources/
.\patch-backend.ps1

# Solo copiar (si ya hiciste `npm run build` manualmente en web/)
.\patch-backend.ps1 -SkipBuild

# Solo verificar compilación de Tauri (Rust + TypeScript)
.\patch-backend.ps1 -TauriOnly

# Build completo + generar instalador .exe
.\patch-backend.ps1 -Full
```

### ¿Qué hace internamente `patch-backend.ps1`?

```
1. cd Frontend/NextJS_React/web
2. npm run build                          ← Genera .next/standalone
3. Copia .next/standalone → resources/backend/
4. Copia assets estáticos y public/
5. Verifica que archivos clave existen
6. Verifica fix de cookie LAN (secure=false)
7. (Si -Full) Ejecuta `npm run tauri build`
```

### Ejemplo: Cambié un estilo CSS del sitio web

```powershell
# 1. Editaste Frontend/NextJS_React/web/styles/algo.css
# 2. Ejecutar parche
.\patch-backend.ps1

# 3. Probar
cd ChavalosServerApp
npm run tauri dev
```

### Ejemplo: Solo cambié un componente del panel Tauri

```powershell
# 1. Editaste ChavalosServerApp/src/components/MiComponente.tsx
# 2. No necesitas rebuild del backend
.\patch-backend.ps1 -TauriOnly

# 3. O simplemente:
cd ChavalosServerApp
npm run tauri dev   # Hot-reload ya lo refleja
```

---

## 5. Build completo con prepare-installer.ps1

El script completo hace las **10 fases** necesarias para un build limpio desde cero.

### Cuándo usarlo

- ✅ Agregaste una nueva dependencia npm (`npm install algo`)
- ✅ Cambiaste `schema.prisma` (estructura de BD)
- ✅ Necesitas actualizar el sidecar `node.exe`
- ✅ Primera vez después de clonar el repo
- ✅ Release oficial / versión mayor
- ✅ Algo se rompió y quieres limpiar todo

### Ejecutar

```powershell
# Desde la raíz del proyecto
.\prepare-installer.ps1
```

### Las 10 fases

```
Fase 1:  Detección de rutas (node.exe, npm, Docker)
Fase 2:  Limpieza de destinos (resources/backend, staging)
Fase 3:  Build backend (npm run build en web/)
Fase 4:  Copia a staging temporal
Fase 5:  Ofuscación de código JS
Fase 6:  Dependencias de producción (npm ci --omit=dev)
Fase 7:  Copia final a resources/backend
Fase 8:  Node sidecar (copia node.exe a binaries/)
Fase 9:  Recursos adicionales (docker-compose.yml, SQL, .env)
Fase 10: Prisma generate (genera cliente Prisma)
```

### Después del prepare-installer

```powershell
# El backend ya está listo en resources/
# Ahora genera el instalador:
cd ChavalosServerApp
npm run tauri build
```

---

## 6. Generar el instalador (.exe)

### Comando

```powershell
cd ChavalosServerApp
npm run tauri build
```

### ¿Qué genera?

```
ChavalosServerApp/src-tauri/target/release/bundle/
  ├── nsis/
  │   └── Chavalos Server_1.1.2_x64-setup.exe    ← Instalador NSIS
  └── msi/
      └── Chavalos Server_1.1.2_x64_es-ES.msi    ← Instalador MSI
```

### Tiempo estimado

| Compilación         | Primera vez | Subsiguientes |
|---------------------|-------------|---------------|
| Rust (cargo build)  | ~3-8 min    | ~30s-2 min    |
| Vite (frontend)     | ~5s         | ~5s           |
| Empaquetado NSIS    | ~30s        | ~30s          |
| **Total**           | **~5-10 min** | **~1-3 min** |

### Atajo: patch-backend con instalador

```powershell
# Hace rebuild del backend + genera instalador en un solo comando
.\patch-backend.ps1 -Full
```

---

## 7. Verificar que los cambios se aplicaron

### Verificar backend en resources/

```powershell
# Ver que server.js existe y es reciente
Get-Item ChavalosServerApp\src-tauri\resources\backend\server.js | 
  Select-Object Name, Length, LastWriteTime

# Ver tamaño total del backend empaquetado
$size = (Get-ChildItem ChavalosServerApp\src-tauri\resources\backend -Recurse -File | 
  Measure-Object -Property Length -Sum).Sum
Write-Host "Backend: $([math]::Round($size / 1MB, 1)) MB"
```

### Verificar fix de cookies LAN

```powershell
# Debe mostrar "secure:!1" (que es false minificado)
Select-String -Path "ChavalosServerApp\src-tauri\resources\backend\.next\server\app\api\auth\login\route.js" `
  -Pattern "secure:" | ForEach-Object { $_.Line.Substring([Math]::Max(0, $_.Line.IndexOf("secure:") - 5), 20) }
```

### Verificar versión

```powershell
# Versión en tauri.conf.json
(Get-Content ChavalosServerApp\src-tauri\tauri.conf.json | ConvertFrom-Json).version

# Versión en package.json
(Get-Content ChavalosServerApp\package.json | ConvertFrom-Json).version

# Versión en Cargo.toml
Select-String -Path ChavalosServerApp\src-tauri\Cargo.toml -Pattern '^version' | 
  ForEach-Object { $_.Line }
```

### Verificar que Rust compila

```powershell
cd ChavalosServerApp\src-tauri
cargo check
```

### Verificar que TypeScript compila

```powershell
cd ChavalosServerApp
npx tsc --noEmit
```

---

## 8. Actualizar versión

Cuando vas a generar un release nuevo, actualiza la versión en **3 archivos**:

### Archivos a actualizar

```powershell
# 1. tauri.conf.json  →  "version": "X.Y.Z"
# 2. package.json     →  "version": "X.Y.Z"
# 3. Cargo.toml       →  version = "X.Y.Z"
```

### Convención de versiones

```
MAJOR.MINOR.PATCH

1.0.0 → 1.0.1    # Patch: bug fix pequeño
1.0.1 → 1.1.0    # Minor: funcionalidad nueva
1.1.0 → 2.0.0    # Major: cambio grande / incompatible
```

### Ejemplos

```powershell
# Versión actual: 1.1.2
# Si arreglaste un bug           → 1.1.3
# Si agregaste funcionalidad     → 1.2.0
# Si rediseñaste toda la app     → 2.0.0
```

### Después de cambiar la versión

```powershell
# Verificar que los 3 archivos coinciden
.\patch-backend.ps1 -TauriOnly    # Verifica compilación
# Luego generar instalador
cd ChavalosServerApp
npm run tauri build

# Y crear un tag en Git
git add .
git commit -m "build: bump version to 1.2.0"
git tag -a v1.2.0 -m "Release v1.2.0 - descripción"
```

---

## 9. Flujos típicos paso a paso

### 🔧 Cambié código del sitio web (páginas, API, estilos)

```powershell
# 1. Hiciste tus cambios en Frontend/NextJS_React/web/
# 2. (Opcional) Probar en el navegador primero:
cd Frontend\NextJS_React\web
npm run dev
# Abrir http://localhost:3000 y verificar

# 3. Aplicar los cambios al empaquetado:
cd d:\Aquiles\Tienda_Chavalos_Virtual_web
.\patch-backend.ps1

# 4. Probar en la app de escritorio:
cd ChavalosServerApp
npm run tauri dev

# 5. Si todo está bien y quieres distribuir:
npm run tauri build
```

### 🖥️ Cambié el panel de escritorio (React/Tauri UI)

```powershell
# 1. Hiciste cambios en ChavalosServerApp/src/
# 2. Probar con hot-reload:
cd ChavalosServerApp
npm run tauri dev
# Los cambios se ven al instante (hot-reload)

# 3. Cuando esté listo para distribuir:
npm run tauri build
```

### ⚙️ Cambié código Rust (lib.rs)

```powershell
# 1. Editaste ChavalosServerApp/src-tauri/src/lib.rs
# 2. Verificar que compila:
cd ChavalosServerApp\src-tauri
cargo check

# 3. Probar en vivo (recompila automáticamente):
cd ChavalosServerApp
npm run tauri dev

# 4. Para distribuir:
npm run tauri build
```

### 📦 Agregué una dependencia npm al backend

```powershell
# 1. Instalaste algo nuevo en web/
cd Frontend\NextJS_React\web
npm install nueva-libreria

# 2. ¡NECESITAS el script completo! (por node_modules)
cd d:\Aquiles\Tienda_Chavalos_Virtual_web
.\prepare-installer.ps1

# 3. Generar instalador
cd ChavalosServerApp
npm run tauri build
```

### 🗄️ Cambié el schema de Prisma

```powershell
# 1. Editaste Base_de_datos/Prisma/schema.prisma
# 2. Script completo (regenera Prisma client)
.\prepare-installer.ps1

# 3. Generar instalador
cd ChavalosServerApp
npm run tauri build
```

### 🆘 Algo se rompió, quiero empezar limpio

```powershell
# Build completo desde cero
.\prepare-installer.ps1

# Verificar todo
cd ChavalosServerApp\src-tauri
cargo check
cd ..
npx tsc --noEmit

# Generar instalador
npm run tauri build
```

### 🌐 Quiero probar la app en otra computadora de la LAN

```powershell
# 1. Generar instalador
cd ChavalosServerApp
npm run tauri build

# 2. El .exe está en:
#    src-tauri\target\release\bundle\nsis\Chavalos Server_X.Y.Z_x64-setup.exe

# 3. Copiar el .exe a la otra computadora
# 4. Instalar y ejecutar

# 5. Desde otra máquina acceder al sitio web en:
#    http://IP-DEL-SERVIDOR:3000
```

---

## 10. Solución de problemas comunes

### "Hice cambios pero no se ven en la app"

```powershell
# ¿Dónde hiciste el cambio?

# Si fue en Frontend/NextJS_React/web/ :
.\patch-backend.ps1                # Rebuild y copiar

# Si fue en ChavalosServerApp/src/ :
cd ChavalosServerApp
npm run tauri dev                  # Hot-reload lo refleja

# Si fue en lib.rs :
# Reiniciar tauri dev (o esperar recompilación automática)
```

### "npm run tauri build falla con error de Rust"

```powershell
# Verificar compilación Rust por separado
cd ChavalosServerApp\src-tauri
cargo check

# Si hay errores, corregirlos y volver a intentar
# Tip: los errores de Rust son muy descriptivos, leer el mensaje
```

### "npm run tauri build falla con error de TypeScript"

```powershell
# Verificar TypeScript por separado
cd ChavalosServerApp
npx tsc --noEmit

# Corregir los errores de tipo y reintentar
```

### "El instalador no puede sobrescribir bcrypt.node o archivos de Prisma"

```powershell
# Los archivos están bloqueados por procesos Node.js
# Cierra la app Chavalos Server antes de instalar la actualización

# Si sigue fallando, matar procesos manualmente:
taskkill /F /IM "Chavalos Server.exe" /T
taskkill /F /IM node.exe /T
# Luego ejecutar el instalador de nuevo
```

### "prepare-installer.ps1 tarda mucho"

```powershell
# ¿Realmente necesitas el build completo?
# Para cambios simples usa:
.\patch-backend.ps1        # ~30-60 segundos vs 5-15 minutos
```

### "Error: No se generó .next/standalone"

```powershell
# Verificar que next.config.ts tiene output: 'standalone'
Select-String -Path Frontend\NextJS_React\web\next.config.ts -Pattern "output"

# Probar build manual:
cd Frontend\NextJS_React\web
npm run build
# Si falla, revisar los errores de Next.js
```

### "El login funciona en localhost pero no en otra máquina (LAN)"

```powershell
# Verificar que el fix de cookies está aplicado:
Select-String -Path Frontend\NextJS_React\web\lib\auth-session.ts -Pattern "secure"
# Debe decir: secure: false

# Rebuild y copiar
cd d:\Aquiles\Tienda_Chavalos_Virtual_web
.\patch-backend.ps1

# Verificar en el bundle compilado:
Select-String -Path ChavalosServerApp\src-tauri\resources\backend\.next\server\app\api\auth\login\route.js `
  -Pattern "secure:!1"
# Debe encontrar una coincidencia (secure:!1 = false en JS minificado)
```

### "Docker no inicia / PostgreSQL no se conecta"

```powershell
# Verificar que Docker Desktop está corriendo
docker info

# Verificar contenedores
docker ps -a

# Reiniciar los contenedores
docker-compose -f ChavalosServerApp\src-tauri\resources\docker-compose.yml down
docker-compose -f ChavalosServerApp\src-tauri\resources\docker-compose.yml up -d
```

---

## 📋 Cheat Sheet Express

| Acción                              | Comando                                          |
|-------------------------------------|--------------------------------------------------|
| Probar app (desarrollo)             | `cd ChavalosServerApp && npm run tauri dev`       |
| Probar web (navegador)              | `cd Frontend\NextJS_React\web && npm run dev`     |
| Parche rápido backend               | `.\patch-backend.ps1`                             |
| Solo copiar (sin rebuild)           | `.\patch-backend.ps1 -SkipBuild`                  |
| Solo verificar Tauri                | `.\patch-backend.ps1 -TauriOnly`                  |
| Build completo (desde cero)         | `.\prepare-installer.ps1`                         |
| Generar instalador                  | `cd ChavalosServerApp && npm run tauri build`     |
| Parche + instalador                 | `.\patch-backend.ps1 -Full`                       |
| Verificar Rust                      | `cd src-tauri && cargo check`                     |
| Verificar TypeScript                | `cd ChavalosServerApp && npx tsc --noEmit`        |
| Ver versión actual                  | `(gc ChavalosServerApp\src-tauri\tauri.conf.json \| ConvertFrom-Json).version` |
| Matar procesos bloqueados           | `taskkill /F /IM node.exe /T`                     |

---

## 📊 Diagrama de decisión

```
¿Qué cambié?
│
├─ Código web (Frontend/NextJS_React/web/)
│  ├─ Solo .env ──────────────────── .\patch-backend.ps1 -SkipBuild
│  ├─ Código/CSS/API ─────────────── .\patch-backend.ps1
│  └─ Nueva dependencia npm ──────── .\prepare-installer.ps1
│
├─ Panel Tauri (ChavalosServerApp/src/)
│  └─ Componentes .tsx / .css ────── npm run tauri dev (hot-reload)
│
├─ Rust (src-tauri/src/)
│  └─ lib.rs u otro .rs ─────────── npm run tauri dev (recompila solo)
│
├─ Config (tauri.conf.json / NSIS)
│  └─ Cualquier config ──────────── .\patch-backend.ps1 -TauriOnly
│
├─ Base de datos (schema.prisma)
│  └─ Estructura BD ─────────────── .\prepare-installer.ps1
│
└─ ¿Quiero distribuir?
   └─ SÍ ────────────────────────── npm run tauri build (o -Full)
```

---

*Guía creada para el proyecto Tienda Chavalos Virtual — v1.1.2*
