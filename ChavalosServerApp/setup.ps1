# Setup Completo - Chavalos Server App
# Instala todas las dependencias y prepara el proyecto

# Agregar Rust al PATH si no está disponible
if (!(Get-Command rustc -ErrorAction SilentlyContinue)) {
    $env:Path += ";$env:USERPROFILE\.cargo\bin"
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                            ║" -ForegroundColor Cyan
Write-Host "║   🏪 CHAVALOS SERVER APP - SETUP          ║" -ForegroundColor Cyan
Write-Host "║   Instalación y Configuración Inicial     ║" -ForegroundColor Cyan
Write-Host "║                                            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# ========================================
# VERIFICAR PREREQUISITOS
# ========================================

Write-Host "[1/7] Verificando prerequisitos..." -ForegroundColor Yellow
Write-Host ""

$allOk = $true

# Node.js
Write-Host "  Verificando Node.js..." -NoNewline
try {
    $nodeVersion = node --version 2>&1
    if ($nodeVersion -match "v\d+\.\d+\.\d+") {
        Write-Host " ✅ $nodeVersion" -ForegroundColor Green
    } else {
        throw "Version no válida"
    }
} catch {
    Write-Host " ❌ NO ENCONTRADO" -ForegroundColor Red
    Write-Host "     Descarga e instala Node.js desde: https://nodejs.org" -ForegroundColor Yellow
    Write-Host "     Recomendado: Versión LTS (18.x o superior)" -ForegroundColor Gray
    $allOk = $false
}

# npm
Write-Host "  Verificando npm..." -NoNewline
try {
    $npmVersion = npm --version 2>&1
    Write-Host " ✅ v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host " ❌ NO ENCONTRADO" -ForegroundColor Red
    $allOk = $false
}

# Rust
Write-Host "  Verificando Rust..." -NoNewline
try {
    $rustVersion = rustc --version 2>&1
    if ($rustVersion -match "rustc \d+\.\d+\.\d+") {
        Write-Host " ✅ $rustVersion" -ForegroundColor Green
    } else {
        throw "Version no válida"
    }
} catch {
    Write-Host " ❌ NO ENCONTRADO" -ForegroundColor Red
    Write-Host "     Instala Rust con: winget install Rustlang.Rustup" -ForegroundColor Yellow
    Write-Host "     O descarga desde: https://rustup.rs" -ForegroundColor Gray
    $allOk = $false
}

# Cargo
Write-Host "  Verificando Cargo..." -NoNewline
try {
    $cargoVersion = cargo --version 2>&1
    Write-Host " ✅ $cargoVersion" -ForegroundColor Green
} catch {
    Write-Host " ❌ NO ENCONTRADO" -ForegroundColor Red
    $allOk = $false
}

# Docker
Write-Host "  Verificando Docker..." -NoNewline
try {
    docker --version 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $dockerVersion = docker --version
        Write-Host " ✅ $dockerVersion" -ForegroundColor Green
    } else {
        throw "Docker no responde"
    }
} catch {
    Write-Host " ⚠️  NO DISPONIBLE" -ForegroundColor Yellow
    Write-Host "     Docker es necesario para ejecutar el servidor" -ForegroundColor Gray
    Write-Host "     Descarga Docker Desktop desde: https://docker.com" -ForegroundColor Gray
}

Write-Host ""

if (-not $allOk) {
    Write-Host "❌ Faltan prerequisitos. Instálalos y vuelve a ejecutar este script." -ForegroundColor Red
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host "✅ Todos los prerequisitos están instalados" -ForegroundColor Green
Write-Host ""

# ========================================
# INSTALAR DEPENDENCIAS
# ========================================

Write-Host "[2/7] Instalando dependencias de Node.js..." -ForegroundColor Yellow
Write-Host "Esto puede tomar varios minutos..." -ForegroundColor Gray
Write-Host ""

npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Error instalando dependencias de Node.js" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host ""
Write-Host "✅ Dependencias de Node.js instaladas" -ForegroundColor Green
Write-Host ""

# ========================================
# VERIFICAR ESTRUCTURA
# ========================================

Write-Host "[3/7] Verificando estructura del proyecto..." -ForegroundColor Yellow
Write-Host ""

$requiredFiles = @(
    "package.json",
    "vite.config.ts",
    "tsconfig.json",
    "src\App.tsx",
    "src-tauri\Cargo.toml",
    "src-tauri\tauri.conf.json",
    "src-tauri\src\main.rs",
    "server-launcher.ps1"
)

$allFilesOk = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file (FALTANTE)" -ForegroundColor Red
        $allFilesOk = $false
    }
}

Write-Host ""

if (-not $allFilesOk) {
    Write-Host "❌ Faltan archivos del proyecto" -ForegroundColor Red
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host "✅ Estructura del proyecto correcta" -ForegroundColor Green
Write-Host ""

# ========================================
# CONFIGURAR ICONOS
# ========================================

Write-Host "[4/7] Configurando iconos..." -ForegroundColor Yellow
Write-Host ""

$iconsDir = "src-tauri\icons"
if (!(Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
    Write-Host "  📁 Carpeta de iconos creada" -ForegroundColor Gray
}

# Check if icons exist
$hasIcons = (Test-Path "$iconsDir\icon.ico") -or (Test-Path "$iconsDir\icon.png")

if (-not $hasIcons) {
    Write-Host "  ⚠️  No se encontraron iconos personalizados" -ForegroundColor Yellow
    Write-Host "     Se usarán los iconos por defecto de Tauri" -ForegroundColor Gray
    Write-Host "     Para agregar iconos personalizados:" -ForegroundColor Gray
    Write-Host "       1. Crea un PNG de 1024x1024" -ForegroundColor Gray
    Write-Host "       2. Ejecuta: npm run tauri icon tu-icono.png" -ForegroundColor Gray
} else {
    Write-Host "  ✅ Iconos encontrados" -ForegroundColor Green
}

Write-Host ""

# ========================================
# COMPILAR RUST (opcional)
# ========================================

Write-Host "[5/7] Verificando compilación de Rust..." -ForegroundColor Yellow
Write-Host "Esta es una verificación opcional (puede tardar)" -ForegroundColor Gray
Write-Host ""

$testRust = Read-Host "¿Ejecutar test de compilación Rust? (S/N) [N]"

if ($testRust -eq "S" -or $testRust -eq "s") {
    Write-Host ""
    Write-Host "  Compilando backend Rust (puede tardar 5-10 min)..." -ForegroundColor Gray
    
    Push-Location "src-tauri"
    cargo check
    $cargoResult = $LASTEXITCODE
    Pop-Location
    
    Write-Host ""
    if ($cargoResult -eq 0) {
        Write-Host "  ✅ Rust compila correctamente" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Hubo problemas compilando Rust" -ForegroundColor Yellow
        Write-Host "     Esto puede deberse a dependencias faltantes" -ForegroundColor Gray
        Write-Host "     Instala Visual Studio Build Tools:" -ForegroundColor Gray
        Write-Host "       winget install Microsoft.VisualStudio.2022.BuildTools" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⏭️  Test de Rust omitido" -ForegroundColor Gray
}

Write-Host ""

# ========================================
# VERIFICAR PROYECTO PRINCIPAL
# ========================================

Write-Host "[6/7] Verificando proyecto principal..." -ForegroundColor Yellow
Write-Host ""

$projectPath = "D:\Aquiles\Tienda_Chavalos_Virtual_web"
$nextPath = Join-Path $projectPath "Frontend\NextJS_React\web"
$dockerPath = Join-Path $projectPath "Despliegue\Hosting\postgres-local"

if (Test-Path $projectPath) {
    Write-Host "  ✅ Proyecto principal encontrado" -ForegroundColor Green
    Write-Host "     Ubicación: $projectPath" -ForegroundColor Gray
    
    if (Test-Path $nextPath) {
        Write-Host "  ✅ Proyecto Next.js encontrado" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Proyecto Next.js no encontrado en ruta esperada" -ForegroundColor Yellow
    }
    
    if (Test-Path $dockerPath) {
        Write-Host "  ✅ Docker Compose encontrado" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Docker Compose no encontrado en ruta esperada" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠️  Proyecto principal no encontrado en ruta por defecto" -ForegroundColor Yellow
    Write-Host "     Ruta esperada: $projectPath" -ForegroundColor Gray
    Write-Host "     Podrás configurarlo desde la app" -ForegroundColor Gray
}

Write-Host ""

# ========================================
# RESUMEN
# ========================================

Write-Host "[7/7] ✅ SETUP COMPLETADO" -ForegroundColor Green
Write-Host ""
Write-Host "╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         🎉 TODO LISTO PARA USAR           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

Write-Host "📚 SIGUIENTES PASOS:" -ForegroundColor White
Write-Host ""

Write-Host "1️⃣  MODO DESARROLLO (Recomendado para probar):" -ForegroundColor Yellow
Write-Host "   .\dev.ps1" -ForegroundColor White
Write-Host "   - Hot reload habilitado" -ForegroundColor Gray
Write-Host "   - DevTools disponibles" -ForegroundColor Gray
Write-Host "   - Perfecto para desarrollo" -ForegroundColor Gray
Write-Host ""

Write-Host "2️⃣  COMPILAR INSTALADOR (Para distribución):" -ForegroundColor Yellow
Write-Host "   .\build.ps1" -ForegroundColor White
Write-Host "   - Genera archivo MSI" -ForegroundColor Gray
Write-Host "   - Listo para instalar en otras PCs" -ForegroundColor Gray
Write-Host "   - Tarda 15-20 minutos la primera vez" -ForegroundColor Gray
Write-Host ""

Write-Host "3️⃣  LEER DOCUMENTACIÓN:" -ForegroundColor Yellow
Write-Host "   README.md              - Documentación completa" -ForegroundColor Gray
Write-Host "   QUICKSTART.md          - Guía rápida" -ForegroundColor Gray
Write-Host "   INSTRUCCIONES_MAMA.md  - Instrucciones para usuarios finales" -ForegroundColor Gray
Write-Host ""

Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "💡 TIP: Si algo no funciona:" -ForegroundColor Cyan
Write-Host "   - Revisa que Docker Desktop esté corriendo" -ForegroundColor Gray
Write-Host "   - Verifica que Node.js y Rust estén en el PATH" -ForegroundColor Gray
Write-Host "   - Consulta el README.md para troubleshooting" -ForegroundColor Gray
Write-Host ""

$startDev = Read-Host "¿Quieres iniciar en modo desarrollo ahora? (S/N) [N]"

if ($startDev -eq "S" -or $startDev -eq "s") {
    Write-Host ""
    Write-Host "🚀 Iniciando modo desarrollo..." -ForegroundColor Green
    Write-Host ""
    .\dev.ps1
} else {
    Write-Host ""
    Write-Host "👋 ¡Hasta pronto! Ejecuta .\dev.ps1 cuando estés listo." -ForegroundColor Cyan
    Write-Host ""
}
