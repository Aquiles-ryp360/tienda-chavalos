# ================================
# Ferreteria Chavalos - LAN Starter (MEJORADO + QR "PUNTITOS" EN CIAN)
# - Inicia PostgreSQL (Docker Compose)
# - Detecta la IP LAN correcta (por ruta por defecto)
# - Configura Firewall (solo si es Admin)
# - Genera QR OFFLINE en terminal con puntitos (CIAN) + PNG grande (mejor escaneo)
# - Inicia Next.js escuchando en LAN (0.0.0.0:3000)
# ================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ========= CONFIG =========
$repoRoot   = "D:\Aquiles\Tienda_Chavalos_Virtual_web"
$dockerPath = Join-Path $repoRoot "Despliegue\Hosting\postgres-local"
$nextPath   = Join-Path $repoRoot "Frontend\NextJS_React\web"
# ========= BACKUP CONFIG =========
$doBackupOnStart = $true
$backupDir       = "D:\Aquiles\Backups_Chavalos"
$backupKeepLast  = 30  # conserva últimos N zips (0 = no borrar)
$pgContainerName = "ferreteria_chavalos_db"


# ========= UI HELPERS =========
function Fail($msg) {
  Write-Host "❌ $msg" -ForegroundColor Red
  Write-Host ""
  Read-Host "Presiona Enter para salir"
  exit 1
}
function Info($msg) { Write-Host "ℹ️  $msg" -ForegroundColor Gray }
function Ok($msg)   { Write-Host "✅ $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "⚠️  $msg" -ForegroundColor Yellow }
function Step($msg) { Write-Host $msg -ForegroundColor Yellow }

function Test-Admin {
  try {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } catch { return $false }
}


function Get-PgEnvFromContainer {
  param([Parameter(Mandatory=$true)][string]$Container)

  $db   = (docker exec $Container printenv POSTGRES_DB 2>$null).Trim()
  $user = (docker exec $Container printenv POSTGRES_USER 2>$null).Trim()
  $pass = (docker exec $Container printenv POSTGRES_PASSWORD 2>$null).Trim()

  if (-not $db)   { $db = "postgres" }
  if (-not $user) { $user = "postgres" }

  return [pscustomobject]@{ DB=$db; USER=$user; PASS=$pass }
}

function Get-ExistingTables {
  param(
    [Parameter(Mandatory=$true)][string]$Container,
    [Parameter(Mandatory=$true)][string]$Db,
    [Parameter(Mandatory=$true)][string]$User,
    [Parameter(Mandatory=$true)][string]$Pass,
    [Parameter(Mandatory=$true)][string[]]$Tables
  )

  $existing = New-Object System.Collections.Generic.List[string]
  foreach ($t in $Tables) {
    # to_regclass devuelve null si no existe
    $q = "SELECT to_regclass('public.$t');"
    $res = docker exec -e PGPASSWORD=$Pass $Container psql -U $User -d $Db -tAc $q 2>$null
    $res = ($res | Out-String).Trim()
    if ($res -and $res -ne "null") {
      $existing.Add($t) | Out-Null
    }
  }
  return $existing.ToArray()
}

function Backup-KeyData {
  param(
    [Parameter(Mandatory=$true)][string]$Container,
    [Parameter(Mandatory=$true)][string]$BackupDir,
    [int]$KeepLast = 30
  )

  $ErrorActionPreference = "Stop"
  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"

  $env = Get-PgEnvFromContainer -Container $Container
  $db   = $env.DB
  $user = $env.USER
  $pass = $env.PASS

  # Tablas candidatas (si alguna no existe, se ignora automáticamente)
  $candidates = @(
    "products",
    "product_presentations",
    "price_changes",
    "sales",
    "sale_items",
    "sale_payments"
  )

  $tables = Get-ExistingTables -Container $Container -Db $db -User $user -Pass $pass -Tables $candidates
  if (-not $tables -or $tables.Count -eq 0) {
    throw "No se encontró ninguna tabla candidata (products/sales/...). Revisa nombres de tablas."
  }

  $dumpIn  = "/tmp/${db}_KEY_${ts}.dump"
  $dumpOut = Join-Path $BackupDir "${db}_KEY_${ts}.dump"
  $zipOut  = Join-Path $BackupDir "${db}_KEY_${ts}.zip"

  # Construir args -t public.table
  $tArgs = @()
  foreach ($t in $tables) { $tArgs += @("-t", "public.$t") }

  # Dump custom SOLO de esas tablas
  docker exec -e PGPASSWORD=$pass $Container pg_dump -U $user -d $db -Fc @tArgs -f $dumpIn | Out-Null

  # Verificación rápida del dump (TOC)
  $toc = docker exec $Container pg_restore -l $dumpIn 2>$null | Select-Object -First 8
  if (-not $toc) { throw "Dump creado pero no pude verificar con pg_restore -l." }

  # Copiar a host
  docker cp "${Container}:${dumpIn}" "$dumpOut" | Out-Null
  docker exec $Container rm -f $dumpIn 2>$null | Out-Null

  # Comprimir (guardando el .dump también suelto)
  Compress-Archive -Path @($dumpOut) -DestinationPath $zipOut -Force

  # Retención
  if ($KeepLast -gt 0) {
    $pattern = "${db}_KEY_*.zip"
    $zips = Get-ChildItem -Path $BackupDir -Filter $pattern -File |
            Sort-Object LastWriteTime -Descending
    if ($zips.Count -gt $KeepLast) {
      $toDelete = $zips | Select-Object -Skip $KeepLast
      foreach ($f in $toDelete) { Remove-Item -Force $f.FullName }
    }
  }

  return [pscustomobject]@{
    Zip  = $zipOut
    Dump = $dumpOut
    Tables = $tables -join ", "
  }
}



function Get-LanIPv4 {
  # 1) Interface de la ruta por defecto (mejor)
  try {
    $defaultRoute = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction Stop |
      Sort-Object -Property RouteMetric, InterfaceMetric |
      Select-Object -First 1

    if ($defaultRoute) {
      $ifIndex = $defaultRoute.InterfaceIndex
      $ipCfg   = Get-NetIPConfiguration -InterfaceIndex $ifIndex -ErrorAction Stop
      $ipv4    = $ipCfg.IPv4Address | Where-Object { $_.IPAddress -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1

      if ($ipv4) {
        return [pscustomobject]@{
          IP   = $ipv4.IPAddress
          IF   = $ipCfg.InterfaceAlias
          MODE = "DefaultRoute"
        }
      }
    }
  } catch {}

  # 2) Fallback: Wi-Fi primero si existe
  try {
    $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.IPAddress -notlike "172.17.*" -and
        $_.IPAddress -notlike "172.18.*" -and
        $_.IPAddress -notlike "172.19.*" -and
        $_.IPAddress -notlike "172.20.*" -and
        $_.IPAddress -notlike "172.21.*" -and
        $_.IPAddress -notlike "172.22.*" -and
        $_.IPAddress -notlike "172.23.*" -and
        $_.IPAddress -notlike "172.24.*"
      }

    if (-not $candidates -or $candidates.Count -eq 0) { return $null }

    $wifi = $candidates | Where-Object { $_.InterfaceAlias -match "Wi-Fi|WLAN|Wireless" } | Select-Object -First 1
    if ($wifi) {
      return [pscustomobject]@{ IP = $wifi.IPAddress; IF = $wifi.InterfaceAlias; MODE = "WiFiMatch" }
    }

    $first = $candidates | Select-Object -First 1
    return [pscustomobject]@{ IP = $first.IPAddress; IF = $first.InterfaceAlias; MODE = "FirstValid" }
  } catch {
    return $null
  }
}

function Ensure-QrcodePkg {
  param([Parameter(Mandatory=$true)][string]$ProjectPath)

  $pkgJson = Join-Path $ProjectPath "package.json"
  if (!(Test-Path $pkgJson)) { throw "No encontré package.json en: $ProjectPath" }

  $qrcodeDir = Join-Path $ProjectPath "node_modules\qrcode"
  if (Test-Path $qrcodeDir) { return }

  Info "Instalando 'qrcode' (solo la primera vez)..."
  Push-Location $ProjectPath
  try {
    $result = npm install qrcode --save-dev 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw "npm install falló: $result"
    }
  } finally {
    Pop-Location
  }

  if (!(Test-Path $qrcodeDir)) {
    throw "No se pudo instalar 'qrcode'. Revisa Node/NPM y permisos."
  }
}

function Show-QrDotsCyan {
  param(
    [Parameter(Mandatory=$true)][string]$ProjectPath,
    [Parameter(Mandatory=$true)][string]$Url
  )

  # Nota: render de "puntitos" puede ser menos escaneable en consola.
  # Por eso además generamos PNG grande para escaneo real.
  $js = @'
const QRCode = require("qrcode");

const url = process.argv[2];
const qr = QRCode.create(url, { errorCorrectionLevel: "M" });

const size = qr.modules.size;
const data = qr.modules.data;

// "puntitos" (mejor que '.' porque llena más el módulo)
const DARK  = "● ";   // 2 chars de ancho (consistencia visual)
const LIGHT = "  ";

const QUIET = 2; // margen (quiet zone)

// ANSI: cyan
const CYAN  = "\x1b[36m";
const RESET = "\x1b[0m";

let out = "";
for (let y = -QUIET; y < size + QUIET; y++) {
  let line = "";
  for (let x = -QUIET; x < size + QUIET; x++) {
    let isDark = false;
    if (x >= 0 && y >= 0 && x < size && y < size) {
      isDark = data[y * size + x] === true;
    }
    line += isDark ? DARK : LIGHT;
  }
  out += CYAN + line + RESET + "\n";
}
process.stdout.write(out);
'@

  $tempJs = Join-Path $env:TEMP "qr_dots_chavalos.js"
  Set-Content -Path $tempJs -Value $js -Encoding UTF8

  Push-Location $ProjectPath
  try {
    node $tempJs $Url
  } finally {
    Pop-Location
    Remove-Item $tempJs -Force -ErrorAction SilentlyContinue
  }
}

function Make-QrPng {
  param(
    [Parameter(Mandatory=$true)][string]$Url,
    [Parameter(Mandatory=$true)][string]$OutPng
  )

  # Usar API pública qrserver.com (sin dependencias)
  $apiUrl = "https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=$([System.Web.HttpUtility]::UrlEncode($Url))"
  
  try {
    $response = Invoke-WebRequest -Uri $apiUrl -OutFile $OutPng -UseBasicParsing -TimeoutSec 10
    Start-Sleep -Milliseconds 300
  } catch {
    throw "Error descargando QR desde API: $($_.Exception.Message)"
  }
}

# ========= HEADER =========
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🚀 INICIO AUTOMATICO LAN" -ForegroundColor Cyan
Write-Host "  Ferreteria Chavalos" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========= CHECK PATHS =========
if (!(Test-Path $repoRoot))   { Fail "No se encontró repoRoot: $repoRoot" }
if (!(Test-Path $dockerPath)) { Fail "No se encontró dockerPath: $dockerPath" }
if (!(Test-Path $nextPath))   { Fail "No se encontró nextPath: $nextPath" }

$IsAdmin = Test-Admin
if ($IsAdmin) { Ok "Modo Admin: SI (Firewall OK)" } else { Warn "Modo Admin: NO (Firewall puede fallar, igual funciona si la red es privada)" }
Write-Host ""

# ========= [1] DOCKER =========
Step "[1/4] Verificando Docker..."
try {
  docker version *> $null
  Ok "Docker está disponible"
} catch {
  Fail "Docker NO está disponible. Abre Docker Desktop y vuelve a ejecutar."
}
Write-Host ""

# ========= [2] POSTGRES =========
Step "[2/4] Iniciando PostgreSQL..."
Set-Location $dockerPath
Info "Compose dir: $dockerPath"

try {
  $running = docker compose ps --status running --quiet
  if ($running) {
    Ok "PostgreSQL ya está corriendo"
  } else {
    Info "Levantando contenedor..."
    docker compose up -d
    
    # Esperar a que PostgreSQL esté realmente listo para aceptar conexiones
    Info "Esperando a que PostgreSQL esté listo..."
    $maxRetries = 30
    $retryCount = 0
    $isReady = $false
    
    while ($retryCount -lt $maxRetries -and -not $isReady) {
      $retryCount++
      Start-Sleep -Seconds 1
      
      # Verificar si el contenedor acepta conexiones
      $healthCheck = docker compose exec -T postgres pg_isready -U ferre 2>&1
      if ($healthCheck -match "accepting connections") {
        $isReady = $true
        Ok "PostgreSQL está listo y aceptando conexiones"
      } else {
        Write-Host "." -NoNewline -ForegroundColor DarkGray
      }
    }
    
    Write-Host ""
    if (-not $isReady) {
      Fail "PostgreSQL no respondió después de 30 segundos. Verifica los logs con: docker compose logs"
    }
  }
} catch {
  Fail "Error iniciando PostgreSQL con docker compose. Revisa docker-compose.yml en $dockerPath"
}
Write-Host ""


# ========= [2.5] BACKUP AUTOMÁTICO =========
if ($doBackupOnStart) {
  Step "[2.5/4] Backup automático (productos/ventas)..."
  try {
    $result = Backup-KeyData -Container $pgContainerName -BackupDir $backupDir -KeepLast $backupKeepLast
    Ok "Backup KEY OK: $($result.Zip)"
    Info "Tablas incluidas: $($result.Tables)"
  } catch {
    Warn "Backup KEY falló (no detengo el arranque): $($_.Exception.Message)"
  }
  Write-Host ""
}


# ========= [3] IP LAN =========
Step "[3/4] Detectando IP LAN correcta..."
$lan = Get-LanIPv4
if (-not $lan) { Fail "No se encontró una IP LAN válida. Conéctate a Wi-Fi/LAN y vuelve a ejecutar." }

$ipAddress = $lan.IP
$ifName    = $lan.IF
Info "Interfaz: $ifName ($($lan.MODE))"
Ok "IP LAN: $ipAddress"
Write-Host ""

# ========= FIREWALL =========
Step "[3.5/4] Configurando Firewall (TCP 3000)..."
if ($IsAdmin) {
  try {
    $ruleName = "FerreteriaChavalos Next 3000"
    $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $existing) {
      New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 | Out-Null
      Ok "Firewall configurado: $ruleName"
    } else {
      Ok "Regla de Firewall ya existe: $ruleName"
    }
  } catch {
    Warn "No se pudo configurar Firewall. Motivo: $($_.Exception.Message)"
  }
} else {
  Warn "No se configuró Firewall: ejecuta PowerShell/VSCode como Administrador si lo necesitas."
}
Write-Host ""

# ========= SERVICIOS =========
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ SERVICIOS LISTOS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ PostgreSQL: localhost:5432" -ForegroundColor Green
Write-Host "🌐 Next.js LAN: http://$ipAddress`:3000" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========= [4] QR =========
Step "[4/4] Generando QR..."
$url = "http://$ipAddress`:3000"

# Copiar URL al portapapeles
try { Set-Clipboard -Value $url } catch {}

# Forzar salida UTF-8 (importante para puntitos)
try { chcp 65001 > $null } catch {}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        📱 ACCESO DESDE MOVIL                   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  URL: $url" -ForegroundColor Yellow
Write-Host "  (Copiado al portapapeles)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  📷 QR en terminal (PUNTITOS + CIAN):" -ForegroundColor Green
Write-Host ""

try {
  # Instala qrcode (offline) y renderiza puntitos
  Ensure-QrcodePkg -ProjectPath $nextPath
  Show-QrDotsCyan -ProjectPath $nextPath -Url $url

  # PNG grande (lo más escaneable) - descargado desde API pública
  $qrPng = Join-Path $repoRoot "LAN-QR.png"
  Make-QrPng -Url $url -OutPng $qrPng

  Ok "QR PNG generado: $qrPng"
  Info "Abriendo el QR PNG (recomendado para escanear rápido)..."
  Start-Process "$qrPng"
} catch {
  Warn "No pude generar QR. Motivo: $($_.Exception.Message)"
  Write-Host "  Usa esta URL manualmente: $url" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        💻 ACCESO LOCAL                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ========= START NEXT =========
Info "Iniciando Next.js..."
Info "(Ctrl+C para detener)"
Write-Host ""

Set-Location $nextPath
npx next dev -H 0.0.0.0 -p 3000
