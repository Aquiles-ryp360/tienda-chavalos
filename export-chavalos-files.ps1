# export-chavalos-files.ps1
# Exporta archivos clave del proyecto y crea un ZIP manteniendo estructura de carpetas.

$ErrorActionPreference = "Stop"

# 1) Ajusta si tu raíz del proyecto es otra
$root = "D:\Aquiles\Tienda_Chavalos_Virtual_web"

if (-not (Test-Path $root)) {
  throw "No existe la ruta root: $root"
}

$ts = Get-Date -Format "yyyyMMdd_HHmmss"

# 2) ZIP de salida (puedes cambiar el destino)
$outDir = Join-Path $root "_EXPORTS"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$zipPath = Join-Path $outDir "chavalos_export_$ts.zip"

# 3) Lista de archivos a exportar (relativos a $root)
$files = @(
  # Backend (reglas anti-duplicados)
  "Backend\API\products.ts",
  "Backend\Validaciones\stock.ts",

  # Next API (traduce errores + búsqueda para sugerencias)
  "Frontend\NextJS_React\web\app\api\products\route.ts",
  "Frontend\NextJS_React\web\app\api\products\[id]\route.ts",

  # Prisma (modelo/DB)
  "Frontend\NextJS_React\web\prisma\schema.prisma",

  # Lib DB/Prisma
  "Frontend\NextJS_React\web\lib\prisma.ts",
  "Frontend\NextJS_React\web\lib\db.ts",

  # UI (form + modal productos)
  "Frontend\NextJS_React\web\ui\pages\admin\ProductFormView.tsx",
  "Frontend\NextJS_React\web\ui\pages\productos\ProductosView.tsx"
)

# (Opcional) estilos si existen (no fallará si no están)
$optional = @(
  "Frontend\NextJS_React\web\ui\pages\admin\product-form.module.css",
  "Frontend\NextJS_React\web\ui\pages\productos\productos.module.css"
)

# 4) Staging temporal con estructura
$stage = Join-Path $env:TEMP "chavalos_export_stage_$ts"
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

function Copy-RelFile($relPath) {
  $src = Join-Path $root $relPath
  if (-not (Test-Path $src)) {
    Write-Warning "NO ENCONTRADO: $relPath"
    return $false
  }

  $dest = Join-Path $stage $relPath
  $destDir = Split-Path $dest -Parent
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null
  Copy-Item -Force $src $dest
  Write-Host "OK: $relPath"
  return $true
}

Write-Host "== Copiando archivos a staging: $stage =="

$found = 0
foreach ($f in $files) {
  if (Copy-RelFile $f) { $found++ }
}

foreach ($f in $optional) {
  Copy-RelFile $f | Out-Null
}

if ($found -eq 0) {
  throw "No se encontró ningún archivo de la lista principal. Revisa que `\$root` esté bien."
}

# 5) Comprimir
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zipPath -Force

# 6) Limpiar staging
Remove-Item -Recurse -Force $stage

Write-Host ""
Write-Host "✅ ZIP creado:"
Write-Host $zipPath
Write-Host ""
Write-Host "Súbelo aquí en el chat y ya reviso todo con diffs exactos."
