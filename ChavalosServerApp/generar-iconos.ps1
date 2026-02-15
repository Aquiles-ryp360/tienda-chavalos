#!/usr/bin/env pwsh
# ============================================================================
#  SCRIPT: generar-iconos.ps1
#  Genera TODOS los iconos necesarios para Tauri (Windows, macOS, iOS, Android)
#  a partir de las imágenes fuente en src-tauri/icons/icons-por-crear/
# ============================================================================
#
# ┌──────────────────────────────────────────────────────────────────────────┐
# │                   IMÁGENES FUENTE NECESARIAS                             │
# │             Colocar en: src-tauri/icons/icons-por-crear/                 │
# └──────────────────────────────────────────────────────────────────────────┘
#
# ── 1. app-icon.png  [OBLIGATORIO] ─────────────────────────────────────────
#    Icono principal de la aplicación.
#    ● Formato:  PNG cuadrado, con transparencia (fondo transparente)
#    ● Mínimo:   512 x 512 px
#    ● Óptimo:   1024 x 1024 px
#    ● Genera:
#        - 32x32.png, 64x64.png, 128x128.png, 128x128@2x.png (256px)
#        - icon.png (512px), icon.ico (Windows), icon.icns (macOS)
#        - Square30x30Logo.png, Square44x44Logo.png, Square71x71Logo.png
#          Square89x89Logo.png, Square107x107Logo.png, Square142x142Logo.png
#          Square150x150Logo.png, Square284x284Logo.png, Square310x310Logo.png
#          StoreLogo.png (Windows Store)
#        - iOS: AppIcon-20x20@1x/2x/3x, 29x29@1x/2x/3x, 40x40@1x/2x/3x,
#               60x60@2x/3x, 76x76@1x/2x, 83.5x83.5@2x, 512@2x
#        - Android: mipmap-mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi (ic_launcher)
#
# ── 2. nsis-header.png  [RECOMENDADO] ─────────────────────────────────────
#    Imagen de cabecera del instalador NSIS (Windows).
#    Se muestra arriba a la derecha durante la instalación.
#    ● Formato:  PNG rectangular horizontal, SIN transparencia
#    ● Mínimo:   150 x 57 px
#    ● Óptimo:   300 x 114 px (se redimensiona automáticamente)
#    ● Genera:
#        - headerImage.bmp (150x57, 24-bit BMP)
#
# ── 3. nsis-sidebar.png  [RECOMENDADO] ────────────────────────────────────
#    Imagen lateral del instalador NSIS (Windows).
#    Se muestra en la barra izquierda de la pantalla de bienvenida.
#    ● Formato:  PNG vertical (más alto que ancho), SIN transparencia
#    ● Mínimo:   164 x 314 px
#    ● Óptimo:   328 x 628 px (se redimensiona automáticamente)
#    ● Genera:
#        - sidebarImage.bmp (164x314, 24-bit BMP)
#
# ── 4. web-logo.png  [OPCIONAL] ───────────────────────────────────────────
#    Logo para uso web (frontend, favicons, PWA).
#    ● Formato:  PNG cuadrado, con o sin transparencia
#    ● Mínimo:   256 x 256 px
#    ● Óptimo:   512 x 512 px
#    ● Genera:
#        - public/logo.png (copia directa)
#        - resources/logo.png (copia directa)
#        - public/favicon-16x16.png, public/favicon-32x32.png
#        - public/apple-touch-icon.png (180x180)
#        - public/logo-192.png (para manifest PWA)
#        - public/logo-512.png (para manifest PWA)
#
# ── 5. splash-screen.png  [OPCIONAL] ──────────────────────────────────────
#    Pantalla de carga / splash screen de la aplicación.
#    ● Formato:  PNG horizontal, sin transparencia
#    ● Mínimo:   1200 x 630 px
#    ● Óptimo:   1920 x 1080 px
#    ● Genera:
#        - public/splash.png (copia directa)
#        - resources/splash.png (copia directa)
#
# ── 6. banner-promo.png  [OPCIONAL] ───────────────────────────────────────
#    Banner promocional para tiendas de apps o marketing.
#    ● Formato:  PNG horizontal (proporción ~2:1)
#    ● Mínimo:   1024 x 500 px
#    ● Óptimo:   1024 x 500 px
#    ● Genera:
#        - resources/banner-promo.png (copia directa)
#
# ┌──────────────────────────────────────────────────────────────────────────┐
# │                          USO DEL SCRIPT                                │
# └──────────────────────────────────────────────────────────────────────────┘
#
#    .\generar-iconos.ps1                  # Modo interactivo (pide confirmación)
#    .\generar-iconos.ps1 -Force           # Sin preguntar, genera todo
#    .\generar-iconos.ps1 -SkipNsis        # Omitir BMPs del instalador
#    .\generar-iconos.ps1 -SkipWebLogo     # Omitir copia del logo web
#    .\generar-iconos.ps1 -Help            # Mostrar ayuda detallada
#
# ┌──────────────────────────────────────────────────────────────────────────┐
# │                          REQUISITOS                                    │
# └──────────────────────────────────────────────────────────────────────────┘
#
#    - Node.js instalado
#    - npm install ejecutado (para @tauri-apps/cli)
#    - sharp (se instala automáticamente si se necesitan BMPs)
#
# ============================================================================

param(
    [switch]$SkipNsis,
    [switch]$SkipWebLogo,
    [switch]$Force,
    [switch]$Help
)

# ── Colores y helpers ──────────────────────────────────────────────────────────
function Write-Step  { param($msg) Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "  ✔ $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Err   { param($msg) Write-Host "  ✖ $msg" -ForegroundColor Red }
function Write-Info  { param($msg) Write-Host "  ℹ $msg" -ForegroundColor Gray }

# ── Rutas ──────────────────────────────────────────────────────────────────────
$ProjectRoot   = $PSScriptRoot
$TauriDir      = Join-Path $ProjectRoot "src-tauri"
$IconsDir      = Join-Path $TauriDir "icons"
$SourceDir     = Join-Path $IconsDir "icons-por-crear"
$PublicDir     = Join-Path $ProjectRoot "public"
$ResourcesDir  = Join-Path $TauriDir "resources"

# ── Catálogo de imágenes fuente ────────────────────────────────────────────────
# Cada entrada define: nombre, prioridad, tamaño mínimo, tamaño óptimo, descripción y qué genera
$ImageCatalog = @(
    @{
        Name        = "app-icon.png"
        Priority    = "OBLIGATORIO"
        MinSize     = "512x512"
        OptimalSize = "1024x1024"
        Format      = "PNG cuadrado, con transparencia"
        Description = "Icono principal de la aplicación"
        Generates   = "32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024, icon.ico, icon.icns, Square*.png, StoreLogo, iOS AppIcon-*, Android mipmap-*"
    },
    @{
        Name        = "nsis-header.png"
        Priority    = "RECOMENDADO"
        MinSize     = "150x57"
        OptimalSize = "300x114"
        Format      = "PNG rectangular, sin transparencia"
        Description = "Cabecera del instalador NSIS (Windows)"
        Generates   = "headerImage.bmp (150x57)"
    },
    @{
        Name        = "nsis-sidebar.png"
        Priority    = "RECOMENDADO"
        MinSize     = "164x314"
        OptimalSize = "328x628"
        Format      = "PNG vertical, sin transparencia"
        Description = "Barra lateral del instalador NSIS (Windows)"
        Generates   = "sidebarImage.bmp (164x314)"
    },
    @{
        Name        = "web-logo.png"
        Priority    = "OPCIONAL"
        MinSize     = "256x256"
        OptimalSize = "512x512"
        Format      = "PNG cuadrado, con o sin transparencia"
        Description = "Logo para uso en la web"
        Generates   = "public/logo.png, resources/logo.png, favicon-16x16, favicon-32x32, apple-touch-icon (180x180), logo-192, logo-512"
    },
    @{
        Name        = "splash-screen.png"
        Priority    = "OPCIONAL"
        MinSize     = "1200x630"
        OptimalSize = "1920x1080"
        Format      = "PNG horizontal, sin transparencia"
        Description = "Pantalla de carga / splash screen"
        Generates   = "public/splash.png, resources/splash.png"
    },
    @{
        Name        = "banner-promo.png"
        Priority    = "OPCIONAL"
        MinSize     = "1024x500"
        OptimalSize = "1024x500"
        Format      = "PNG horizontal (para tiendas de apps)"
        Description = "Banner promocional (Google Play / marketing)"
        Generates   = "resources/banner-promo.png"
    }
)

# Rutas de las imágenes principales (para uso interno del script)
$AppIconSrc    = Join-Path $SourceDir "app-icon.png"
$NsisHeaderSrc = Join-Path $SourceDir "nsis-header.png"
$NsisSidebarSrc= Join-Path $SourceDir "nsis-sidebar.png"
$WebLogoSrc    = Join-Path $SourceDir "web-logo.png"
$SplashSrc     = Join-Path $SourceDir "splash-screen.png"
$BannerSrc     = Join-Path $SourceDir "banner-promo.png"

# ── Ayuda ──────────────────────────────────────────────────────────────────────
if ($Help) {
    Write-Host @"

  GENERADOR DE ICONOS - Chavalos Server App
  ==========================================

  Este script procesa las imágenes fuente en:
    src-tauri/icons/icons-por-crear/

  y genera todos los iconos necesarios para la aplicación Tauri.

  Imágenes fuente (colocar en src-tauri/icons/icons-por-crear/):
    ┌────────────────────┬─────────────┬───────────┬───────────┐
    │ ARCHIVO            │ PRIORIDAD   │ MÍNIMO    │ ÓPTIMO    │
    ├────────────────────┼─────────────┼───────────┼───────────┤
    │ app-icon.png       │ OBLIGATORIO │ 512x512   │ 1024x1024 │
    │ nsis-header.png    │ RECOMENDADO │ 150x57    │ 300x114   │
    │ nsis-sidebar.png   │ RECOMENDADO │ 164x314   │ 328x628   │
    │ web-logo.png       │ OPCIONAL    │ 256x256   │ 512x512   │
    │ splash-screen.png  │ OPCIONAL    │ 1200x630  │ 1920x1080 │
    │ banner-promo.png   │ OPCIONAL    │ 1024x500  │ 1024x500  │
    └────────────────────┴─────────────┴───────────┴───────────┘

  Parámetros:
    -SkipNsis       Omitir generación de BMP para NSIS
    -SkipWebLogo    Omitir copia del logo web
    -Force          No pedir confirmación
    -Help           Mostrar esta ayuda

  Requisitos:
    - Node.js instalado
    - npm install ejecutado (para @tauri-apps/cli)
    - sharp se instala automáticamente si no está presente

"@ -ForegroundColor White
    exit 0
}

# ══════════════════════════════════════════════════════════════════════════════
#  INICIO
# ══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║     GENERADOR DE ICONOS - Chavalos Server App              ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

# ── Validar directorio fuente ──────────────────────────────────────────────────
if (-not (Test-Path $SourceDir)) {
    Write-Err "No se encontró el directorio de iconos fuente:"
    Write-Err "  $SourceDir"
    exit 1
}

# ── Detectar y mostrar catálogo de imágenes ───────────────────────────────────
Write-Step "Catálogo de imágenes fuente"
Write-Host ""
Write-Host "  Directorio: src-tauri/icons/icons-por-crear/" -ForegroundColor DarkGray
Write-Host ""

# Encabezado de la tabla
$col1 = 22  # Estado
$col2 = 22  # Nombre
$col3 = 14  # Prioridad
$col4 = 14  # Mínimo
$col5 = 14  # Óptimo
$col6 = 10  # Tamaño archivo

$headerLine = "  {0,-$col1} {1,-$col2} {2,-$col3} {3,-$col4} {4,-$col5} {5,-$col6}" -f "ESTADO", "ARCHIVO", "PRIORIDAD", "MÍNIMO", "ÓPTIMO", "TAMAÑO"
$separator  = "  " + ("-" * ($col1 + $col2 + $col3 + $col4 + $col5 + $col6 + 5))

Write-Host $headerLine -ForegroundColor White
Write-Host $separator -ForegroundColor DarkGray

$foundCount   = 0
$missingCount = 0
$hasAppIcon     = $false
$hasNsisHeader  = $false
$hasNsisSidebar = $false
$hasWebLogo     = $false
$hasSplash      = $false
$hasBanner      = $false

foreach ($img in $ImageCatalog) {
    $imgPath = Join-Path $SourceDir $img.Name
    $exists  = Test-Path $imgPath

    if ($exists) {
        $fileInfo = Get-Item $imgPath
        $sizeStr  = "{0:N1} KB" -f ($fileInfo.Length / 1KB)
        $status   = "✔ ENCONTRADO"
        $statusColor = "Green"
        $foundCount++
    } else {
        $sizeStr  = "---"
        $status   = "✖ NO ENCONTRADO"
        $statusColor = if ($img.Priority -eq "OBLIGATORIO") { "Red" } elseif ($img.Priority -eq "RECOMENDADO") { "Yellow" } else { "DarkGray" }
    }

    $priorityColor = switch ($img.Priority) {
        "OBLIGATORIO" { "Red" }
        "RECOMENDADO"  { "Yellow" }
        "OPCIONAL"     { "DarkGray" }
    }

    # Imprimir fila
    Write-Host -NoNewline "  "
    Write-Host -NoNewline ("{0,-$col1}" -f $status) -ForegroundColor $statusColor
    Write-Host -NoNewline " "
    Write-Host -NoNewline ("{0,-$col2}" -f $img.Name) -ForegroundColor White
    Write-Host -NoNewline " "
    Write-Host -NoNewline ("{0,-$col3}" -f $img.Priority) -ForegroundColor $priorityColor
    Write-Host -NoNewline " "
    Write-Host -NoNewline ("{0,-$col4}" -f $img.MinSize) -ForegroundColor Gray
    Write-Host -NoNewline " "
    Write-Host -NoNewline ("{0,-$col5}" -f $img.OptimalSize) -ForegroundColor Cyan
    Write-Host -NoNewline " "
    Write-Host ("{0,-$col6}" -f $sizeStr) -ForegroundColor Gray

    if (-not $exists) { $missingCount++ }

    # Guardar estado
    switch ($img.Name) {
        "app-icon.png"      { $hasAppIcon     = $exists }
        "nsis-header.png"   { $hasNsisHeader  = $exists }
        "nsis-sidebar.png"  { $hasNsisSidebar = $exists }
        "web-logo.png"      { $hasWebLogo     = $exists }
        "splash-screen.png" { $hasSplash      = $exists }
        "banner-promo.png"  { $hasBanner      = $exists }
    }
}

Write-Host $separator -ForegroundColor DarkGray
Write-Host "  Encontradas: $foundCount / $($ImageCatalog.Count)" -ForegroundColor $(if ($foundCount -eq $ImageCatalog.Count) { "Green" } else { "Yellow" })
Write-Host ""

# Mostrar qué genera cada imagen encontrada
Write-Step "¿Qué genera cada imagen?"
foreach ($img in $ImageCatalog) {
    $imgPath = Join-Path $SourceDir $img.Name
    if (Test-Path $imgPath) {
        Write-Host "  $($img.Name)" -ForegroundColor White -NoNewline
        Write-Host " - $($img.Description)" -ForegroundColor DarkGray
        Write-Host "    Formato: $($img.Format)" -ForegroundColor Gray
        Write-Host "    Genera:  $($img.Generates)" -ForegroundColor Green
        Write-Host ""
    }
}

# Sugerencias para imágenes faltantes recomendadas
$missingRecommended = $ImageCatalog | Where-Object {
    $_.Priority -in @("OBLIGATORIO", "RECOMENDADO") -and -not (Test-Path (Join-Path $SourceDir $_.Name))
}
if ($missingRecommended.Count -gt 0) {
    Write-Step "Imágenes recomendadas faltantes"
    foreach ($img in $missingRecommended) {
        Write-Warn "$($img.Name) ($($img.Priority)) - $($img.Description)"
        Write-Info "  Tamaño recomendado: $($img.OptimalSize) | Formato: $($img.Format)"
    }
    Write-Host ""
}

# Detectar imágenes extras no catalogadas
$catalogNames = $ImageCatalog | ForEach-Object { $_.Name }
$extraFiles = Get-ChildItem $SourceDir -Filter "*.png" -File | Where-Object { $_.Name -notin $catalogNames }
if ($extraFiles.Count -gt 0) {
    Write-Step "Imágenes extra detectadas (no catalogadas)"
    foreach ($f in $extraFiles) {
        Write-Warn "$($f.Name) ($([math]::Round($f.Length / 1KB, 1)) KB) - no se procesará automáticamente"
    }
    Write-Host ""
}

# Validar obligatorias
if (-not $hasAppIcon) {
    Write-Err "Falta app-icon.png - es OBLIGATORIO para generar los iconos de la app."
    Write-Err "Coloca un PNG cuadrado (mínimo 512x512, óptimo 1024x1024) en:"
    Write-Err "  $SourceDir\app-icon.png"
    exit 1
}

# ── Confirmación ───────────────────────────────────────────────────────────────
if (-not $Force) {
    Write-Host ""
    Write-Host "  Se generarán los siguientes iconos:" -ForegroundColor White
    Write-Host "    • Iconos Tauri (32, 64, 128, 256, 512, 1024px + .ico + .icns)" -ForegroundColor White
    Write-Host "    • Iconos Windows Store (Square*.png + StoreLogo.png)" -ForegroundColor White
    Write-Host "    • Iconos iOS (AppIcon-*.png)" -ForegroundColor White
    Write-Host "    • Iconos Android (mipmap-*/ic_launcher*.png)" -ForegroundColor White
    if (-not $SkipNsis -and ($hasNsisHeader -or $hasNsisSidebar)) {
        Write-Host "    • Imágenes NSIS (headerImage.bmp + sidebarImage.bmp)" -ForegroundColor White
    }
    if (-not $SkipWebLogo -and $hasWebLogo) {
        Write-Host "    • Logo web (public/ y resources/)" -ForegroundColor White
    }
    if ($hasSplash) {
        Write-Host "    • Splash screen (public/ y resources/)" -ForegroundColor White
    }
    if ($hasBanner) {
        Write-Host "    • Banner promocional (resources/)" -ForegroundColor White
    }
    Write-Host ""

    $confirm = Read-Host "  ¿Continuar? (S/n)"
    if ($confirm -eq "n" -or $confirm -eq "N") {
        Write-Warn "Cancelado por el usuario."
        exit 0
    }
}

# ══════════════════════════════════════════════════════════════════════════════
#  PASO 1: Generar iconos Tauri con `npx tauri icon`
# ══════════════════════════════════════════════════════════════════════════════
Write-Step "Generando iconos Tauri desde app-icon.png..."
Write-Info "Usando: npx tauri icon"

Push-Location $ProjectRoot
try {
    $iconResult = & npx tauri icon $AppIconSrc -o $IconsDir 2>&1
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-Ok "Iconos Tauri generados correctamente"
        # Mostrar resumen
        $generated = Get-ChildItem $IconsDir -File -Recurse | Where-Object { $_.Extension -in ".png", ".ico", ".icns" }
        Write-Info "$($generated.Count) archivos de icono generados/actualizados"
    } else {
        Write-Err "Error al generar iconos Tauri:"
        $iconResult | ForEach-Object { Write-Err "  $_" }
        Pop-Location
        exit 1
    }
} catch {
    Write-Err "Error ejecutando tauri icon: $_"
    Pop-Location
    exit 1
}
Pop-Location

# ══════════════════════════════════════════════════════════════════════════════
#  PASO 2: Generar imágenes BMP para NSIS (headerImage.bmp, sidebarImage.bmp)
# ══════════════════════════════════════════════════════════════════════════════
if (-not $SkipNsis -and ($hasNsisHeader -or $hasNsisSidebar)) {
    Write-Step "Generando imágenes BMP para instalador NSIS..."

    # Verificar/instalar sharp
    Write-Info "Verificando dependencia 'sharp'..."
    Push-Location $ProjectRoot
    $hasSharp = $false
    try {
        $checkSharp = node -e "try { require('sharp'); process.exit(0); } catch(e) { process.exit(1); }" 2>$null
        if ($LASTEXITCODE -eq 0) { $hasSharp = $true }
    } catch {}

    if (-not $hasSharp) {
        Write-Info "Instalando sharp (procesamiento de imágenes)..."
        npm install --save-dev sharp 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Err "No se pudo instalar sharp. Intentando con npx..."
        } else {
            Write-Ok "sharp instalado"
            $hasSharp = $true
        }
    } else {
        Write-Ok "sharp ya disponible"
    }

    if ($hasSharp) {
        # Crear script temporal de Node.js para generar BMPs
        $bmpScript = @"
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const iconsDir = process.argv[2];
const sourceDir = process.argv[3];

async function generateBMP(inputPath, outputPath, width, height, label) {
    if (!fs.existsSync(inputPath)) {
        console.log('SKIP: ' + label + ' (fuente no encontrada)');
        return;
    }

    try {
        // sharp no soporta BMP directamente, generamos un BMP manualmente
        // Primero redimensionamos a las dimensiones correctas
        const resized = await sharp(inputPath)
            .resize(width, height, { fit: 'fill' })
            .removeAlpha()    // BMP no soporta transparencia
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { data, info } = resized;
        const w = info.width;
        const h = info.height;
        const channels = info.channels;

        // Construir BMP manualmente (formato Windows BITMAPINFOHEADER)
        const rowSize = Math.ceil((w * 24) / 32) * 4; // Cada fila alineada a 4 bytes
        const pixelDataSize = rowSize * h;
        const fileSize = 54 + pixelDataSize; // 14 (file header) + 40 (info header) + pixel data

        const bmp = Buffer.alloc(fileSize);

        // ── BMP File Header (14 bytes) ──
        bmp.write('BM', 0);                      // Signature
        bmp.writeUInt32LE(fileSize, 2);           // File size
        bmp.writeUInt32LE(0, 6);                  // Reserved
        bmp.writeUInt32LE(54, 10);                // Pixel data offset

        // ── DIB Header - BITMAPINFOHEADER (40 bytes) ──
        bmp.writeUInt32LE(40, 14);                // Header size
        bmp.writeInt32LE(w, 18);                  // Width
        bmp.writeInt32LE(h, 22);                  // Height (positive = bottom-up)
        bmp.writeUInt16LE(1, 26);                 // Color planes
        bmp.writeUInt16LE(24, 28);                // Bits per pixel
        bmp.writeUInt32LE(0, 30);                 // Compression (none)
        bmp.writeUInt32LE(pixelDataSize, 34);     // Image size
        bmp.writeInt32LE(2835, 38);               // H resolution (72 DPI)
        bmp.writeInt32LE(2835, 42);               // V resolution (72 DPI)
        bmp.writeUInt32LE(0, 46);                 // Colors in palette
        bmp.writeUInt32LE(0, 50);                 // Important colors

        // ── Pixel data (bottom-up, BGR) ──
        for (let y = 0; y < h; y++) {
            const srcRow = (h - 1 - y);   // BMP is bottom-up
            for (let x = 0; x < w; x++) {
                const srcIdx = (srcRow * w + x) * channels;
                const dstIdx = 54 + y * rowSize + x * 3;
                bmp[dstIdx]     = data[srcIdx + 2]; // B
                bmp[dstIdx + 1] = data[srcIdx + 1]; // G
                bmp[dstIdx + 2] = data[srcIdx];     // R
            }
        }

        fs.writeFileSync(outputPath, bmp);
        console.log('OK: ' + label + ' (' + w + 'x' + h + ') -> ' + path.basename(outputPath));
    } catch (err) {
        console.error('ERROR: ' + label + ': ' + err.message);
    }
}

async function main() {
    const tasks = [];

    // NSIS Header: 150x57 px
    const headerSrc = path.join(sourceDir, 'nsis-header.png');
    const headerDst = path.join(iconsDir, 'headerImage.bmp');
    tasks.push(generateBMP(headerSrc, headerDst, 150, 57, 'NSIS Header'));

    // NSIS Sidebar: 164x314 px  
    const sidebarSrc = path.join(sourceDir, 'nsis-sidebar.png');
    const sidebarDst = path.join(iconsDir, 'sidebarImage.bmp');
    tasks.push(generateBMP(sidebarSrc, sidebarDst, 164, 314, 'NSIS Sidebar'));

    await Promise.all(tasks);
    console.log('DONE');
}

main().catch(err => { console.error('FATAL: ' + err.message); process.exit(1); });
"@
        $bmpScriptPath = Join-Path $ProjectRoot "_gen-bmp-temp.cjs"
        Set-Content -Path $bmpScriptPath -Value $bmpScript -Encoding UTF8

        $bmpResult = & node $bmpScriptPath $IconsDir $SourceDir 2>&1
        $bmpResult | ForEach-Object {
            $line = $_
            if ($line -match "^OK:")   { Write-Ok ($line -replace "^OK:\s*", "") }
            elseif ($line -match "^SKIP:") { Write-Warn ($line -replace "^SKIP:\s*", "") }
            elseif ($line -match "^ERROR:") { Write-Err ($line -replace "^ERROR:\s*", "") }
            elseif ($line -match "^DONE") { Write-Ok "Imágenes NSIS generadas" }
            else { Write-Info $line }
        }

        # Eliminar script temporal
        Remove-Item $bmpScriptPath -Force -ErrorAction SilentlyContinue
    } else {
        Write-Warn "No se pudo generar BMPs (sharp no disponible)"
        Write-Info "Puedes instalar ImageMagick o ejecutar: npm install --save-dev sharp"
    }

    Pop-Location
}

# ══════════════════════════════════════════════════════════════════════════════
#  PASO 3: Copiar web-logo.png a destinos
# ══════════════════════════════════════════════════════════════════════════════
if (-not $SkipWebLogo -and $hasWebLogo) {
    Write-Step "Procesando logo web..."

    # Copiar a public/
    if (-not (Test-Path $PublicDir)) {
        New-Item -ItemType Directory -Path $PublicDir -Force | Out-Null
    }

    $webLogoDst1 = Join-Path $PublicDir "logo.png"
    Copy-Item $WebLogoSrc $webLogoDst1 -Force
    Write-Ok "Copiado a public/logo.png"

    # Copiar a resources/
    if (-not (Test-Path $ResourcesDir)) {
        New-Item -ItemType Directory -Path $ResourcesDir -Force | Out-Null
    }

    $webLogoDst2 = Join-Path $ResourcesDir "logo.png"
    Copy-Item $WebLogoSrc $webLogoDst2 -Force
    Write-Ok "Copiado a resources/logo.png"

    # Generar favicon.ico desde web-logo (si sharp está disponible)
    Push-Location $ProjectRoot
    $hasSharp = $false
    try {
        node -e "require('sharp')" 2>$null
        if ($LASTEXITCODE -eq 0) { $hasSharp = $true }
    } catch {}

    if ($hasSharp) {
        $faviconScript = @"
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function main() {
    const src = process.argv[2];
    const dstDir = process.argv[3];

    // Generar favicon-32x32.png y favicon-16x16.png
    await sharp(src).resize(32, 32).png().toFile(path.join(dstDir, 'favicon-32x32.png'));
    await sharp(src).resize(16, 16).png().toFile(path.join(dstDir, 'favicon-16x16.png'));
    await sharp(src).resize(180, 180).png().toFile(path.join(dstDir, 'apple-touch-icon.png'));
    await sharp(src).resize(192, 192).png().toFile(path.join(dstDir, 'logo-192.png'));
    await sharp(src).resize(512, 512).png().toFile(path.join(dstDir, 'logo-512.png'));
    console.log('OK');
}
main().catch(e => { console.error(e.message); process.exit(1); });
"@
        $faviconScriptPath = Join-Path $ProjectRoot "_gen-favicon-temp.cjs"
        Set-Content -Path $faviconScriptPath -Value $faviconScript -Encoding UTF8

        & node $faviconScriptPath $WebLogoSrc $PublicDir 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "Generados: favicon-32x32.png, favicon-16x16.png, apple-touch-icon.png, logo-192.png, logo-512.png"
        }

        Remove-Item $faviconScriptPath -Force -ErrorAction SilentlyContinue
    }
    Pop-Location
}

# ══════════════════════════════════════════════════════════════════════════════
#  PASO 4: Copiar splash-screen.png (si existe)
# ══════════════════════════════════════════════════════════════════════════════
if ($hasSplash) {
    Write-Step "Procesando splash screen..."

    if (-not (Test-Path $PublicDir))    { New-Item -ItemType Directory -Path $PublicDir -Force | Out-Null }
    if (-not (Test-Path $ResourcesDir)) { New-Item -ItemType Directory -Path $ResourcesDir -Force | Out-Null }

    Copy-Item $SplashSrc (Join-Path $PublicDir "splash.png") -Force
    Write-Ok "Copiado a public/splash.png"

    Copy-Item $SplashSrc (Join-Path $ResourcesDir "splash.png") -Force
    Write-Ok "Copiado a resources/splash.png"
}

# ══════════════════════════════════════════════════════════════════════════════
#  PASO 5: Copiar banner-promo.png (si existe)
# ══════════════════════════════════════════════════════════════════════════════
if ($hasBanner) {
    Write-Step "Procesando banner promocional..."

    if (-not (Test-Path $ResourcesDir)) { New-Item -ItemType Directory -Path $ResourcesDir -Force | Out-Null }

    Copy-Item $BannerSrc (Join-Path $ResourcesDir "banner-promo.png") -Force
    Write-Ok "Copiado a resources/banner-promo.png"
}

# ══════════════════════════════════════════════════════════════════════════════
#  RESUMEN FINAL
# ══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║          GENERACIÓN DE ICONOS COMPLETADA                   ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green

# Contar archivos generados
$tauriIcons = (Get-ChildItem $IconsDir -File | Where-Object { $_.Extension -in ".png", ".ico", ".icns", ".bmp" }).Count
$iosIcons   = if (Test-Path (Join-Path $IconsDir "ios")) { (Get-ChildItem (Join-Path $IconsDir "ios") -File -Filter "*.png").Count } else { 0 }
$androidIcons = if (Test-Path (Join-Path $IconsDir "android")) { (Get-ChildItem (Join-Path $IconsDir "android") -File -Filter "*.png" -Recurse).Count } else { 0 }

Write-Host ""
Write-Host "  Resumen:" -ForegroundColor White
Write-Host "    Iconos raíz:    $tauriIcons archivos" -ForegroundColor Gray
Write-Host "    Iconos iOS:     $iosIcons archivos" -ForegroundColor Gray
Write-Host "    Iconos Android: $androidIcons archivos" -ForegroundColor Gray

if (-not $SkipWebLogo -and $hasWebLogo) {
    $webIcons = (Get-ChildItem $PublicDir -File -Filter "*.png" -ErrorAction SilentlyContinue).Count
    Write-Host "    Web (public/):  $webIcons archivos" -ForegroundColor Gray
}
if ($hasSplash) {
    Write-Host "    Splash screen:  2 copias (public + resources)" -ForegroundColor Gray
}
if ($hasBanner) {
    Write-Host "    Banner promo:   1 copia (resources)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "  Los iconos están listos. Puedes compilar con:" -ForegroundColor White
Write-Host "    npx tauri build" -ForegroundColor Yellow
Write-Host ""
