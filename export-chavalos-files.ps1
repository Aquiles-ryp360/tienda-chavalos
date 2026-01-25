<# 
Export-Chavalos-SupportPack.ps1
Crea un ZIP con el código relevante (Frontend Next + Backend + Prisma + configs),
excluyendo carpetas pesadas y archivos sensibles.
Ejecutar en la raíz del repo.
#>

param(
  [string]$Root = (Get-Location).Path,
  [string]$OutDir = (Join-Path (Get-Location).Path "_EXPORTS"),
  [switch]$IncludeTauri # si quieres incluir ChavalosServerApp/src-tauri y src (normalmente NO hace falta)
)

$ErrorActionPreference = "Stop"

# ==== Ajustes ====
$excludeDirNames = @(
  "node_modules",".git",".next","dist","build","target",".vscode",".idea",
  ".turbo",".cache","coverage","out","tmp","temp",".pnpm-store",
  "_EXPORTS" # no re-empaques zips viejos
)

# Archivos sensibles (se omiten)
$excludeFilePatterns = @(
  ".env", ".env.*", "*.pem", "*.pfx", "*.p12", "*.key", "*id_rsa*", "*id_dsa*",
  "*secrets*", "*secret*", "*credentials*", "*passwd*", "*password*"
)

# Extensiones que SÍ copiamos (código + configs + prisma + css + docs)
$includeExt = @(
  ".ts",".tsx",".js",".mjs",".cjs",".json",".css",".scss",
  ".md",".txt",".prisma",".sql",".yml",".yaml",".toml",".lock"
)

# Directorios que queremos (robusto para este bug)
$includeDirs = @(
  "Frontend/NextJS_React/web/app",         # pages + api (incluye caja y /api/sales)
  "Frontend/NextJS_React/web/ui",          # components + pages (CajaView, stepper, slider)
  "Frontend/NextJS_React/web/lib",         # prisma/db/helpers
  "Frontend/NextJS_React/web/styles",
  "Frontend/NextJS_React/web/prisma",      # schema + migrations
  "Backend",                               # API/Validaciones/Autenticacion si lo usas
  "Base_de_datos/Prisma",                  # schema alterno (por si está vivo)
  "Despliegue/Hosting"                     # docker-compose / postgres-local (por contexto)
)

# Archivos sueltos útiles (si existen)
$includeFiles = @(
  "Frontend/NextJS_React/web/package.json",
  "Frontend/NextJS_React/web/package-lock.json",
  "Frontend/NextJS_React/web/pnpm-lock.yaml",
  "Frontend/NextJS_React/web/yarn.lock",
  "Frontend/NextJS_React/web/tsconfig.json",
  "Frontend/NextJS_React/web/next.config.js",
  "Frontend/NextJS_React/web/next.config.mjs",
  "Frontend/NextJS_React/web/tailwind.config.js",
  "Frontend/NextJS_React/web/postcss.config.js",
  "Frontend/NextJS_React/web/middleware.ts",
  "Frontend/NextJS_React/web/middleware.js",

  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock"
)

if ($IncludeTauri) {
  $includeDirs += @(
    "ChavalosServerApp/src",
    "ChavalosServerApp/src-tauri"
  )
}

# ==== Helpers ====
function Test-IsExcludedDir([string]$fullPath) {
  foreach ($d in $excludeDirNames) {
    if ($fullPath -match [regex]::Escape("\$d\") -or $fullPath.EndsWith("\$d")) { return $true }
  }
  return $false
}

function Test-IsSensitiveFile([string]$nameOrPath) {
  foreach ($p in $excludeFilePatterns) {
    if ($nameOrPath -like $p) { return $true }
  }
  return $false
}

function Test-IncludeExtension([string]$path) {
  $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
  return $includeExt -contains $ext
}

function Copy-PreserveRelative([string]$src, [string]$stageDir) {
  $rel = $src.Substring($Root.Length).TrimStart('\','/')
  $dst = Join-Path $stageDir $rel
  New-Item -ItemType Directory -Force -Path (Split-Path $dst -Parent) | Out-Null
  Copy-Item -Force -Path $src -Destination $dst
}

# ==== Staging ====
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$stage = Join-Path $OutDir ("_staging_supportpack_" + $ts)
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

$copied = New-Object System.Collections.Generic.List[string]
$missing = New-Object System.Collections.Generic.List[string]

Write-Host "==> Root: $Root"
Write-Host "==> Staging: $stage"
Write-Host ""

# ==== Copiar directorios ====
foreach ($relDir in $includeDirs) {
  $dir = Join-Path $Root $relDir
  if (-not (Test-Path $dir)) {
    $missing.Add("DIR: $relDir") | Out-Null
    continue
  }

  Write-Host "-> Escaneando dir: $relDir"
  Get-ChildItem -Path $dir -Recurse -File -Force | ForEach-Object {
    $full = $_.FullName

    if (Test-IsExcludedDir $full) { return }
    if (Test-IsSensitiveFile $_.Name) { return }
    if (Test-IsSensitiveFile $full) { return }
    if (-not (Test-IncludeExtension $full)) { return }

    Copy-PreserveRelative -src $full -stageDir $stage
    $copied.Add($full.Substring($Root.Length).TrimStart('\','/')) | Out-Null
  }
}

# ==== Copiar archivos sueltos ====
foreach ($relFile in $includeFiles) {
  $src = Join-Path $Root $relFile
  if (-not (Test-Path $src)) {
    $missing.Add("FILE: $relFile") | Out-Null
    continue
  }

  if (Test-IsSensitiveFile (Split-Path $src -Leaf)) { continue }
  if (Test-IsSensitiveFile $src) { continue }
  # permitimos lock/json aunque extensión ya esté en lista
  if (-not (Test-IncludeExtension $src)) { continue }

  Copy-PreserveRelative -src $src -stageDir $stage
  $copied.Add($relFile) | Out-Null
  Write-Host "OK file: $relFile"
}

# ==== Manifest ====
$manifestPath = Join-Path $stage "SUPPORTPACK_MANIFEST.txt"
$copiedSorted = $copied | Sort-Object
$missingSorted = $missing | Sort-Object

@"
Chavalos Support Pack
Timestamp: $ts
Root: $Root

== COPIED FILES (count: $($copiedSorted.Count)) ==
$($copiedSorted -join "`r`n")

== MISSING (NOT FOUND) ==
$($missingSorted -join "`r`n")
"@ | Set-Content -Encoding UTF8 -Path $manifestPath

# ==== ZIP ====
$zipPath = Join-Path $OutDir ("chavalos_supportpack_" + $ts + ".zip")
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zipPath -Force

# Cleanup staging (si quieres dejar staging, comenta estas 2 líneas)
Remove-Item -Recurse -Force $stage

Write-Host ""
Write-Host "LISTO ✅ ZIP generado:"
Write-Host $zipPath
Write-Host ""
Write-Host "Nota: El pack EXCLUYE .env y llaves/credenciales por seguridad."
