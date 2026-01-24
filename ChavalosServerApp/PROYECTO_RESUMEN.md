# 📊 Chavalos Server App - Resumen Técnico

## 🎯 Objetivo del Proyecto

Convertir el stack técnico de "Ferretería Chavalos" (Next.js + PostgreSQL + Docker) en una aplicación de escritorio con interfaz gráfica que permita a usuarios no técnicos gestionar el servidor con un solo clic.

## 🏗️ Arquitectura

### Stack Tecnológico

```
┌─────────────────────────────────────────────────────┐
│                   TAURI APP                         │
├─────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript + Vite)              │
│  - UI moderna con componentes funcionales          │
│  - Estado local con hooks                          │
│  - Comunicación con backend vía Tauri API          │
├─────────────────────────────────────────────────────┤
│  Backend (Rust)                                     │
│  - Comandos Tauri para ejecutar PowerShell         │
│  - Gestión de procesos (spawn, kill)              │
│  - Stream de logs en tiempo real                   │
│  - Sistema de bandeja (tray)                       │
│  - Persistencia de configuración (JSON)            │
├─────────────────────────────────────────────────────┤
│  PowerShell Script (server-launcher.ps1)           │
│  - Docker Compose (PostgreSQL)                     │
│  - Next.js (modo dev/prod)                         │
│  - Detección de IP LAN                            │
│  - Configuración de firewall                      │
│  - Generación de código QR                        │
└─────────────────────────────────────────────────────┘
```

### Flujo de Ejecución

```
Usuario presiona "Iniciar"
        ↓
React llama invoke('start_server')
        ↓
Rust ejecuta PowerShell con spawn
        ↓
PowerShell:
  1. Verifica Docker
  2. Inicia PostgreSQL (docker compose up)
  3. Detecta IP LAN
  4. Configura firewall
  5. Genera QR
  6. Inicia Next.js (npx next dev)
        ↓
Logs streameados a Rust vía stdout/stderr
        ↓
Rust emite eventos a React (server-log, server-status)
        ↓
React actualiza UI en tiempo real
```

## 📁 Estructura de Archivos

```
ChavalosServerApp/
│
├── 📄 Documentación
│   ├── README.md                    # Documentación técnica completa
│   ├── QUICKSTART.md                # Guía rápida para desarrolladores
│   └── INSTRUCCIONES_MAMA.md        # Manual de usuario final
│
├── 🔧 Scripts de Utilidad
│   ├── setup.ps1                    # Instalación inicial de dependencias
│   ├── dev.ps1                      # Ejecutar en modo desarrollo
│   ├── build.ps1                    # Compilar instalador MSI
│   ├── setup-icons.ps1              # Configurar iconos
│   └── server-launcher.ps1          # Engine principal (PowerShell)
│
├── 🎨 Frontend (React)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx                 # Entry point
│       ├── App.tsx                  # Componente principal (UI completa)
│       └── App.css                  # Estilos globales
│
├── 🦀 Backend (Rust/Tauri)
│   └── src-tauri/
│       ├── Cargo.toml               # Dependencias Rust
│       ├── build.rs                 # Build script
│       ├── tauri.conf.json          # Configuración app (ventana, tray, permisos)
│       ├── icons/                   # Iconos de la aplicación
│       └── src/
│           └── main.rs              # Backend completo
│               ├── Comandos:
│               │   - get_settings
│               │   - save_settings
│               │   - start_server
│               │   - stop_server
│               │   - copy_to_clipboard
│               │   - export_logs
│               │   - open_file
│               │   - select_folder
│               └── Eventos:
│                   - server-log
│                   - server-status
│                   - server-info
│
└── 📦 Configuración
    ├── package.json                 # Dependencias Node
    ├── .gitignore
    └── .vscode/
        ├── extensions.json          # Extensiones recomendadas
        └── settings.json            # Configuración VS Code
```

## 🔑 Funcionalidades Implementadas

### ✅ Core

- [x] Interfaz gráfica moderna (React + CSS gradients)
- [x] Dashboard con estado visual (Detenido/Iniciando/Corriendo/Error)
- [x] Botones de control (Iniciar/Detener/Reiniciar)
- [x] Panel de logs en tiempo real con scroll automático
- [x] Captura de stdout/stderr de PowerShell
- [x] Coloreado de logs por nivel (info/warn/error/success)
- [x] Timestamps en cada log
- [x] Gestión de procesos con PID tracking

### ✅ Red y Conectividad

- [x] Detección automática de IP LAN
- [x] Generación de código QR (API online)
- [x] Botón "Abrir en navegador"
- [x] Botón "Copiar URL al portapapeles"
- [x] Botón "Ver QR" (abre imagen PNG)
- [x] Health check de servicios (Docker, PostgreSQL)

### ✅ Sistema de Bandeja (Tray)

- [x] Minimizar a bandeja en lugar de cerrar
- [x] Menú contextual con opciones:
  - Mostrar ventana
  - Iniciar servidor
  - Detener servidor
  - Salir
- [x] El servidor sigue corriendo en background

### ✅ Configuración

- [x] Panel de configuración (modal)
- [x] Selector de carpeta del proyecto
- [x] Puerto configurable
- [x] Modo dev/prod seleccionable
- [x] Checkbox "Iniciar minimizado"
- [x] Checkbox "Iniciar con Windows" (estructura lista)
- [x] Persistencia en JSON (%APPDATA%/chavalos-server/settings.json)

### ✅ Utilidades

- [x] Exportar logs a archivo .txt
- [x] Timestamp en cada entrada de log
- [x] Filtros de salida (Docker, PostgreSQL, Next.js)
- [x] Manejo de errores con mensajes claros

### ✅ Build e Instalación

- [x] Script de build automatizado (build.ps1)
- [x] Generación de MSI (Windows Installer)
- [x] Generación de NSIS EXE (alternativo)
- [x] Configuración de idioma español (es-MX)
- [x] Metadata de aplicación completa
- [x] Iconos (estructura lista, usa defaults de Tauri)

## 🔧 Comandos Rust (Tauri)

| Comando | Parámetros | Retorno | Descripción |
|---------|-----------|---------|-------------|
| `get_settings` | - | `AppSettings` | Lee configuración guardada |
| `save_settings` | `settings: AppSettings` | `Result<(), String>` | Guarda configuración |
| `start_server` | - | `Result<(), String>` | Inicia servidor (ejecuta .ps1) |
| `stop_server` | - | `Result<(), String>` | Detiene servidor y docker |
| `copy_to_clipboard` | `text: String` | `Result<(), String>` | Copia al portapapeles |
| `export_logs` | `logs: String` | `Result<(), String>` | Exporta logs a archivo |
| `open_file` | `path: String` | `Result<(), String>` | Abre archivo con app por defecto |
| `select_folder` | - | `Result<String, String>` | Diálogo para seleccionar carpeta |

## 📡 Eventos Emitidos

| Evento | Payload | Descripción |
|--------|---------|-------------|
| `server-log` | `{ message: string, level: string }` | Log en tiempo real |
| `server-status` | `string` (stopped/starting/running/error) | Cambio de estado |
| `server-info` | `{ local_url, lan_url, lan_ip, qr_path }` | Info del servidor corriendo |

## 🎨 Componentes React

### App.tsx (Componente Principal)

**Estado Local:**
```typescript
- status: ServerStatus                    // Estado del servidor
- logs: LogEntry[]                        // Historial de logs
- serverInfo: ServerInfo | null           // URLs e IP cuando está corriendo
- settings: AppSettings | null            // Configuración actual
- showSettings: boolean                   // Modal de config visible
- copied: boolean                         // Feedback "URL copiada"
```

**Componentes:**
1. **App**: Dashboard principal
2. **SettingsPanel**: Modal de configuración
3. **InfoCard**: Card reutilizable para mostrar info

**Hooks:**
- `useEffect` para auto-scroll de logs
- `useEffect` para cargar settings y escuchar eventos
- `useState` para gestión de estado local

## 🔒 Seguridad

### Permisos de Tauri

```json
{
  "shell": { "open": true },           // Abrir URLs y archivos
  "dialog": { "open": true, "save": true },  // Diálogos de archivo
  "clipboard": { "all": true },        // Copiar al portapapeles
  "fs": {                              // Sistema de archivos (limitado)
    "scope": ["$APPDATA/*", "$RESOURCE/*", "$TEMP/*"]
  },
  "path": { "all": true },             // Rutas del sistema
  "os": { "all": true }                // Info del OS
}
```

### Datos Almacenados

- **Ubicación**: `%APPDATA%\chavalos-server\settings.json`
- **Contenido**: Solo configuración (rutas, puerto, preferencias)
- **Sin credenciales**: No se guardan contraseñas

## 📦 Salida del Build

### MSI Installer
```
Chavalos Server_1.0.0_x64_es-MX.msi
├── Tamaño: ~8-12 MB
├── Requiere: .NET Framework (Windows 10/11 incluyen)
├── Instalación: Interfaz gráfica estándar de Windows
└── Crea:
    ├── Acceso directo en escritorio (opcional)
    ├── Acceso directo en menú inicio
    ├── Entrada en "Programas y características"
    └── Desinstalador automático
```

### NSIS Executable (alternativo)
```
Chavalos Server_1.0.0_x64-setup.exe
├── Tamaño: ~8-12 MB
├── Instalación: Wizard personalizable
└── Más flexible pero menos "nativo" que MSI
```

## 🚀 Proceso de Compilación

### Tiempos Aproximados

| Tarea | Primera Vez | Subsiguientes |
|-------|-------------|---------------|
| `npm install` | 2-3 min | 10-30 seg |
| `npm run build` (frontend) | 30-60 seg | 20-40 seg |
| `cargo build --release` (Rust) | 10-20 min | 2-5 min |
| **Total** | **15-25 min** | **3-6 min** |

### Dependencias Críticas

**Rust:**
- `tauri` (framework principal)
- `serde` + `serde_json` (serialización)
- `tokio` (async runtime)
- `clipboard-win` (portapapeles Windows)

**Node:**
- `@tauri-apps/api` (comunicación frontend-backend)
- `react` + `react-dom` (UI)
- `lucide-react` (iconos)
- `vite` (bundler)

## 🔄 Ciclo de Vida del Servidor

```
┌─────────────────────────────────────────────────────┐
│                  [STOPPED]                          │
│  - No hay procesos corriendo                        │
│  - UI: Botón "Iniciar" habilitado                  │
└────────────────┬────────────────────────────────────┘
                 │ User: Iniciar
                 ↓
┌─────────────────────────────────────────────────────┐
│                 [STARTING]                          │
│  - PowerShell ejecutándose                          │
│  - Logs streameando                                 │
│  - Verificando Docker, PostgreSQL, IP               │
│  - UI: Spinner, botones deshabilitados             │
└────────────────┬────────────────────────────────────┘
                 │ Script completa
                 ↓
┌─────────────────────────────────────────────────────┐
│                 [RUNNING]                           │
│  - Next.js sirviendo en 0.0.0.0:3000               │
│  - PostgreSQL en localhost:5432                     │
│  - UI: Info de red visible, botón "Detener"       │
│  - Logs continúan en tiempo real                   │
└────────────────┬────────────────────────────────────┘
                 │ User: Detener
                 ↓
┌─────────────────────────────────────────────────────┐
│                [STOPPING]                           │
│  - Matando proceso PowerShell                       │
│  - docker compose down                              │
│  - Cleanup de procesos                              │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
              [STOPPED]
```

## 🐛 Manejo de Errores

### Niveles de Error

1. **Informativo** (Gray): Progreso normal
2. **Warning** (Yellow): Cosas opcionales que fallaron (firewall, QR)
3. **Error** (Red): Fallas críticas (Docker no disponible, script no encontrado)
4. **Success** (Green): Hitos completados

### Estrategia de Recovery

- **Docker no disponible**: Detiene ejecución, muestra error claro
- **PostgreSQL no responde**: Timeout de 30s, luego falla con mensaje
- **IP LAN no detectada**: Continúa, pero sin acceso móvil
- **Firewall falla**: Warning, pero servidor funciona (puede requerir config manual)
- **QR no genera**: Warning, muestra URL en texto

## 📊 Métricas del Proyecto

### Líneas de Código (aproximado)

| Archivo | LOC | Descripción |
|---------|-----|-------------|
| `src/App.tsx` | ~600 | UI React completa |
| `src-tauri/src/main.rs` | ~400 | Backend Rust |
| `server-launcher.ps1` | ~350 | Script PowerShell |
| Configuración | ~200 | JSON, TOML, TS configs |
| **Total** | **~1550** | Código productivo |

### Tamaño de Archivos

| Componente | Tamaño |
|------------|--------|
| Instalador MSI | 8-12 MB |
| Ejecutable (.exe) | 5-7 MB |
| Assets (iconos) | <1 MB |
| Dependencias (node_modules) | ~150 MB |
| Target Rust (compilado) | ~500 MB |

## 🎯 Próximos Pasos Sugeridos

### Mejoras Futuras

1. **Health Check Activo**
   - Ping a localhost:3000 cada 2s
   - Mostrar "● Online" / "● Offline"
   - Alert si el servidor cae inesperadamente

2. **Auto-Update**
   - Integrar Tauri Updater
   - Notificar nuevas versiones
   - Actualización con un clic

3. **Multi-Instancia**
   - Detectar si ya hay una instancia corriendo
   - Prevenir múltiples servidores en mismo puerto
   - Single instance lock

4. **Logs Mejorados**
   - Filtro por nivel (mostrar solo errores, etc.)
   - Búsqueda en logs
   - Límite de historial (últimos 500 logs)

5. **Iconos Personalizados**
   - Diseño profesional para la ferretería
   - Tema de colores corporativo

6. **Estadísticas**
   - Tiempo de actividad (uptime)
   - Número de reinicios
   - Última vez iniciado

7. **Modo Portable**
   - Opción de instalación sin instalador
   - Ejecutable único con configuración relativa

## 📚 Referencias

### Documentación Oficial

- **Tauri**: https://tauri.app/
- **Rust**: https://doc.rust-lang.org/
- **React**: https://react.dev/
- **Vite**: https://vitejs.dev/

### Troubleshooting Links

- **Windows Build Tools**: https://visualstudio.microsoft.com/downloads/
- **Rust Install**: https://rustup.rs/
- **Node.js**: https://nodejs.org/
- **Docker Desktop**: https://docker.com/products/docker-desktop

## 🤝 Créditos

**Desarrollado para**: Ferretería Chavalos  
**Desarrollador**: Aquiles  
**Framework**: Tauri + React + Rust  
**Fecha**: Enero 2026  
**Versión**: 1.0.0  

---

## 📝 Notas Finales

Este proyecto es **completamente funcional** y listo para usar.

**Para empezar:**
```powershell
cd ChavalosServerApp
.\setup.ps1
```

**Para desarrollar:**
```powershell
.\dev.ps1
```

**Para distribuir:**
```powershell
.\build.ps1
```

La app está diseñada para ser **mantenible**, **extensible** y **fácil de usar** incluso para personas sin conocimientos técnicos.

Todos los scripts incluyen mensajes claros, logs detallados y manejo de errores robusto.

---

**¡Éxito con tu proyecto!** 🚀
