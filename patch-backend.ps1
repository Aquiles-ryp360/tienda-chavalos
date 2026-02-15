# patch-backend.ps1
# ============================================
# Parche rápido: Reconstruye SOLO el backend Next.js y lo copia a resources/
# Sin ofuscación, sin npm ci, sin copiar node.exe, sin docker-compose, sin prisma generate
# Tiempo estimado: ~30-60 segundos (vs 5-15 min del prepare-installer completo)
#
# USO:
#   .\patch-backend.ps1                  # Rebuild Next.js + copiar a resources
#   .\patch-backend.ps1 -SkipBuild       # Solo copiar (si ya hiciste npm run build manualmente)
#   .\patch-backend.ps1 -TauriOnly       # Solo compilar Tauri (sin tocar backend)
#   .\patch-backend.ps1 -Full            # Build + Tauri build (genera instalador)
#
# ¿CUÁNDO USAR CADA UNO?
# ┌──────────────────────────────────────┬─────────────────────────┐
# │ Cambio que hiciste                   │ Script a usar           │
# ├──────────────────────────────────────┼─────────────────────────┤
# │ Código frontend web (React/Next.js)  │ .\patch-backend.ps1     │
# │ Código lib/ (auth, sesión, etc.)     │ .\patch-backend.ps1     │
# │ API routes (app/api/*)               │ .\patch-backend.ps1     │
# │ CSS/estilos web                      │ .\patch-backend.ps1     │
# │ .env del backend                     │ .\patch-backend.ps1     │
# │ Solo código Tauri (Rust / React UI)  │ .\patch-backend.ps1 -TauriOnly │
# │ Hooks NSIS / tauri.conf.json         │ .\patch-backend.ps1 -TauriOnly │
# │ Componentes del panel Tauri (.tsx)   │ .\patch-backend.ps1 -TauriOnly │
# │ Agregar dependencia npm al backend   │ prepare-installer.ps1   │
# │ Cambiar schema.prisma (migraciones) │ prepare-installer.ps1   │
# │ Actualizar node.exe sidecar          │ prepare-installer.ps1   │
# │ Primera vez / release mayor          │ prepare-installer.ps1   │
# └──────────────────────────────────────┴─────────────────────────┘
# ============================================

[CmdletBinding()]
param(
  [switch]$SkipBuild,     # Solo copiar standalone existente, sin rebuild
  [switch]$TauriOnly,     # Solo compilar Tauri (no tocar backend)
  [switch]$Full,          # Build backend + Tauri build (genera .exe instalador)
  [switch]$NoBuildTauri   # No ejecutar `npm run tauri build` al final
)

$ErrorActionPreference = 'Stop'

# ── Colores ──
function Write-Step  { param([string]$T) Write-Host "`n🔧 $T" -ForegroundColor Cyan }
function Write-Ok    { param([string]$T) Write-Host "  ✅ $T" -ForegroundColor Green }
function Write-Warn  { param([string]$T) Write-Host "  ⚠️  $T" -ForegroundColor Yellow }
function Write-Err   { param([string]$T) Write-Host "  ❌ $T" -ForegroundColor Red }

# ── Detectar rutas ──
$repoRoot    = Split-Path $PSScriptRoot -ErrorAction SilentlyContinue
if (-not $repoRoot) { $repoRoot = (Get-Location).Path }
# Si el script está en la raíz del repo
if (Test-Path (Join-Path $PSScriptRoot "ChavalosServerApp")) {
  $repoRoot = $PSScriptRoot
}

$backendRoot = Join-Path $repoRoot "Frontend\NextJS_React\web"
$tauriRoot   = Join-Path $repoRoot "ChavalosServerApp"
$destBackend = Join-Path $tauriRoot "src-tauri\resources\backend"

# Validar que existen
if (-not (Test-Path $backendRoot)) { Write-Err "Backend no encontrado: $backendRoot"; exit 1 }
if (-not (Test-Path $tauriRoot))   { Write-Err "Tauri no encontrado: $tauriRoot"; exit 1 }

$sw = [System.Diagnostics.Stopwatch]::StartNew()
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "  PATCH RÁPIDO — Chavalos Server" -ForegroundColor Magenta
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta

# ================================================
# MODO: Solo Tauri (no tocar backend Next.js)
# ================================================
if ($TauriOnly) {
  Write-Step "Modo TauriOnly: solo compilar app de escritorio"
  
  Set-Location $tauriRoot
  if ($Full) {
    Write-Step "Compilando Tauri (build completo + instalador)..."
    & npm run tauri build 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) { Write-Err "Tauri build falló"; exit 1 }
    Write-Ok "Instalador generado"
  } else {
    Write-Step "Verificando compilación TypeScript..."
    & npx tsc --noEmit 2>&1 | ForEach-Object { Write-Host $_ }
    
    Write-Step "Verificando compilación Rust..."
    Set-Location (Join-Path $tauriRoot "src-tauri")
    & cargo check 2>&1 | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) { Write-Err "Cargo check falló"; exit 1 }
    Write-Ok "Compilación verificada"
  }
  
  $sw.Stop()
  Write-Host "`n⏱️  Tiempo: $([math]::Round($sw.Elapsed.TotalSeconds, 1))s" -ForegroundColor Cyan
  exit 0
}

# ================================================
# PASO 1: Build del backend Next.js
# ================================================
if (-not $SkipBuild) {
  Write-Step "Rebuild Next.js standalone..."
  Set-Location $backendRoot
  
  & npm run build 2>&1 | ForEach-Object { Write-Host $_ }
  if ($LASTEXITCODE -ne 0) { Write-Err "npm run build falló"; exit 1 }
  
  $standalone = Join-Path $backendRoot ".next\standalone"
  if (-not (Test-Path $standalone)) { Write-Err "No se generó .next/standalone"; exit 1 }
  Write-Ok "Build completo"
} else {
  Write-Step "SkipBuild: usando standalone existente"
  $standalone = Join-Path $backendRoot ".next\standalone"
  if (-not (Test-Path $standalone)) { Write-Err "No existe .next/standalone. Quitá -SkipBuild"; exit 1 }
}

# ================================================
# PASO 2: Copiar a resources/backend
# ================================================
Write-Step "Copiando standalone a resources/backend..."

# Limpiar destino (excepto binarios Prisma que tardan en desbloquear)
$foldersToClean = @(".next", "node_modules")
foreach ($folder in $foldersToClean) {
  $target = Join-Path $destBackend $folder
  if (Test-Path $target) {
    Remove-Item $target -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# Copiar standalone (server.js, .next/server, node_modules, package.json)
$standaloneSrc = Join-Path $backendRoot ".next\standalone"
Copy-Item "$standaloneSrc\.next"        "$destBackend\.next"        -Recurse -Force
Copy-Item "$standaloneSrc\node_modules" "$destBackend\node_modules" -Recurse -Force
Copy-Item "$standaloneSrc\server.js"    "$destBackend\server.js"    -Force
Copy-Item "$standaloneSrc\package.json" "$destBackend\package.json" -Force
Write-Ok "Standalone copiado"

# Copiar static assets
$staticSrc = Join-Path $backendRoot ".next\static"
if (Test-Path $staticSrc) {
  $staticDst = Join-Path $destBackend ".next\static"
  Remove-Item $staticDst -Recurse -Force -ErrorAction SilentlyContinue
  Copy-Item $staticSrc $staticDst -Recurse -Force
  Write-Ok "Assets estáticos copiados"
}

# Copiar public
$publicSrc = Join-Path $backendRoot "public"
if (Test-Path $publicSrc) {
  $publicDst = Join-Path $destBackend "public"
  Remove-Item $publicDst -Recurse -Force -ErrorAction SilentlyContinue
  Copy-Item $publicSrc $publicDst -Recurse -Force
  Write-Ok "Public copiado"
}

# Copiar .env
$envSrc = Join-Path $standaloneSrc ".env"
if (Test-Path $envSrc) {
  Copy-Item $envSrc (Join-Path $destBackend ".env") -Force
}
# Sobrescribir con el .env de resources si tiene config especial (HOSTNAME, etc.)
$envProd = Join-Path $repoRoot "ChavalosServerApp\src-tauri\resources\backend\.env"
# (ya existe, no lo sobreescribimos si ya tiene las vars correctas)

# ================================================
# PASO 3: Verificación
# ================================================
Write-Step "Verificando..."

$checks = @(
  @{ Path = "$destBackend\server.js";                          Name = "server.js" },
  @{ Path = "$destBackend\.next\server";                       Name = ".next/server/" },
  @{ Path = "$destBackend\node_modules\.prisma";               Name = "Prisma client" }
)

$allOk = $true
foreach ($check in $checks) {
  if (Test-Path $check.Path) {
    Write-Ok $check.Name
  } else {
    Write-Warn "$($check.Name) no encontrado (puede estar OK si no aplica)"
  }
}

# Verificar que el fix de secure está aplicado
$loginRoute = Join-Path $destBackend ".next\server\app\api\auth\login\route.js"
if (Test-Path $loginRoute) {
  $content = Get-Content $loginRoute -Raw
  if ($content -match 'secure:!1') {
    Write-Ok "Cookie fix LAN: secure=false ✓"
  } elseif ($content -match 'secure:!0') {
    Write-Err "Cookie fix LAN: secure=true ✗ (el fix no se aplicó en auth-session.ts)"
    $allOk = $false
  }
}

# Tamaño total
$size = (Get-ChildItem $destBackend -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
$sizeMB = [math]::Round($size / 1MB, 1)
Write-Ok "Tamaño resources/backend: $sizeMB MB"

# ================================================
# PASO 4 (opcional): Tauri build
# ================================================
if ($Full -and -not $NoBuildTauri) {
  Write-Step "Compilando Tauri (build completo + instalador)..."
  Set-Location $tauriRoot
  & npm run tauri build 2>&1 | ForEach-Object { Write-Host $_ }
  if ($LASTEXITCODE -ne 0) { Write-Err "Tauri build falló"; exit 1 }
  Write-Ok "Instalador generado"
} elseif (-not $NoBuildTauri -and -not $Full) {
  Write-Host ""
  Write-Host "  📦 Backend actualizado. Para generar el instalador:" -ForegroundColor Yellow
  Write-Host "     cd ChavalosServerApp" -ForegroundColor White
  Write-Host "     npm run tauri build" -ForegroundColor White
  Write-Host ""
}

$sw.Stop()
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
Write-Host "  ✅ Listo — $([math]::Round($sw.Elapsed.TotalSeconds, 1))s" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Magenta
