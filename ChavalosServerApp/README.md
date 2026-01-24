# 🏪 Chavalos Server App

**Aplicación de escritorio para gestionar el servidor de la Ferretería Chavalos**

Una interfaz gráfica moderna y fácil de usar que permite iniciar, detener y monitorear el servidor web Next.js + PostgreSQL con un solo clic.

![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-1.0.0-orange)

## ✨ Características

### 🎯 Funcionalidades Principales
- **Inicio con un clic**: Arranca todo el stack (Docker PostgreSQL + Next.js) automáticamente
- **Interfaz intuitiva**: Dashboard visual con estado en tiempo real
- **Logs en vivo**: Visualiza toda la actividad del servidor con colores y timestamps
- **Acceso LAN automático**: Detecta la IP local y genera código QR para acceso móvil
- **Sistema de bandeja**: Minimiza a tray, el servidor sigue corriendo en segundo plano
- **Control completo**: Iniciar, detener y reiniciar con botones dedicados

### 🔧 Características Técnicas
- **Sin consola**: No requiere conocimientos técnicos
- **Persistencia de configuración**: Guarda preferencias y rutas del proyecto
- **Health checks**: Verifica que los servicios estén funcionando
- **Gestión de firewall**: Configura reglas automáticamente (con permisos admin)
- **Exportar logs**: Guarda el historial de actividad en archivos `.txt`

## 📋 Requisitos

### Para Usuarios (Instalación del MSI)
- Windows 10/11 (64-bit)
- Docker Desktop instalado y corriendo
- Node.js 18+ instalado
- 200 MB de espacio en disco

### Para Desarrolladores (Build desde código)
Además de lo anterior:
- Rust 1.70+ ([Instalar desde rustup.rs](https://rustup.rs))
- Visual Studio C++ Build Tools o Visual Studio 2022
- Git

## 🚀 Instalación Rápida (Para Tu Mamá)

### Opción 1: Instalador MSI (Recomendado)

1. **Descarga el instalador**
   - Ubica el archivo: `Chavalos Server_1.0.0_x64_es-MX.msi`
   - Tamaño aproximado: 8-12 MB

2. **Ejecuta el instalador**
   - Doble clic en el archivo `.msi`
   - Sigue el asistente (Next → Next → Install)
   - Acepta el UAC (User Account Control) si aparece

3. **Inicia la aplicación**
   - Busca "Chavalos Server" en el menú inicio
   - O usa el acceso directo en el escritorio

4. **Primera configuración**
   - Al abrir por primera vez, ve a ⚙️ **Configuración**
   - Haz clic en **Buscar** junto a "Ruta del Proyecto"
   - Selecciona la carpeta: `D:\Aquiles\Tienda_Chavalos_Virtual_web`
   - Guarda los cambios

5. **¡Listo! Presiona Iniciar** 🚀

### Opción 2: Ejecutar desde Código (Desarrollo)

```powershell
# 1. Navega a la carpeta del proyecto
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp

# 2. Ejecuta el script de desarrollo
.\dev.ps1
```

## 📖 Guía de Uso

### Interfaz Principal

```
┌─────────────────────────────────────────────────────────────┐
│  🏪 Ferretería Chavalos                      [⚙️ Configuración] │
│  Servidor de Gestión                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [●] Estado del Servidor                                   │
│      En ejecución                                          │
│                                                             │
│      [Iniciar]  [Detener]  [Reiniciar]                    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 🌐 URL Local: http://localhost:3000                   │ │
│  │ 📱 IP LAN: 192.168.1.10                               │ │
│  │                                                        │ │
│  │ [Abrir en navegador]  [Copiar]  [📱 QR]              │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  📋 Registro de Actividad          [Exportar]             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ [14:23:45] [INFO] Iniciando servidor...               │ │
│  │ [14:23:47] [INFO] ✅ Docker está disponible           │ │
│  │ [14:23:50] [INFO] ✅ PostgreSQL listo                 │ │
│  │ [14:23:52] [INFO] ✅ IP LAN: 192.168.1.10             │ │
│  │ [14:23:55] [SUCCESS] Servidor iniciado correctamente  │ │
│  │                                                        │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Controles Principales

#### Botón INICIAR
- Arranca PostgreSQL (Docker Compose)
- Detecta IP LAN automáticamente
- Configura firewall (si es admin)
- Genera código QR
- Inicia Next.js en modo dev/prod

#### Botón DETENER
- Detiene Next.js de forma segura
- Apaga el contenedor de PostgreSQL
- Limpia procesos relacionados

#### Botón REINICIAR
- Equivale a Detener + Iniciar
- Útil para aplicar cambios

#### Botón ABRIR EN NAVEGADOR
- Abre `http://localhost:3000` en el navegador predeterminado

#### Botón 📱 QR
- Muestra el código QR generado
- Para escanear desde móviles en la misma red

#### Botón EXPORTAR
- Guarda los logs en un archivo `.txt`
- Útil para reportar problemas

### Sistema de Bandeja (Tray)

Al cerrar la ventana, la app NO se cierra completamente. Se minimiza a la bandeja del sistema.

**Para acceder:**
- Busca el ícono de Chavalos Server en la bandeja (esquina inferior derecha)
- Clic derecho para ver el menú:
  - **Mostrar**: Abre la ventana principal
  - **Iniciar Servidor**: Inicia el servidor (si está detenido)
  - **Detener Servidor**: Detiene el servidor (si está corriendo)
  - **Salir**: Cierra completamente la aplicación

> ⚠️ **IMPORTANTE**: Si cierras desde "Salir", el servidor se detendrá también.

### Panel de Configuración

Accede con el botón ⚙️ en la esquina superior derecha.

**Opciones disponibles:**

| Opción | Descripción | Valor Predeterminado |
|--------|-------------|---------------------|
| **Ruta del Proyecto** | Ubicación del proyecto Chavalos | `D:\Aquiles\Tienda_Chavalos_Virtual_web` |
| **Puerto** | Puerto del servidor Next.js | `3000` |
| **Modo de Ejecución** | `dev` (desarrollo) o `prod` (producción) | `dev` |
| **Iniciar minimizado** | La app inicia directamente en la bandeja | ❌ Desactivado |
| **Iniciar con Windows** | Ejecuta automáticamente al encender la PC | ❌ Desactivado |

## 🛠️ Desarrollo

### Estructura del Proyecto

```
ChavalosServerApp/
├── src/                       # Frontend React
│   ├── App.tsx               # Componente principal
│   ├── App.css               # Estilos
│   └── main.tsx              # Entry point
├── src-tauri/                # Backend Rust
│   ├── src/
│   │   └── main.rs          # Lógica principal (comandos Tauri)
│   ├── Cargo.toml           # Dependencias Rust
│   ├── tauri.conf.json      # Configuración Tauri
│   └── icons/               # Iconos de la app
├── server-launcher.ps1       # Script PowerShell mejorado
├── build.ps1                 # Script para compilar MSI
├── dev.ps1                   # Script para modo desarrollo
├── package.json              # Dependencias Node
└── README.md                 # Esta documentación
```

### Comandos de Desarrollo

```powershell
# Instalar dependencias
npm install

# Modo desarrollo (hot reload)
npm run tauri:dev
# O usar el script:
.\dev.ps1

# Compilar para producción (genera MSI)
npm run tauri:build
# O usar el script:
.\build.ps1

# Solo frontend (testing)
npm run dev

# Limpiar build
Remove-Item -Recurse -Force .\src-tauri\target
```

### Build del Instalador

El proceso completo toma **15-20 minutos** la primera vez (Rust compila todas las dependencias):

```powershell
# Ejecuta el script de build
.\build.ps1
```

**Output esperado:**
```
src-tauri/target/release/bundle/
├── msi/
│   ├── Chavalos Server_1.0.0_x64_es-MX.msi  ← ESTE ES EL INSTALADOR
│   └── (otros archivos internos)
└── nsis/
    └── Chavalos Server_1.0.0_x64-setup.exe  ← Alternativo
```

### Personalización

#### Cambiar Íconos

Reemplaza los archivos en `src-tauri/icons/`:
- `icon.ico` (Windows)
- `icon.png` (Tray icon)
- `32x32.png`, `128x128.png`, etc.

Regenera automáticamente con:
```powershell
npm run tauri icon path/to/your/icon.png
```

#### Modificar Colores/Estilos

Edita [src/App.css](src/App.css) y los estilos inline en [src/App.tsx](src/App.tsx).

Colores actuales:
- Primary: `#667eea` (Azul)
- Secondary: `#764ba2` (Morado)
- Success: `#10b981` (Verde)
- Warning: `#f59e0b` (Naranja)
- Error: `#ef4444` (Rojo)

#### Agregar Nuevos Comandos

1. **Define el comando en Rust** ([src-tauri/src/main.rs](src-tauri/src/main.rs)):
```rust
#[tauri::command]
fn my_command(param: String) -> Result<String, String> {
    // Tu lógica aquí
    Ok(format!("Procesado: {}", param))
}

// Registra en el handler
.invoke_handler(tauri::generate_handler![
    // ... comandos existentes
    my_command,
])
```

2. **Llama desde React** ([src/App.tsx](src/App.tsx)):
```typescript
import { invoke } from '@tauri-apps/api/tauri';

const handleMyAction = async () => {
    try {
        const result = await invoke<string>('my_command', { param: 'test' });
        console.log(result);
    } catch (error) {
        console.error(error);
    }
};
```

### Debugging

#### Logs de Rust
En modo desarrollo, los logs aparecen en la consola del terminal donde ejecutaste `npm run tauri:dev`.

#### Logs de React
Abre DevTools con `F12` (solo en modo desarrollo).

#### Logs de PowerShell
Se capturan y muestran en tiempo real en el panel de "Registro de Actividad".

Para debug manual:
```powershell
# Ejecuta el script directamente
.\server-launcher.ps1 -ProjectPath "D:\Aquiles\Tienda_Chavalos_Virtual_web" -Mode dev -Port 3000
```

## 🐛 Solución de Problemas

### "Docker NO está disponible"
**Causa**: Docker Desktop no está corriendo.

**Solución**:
1. Abre Docker Desktop desde el menú inicio
2. Espera a que el ícono de Docker en la bandeja esté verde
3. Intenta nuevamente

### "No se detectó IP LAN"
**Causa**: No estás conectado a una red local.

**Solución**:
- Conéctate a Wi-Fi o Ethernet
- El servidor seguirá funcionando en `localhost:3000`
- El acceso móvil no estará disponible

### "Error iniciando PostgreSQL"
**Causa**: Puerto 5432 ocupado o problema con docker-compose.yml.

**Solución**:
```powershell
# Revisa contenedores corriendo
docker ps

# Detén todos los contenedores
docker stop $(docker ps -q)

# Intenta nuevamente
```

### "Firewall no configurado"
**Causa**: La app no tiene permisos de administrador.

**Solución**:
1. Cierra la app
2. Clic derecho en el acceso directo → "Ejecutar como administrador"
3. O configura manualmente:
   ```powershell
   New-NetFirewallRule -DisplayName "Chavalos Server" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000
   ```

### "Script no encontrado: server-launcher.ps1"
**Causa**: Ruta del proyecto incorrecta.

**Solución**:
1. Ve a ⚙️ Configuración
2. Verifica que la ruta apunte a: `D:\Aquiles\Tienda_Chavalos_Virtual_web`
3. Verifica que exista: `D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp\server-launcher.ps1`

### Build falla con error de Rust
**Causa**: Dependencias de C++ faltantes.

**Solución**:
```powershell
# Instala Visual Studio Build Tools
winget install Microsoft.VisualStudio.2022.BuildTools

# O descarga manualmente:
# https://visualstudio.microsoft.com/downloads/
# Selecciona "Desktop development with C++"
```

## 📦 Distribución

### Para entregar a usuarios finales:

1. **Compila el instalador**:
   ```powershell
   .\build.ps1
   ```

2. **Localiza el MSI**:
   ```
   src-tauri\target\release\bundle\msi\Chavalos Server_1.0.0_x64_es-MX.msi
   ```

3. **Comparte el archivo**:
   - Por USB
   - Google Drive / OneDrive
   - Red local

4. **Instrucciones para el usuario**:
   > 1. Haz doble clic en el archivo `.msi`
   > 2. Sigue el asistente de instalación
   > 3. Busca "Chavalos Server" en el menú inicio
   > 4. La primera vez, configura la ruta del proyecto
   > 5. Presiona "Iniciar"

### Requisitos del usuario final:
- Docker Desktop instalado
- Node.js instalado
- Proyecto Chavalos en alguna carpeta del disco

## 🔐 Seguridad

### Permisos Requeridos

La app solicita:
- **Lectura/escritura de archivos**: Para configuración y logs
- **Ejecución de procesos**: Para correr PowerShell, Docker y Node
- **Acceso a red**: Para el servidor web
- **Modificar firewall** (opcional): Solo si se ejecuta como admin

### Datos Almacenados

**Ubicación**: `%APPDATA%\chavalos-server\settings.json`

**Contenido**:
```json
{
  "project_path": "D:\\Aquiles\\Tienda_Chavalos_Virtual_web",
  "port": 3000,
  "mode": "dev",
  "start_minimized": false,
  "auto_start": false
}
```

No se almacenan contraseñas ni datos sensibles.

## 🤝 Contribuciones

Si encuentras bugs o tienes sugerencias:

1. Abre un issue en el repositorio
2. O edita directamente los archivos:
   - UI: [src/App.tsx](src/App.tsx)
   - Backend: [src-tauri/src/main.rs](src-tauri/src/main.rs)
   - Script: [server-launcher.ps1](server-launcher.ps1)

## 📄 Licencia

MIT License - Puedes modificar y distribuir libremente.

## 📞 Soporte

**Desarrollador**: Aquiles  
**Proyecto**: Ferretería Chavalos - Tienda Virtual  
**Versión**: 1.0.0  
**Fecha**: Enero 2026  

---

## 🎉 ¡Disfruta tu nueva app!

Ahora tu mamá puede iniciar el servidor con un solo clic. Sin terminal, sin comandos, sin complicaciones. 

**¿Preguntas?** Revisa la sección de [Solución de Problemas](#-solución-de-problemas) o contacta al desarrollador.

---

**Made with ❤️ using Tauri + React**
