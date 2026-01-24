# Script para generar iconos placeholder
# Los iconos reales deben ser creados con una herramienta de diseño

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🎨 GENERADOR DE ICONOS PLACEHOLDER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "⚠️  IMPORTANTE:" -ForegroundColor Yellow
Write-Host "Este script crea iconos placeholder básicos." -ForegroundColor Yellow
Write-Host "Para producción, deberías crear iconos profesionales." -ForegroundColor Yellow
Write-Host ""

$iconsDir = "src-tauri\icons"

if (!(Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
}

Write-Host "📁 Creando estructura de carpetas..." -ForegroundColor Gray
Write-Host ""

# Create a simple README for icons
$readmeContent = @"
# Iconos de la Aplicación

## Archivos Requeridos

Para que Tauri compile correctamente, necesitas estos archivos:

- \`icon.png\` (1024x1024) - Ícono principal, Tauri genera el resto automáticamente
- \`icon.ico\` - Windows app icon (generado automáticamente)
- \`32x32.png\` - Windows system tray
- \`128x128.png\` - Windows taskbar
- \`icon.icns\` - macOS (si compiles para Mac)

## Generar Automáticamente

Si tienes un solo ícono PNG de 1024x1024:

\`\`\`powershell
npm run tauri icon path/to/your/icon.png
\`\`\`

Esto generará todos los tamaños necesarios.

## Diseño Recomendado

Para la Ferretería Chavalos, considera:

- 🏪 Ícono de tienda/ferretería
- 🛠️ Herramienta (martillo, llave)
- 🏠 Casa con herramientas
- Colores: Azul (#667eea), Morado (#764ba2)

## Herramientas de Diseño

- **Gratuitas**: 
  - Figma (https://figma.com)
  - GIMP (https://gimp.org)
  - Inkscape (https://inkscape.org)
  
- **Online**:
  - Canva (https://canva.com)
  - Photopea (https://photopea.com)

## Placeholder Actual

Los iconos actuales son placeholders simples.
Reemplázalos antes de distribuir la aplicación.
"@

Set-Content -Path "$iconsDir\README.md" -Value $readmeContent

Write-Host "✅ README de iconos creado" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  📋 SIGUIENTES PASOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Crea un ícono PNG de 1024x1024 pixeles" -ForegroundColor White
Write-Host "   Guárdalo como: app-icon.png" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Genera todos los tamaños automáticamente:" -ForegroundColor White
Write-Host "   npm run tauri icon app-icon.png" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Los archivos se crearán en: src-tauri/icons/" -ForegroundColor Gray
Write-Host ""
Write-Host "Mientras tanto, puedes usar el ícono por defecto de Tauri" -ForegroundColor Gray
Write-Host ""

# Check if Tauri CLI is installed
try {
    $tauriVersion = npm list @tauri-apps/cli --depth=0 2>&1
    if ($tauriVersion -match "@tauri-apps/cli") {
        Write-Host "✅ Tauri CLI detectado - Puedes usar el comando 'npm run tauri icon'" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Instala dependencias primero: npm install" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Instala dependencias primero: npm install" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Para continuar con el desarrollo:" -ForegroundColor Cyan
Write-Host "  .\dev.ps1" -ForegroundColor Yellow
Write-Host ""
