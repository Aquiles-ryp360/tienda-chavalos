# 📚 Documentación Completa - Chavalos Server App

> **Aplicación de escritorio para gestionar el servidor de Ferretería Chavalos con un solo clic**
> 
> Fecha: Enero 2026  
> Versión: 1.0.0  
> Plataforma: Windows x64

---

## 📋 Índice

1. [Visión General](#visión-general)
2. [Estructura del Proyecto](#estructura-del-proyecto)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Arquitectura](#arquitectura)
5. [Configuración y Setup](#configuración-y-setup)
6. [Funcionalidades](#funcionalidades)
7. [Proceso de Compilación](#proceso-de-compilación)
8. [Problemas Resueltos](#problemas-resueltos)
9. [Uso y Deployment](#uso-y-deployment)
10. [Código Fuente Clave](#código-fuente-clave)

---

## 🎯 Visión General

### Propósito
**Chavalos Server App** es una aplicación de escritorio Windows diseñada para que usuarios no técnicos (específicamente la madre del desarrollador) puedan iniciar y gestionar el servidor web de la Ferretería Chavalos con un simple clic, sin necesidad de conocimientos técnicos sobre Docker, Node.js o comandos de terminal.

### Problema que Resuelve
Antes de esta aplicación, iniciar el servidor requería:
- Abrir PowerShell
- Navegar a directorios específicos
- Ejecutar múltiples comandos (Docker, npm, etc.)
- Configurar variables de entorno
- Monitorear logs manualmente

**Ahora:** Doble clic en "Chavalos Server" desde el escritorio → El servidor arranca automáticamente.

### Características Principales
- ✅ **Un clic para iniciar/detener** el servidor completo
- ✅ **Monitoreo en tiempo real** de logs del servidor
- ✅ **Código QR automático** con la IP LAN para acceso desde otros dispositivos
- ✅ **Bandeja del sistema** para operación en segundo plano
- ✅ **Detección automática de red** (muestra IP local para acceso LAN)
- ✅ **Interfaz gráfica moderna** con estados visuales claros
- ✅ **Configuración persistente** (puerto, modo, ruta del proyecto)
- ✅ **Instalador MSI** para distribución simple

---

## 📁 Estructura del Proyecto

```
ChavalosServerApp/
│
├── src/                          # Frontend React
│   ├── App.tsx                   # Componente principal (775 líneas)
│   ├── main.tsx                  # Entry point de React
│   └── styles.css                # Estilos globales
│
├── src-tauri/                    # Backend Rust (Tauri)
│   ├── src/
│   │   └── main.rs               # Lógica del servidor (433 líneas)
│   ├── tauri.conf.json           # Configuración de Tauri (108 líneas)
│   ├── Cargo.toml                # Dependencias Rust
│   ├── build.rs                  # Script de build
│   └── icons/                    # Iconos de la aplicación (16 archivos)
│       ├── icon.ico              # Icono principal Windows
│       ├── 32x32.png
│       ├── 128x128.png
│       └── ... (otros tamaños)
│
├── server-launcher.ps1           # Script PowerShell (309 líneas)
│                                 # Orquesta Docker + Next.js
│
├── package.json                  # Dependencias Node.js
├── vite.config.ts                # Configuración Vite
├── tsconfig.json                 # Configuración TypeScript
│
├── setup.ps1                     # Script de instalación dev
├── dev.ps1                       # Script de desarrollo
├── build.ps1                     # Script de build producción
│
├── INSTRUCCIONES_MAMA.md         # Guía para el usuario final
├── README.md                     # Documentación general
└── QUICKSTART.md                 # Inicio rápido

Instaladores generados (después del build):
├── src-tauri/target/release/bundle/
    ├── msi/
    │   └── Chavalos Server_1.0.0_x64_es-ES.msi      (2.54 MB)
    └── nsis/
        └── Chavalos Server_1.0.0_x64-setup.exe      (1.69 MB)
```

---

## 🛠️ Stack Tecnológico

### Frontend
- **React 18.3.1** - Framework UI
- **TypeScript 5.6.2** - Tipado estático
- **Vite 5.4.21** - Build tool y dev server
- **Lucide React** - Librería de iconos
- **QRCode.react** - Generación de códigos QR

### Backend
- **Rust 1.92.0** - Lenguaje del backend
- **Tauri 1.8.3** - Framework para apps de escritorio
  - Combina Rust (backend) + WebView (frontend)
  - Alternativa ligera a Electron (~6.5 MB vs ~150 MB)
- **Serde** - Serialización JSON
- **Chrono** - Manejo de fechas

### Infraestructura
- **PowerShell 7+** - Scripts de orquestación
- **Docker Desktop 29.1.3** - Contenedores para PostgreSQL
- **WiX Toolset 3.14** - Generación de instaladores MSI
- **NSIS** - Generación de instaladores EXE

### Herramientas de Desarrollo
- **Visual Studio Build Tools 2022** - Compilador MSVC (requerido por Rust en Windows)
- **Cargo** - Gestor de paquetes Rust
- **npm 11.6.2** - Gestor de paquetes Node.js

---

## 🏗️ Arquitectura

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                    Chavalos Server App                       │
│                     (Tauri Window)                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐         ┌──────────────────┐           │
│  │  React UI      │◄────────┤  Tauri Commands  │           │
│  │  (Frontend)    │  IPC    │  (Rust Backend)  │           │
│  │                │─────────►                  │           │
│  │  - Dashboard   │         │  8 comandos:     │           │
│  │  - Logs        │         │  - start_server  │           │
│  │  - QR Code     │         │  - stop_server   │           │
│  │  - Settings    │         │  - get_settings  │           │
│  └────────────────┘         │  - save_settings │           │
│                              │  - get_status    │           │
│                              │  - open_browser  │           │
│                              │  - open_folder   │           │
│                              │  - export_logs   │           │
│                              └────────┬─────────┘           │
└───────────────────────────────────────┼─────────────────────┘
                                        │
                                        │ Ejecuta PowerShell
                                        ▼
                        ┌───────────────────────────┐
                        │  server-launcher.ps1      │
                        │                           │
                        │  1. Verifica Docker       │
                        │  2. Inicia PostgreSQL     │
                        │  3. Espera DB lista       │
                        │  4. Inicia Next.js        │
                        │  5. Configura Firewall    │
                        │  6. Detecta IP LAN        │
                        └───────────┬───────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌────────────────────┐        ┌─────────────────────┐
        │  Docker Container   │        │  Next.js Server     │
        │  PostgreSQL 17      │◄───────┤  (Frontend Web)     │
        │  Puerto: 5432       │        │  Puerto: 3000       │
        └────────────────────┘        └─────────────────────┘
```

### Flujo de Comunicación

1. **Usuario hace clic en "Iniciar"**
2. React UI invoca `start_server()` (comando Tauri)
3. Rust backend ejecuta PowerShell con `server-launcher.ps1`
4. Script PowerShell:
   - Levanta Docker Compose (PostgreSQL)
   - Espera a que DB esté lista (health check)
   - Inicia Next.js con `npm run dev`
   - Configura reglas de Firewall de Windows
   - Detecta IP LAN y genera URL accesible
5. Logs se transmiten en tiempo real vía stdout → Rust → IPC → React
6. React actualiza UI con estado, logs y código QR

### Persistencia de Datos

**Configuración:**
- Ruta: `%APPDATA%\chavalos-server\settings.json`
- Contiene: project_path, port, mode, start_minimized, auto_start
- Formato: JSON serializado con serde

**Logs exportados:**
- Ruta: Elegida por el usuario (diálogo de guardado)
- Formato: `.txt` con timestamps

---

## ⚙️ Configuración y Setup

### Prerequisitos

#### Software Requerido
1. **Node.js 24.13.0+** y npm 11.6.2+
2. **Rust 1.92.0+** (con Cargo)
3. **Visual Studio Build Tools 2022**
   - Workload: "Desktop development with C++"
   - Componentes: MSVC v143, Windows 10/11 SDK
4. **Docker Desktop 29.1.3+**
   - Debe estar corriendo antes de iniciar el servidor

#### Variables de Entorno
- `PATH` debe incluir:
  - `C:\Users\<user>\.cargo\bin` (Rust/Cargo)
  - `C:\Program Files\nodejs` (Node.js)
  - Docker Desktop añade su propio PATH automáticamente

### Instalación para Desarrollo

```powershell
# 1. Clonar/navegar al proyecto
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp

# 2. Ejecutar setup automático
.\setup.ps1

# El script verifica:
# - Node.js instalado
# - npm instalado
# - Rust instalado
# - Cargo instalado
# - Instala dependencias de Node.js
# - Valida compilación de Rust
```

### Desarrollo

```powershell
# Modo desarrollo con hot-reload
.\dev.ps1

# O manualmente:
npm run tauri:dev
```

### Build de Producción

```powershell
# Build completo (MSI + NSIS)
.\build.ps1

# O manualmente:
npm run tauri:build

# Tiempo aprox: 10-20 minutos (primera vez), 1-2 min (subsecuentes)
# Salida: src-tauri/target/release/bundle/
```

---

## 🎨 Funcionalidades

### 1. Control del Servidor

**Estados:**
- 🔴 **Detenido** - Servidor no está corriendo
- 🟡 **Iniciando** - Levantando Docker y Next.js
- 🟢 **Corriendo** - Servidor operativo y accesible
- 🔴 **Deteniendo** - Cerrando procesos
- ❌ **Error** - Algo falló (ver logs)

**Botones:**
- **Iniciar**: Ejecuta `server-launcher.ps1`
- **Detener**: Mata procesos de PowerShell y Docker
- **Reiniciar**: Stop + Start

### 2. Monitoreo de Logs

**Características:**
- Logs en tiempo real con scroll automático
- Colores por nivel:
  - 🔵 INFO - Azul
  - 🟢 SUCCESS - Verde
  - 🟡 WARN - Amarillo
  - 🔴 ERROR - Rojo
- Timestamps en formato `[HH:mm:ss]`
- Botón "Exportar Logs" para guardar historial

### 3. Acceso LAN

**Código QR:**
- Generado automáticamente cuando el servidor arranca
- Contiene la URL con IP local (ej: `http://192.168.1.100:3000`)
- Escaneable desde móviles para acceso remoto
- Se actualiza si cambia la IP

**URLs mostradas:**
- Local: `http://localhost:3000`
- LAN: `http://<IP_LOCAL>:3000`

### 4. Configuración

**Ajustes disponibles:**
- **Ruta del Proyecto**: Dónde está el código de Next.js
- **Puerto**: Puerto del servidor (default: 3000)
- **Modo**: dev (hot-reload) o prod (optimizado)
- **Iniciar Minimizado**: Abre en bandeja del sistema
- **Auto-start**: Inicia servidor al abrir la app

**Persistencia:**
- Cambios se guardan automáticamente en `settings.json`
- Se cargan al abrir la aplicación

### 5. Bandeja del Sistema

**Menú contextual:**
- Mostrar/Ocultar ventana
- Iniciar/Detener servidor
- Salir

**Indicadores:**
- Icono cambia según estado del servidor
- Notificaciones para eventos importantes

---

## 🔨 Proceso de Compilación

### Dependencias Rust (468 paquetes)

**Principales:**
```toml
[dependencies]
tauri = { version = "1.8.3", features = ["shell-open"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tauri-plugin-fs-extra = "1.0"
```

**Tiempo de build:**
- Primera compilación: ~10-20 min (compila 468 crates)
- Subsecuentes: ~1-2 min (solo cambios)
- Espacio en disco: ~4 GB (target/ completo)

### Dependencias Node.js (75 paquetes)

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@tauri-apps/api": "^1.5.0",
    "lucide-react": "^0.263.1",
    "qrcode.react": "^3.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^5.4.21",
    "typescript": "^5.6.2",
    "@tauri-apps/cli": "^1.5.0"
  }
}
```

### Pasos del Build

```powershell
# 1. Verificar prerequisitos
✅ Node.js: v24.13.0
✅ npm: v11.6.2
✅ Rust: rustc 1.92.0
✅ Cargo: cargo 1.92.0

# 2. Instalar dependencias
npm install  # ~3 segundos

# 3. Compilar frontend (Vite)
npm run build
# Salida: dist/index.html (0.48 KB)
#         dist/assets/index.css (0.94 KB)
#         dist/assets/index.js (161.84 KB gzipped)

# 4. Compilar backend (Rust)
cargo build --release
# Salida: target/release/chavalos-server.exe (6.5 MB)

# 5. Empaquetar recursos
# - Copia dist/ al bundle
# - Incluye server-launcher.ps1
# - Genera iconos

# 6. Crear instaladores
# MSI (WiX Toolset): Chavalos Server_1.0.0_x64_es-ES.msi (2.54 MB)
# NSIS: Chavalos Server_1.0.0_x64-setup.exe (1.69 MB)
```

### Configuración del Bundle (tauri.conf.json)

```json
{
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "identifier": "com.chavalos.server",
    "icon": [...],
    "resources": ["../server-launcher.ps1"],  // ← Script incluido
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "",
      "wix": {
        "language": "es-ES"  // ← Español de España (requerido)
      }
    }
  }
}
```

---

## 🐛 Problemas Resueltos

### 1. Rust no encontrado en PATH
**Error:** `'cargo' is not recognized as an internal or external command`

**Causa:** Instalación de Rust no añade automáticamente `~\.cargo\bin` al PATH en PowerShell.

**Solución:**
```powershell
# Añadido al inicio de setup.ps1, dev.ps1, build.ps1
if (!(Get-Command rustc -ErrorAction SilentlyContinue)) {
    $env:Path += ";$env:USERPROFILE\.cargo\bin"
}
```

### 2. Visual Studio Build Tools faltante
**Error:** `error: linker 'link.exe' not found`

**Causa:** Rust en Windows requiere MSVC linker para compilar código nativo.

**Solución:**
- Instalar "Visual Studio Build Tools 2022"
- Seleccionar workload "Desktop development with C++"
- Incluir MSVC v143 y Windows SDK

### 3. Iconos faltantes
**Error:** `icons/icon.ico not found`

**Causa:** Tauri requiere iconos en múltiples tamaños para empaquetado.

**Solución:**
- Creado script `create-icons.ps1`
- Genera 16 archivos de iconos placeholder (PNG, ICO)
- Iconos base64-encoded para portabilidad

### 4. Error de importación Windows (`CommandExt`)
**Error:** `use of undeclared type 'CommandExt'`

**Causa:** `CommandExt` es específico de Windows y requiere importación condicional.

**Solución:**
```rust
#[cfg(windows)]
use std::os::windows::process::CommandExt;
```

### 5. Error de ownership en logs
**Error:** `value moved here, value borrowed here`

**Causa:** Variable `line` movida al emitir evento, pero usada después.

**Solución:**
```rust
// Antes:
message: line

// Después:
message: line.clone()
```

### 6. Importaciones TypeScript no usadas
**Error:** `'Database' is declared but its value is never read`

**Causa:** Imports de lucide-react no utilizados en App.tsx.

**Solución:**
```typescript
// Removidos Database y AlertCircle de:
import { Server, X, Settings, /* ... */ } from 'lucide-react';
```

### 7. WiX idioma no soportado
**Error:** `Language es-MX not found. It must be one of [...] es-ES [...]`

**Causa:** WiX Toolset solo soporta códigos de idioma específicos.

**Solución:**
```json
// tauri.conf.json
"wix": {
  "language": "es-ES"  // Cambiado de "es-MX"
}
```

### 8. Script no encontrado en runtime
**Error:** `Script no encontrado: D:\...\ChavalosServerApp\src-tauri\target\...\server-launcher.ps1`

**Causa:** Script no incluido en recursos del bundle, app buscaba en ruta de desarrollo.

**Solución:**
```json
// tauri.conf.json
"resources": ["../server-launcher.ps1"]
```

```rust
// main.rs - Buscar en recursos primero
let resource_path = window.app_handle()
    .path_resolver()
    .resolve_resource("server-launcher.ps1")?;

let script_path = if resource_path.exists() {
    resource_path  // Producción
} else {
    PathBuf::from(&settings.project_path)
        .join("ChavalosServerApp")
        .join("server-launcher.ps1")  // Desarrollo
};
```

---

## 📦 Uso y Deployment

### Para Usuarios Finales (Tu Mamá)

#### Instalación

1. **Recibir el instalador**: `Chavalos Server_1.0.0_x64_es-ES.msi` (2.54 MB)

2. **Doble clic** en el archivo `.msi`

3. **Seguir asistente**:
   - Aceptar licencia
   - Elegir ubicación (default: `C:\Program Files\Chavalos Server`)
   - Instalar

4. **Finalizar instalación**
   - Se crea acceso directo en Menú Inicio
   - Se crea acceso directo en Escritorio (opcional)

#### Uso Diario

1. **Abrir aplicación**:
   - Doble clic en icono de escritorio, o
   - Buscar "Chavalos Server" en menú inicio

2. **Iniciar servidor**:
   - Clic en botón "🚀 Iniciar"
   - Esperar ~30-60 segundos
   - Aparecerá código QR con la URL

3. **Acceder al servidor**:
   - Desde la misma PC: Abrir navegador → `http://localhost:3000`
   - Desde móvil/tablet: Escanear código QR

4. **Detener servidor**:
   - Clic en botón "🛑 Detener"
   - O cerrar la aplicación

#### Troubleshooting

**"Error: Docker no está corriendo"**
- Abrir Docker Desktop
- Esperar a que el icono de Docker en la bandeja sea azul/verde
- Reintentar iniciar servidor

**"Error: Puerto 3000 ya está en uso"**
- Cerrar otras aplicaciones que usen ese puerto
- O cambiar puerto en Configuración → Puerto → Guardar

**"No aparece código QR"**
- Verificar que la PC esté conectada a la red
- Verificar que Firewall de Windows no bloquee el puerto

### Para Desarrolladores

#### Modificar y Reconstruir

```powershell
# 1. Editar código
# - Frontend: src/App.tsx
# - Backend: src-tauri/src/main.rs
# - Script: server-launcher.ps1

# 2. Probar en desarrollo
.\dev.ps1

# 3. Compilar nuevo instalador
.\build.ps1

# 4. Instalar y probar
# - Desinstalar versión anterior
# - Instalar nuevo MSI
# - Validar funcionamiento
```

#### Actualizar Versión

```json
// package.json
"version": "1.1.0"

// src-tauri/tauri.conf.json
"package": {
  "productName": "Chavalos Server",
  "version": "1.1.0"
}

// src-tauri/Cargo.toml
[package]
version = "1.1.0"
```

#### Distribuir Actualizaciones

1. Compilar nuevo instalador
2. Subir MSI a almacenamiento (Drive, Dropbox, etc.)
3. Notificar a usuarios
4. Usuarios desinstalan versión anterior e instalan nueva

**Nota:** Tauri soporta auto-updates, pero requiere configuración adicional.

---

## 💻 Código Fuente Clave

### main.rs - Backend Rust (Fragmentos importantes)

```rust
// === COMANDOS TAURI (API para el frontend) ===

#[tauri::command]
async fn start_server(
    window: Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // 1. Verificar que no esté corriendo
    // 2. Emitir evento "starting"
    // 3. Construir comando PowerShell con script
    // 4. Ejecutar con CREATE_NO_WINDOW flag
    // 5. Capturar stdout/stderr en tiempo real
    // 6. Emitir logs al frontend vía IPC
    // 7. Parsear output para detectar URLs
    // 8. Cambiar estado a "running"
}

#[tauri::command]
async fn stop_server(
    window: Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // 1. Verificar que esté corriendo
    // 2. Emitir evento "stopping"
    // 3. Matar proceso de PowerShell
    // 4. Limpiar estado
    // 5. Emitir evento "stopped"
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> AppSettings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn save_settings(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    save_settings_to_file(&settings)?;
    *state.settings.lock().unwrap() = settings;
    Ok(())
}

// === RESOLUCIÓN DE RECURSOS ===

let resource_path = window.app_handle()
    .path_resolver()
    .resolve_resource("server-launcher.ps1")
    .ok_or_else(|| "No se pudo resolver la ruta del recurso".to_string())?;

let script_path = if resource_path.exists() {
    resource_path  // App instalada
} else {
    PathBuf::from(&settings.project_path)
        .join("ChavalosServerApp")
        .join("server-launcher.ps1")  // Dev mode
};
```

### App.tsx - Frontend React (Fragmentos importantes)

```typescript
// === ESTADO PRINCIPAL ===

const [serverStatus, setServerStatus] = useState<
  'stopped' | 'starting' | 'running' | 'stopping' | 'error'
>('stopped');

const [logs, setLogs] = useState<Log[]>([]);
const [serverInfo, setServerInfo] = useState({ url: '', lanIp: '' });

// === INICIALIZACIÓN - ESCUCHAR EVENTOS ===

useEffect(() => {
  // Escuchar cambios de estado
  const unlisten1 = listen('server-status', (event) => {
    setServerStatus(event.payload as any);
  });

  // Escuchar logs en tiempo real
  const unlisten2 = listen('server-log', (event) => {
    const log = event.payload as Log;
    setLogs(prev => [...prev, log]);
    // Auto-scroll
    scrollToBottom();
  });

  return () => { unlisten1.then(fn => fn()); unlisten2.then(fn => fn()); };
}, []);

// === ACCIONES ===

const handleStart = async () => {
  try {
    await invoke('start_server');
  } catch (error) {
    showError('Error iniciando servidor');
  }
};

const handleStop = async () => {
  try {
    await invoke('stop_server');
  } catch (error) {
    showError('Error deteniendo servidor');
  }
};

// === RENDERIZADO ===

<div className="server-control">
  <button 
    onClick={handleStart} 
    disabled={serverStatus !== 'stopped'}
  >
    🚀 Iniciar
  </button>
  
  <button 
    onClick={handleStop} 
    disabled={serverStatus !== 'running'}
  >
    🛑 Detener
  </button>
</div>

{serverInfo.lanIp && (
  <div className="qr-section">
    <QRCodeSVG 
      value={`http://${serverInfo.lanIp}:${settings.port}`}
      size={200}
    />
  </div>
)}

<div className="logs-container">
  {logs.map((log, i) => (
    <div key={i} className={`log log-${log.level}`}>
      {log.message}
    </div>
  ))}
</div>
```

### server-launcher.ps1 - Orquestador (Fragmentos importantes)

```powershell
# === PARÁMETROS ===
param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev', 'prod')]
    [string]$Mode = 'dev',
    
    [Parameter(Mandatory=$false)]
    [int]$Port = 3000
)

# === VERIFICACIONES ===

# Docker corriendo
$dockerRunning = docker info 2>$null
if (!$dockerRunning) {
    Write-AppLog "ERROR: Docker no está corriendo" "ERROR"
    exit 1
}

# === LEVANTAR POSTGRESQL ===

Set-Location $dockerPath
Write-AppLog "Iniciando PostgreSQL con Docker Compose..." "INFO"
docker-compose up -d

# Esperar hasta que DB esté lista (health check)
$maxWait = 60  # segundos
$waited = 0
while ($waited -lt $maxWait) {
    $status = docker inspect postgres-local --format='{{.State.Health.Status}}' 2>$null
    if ($status -eq 'healthy') {
        Write-AppLog "✅ PostgreSQL listo" "INFO"
        break
    }
    Start-Sleep -Seconds 2
    $waited += 2
}

# === CONFIGURAR FIREWALL ===

Write-AppLog "Configurando Firewall de Windows..." "INFO"
$ruleName = "Chavalos Server - Puerto $Port"

# Verificar si regla existe
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

if (!$existingRule) {
    # Crear regla
    New-NetFirewallRule -DisplayName $ruleName `
                        -Direction Inbound `
                        -Protocol TCP `
                        -LocalPort $Port `
                        -Action Allow `
                        -Profile Domain,Private `
                        -ErrorAction SilentlyContinue
    Write-AppLog "✅ Regla de firewall creada" "INFO"
}

# === DETECTAR IP LAN ===

$lanIP = Get-LanIPv4
if ($lanIP) {
    Write-AppLog "IP LAN detectada: $lanIP" "INFO"
    Write-AppLog "Acceso remoto: http://${lanIP}:${Port}" "INFO"
}

# === INICIAR NEXT.JS ===

Set-Location $nextPath

if ($Mode -eq 'dev') {
    npm run dev -- --port $Port
} else {
    npm run build
    npm run start -- --port $Port
}

# === CLEANUP AL SALIR ===

trap {
    Write-AppLog "Deteniendo servicios..." "INFO"
    docker-compose -f "$dockerPath\docker-compose.yml" down
    Write-AppLog "✅ Servicios detenidos" "INFO"
}
```

---

## 📊 Métricas del Proyecto

### Tamaño del Código

| Componente | Líneas de Código | Archivos |
|-----------|-----------------|----------|
| Frontend (React) | ~800 | 3 |
| Backend (Rust) | ~450 | 1 |
| Scripts (PowerShell) | ~400 | 4 |
| Configuración | ~200 | 5 |
| **Total** | **~1,850** | **13** |

### Dependencias

| Ecosistema | Paquetes | Tamaño |
|-----------|----------|--------|
| Node.js | 75 | ~50 MB |
| Rust | 468 | ~4 GB (compilado) |
| **Total** | **543** | **~4.05 GB** |

### Instaladores

| Formato | Tamaño | Compresión |
|---------|--------|-----------|
| MSI | 2.54 MB | WiX |
| NSIS EXE | 1.69 MB | LZMA |

### Performance

| Métrica | Valor |
|---------|-------|
| Tiempo de inicio (app) | <1 segundo |
| Tiempo de inicio (servidor) | ~30-60 segundos |
| Memoria en reposo | ~50 MB |
| Memoria con servidor | ~200 MB |
| CPU en reposo | <1% |

---

## 🔮 Mejoras Futuras

### Funcionalidades Planeadas

1. **Auto-updates**
   - Integración con Tauri updater
   - Notificaciones de nuevas versiones
   - Instalación automática

2. **Monitoreo avanzado**
   - Gráficas de uso de CPU/RAM
   - Estadísticas de requests
   - Alertas de errores

3. **Gestión de múltiples instancias**
   - Iniciar múltiples servidores (dev, staging, prod)
   - Cambiar entre instancias fácilmente

4. **Respaldos automáticos**
   - Backup programado de base de datos
   - Exportación de datos

5. **Terminal integrada**
   - Ejecutar comandos directamente
   - Acceso a Docker CLI

### Optimizaciones Técnicas

1. **Reducir tamaño del instalador**
   - Usar UPX para comprimir binario
   - Target: <1 MB

2. **Caché inteligente**
   - Detectar si Docker ya corrió hoy
   - Evitar checks innecesarios

3. **Logging estructurado**
   - Formato JSON para logs
   - Rotación automática de archivos

---

## 🤝 Contribución

### Guía para Nuevos Desarrolladores

1. **Clonar proyecto**
2. **Ejecutar `.\setup.ps1`**
3. **Leer este documento** 
4. **Ejecutar `.\dev.ps1` y experimentar**
5. **Hacer cambios**
6. **Probar en desarrollo**
7. **Compilar MSI y probar instalación**
8. **Documentar cambios**

### Convenciones de Código

**Rust:**
- Snake_case para variables y funciones
- PascalCase para structs y enums
- Documentar funciones públicas con `///`

**TypeScript:**
- camelCase para variables y funciones
- PascalCase para componentes React
- Interfaces con prefijo `I` opcional

**PowerShell:**
- PascalCase para funciones (Verb-Noun)
- camelCase para variables
- Comentarios explicativos para bloques complejos

---

## 📄 Licencia

Uso interno - Ferretería Chavalos
Copyright © 2026

---

## 🙏 Créditos

**Desarrollador:** Aquiles  
**Usuario Final:** Mamá de Aquiles  
**Propósito:** Simplificar gestión del servidor de Ferretería Chavalos  
**Framework Principal:** Tauri (https://tauri.app)  
**Inspiración:** Electron, pero más ligero y seguro  

---

## 📞 Soporte

Para problemas técnicos o consultas:
1. Revisar sección [Troubleshooting](#troubleshooting)
2. Verificar logs exportados
3. Contactar al desarrollador

---

**Última actualización:** Enero 16, 2026  
**Versión del documento:** 1.0  
**Estado del proyecto:** ✅ Producción
