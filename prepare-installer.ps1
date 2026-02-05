# prepare-installer.ps1
# Automatiza la preparacion para generar el instalador MSI con Tauri sin poner en riesgo la rama actual.

[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Section {
    param([string]$Text)
    Write-Host "`n=== $Text ===" -ForegroundColor Cyan
}

function Write-Warn {
    param([string]$Text)
    Write-Host $Text -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Text)
    Write-Host $Text -ForegroundColor Green
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [switch]$Silent
    )

    if ($Silent) {
        & $FilePath @Arguments *> $null
    }
    else {
        & $FilePath @Arguments
    }

    if ($LASTEXITCODE -ne 0) {
        $joined = $Arguments -join ' '
        throw "El comando '$FilePath $joined' fallo con codigo $LASTEXITCODE"
    }
}

$repoRoot = Split-Path -Parent (Resolve-Path $MyInvocation.MyCommand.Definition)
Set-Location $repoRoot
Write-Info "Raiz del repo: $repoRoot"

# 1) Seguridad Git
Write-Section "1) Seguridad Git"
if (-not (Test-Path (Join-Path $repoRoot ".git"))) {
    throw "No se encontro carpeta .git en $repoRoot. Abortando para proteger el codigo."
}

Invoke-Checked git @("rev-parse", "--is-inside-work-tree") -Silent

$pending = & git status --porcelain
if (-not [string]::IsNullOrWhiteSpace($pending)) {
    Write-Warn "Cambios pendientes detectados. Creando commit de respaldo."
    Invoke-Checked git @("add", ".")
    Invoke-Checked git @("commit", "-m", "Backup automatico antes de iniciar configuracion de instalador")
}
else {
    Write-Info "Sin cambios pendientes; se omite commit de respaldo."
}

$targetBranch = "feature/instalador-tauri"
& git show-ref --verify --quiet ("refs/heads/$targetBranch")
$branchExists = ($LASTEXITCODE -eq 0)

if ($branchExists) {
    Write-Warn "La rama $targetBranch ya existe. Se cambiara a ella sin recrearla."
    & git switch $targetBranch *> $null
    if ($LASTEXITCODE -ne 0) {
        Invoke-Checked git @("checkout", $targetBranch)
    }
}
else {
    Write-Info "Creando y cambiando a $targetBranch"
    & git switch "-c" $targetBranch *> $null
    if ($LASTEXITCODE -ne 0) {
        Invoke-Checked git @("checkout", "-b", $targetBranch)
    }
}

# 2) Compilacion del backend (sidecar)
Write-Section "2) Compilacion backend"
if (-not (Get-Command pkg -ErrorAction SilentlyContinue)) {
    Write-Warn "pkg no esta instalado. Instalando globalmente con npm -g."
    Invoke-Checked npm @("i", "-g", "pkg")
}
else {
    Write-Info "pkg detectado."
}

$backendPath = Join-Path $repoRoot "ChavalosServerApp/bundle/project/web-server"
if (-not (Test-Path $backendPath)) {
    throw "No se encontro la carpeta backend esperada en $backendPath"
}

$serverEntry = Join-Path $backendPath "server.js"
if (-not (Test-Path $serverEntry)) {
    throw "No se encontro server.js en $backendPath"
}

$compiledExe = Join-Path $backendPath "server-backend.exe"
Push-Location $backendPath
try {
    Write-Info "Compilando server.js -> node18-win-x64"
    Invoke-Checked pkg @($serverEntry, "--targets", "node18-win-x64", "--output", $compiledExe)
}
finally {
    Pop-Location
}

# 3) Estructura Tauri: binaries
Write-Section "3) Estructura Tauri (binaries)"
$binariesDir = Join-Path $repoRoot "ChavalosServerApp/src-tauri/binaries"
New-Item -ItemType Directory -Force -Path $binariesDir | Out-Null

$rustInfo = & rustc -Vv 2>$null
if (-not $rustInfo) {
    throw "rustc no esta disponible en PATH. Instala Rust antes de continuar."
}
$hostLine = $rustInfo | Where-Object { $_ -like "host:*" }
$rustTarget = ($hostLine -replace "host:\s*", "").Trim()
if ([string]::IsNullOrWhiteSpace($rustTarget)) {
    throw "No se pudo leer el target triple desde rustc -Vv."
}

$finalExeName = "server-backend-$rustTarget.exe"
$destExe = Join-Path $binariesDir $finalExeName
Write-Info "Moviendo ejecutable a binaries como $finalExeName"
Move-Item -Force -Path $compiledExe -Destination $destExe

# 4) Gestion de recursos
Write-Section "4) Recursos (docker-compose y Prisma)"
$resourcesDir = Join-Path $repoRoot "ChavalosServerApp/src-tauri/resources"
New-Item -ItemType Directory -Force -Path $resourcesDir | Out-Null

$dockerSrc = Join-Path $repoRoot "Despliegue/Hosting/postgres-local/docker-compose.yml"
if (-not (Test-Path $dockerSrc)) {
    throw "No se encontro docker-compose.yml en $dockerSrc"
}
Copy-Item -Force $dockerSrc -Destination $resourcesDir

$prismaCandidates = @(
    (Join-Path $repoRoot "Frontend/NextJS_React/web/prisma"),
    (Join-Path $repoRoot "Base_de_datos/Prisma")
)
$prismaSource = $prismaCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $prismaSource) {
    throw "No se encontro ninguna carpeta Prisma en las rutas esperadas."
}

$prismaDest = Join-Path $resourcesDir "Prisma"
if (Test-Path $prismaDest) {
    Write-Warn "Ya existe Prisma en resources. Se sobrescribira el contenido."
}
Copy-Item -Recurse -Force $prismaSource -Destination $prismaDest

# 5) Advertencia Next.js
Write-Section "5) Configuracion manual Next.js"
Write-Warn "Recuerda ajustar next.config.js para que output sea 'export' antes de construir el instalador MSI."

Write-Info "Proceso completado."
