# Quick Start - Development Mode
# Ejecuta la app en modo desarrollo (hot reload)

# Agregar Rust al PATH si no está disponible
if (!(Get-Command rustc -ErrorAction SilentlyContinue)) {
    $env:Path += ";$env:USERPROFILE\.cargo\bin"
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🚀 CHAVALOS SERVER APP - DEV MODE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Check if node_modules exists
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Instalando dependencias por primera vez..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error instalando dependencias" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Dependencias instaladas" -ForegroundColor Green
    Write-Host ""
}

Write-Host "🔧 Iniciando en modo desarrollo..." -ForegroundColor Yellow
Write-Host "   - Hot reload habilitado" -ForegroundColor Gray
Write-Host "   - DevTools disponibles" -ForegroundColor Gray
Write-Host ""
Write-Host "Presiona Ctrl+C para detener" -ForegroundColor Yellow
Write-Host ""

npm run tauri:dev
