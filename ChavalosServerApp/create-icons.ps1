# Script para crear iconos válidos para Tauri
# Este script crea un set básico de iconos PNG y ICO

$ErrorActionPreference = "Stop"

# Usar ruta absoluta para evitar problemas
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$iconDir = Join-Path $scriptPath "src-tauri\icons"

Write-Host "🎨 Creando iconos para Tauri..." -ForegroundColor Cyan
Write-Host "📁 Directorio: $iconDir" -ForegroundColor White

# Asegurarse de que el directorio existe
if (!(Test-Path $iconDir)) {
    New-Item -ItemType Directory -Path $iconDir -Force | Out-Null
    Write-Host "  📂 Directorio creado" -ForegroundColor Yellow
}

# PNG transparente de 1x1 pixel (placeholder válido)
# Este es el PNG más pequeño posible que es válido
$pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
$pngBytes = [System.Convert]::FromBase64String($pngBase64)

# Crear todos los tamaños PNG que Tauri necesita
$pngSizes = @("32x32", "128x128", "128x128@2x", "icon")
foreach ($size in $pngSizes) {
    $fileName = "$size.png"
    $filePath = Join-Path $iconDir $fileName
    [System.IO.File]::WriteAllBytes($filePath, $pngBytes)
    Write-Host "  ✅ $fileName" -ForegroundColor Green
}

# Crear ICO válido de 32x32 con un pixel transparente
# Estructura ICO: Header (6 bytes) + Directory Entry (16 bytes) + PNG Data
$icoHeader = @(
    0x00, 0x00,  # Reserved (must be 0)
    0x01, 0x00,  # Type (1 = ICO)
    0x01, 0x00   # Number of images (1)
)

$icoEntry = @(
    0x20,        # Width (32 pixels)
    0x20,        # Height (32 pixels)
    0x00,        # Color palette (0 = no palette)
    0x00,        # Reserved (must be 0)
    0x01, 0x00,  # Color planes (1)
    0x20, 0x00,  # Bits per pixel (32 = RGBA)
    0x44, 0x00, 0x00, 0x00,  # Image data size (68 bytes)
    0x16, 0x00, 0x00, 0x00   # Offset to image data (22 bytes)
)

# PNG data pequeño embebido en el ICO
$icoImageData = $pngBytes

# Combinar todo
$icoBytes = $icoHeader + $icoEntry + $icoImageData
$icoPath = Join-Path $iconDir "icon.ico"
[System.IO.File]::WriteAllBytes($icoPath, $icoBytes)
Write-Host "  ✅ icon.ico" -ForegroundColor Green

# Crear también logos de Windows Store (opcionales pero útiles)
$storeSizes = @(
    "Square30x30Logo",
    "Square44x44Logo", 
    "Square71x71Logo",
    "Square89x89Logo",
    "Square107x107Logo",
    "Square142x142Logo",
    "Square150x150Logo",
    "Square284x284Logo",
    "Square310x310Logo",
    "StoreLogo"
)

foreach ($logo in $storeSizes) {
    $fileName = "$logo.png"
    $filePath = Join-Path $iconDir $fileName
    [System.IO.File]::WriteAllBytes($filePath, $pngBytes)
    Write-Host "  ✅ $fileName" -ForegroundColor Green
}

Write-Host "`n✅ Iconos creados exitosamente!" -ForegroundColor Cyan
Write-Host "📁 Ubicación: $iconDir" -ForegroundColor White
Write-Host ""
Write-Host "💡 TIP: Para iconos personalizados:" -ForegroundColor Yellow
Write-Host "   1. Crea un PNG de 1024x1024 con tu logo" -ForegroundColor White
Write-Host "   2. Ejecuta: npm run tauri icon tu-logo.png" -ForegroundColor White
Write-Host "   3. Tauri generará automáticamente todos los tamaños" -ForegroundColor White

# Mostrar resultado final
Write-Host "`n📊 Archivos creados:" -ForegroundColor Cyan
Get-ChildItem $iconDir | Format-Table Name, Length -AutoSize
