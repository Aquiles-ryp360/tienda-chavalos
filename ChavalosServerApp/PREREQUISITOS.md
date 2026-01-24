# 🛠️ Instalación de Prerequisitos

Esta guía te ayudará a instalar todo lo necesario para compilar y ejecutar la aplicación Chavalos Server.

## 📋 Lista de Prerequisitos

- ✅ **Node.js** (v18+)
- ✅ **Rust** (v1.70+)
- ✅ **Visual Studio Build Tools** (para compilar Rust en Windows)
- ✅ **Docker Desktop** (para ejecutar el servidor)
- ✅ **Git** (opcional, para clonar el proyecto)

---

## 🟢 Node.js

### Instalación con winget (Recomendado)

```powershell
winget install OpenJS.NodeJS.LTS
```

### Instalación Manual

1. Ve a: https://nodejs.org/
2. Descarga la versión **LTS** (Long Term Support)
3. Ejecuta el instalador
4. Sigue el wizard (Next → Next → Install)

### Verificar Instalación

```powershell
node --version
# Debe mostrar: v18.x.x o superior

npm --version
# Debe mostrar: 9.x.x o superior
```

---

## 🦀 Rust

### Instalación con winget (Más fácil)

```powershell
winget install Rustlang.Rustup
```

**Después de instalar, CIERRA Y REABRE el terminal.**

### Instalación Manual

1. Ve a: https://rustup.rs/
2. Descarga `rustup-init.exe`
3. Ejecuta el instalador
4. Presiona **Enter** para instalación por defecto
5. Espera a que complete (puede tardar 5-10 minutos)

### Verificar Instalación

```powershell
rustc --version
# Debe mostrar: rustc 1.7x.x

cargo --version
# Debe mostrar: cargo 1.7x.x
```

---

## 🔨 Visual Studio Build Tools

**IMPORTANTE**: Rust en Windows requiere herramientas de compilación de C++.

### Instalación con winget

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```

**Después de la instalación:**
1. Abre "Visual Studio Installer"
2. Clic en "Modify" (Modificar)
3. Selecciona: **"Desktop development with C++"**
4. Clic en "Install" (puede tardar 20-30 minutos)

### Instalación Manual

1. Ve a: https://visualstudio.microsoft.com/downloads/
2. Desplázate a "Tools for Visual Studio"
3. Descarga **"Build Tools for Visual Studio 2022"**
4. Ejecuta el instalador
5. Selecciona: **"Desktop development with C++"**
6. Instala (tarda ~30 minutos, descarga ~6 GB)

### Componentes Mínimos Requeridos

Asegúrate de que estos estén marcados:
- ✅ MSVC v143 - VS 2022 C++ x64/x86 build tools
- ✅ Windows 10/11 SDK
- ✅ C++ CMake tools for Windows

---

## 🐳 Docker Desktop

### Instalación con winget

```powershell
winget install Docker.DockerDesktop
```

### Instalación Manual

1. Ve a: https://www.docker.com/products/docker-desktop
2. Descarga Docker Desktop para Windows
3. Ejecuta el instalador
4. Sigue el wizard
5. **REINICIA** la computadora cuando te lo pida

### Primera Ejecución

1. Abre Docker Desktop desde el menú inicio
2. Acepta los términos de servicio
3. Puedes omitir el tutorial
4. Espera a que el ícono en la bandeja esté **verde**

### Verificar Instalación

```powershell
docker --version
# Debe mostrar: Docker version 24.x.x

docker compose version
# Debe mostrar: Docker Compose version v2.x.x
```

---

## 🎨 Git (Opcional)

Solo necesario si vas a clonar el repositorio.

### Instalación con winget

```powershell
winget install Git.Git
```

### Instalación Manual

1. Ve a: https://git-scm.com/downloads
2. Descarga Git para Windows
3. Ejecuta el instalador (usa opciones por defecto)

### Verificar Instalación

```powershell
git --version
# Debe mostrar: git version 2.x.x
```

---

## ✅ Verificación Completa

Ejecuta este script para verificar que todo está instalado:

```powershell
# Guardar como: check-prerequisites.ps1

Write-Host "Verificando prerequisitos..." -ForegroundColor Cyan
Write-Host ""

$allOk = $true

# Node.js
Write-Host "Node.js: " -NoNewline
try {
    $nodeVersion = node --version
    Write-Host "✅ $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ NO INSTALADO" -ForegroundColor Red
    Write-Host "   Instala con: winget install OpenJS.NodeJS.LTS" -ForegroundColor Yellow
    $allOk = $false
}

# npm
Write-Host "npm: " -NoNewline
try {
    $npmVersion = npm --version
    Write-Host "✅ v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ NO INSTALADO" -ForegroundColor Red
    $allOk = $false
}

# Rust
Write-Host "Rust: " -NoNewline
try {
    $rustVersion = rustc --version
    Write-Host "✅ $rustVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ NO INSTALADO" -ForegroundColor Red
    Write-Host "   Instala con: winget install Rustlang.Rustup" -ForegroundColor Yellow
    $allOk = $false
}

# Cargo
Write-Host "Cargo: " -NoNewline
try {
    $cargoVersion = cargo --version
    Write-Host "✅ $cargoVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ NO INSTALADO" -ForegroundColor Red
    $allOk = $false
}

# Docker
Write-Host "Docker: " -NoNewline
try {
    docker version *> $null
    if ($LASTEXITCODE -eq 0) {
        $dockerVersion = docker --version
        Write-Host "✅ $dockerVersion" -ForegroundColor Green
    } else {
        throw
    }
} catch {
    Write-Host "❌ NO DISPONIBLE" -ForegroundColor Red
    Write-Host "   Instala Docker Desktop: winget install Docker.DockerDesktop" -ForegroundColor Yellow
    Write-Host "   Y asegúrate de que esté corriendo" -ForegroundColor Yellow
    $allOk = $false
}

Write-Host ""
if ($allOk) {
    Write-Host "🎉 ¡Todos los prerequisitos están instalados!" -ForegroundColor Green
    Write-Host "Ya puedes ejecutar: .\setup.ps1" -ForegroundColor Cyan
} else {
    Write-Host "❌ Faltan algunos prerequisitos. Instálalos y vuelve a ejecutar este script." -ForegroundColor Red
}
```

---

## 🚀 Próximos Pasos

Una vez que todos los prerequisitos estén instalados:

### 1. Navega al proyecto

```powershell
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp
```

### 2. Ejecuta el setup

```powershell
.\setup.ps1
```

Este script:
- ✅ Verifica todos los prerequisitos
- ✅ Instala dependencias de Node
- ✅ Verifica la estructura del proyecto
- ✅ Comprueba que Rust compile correctamente
- ✅ Te guía para los siguientes pasos

### 3. Inicia en modo desarrollo

```powershell
.\dev.ps1
```

---

## 🐛 Problemas Comunes

### "rustc no se reconoce como comando"

**Causa**: Rust no está en el PATH.

**Solución**:
1. Cierra TODAS las ventanas de PowerShell/Terminal
2. Abre una nueva ventana
3. Intenta de nuevo

Si persiste:
1. Busca "Edit environment variables" en Windows
2. En "User variables", busca `Path`
3. Verifica que exista: `%USERPROFILE%\.cargo\bin`
4. Si no, agrégalo
5. Reinicia el terminal

### "docker: command not found"

**Causa**: Docker Desktop no está corriendo.

**Solución**:
1. Abre Docker Desktop desde el menú inicio
2. Espera a que el ícono en la bandeja esté verde
3. Intenta de nuevo

### "link.exe not found" al compilar Rust

**Causa**: Visual Studio Build Tools no está instalado o no tiene C++.

**Solución**:
1. Instala Visual Studio Build Tools (ver arriba)
2. Asegúrate de seleccionar "Desktop development with C++"
3. Reinicia el terminal
4. Intenta de nuevo

### Error: "PowerShell execution policy"

**Causa**: Windows bloquea la ejecución de scripts.

**Solución**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📦 Tamaños de Descarga

| Componente | Tamaño |
|------------|--------|
| Node.js | ~50 MB |
| Rust (rustup-init) | ~10 MB |
| Rust (toolchain completa) | ~500 MB |
| VS Build Tools | ~6 GB |
| Docker Desktop | ~500 MB |
| **Total** | **~7 GB** |

**Tiempo de instalación total**: 1-2 horas (dependiendo de conexión a internet)

---

## 💡 Tips

### Para Desarrolladores Nuevos en Rust

1. **No te asustes por el tiempo de compilación**: La primera vez tarda mucho, luego es más rápido
2. **Rust es estricto**: Si compila, generalmente funciona bien
3. **Documentación oficial**: https://doc.rust-lang.org/book/

### Para Acelerar Compilaciones Rust

Edita `~/.cargo/config.toml` (crea el archivo si no existe):

```toml
[build]
jobs = 4  # Usa 4 cores (ajusta según tu CPU)

[target.x86_64-pc-windows-msvc]
rustflags = ["-C", "link-arg=/INCREMENTAL"]
```

---

## 🆘 Ayuda Adicional

Si tienes problemas con la instalación:

1. **Revisa los logs de error** cuidadosamente
2. **Busca el error en Google** (copy-paste el mensaje)
3. **Stack Overflow** tiene soluciones para la mayoría de errores
4. **Contacta al desarrollador** (Aquiles)

---

**¡Buena suerte con la instalación!** 🚀
