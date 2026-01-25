param(
  [string]$ProjectRoot = (Get-Location).Path,
  [string]$OutBaseDir  = (Join-Path (Get-Location).Path "_SUPPORTPACKS"),
  [switch]$OpenFolder
)

$ErrorActionPreference = "Stop"

function Copy-RelFile {
  param([string]$RelPath, [string]$Tag)

  $src = Join-Path $ProjectRoot $RelPath
  if (-not (Test-Path $src)) {
    Write-Host "[-] ($Tag) NO EXISTE: $RelPath" -ForegroundColor Yellow
    return
  }
  $dst = Join-Path $outDir $RelPath
  New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
  Copy-Item -LiteralPath $src -Destination $dst -Force
  Write-Host "[+] ($Tag) Copiado: $RelPath" -ForegroundColor Green
}

$ts = Get-Date -Format "yyyyMMdd_HHmmss"
$outDir = Join-Path $OutBaseDir "cart_unit_fix_supportpack_robusto_$ts"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# ===== FRONTEND / NEXT (mínimo + recomendado) =====
$nextFiles = @(
  "Frontend/NextJS_React/web/ui/pages/ventas/VentasView.tsx",
  "Frontend/NextJS_React/web/ui/pages/ventas/ventas.module.css",
  "Frontend/NextJS_React/web/app/ventas/page.tsx",

  "Frontend/NextJS_React/web/ui/pages/caja/CajaView.tsx",
  "Frontend/NextJS_React/web/ui/pages/caja/caja.module.css",
  "Frontend/NextJS_React/web/app/caja/page.tsx",

  "Frontend/NextJS_React/web/ui/components/BottomNav.tsx",
  "Frontend/NextJS_React/web/ui/components/Header.tsx",

  "Frontend/NextJS_React/web/ui/pages/admin/ProductFormView.tsx",
  "Frontend/NextJS_React/web/ui/pages/admin/product-form.module.css",
  "Frontend/NextJS_React/web/ui/pages/productos/ProductosView.tsx",
  "Frontend/NextJS_React/web/ui/pages/productos/productos.module.css",

  "Frontend/NextJS_React/web/app/api/products/route.ts",
  "Frontend/NextJS_React/web/app/api/products/[id]/route.ts",
  "Frontend/NextJS_React/web/app/api/sales/route.ts",
  "Frontend/NextJS_React/web/app/api/sales/[id]/route.ts",

  "Frontend/NextJS_React/web/lib/prisma.ts",
  "Frontend/NextJS_React/web/lib/db.ts",

  "Frontend/NextJS_React/web/prisma/schema.prisma",
  "Frontend/NextJS_React/web/package.json"
)

# ===== BACKEND externo (por si acaso) =====
$backendFiles = @(
  "Backend/API/products.ts",
  "Backend/API/sales.ts",
  "Backend/API/price-changes.ts",
  "Backend/Validaciones/stock.ts",
  "Backend/Autenticacion/auth.ts",
  "Base_de_datos/Prisma/schema.prisma"
)

foreach ($f in $nextFiles)   { Copy-RelFile -RelPath $f -Tag "NEXT" }
foreach ($f in $backendFiles){ Copy-RelFile -RelPath $f -Tag "BACK" }

$zipPath = "$outDir.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $outDir "*") -DestinationPath $zipPath -Force

Write-Host ""
Write-Host "[OK] ZIP creado: $zipPath" -ForegroundColor Cyan

if ($OpenFolder) { Start-Process explorer.exe (Split-Path $zipPath -Parent) }
