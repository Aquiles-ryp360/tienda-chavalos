# ================================================================================================
# CHAVALOS SERVER LAUNCHER
# Versión 3.0 - Producción con Logging Robusto y Readiness Check
# ================================================================================================
# Este script funciona en DOS modos:
# - PRODUCCIÓN: usa recursos empaquetados (bundle/project)
# - DESARROLLO: usa rutas del repositorio original
# ================================================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectRoot,  # Ruta al bundle/project (PROD) o repo raíz (DEV)
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('dev', 'prod')]
    [string]$Mode = 'prod',
    
    [Parameter(Mandatory=$false)]
    [int]$Port = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ========= CONFIGURACIÓN GLOBAL =========
$LogDir = Join-Path $env:APPDATA "com.chavalos.server\logs"
$LogTimestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$LogFile = Join-Path $LogDir "server-$LogTimestamp.log"
$NodeProcess = $null

# Crear directorio de logs si no existe
if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# ========= TRAP PARA ERRORES GLOBALES =========
trap {
    Write-AppLog "❌ ERROR CRÍTICO: $_" "ERROR"
    Write-AppLog "StackTrace: $($_.ScriptStackTrace)" "ERROR"
    
    # Terminar proceso Node si está corriendo
    if ($NodeProcess -and !$NodeProcess.HasExited) {
        Write-AppLog "Terminando proceso Node (PID: $($NodeProcess.Id))..." "ERROR"
        $NodeProcess.Kill()
    }
    
    exit 1
}

# ========= DETECTAR MODO =========
$IsProductionBundle = $ProjectRoot -like "*bundle\project*" -or (Test-Path (Join-Path $ProjectRoot "web-server\server.js"))
if ($IsProductionBundle) {
    $Mode = "prod"
    Write-Output "🎯 MODO: PRODUCCIÓN (bundle auto-contenido)"
} else {
    Write-Output "🔧 MODO: DESARROLLO (repositorio)"
}

# ========= CONFIGURACIÓN DE RUTAS =========
if ($IsProductionBundle) {
    # PRODUCCIÓN: rutas dentro del bundle
    $webServerPath  = Join-Path $ProjectRoot "web-server"
    $dbPath         = Join-Path $ProjectRoot "deployment\Hosting\postgres-local"
    $backendPath    = Join-Path $ProjectRoot "backend"
    $deployPath     = Join-Path $ProjectRoot "deployment"
} else {
    # DESARROLLO: rutas del repositorio original
    $webServerPath  = Join-Path $ProjectRoot "Frontend\NextJS_React\web"
    $dbPath         = Join-Path $ProjectRoot "Despliegue\Hosting\postgres-local"
    $backendPath    = Join-Path $ProjectRoot "Backend"
    $deployPath     = Join-Path $ProjectRoot "Despliegue"
}

# ========= FUNCIONES HELPER =========
function Write-AppLog {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    $timestamp = Get-Date -Format "HH:mm:ss"
    $logLine = "[$timestamp] [$Level] $Message"
    Write-Output $logLine
    Add-Content -Path $LogFile -Value $logLine -Encoding UTF8
}

function Show-DiagnosticInfo {
    Write-AppLog "═══════════════════════════════════════" "INFO"
    Write-AppLog "🔍 DIAGNÓSTICO DEL SISTEMA" "INFO"
    Write-AppLog "═══════════════════════════════════════" "INFO"
    
    # PowerShell version
    $psVersion = $PSVersionTable.PSVersion
    Write-AppLog "PowerShell: v$psVersion ($($PSVersionTable.PSEdition))" "INFO"
    
    # Admin check
    try {
        $id = [Security.Principal.WindowsIdentity]::GetCurrent()
        $p  = New-Object Security.Principal.WindowsPrincipal($id)
        $isAdmin = $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        if ($isAdmin) {
            Write-AppLog "Permisos: Administrador ✅" "INFO"
        } else {
            Write-AppLog "Permisos: Usuario estándar (no admin)" "WARN"
        }
    } catch {
        Write-AppLog "Permisos: No se pudo determinar" "WARN"
    }
    
    # Rutas clave
    Write-AppLog "ProjectRoot: $ProjectRoot" "INFO"
    Write-AppLog "WebServerPath: $webServerPath" "INFO"
    Write-AppLog "DBPath: $dbPath" "INFO"
    
    # Validar que server.js existe (o package.json en dev)
    if ($IsProductionBundle) {
        $serverEntry = Join-Path $webServerPath "server.js"
        if (Test-Path $serverEntry) {
            $serverSize = (Get-Item $serverEntry).Length
            Write-AppLog "server.js: ✅ Existe ($serverSize bytes)" "INFO"
        } else {
            Write-AppLog "server.js: ❌ NO ENCONTRADO en $serverEntry" "ERROR"
        }
    } else {
        $pkgJson = Join-Path $webServerPath "package.json"
        if (Test-Path $pkgJson) {
            Write-AppLog "package.json: ✅ Existe" "INFO"
        } else {
            Write-AppLog "package.json: ❌ NO ENCONTRADO" "ERROR"
        }
    }
    
    Write-AppLog "═══════════════════════════════════════" "INFO"
    Write-AppLog "" "INFO"
}

function Test-Admin {
    try {
        $id = [Security.Principal.WindowsIdentity]::GetCurrent()
        $p  = New-Object Security.Principal.WindowsPrincipal($id)
        return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch { return $false }
}

function Get-LanIPv4 {
    try {
        $defaultRoute = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction Stop |
            Sort-Object -Property RouteMetric, InterfaceMetric |
            Select-Object -First 1

        if ($defaultRoute) {
            $ifIndex = $defaultRoute.InterfaceIndex
            $ipCfg   = Get-NetIPConfiguration -InterfaceIndex $ifIndex -ErrorAction Stop
            $ipv4    = $ipCfg.IPv4Address | Where-Object { 
                $_.IPAddress -and $_.IPAddress -notlike "169.254.*" 
            } | Select-Object -First 1

            if ($ipv4) {
                return [pscustomobject]@{
                    IP   = $ipv4.IPAddress
                    IF   = $ipCfg.InterfaceAlias
                }
            }
        }
    } catch {}

    # Fallback
    try {
        $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object {
                $_.IPAddress -notlike "127.*" -and
                $_.IPAddress -notlike "169.254.*" -and
                $_.IPAddress -notlike "172.1*"
            }

        if ($candidates) {
            $wifi = $candidates | Where-Object { 
                $_.InterfaceAlias -match "Wi-Fi|WLAN|Wireless" 
            } | Select-Object -First 1
            
            if ($wifi) {
                return [pscustomobject]@{ IP = $wifi.IPAddress; IF = $wifi.InterfaceAlias }
            }

            $first = $candidates | Select-Object -First 1
            return [pscustomobject]@{ IP = $first.IPAddress; IF = $first.InterfaceAlias }
        }
    } catch {}

    return $null
}

function New-QrPng {
    param(
        [string]$Url,
        [string]$OutPng
    )

    try {
        $apiUrl = "https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=$([uri]::EscapeDataString($Url))"
        Invoke-WebRequest -Uri $apiUrl -OutFile $OutPng -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop | Out-Null
        Start-Sleep -Milliseconds 500
        return $true
    } catch {
        Write-AppLog "Error generando QR: $_" "WARN"
        return $false
    }
}

function Test-TcpPort {
    param(
        [string]$HostName = "127.0.0.1",
        [int]$Port,
        [int]$TimeoutSeconds = 15
    )
    
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    
    while ((Get-Date) -lt $deadline) {
        try {
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $connection = $tcpClient.BeginConnect($HostName, $Port, $null, $null)
            $wait = $connection.AsyncWaitHandle.WaitOne(1000, $false)
            
            if ($wait) {
                try {
                    $tcpClient.EndConnect($connection)
                    $tcpClient.Close()
                    return $true
                } catch {
                    $tcpClient.Close()
                }
            } else {
                $tcpClient.Close()
            }
        } catch {}
        
        Start-Sleep -Milliseconds 500
    }
    
    return $false
}

# ========= INICIO =========
Write-AppLog "═══════════════════════════════════════" "INFO"
Write-AppLog "🚀 CHAVALOS SERVER LAUNCHER v3.0" "INFO"
Write-AppLog "═══════════════════════════════════════" "INFO"
Write-AppLog "Modo: $Mode | Puerto: $Port" "INFO"
Write-AppLog "Log: $LogFile" "INFO"
Write-AppLog "" "INFO"

# Mostrar diagnóstico del sistema
Show-DiagnosticInfo

# Validar ruta raíz
if (!(Test-Path $ProjectRoot)) {
    Write-AppLog "ERROR: Proyecto no encontrado: $ProjectRoot" "ERROR"
    exit 1
}

$IsAdmin = Test-Admin
if ($IsAdmin) {
    Write-AppLog "✅ Ejecutando con privilegios de Administrador" "INFO"
} else {
    Write-AppLog "⚠️  Ejecutando sin privilegios de Admin (firewall puede requerir configuración manual)" "WARN"
}

# ========= [1/6] VERIFICAR PREREQUISITOS =========
Write-AppLog "[1/6] Verificando prerequisitos..." "INFO"

# Check Docker
try {
    docker version 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $dockerVersion = docker --version
        Write-AppLog "✅ Docker disponible: $dockerVersion" "INFO"
    } else {
        throw "Docker no responde"
    }
} catch {
    Write-AppLog "❌ ERROR: Docker NO está disponible" "ERROR"
    Write-AppLog "   Por favor, instala Docker Desktop desde:" "ERROR"
    Write-AppLog "   https://www.docker.com/products/docker-desktop" "ERROR"
    Write-AppLog "   Luego, inicia Docker Desktop y vuelve a intentar." "ERROR"
    exit 1
}

# Check Node.js
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-AppLog "✅ Node.js disponible: $nodeVersion" "INFO"
    } else {
        throw "Node no responde"
    }
} catch {
    Write-AppLog "❌ ERROR: Node.js NO está disponible" "ERROR"
    Write-AppLog "   Por favor, instala Node.js (versión LTS) desde:" "ERROR"
    Write-AppLog "   https://nodejs.org/" "ERROR"
    exit 1
}

# ========= [2/6] VALIDAR RUTAS =========
Write-AppLog "[2/6] Validando rutas del proyecto..." "INFO"

if (!(Test-Path $dbPath)) {
    Write-AppLog "❌ ERROR: Carpeta de DB no encontrada: $dbPath" "ERROR"
    exit 1
}

if (!(Test-Path $webServerPath)) {
    Write-AppLog "❌ ERROR: Carpeta del servidor web no encontrada: $webServerPath" "ERROR"
    exit 1
}

# Validar que existe el punto de entrada del web server
if ($IsProductionBundle) {
    $serverEntry = Join-Path $webServerPath "server.js"
    if (!(Test-Path $serverEntry)) {
        Write-AppLog "❌ ERROR: No se encontró server.js en el bundle" "ERROR"
        Write-AppLog "   Ruta esperada: $serverEntry" "ERROR"
        Write-AppLog "   Asegúrate de que el build.ps1 se ejecutó correctamente" "ERROR"
        exit 1
    }
    Write-AppLog "✅ Punto de entrada encontrado: server.js" "INFO"
} else {
    $packageJson = Join-Path $webServerPath "package.json"
    if (!(Test-Path $packageJson)) {
        Write-AppLog "❌ ERROR: No se encontró package.json en modo desarrollo" "ERROR"
        exit 1
    }
    Write-AppLog "✅ package.json encontrado" "INFO"
}

Write-AppLog "✅ Rutas validadas correctamente" "INFO"

# ========= [3/6] INICIAR POSTGRESQL =========
Write-AppLog "[3/6] Iniciando PostgreSQL..." "INFO"
Push-Location $dbPath
try {
    # Verificar si ya está corriendo
    Write-AppLog "Verificando estado de contenedor..." "INFO"
    $psOutput = docker compose ps --status running --quiet 2>&1 | Out-String
    $psExitCode = $LASTEXITCODE
    
    if ($psExitCode -eq 0 -and $psOutput.Trim()) {
        Write-AppLog "✅ PostgreSQL ya está corriendo" "INFO"
    } else {
        Write-AppLog "Levantando contenedor PostgreSQL..." "INFO"
        
        # Capturar stderr sin fallar por warnings
        $tempError = New-TemporaryFile
        $upOutput = docker compose up -d 2>"$tempError" | Out-String
        $upExitCode = $LASTEXITCODE
        $stderrContent = Get-Content "$tempError" -Raw -ErrorAction SilentlyContinue
        Remove-Item "$tempError" -Force -ErrorAction SilentlyContinue
        
        # Loguear stdout
        if ($upOutput) {
            $upOutput -split "`n" | ForEach-Object {
                if ($_.Trim()) { Write-AppLog $_ "INFO" }
            }
        }
        
        # Loguear stderr inteligentemente
        if ($stderrContent) {
            $stderrContent -split "`n" | ForEach-Object {
                $line = $_.Trim()
                if ($line) {
                    # Warnings conocidos de Docker Compose (NO son errores)
                    if ($line -match "attribute.*version.*obsolete|level=warning|WARN") {
                        Write-AppLog $line "WARN"
                    } else {
                        Write-AppLog $line "INFO"
                    }
                }
            }
        }
        
        # SOLO fallar si exit code != 0
        if ($upExitCode -ne 0) {
            throw "docker compose up falló con exit code $upExitCode"
        }
        
        Write-AppLog "Esperando a que PostgreSQL esté listo..." "INFO"
        $maxRetries = 30
        $retryCount = 0
        $isReady = $false
        
        while ($retryCount -lt $maxRetries -and -not $isReady) {
            $retryCount++
            Start-Sleep -Seconds 1
            
            # Verificar readiness (ignorar stderr warnings)
            $healthCheck = docker compose exec -T postgres pg_isready -U ferre 2>&1 | Out-String
            if ($healthCheck -match "accepting connections") {
                $isReady = $true
                Write-AppLog "✅ PostgreSQL está listo" "INFO"
            } else {
                Write-Host "." -NoNewline
            }
        }
        
        Write-Host ""
        if (-not $isReady) {
            Write-AppLog "❌ PostgreSQL no respondió después de 30 segundos" "ERROR"
            exit 1
        }
    }
} catch {
    Write-AppLog "❌ Error iniciando PostgreSQL: $_" "ERROR"
    exit 1
} finally {
    Pop-Location
}

# ========= [4/6] DETECTAR IP LAN =========
Write-AppLog "[4/6] Detectando IP LAN..." "INFO"
$lan = Get-LanIPv4
if (-not $lan) {
    Write-AppLog "⚠️  No se detectó IP LAN. Servidor solo accesible en localhost." "WARN"
    $ipAddress = "localhost"
} else {
    $ipAddress = $lan.IP
    Write-AppLog "✅ IP LAN detectada: $ipAddress (Interfaz: $($lan.IF))" "INFO"
}

# ========= [5/6] CONFIGURAR FIREWALL =========
Write-AppLog "[5/6] Configurando Firewall..." "INFO"
if ($IsAdmin -and $ipAddress -ne "localhost") {
    try {
        $ruleName = "FerreteriaChavalos Next $Port"
        $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
        if (-not $existing) {
            New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -ErrorAction Stop | Out-Null
            Write-AppLog "✅ Regla de firewall creada: $ruleName" "INFO"
        } else {
            Write-AppLog "✅ Regla de firewall ya existe" "INFO"
        }
    } catch {
        Write-AppLog "⚠️  No se pudo configurar firewall: $_" "WARN"
    }
} else {
    Write-AppLog "⚠️  Firewall no configurado (se requieren permisos de Admin)" "WARN"
}

# ========= [6/6] GENERAR QR CODE =========
Write-AppLog "[6/6] Generando código QR..." "INFO"
$qrPng = ""
if ($ipAddress -ne "localhost") {
    $url = "http://$ipAddress`:$Port"
    $qrPng = Join-Path $ProjectRoot "LAN-QR.png"
    
    try {
        Set-Clipboard -Value $url -ErrorAction SilentlyContinue
    } catch {}
    
    if (New-QrPng -Url $url -OutPng $qrPng) {
        Write-AppLog "✅ Código QR generado: $qrPng" "INFO"
        Write-AppLog "📱 URL LAN: $url" "INFO"
        
        try {
            Start-Process $qrPng -ErrorAction SilentlyContinue
        } catch {}
    } else {
        Write-AppLog "⚠️  No se pudo generar QR. Usa la URL manualmente: $url" "WARN"
        $qrPng = ""
    }
} else {
    Write-AppLog "⚠️  QR no generado (sin IP LAN detectada)" "WARN"
}

# ========= INICIAR SERVIDOR WEB CON LOGGING =========
Write-AppLog "═══════════════════════════════════════" "INFO"
Write-AppLog "🌐 INICIANDO SERVIDOR WEB" "INFO"
Write-AppLog "═══════════════════════════════════════" "INFO"

Push-Location $webServerPath
try {
    # Asegurar que directorio de logs existe
    if (!(Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }
    
    # Preparar argumentos y comando
    if ($IsProductionBundle) {
        $env:NODE_ENV = "production"
        $env:HOSTNAME = "0.0.0.0"
        $env:PORT = $Port
        
        $nodeCmd = "node"
        $nodeArgs = @("server.js")
        Write-AppLog "Ejecutando: node server.js" "INFO"
    } else {
        if ($Mode -eq "prod") {
            $env:NODE_ENV = "production"
            $nodeCmd = "npm"
            $nodeArgs = @("run", "start", "--", "-H", "0.0.0.0", "-p", $Port)
            Write-AppLog "Ejecutando: npm run start -H 0.0.0.0 -p $Port" "INFO"
        } else {
            $env:NODE_ENV = "development"
            $nodeCmd = "npx"
            $nodeArgs = @("next", "dev", "-H", "0.0.0.0", "-p", $Port)
            Write-AppLog "Ejecutando: npx next dev -H 0.0.0.0 -p $Port" "INFO"
        }
    }
    
    # Archivos temporales para capturar salida
    $stdoutFile = Join-Path $LogDir "node-stdout-$LogTimestamp.log"
    $stderrFile = Join-Path $LogDir "node-stderr-$LogTimestamp.log"
    
    # Iniciar proceso con captura de salida
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $nodeCmd
    $psi.Arguments = $nodeArgs -join " "
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.WorkingDirectory = $webServerPath
    $psi.CreateNoWindow = $false
    
    $NodeProcess = New-Object System.Diagnostics.Process
    $NodeProcess.StartInfo = $psi
    
    # Event handlers para capturar salida en tiempo real
    $stdoutAction = {
        if ($EventArgs.Data) {
            $line = $EventArgs.Data
            Write-Host $line
            Add-Content -Path $using:stdoutFile -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
            Add-Content -Path $using:LogFile -Value "[NEXT] $line" -Encoding UTF8 -ErrorAction SilentlyContinue
        }
    }
    
    $stderrAction = {
        if ($EventArgs.Data) {
            $line = $EventArgs.Data
            # Determinar nivel de log basado en contenido
            $level = "INFO"
            if ($line -match "error|ERROR|Error|fatal|FATAL|Fatal") {
                $level = "ERROR"
                Write-Host $line -ForegroundColor Red
            } elseif ($line -match "warn|WARN|Warn|warning|WARNING") {
                $level = "WARN"
                Write-Host $line -ForegroundColor Yellow
            } else {
                Write-Host $line
            }
            Add-Content -Path $using:stderrFile -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
            Add-Content -Path $using:LogFile -Value "[NEXT-$level] $line" -Encoding UTF8 -ErrorAction SilentlyContinue
        }
    }
    
    Register-ObjectEvent -InputObject $NodeProcess -EventName OutputDataReceived -Action $stdoutAction | Out-Null
    Register-ObjectEvent -InputObject $NodeProcess -EventName ErrorDataReceived -Action $stderrAction | Out-Null
    
    # Iniciar el proceso
    $started = $NodeProcess.Start()
    if (!$started) {
        throw "No se pudo iniciar el proceso Node.js"
    }
    
    $NodeProcess.BeginOutputReadLine()
    $NodeProcess.BeginErrorReadLine()
    
    Write-AppLog "✅ Proceso Node iniciado (PID: $($NodeProcess.Id))" "INFO"
    Write-AppLog "" "INFO"
    Write-AppLog "─────────────────────────────────────" "INFO"
    Write-AppLog "Esperando a que el servidor esté listo..." "INFO"
    
    # Dar tiempo inicial al servidor para iniciar
    Start-Sleep -Seconds 3
    
    # Verificar que el proceso sigue corriendo
    if ($NodeProcess.HasExited) {
        $exitCode = $NodeProcess.ExitCode
        Write-AppLog "❌ ERROR: El proceso Node terminó inmediatamente (Exit Code: $exitCode)" "ERROR"
        Write-AppLog "" "ERROR"
        
        # Mostrar últimas líneas del log de errores
        if (Test-Path $stderrFile) {
            Write-AppLog "═══ ÚLTIMAS 50 LÍNEAS DE STDERR ═══" "ERROR"
            Get-Content $stderrFile -Tail 50 -ErrorAction SilentlyContinue | ForEach-Object {
                Write-AppLog $_ "ERROR"
            }
        }
        
        # También mostrar stdout por si hay pistas
        if (Test-Path $stdoutFile) {
            Write-AppLog "" "ERROR"
            Write-AppLog "═══ ÚLTIMAS 30 LÍNEAS DE STDOUT ═══" "ERROR"
            Get-Content $stdoutFile -Tail 30 -ErrorAction SilentlyContinue | ForEach-Object {
                Write-AppLog $_ "ERROR"
            }
        }
        
        exit $exitCode
    }
    
    # ========= READINESS CHECK =========
    Write-AppLog "[READINESS CHECK] Verificando puerto $Port..." "INFO"
    $portReady = Test-TcpPort -HostName "127.0.0.1" -Port $Port -TimeoutSeconds 15
    
    if (-not $portReady) {
        Write-AppLog "❌ ERROR: El puerto $Port NO está aceptando conexiones después de 15 segundos" "ERROR"
        Write-AppLog "" "ERROR"
        
        # Terminar el proceso Node si sigue corriendo
        if (!$NodeProcess.HasExited) {
            Write-AppLog "Terminando proceso Node (PID: $($NodeProcess.Id))..." "ERROR"
            try {
                $NodeProcess.Kill()
                $NodeProcess.WaitForExit(5000)
            } catch {
                Write-AppLog "Advertencia al terminar proceso: $_" "WARN"
            }
        }
        
        # Mostrar últimas líneas de los logs
        Write-AppLog "═══ ÚLTIMAS 50 LÍNEAS DE STDOUT ═══" "ERROR"
        if (Test-Path $stdoutFile) {
            Get-Content $stdoutFile -Tail 50 -ErrorAction SilentlyContinue | ForEach-Object {
                Write-AppLog $_ "ERROR"
            }
        } else {
            Write-AppLog "(archivo stdout no encontrado)" "ERROR"
        }
        
        Write-AppLog "" "ERROR"
        Write-AppLog "═══ ÚLTIMAS 50 LÍNEAS DE STDERR ═══" "ERROR"
        if (Test-Path $stderrFile) {
            Get-Content $stderrFile -Tail 50 -ErrorAction SilentlyContinue | ForEach-Object {
                Write-AppLog $_ "ERROR"
            }
        } else {
            Write-AppLog "(archivo stderr no encontrado)" "ERROR"
        }
        
        exit 1
    }
    
    Write-AppLog "✅ Puerto $Port verificado y aceptando conexiones" "INFO"
    Write-AppLog "" "INFO"
    
    # ========= EMITIR LÍNEAS PARSEABLES =========
    Write-AppLog "═══════════════════════════════════════" "INFO"
    Write-AppLog "✅ SERVICIOS LISTOS" "INFO"
    Write-AppLog "═══════════════════════════════════════" "INFO"
    Write-AppLog "📦 PostgreSQL: localhost:5432" "INFO"
    
    # Líneas parseables para la UI
    Write-Output "LOCAL_URL=http://127.0.0.1:$Port"
    
    if ($ipAddress -ne "localhost") {
        Write-Output "LAN_URL=http://$ipAddress`:$Port"
        Write-AppLog "📱 Next.js LAN: http://$ipAddress`:$Port" "INFO"
    } else {
        Write-Output "LAN_URL="
    }
    
    if ($qrPng -and (Test-Path $qrPng)) {
        Write-Output "QR_PATH=$qrPng"
    } else {
        Write-Output "QR_PATH="
    }
    
    Write-Output "LOG_PATH=$LogFile"
    
    Write-AppLog "🌐 Next.js Local: http://localhost:$Port" "INFO"
    Write-AppLog "📋 Log completo: $LogFile" "INFO"
    Write-AppLog "═══════════════════════════════════════" "INFO"
    Write-AppLog "" "INFO"
    Write-AppLog "─────────────────────────────────────" "INFO"
    Write-AppLog "📡 SALIDA DE NEXT.JS (EN VIVO):" "INFO"
    Write-AppLog "─────────────────────────────────────" "INFO"
    
    # Mantener el script corriendo mientras Node esté activo
    $NodeProcess.WaitForExit()
    
    $exitCode = $NodeProcess.ExitCode
    Write-AppLog "" "INFO"
    Write-AppLog "Proceso Node terminó con exit code: $exitCode" $(if ($exitCode -eq 0) {"INFO"} else {"ERROR"})
    
    if ($exitCode -ne 0) {
        Write-AppLog "" "ERROR"
        Write-AppLog "❌ El servidor Node terminó con código de error: $exitCode" "ERROR"
        
        # Mostrar últimas líneas del log de errores
        if (Test-Path $stderrFile) {
            Write-AppLog "" "ERROR"
            Write-AppLog "═══ ÚLTIMAS 100 LÍNEAS DE STDERR ═══" "ERROR"
            Get-Content $stderrFile -Tail 100 -ErrorAction SilentlyContinue | ForEach-Object {
                Write-AppLog $_ "ERROR"
            }
        }
        
        exit $exitCode
    }
    
} catch {
    Write-AppLog "❌ Error ejecutando servidor web: $_" "ERROR"
    Write-AppLog "StackTrace: $($_.ScriptStackTrace)" "ERROR"
    
    # Terminar proceso Node si está corriendo
    if ($NodeProcess -and !$NodeProcess.HasExited) {
        Write-AppLog "Terminando proceso Node (PID: $($NodeProcess.Id))..." "ERROR"
        try {
            $NodeProcess.Kill()
        } catch {
            Write-AppLog "Advertencia al terminar proceso: $_" "WARN"
        }
    }
    
    exit 1
} finally {
    Pop-Location
    
    # Limpiar event handlers
    Get-EventSubscriber | Where-Object { $_.SourceObject -eq $NodeProcess } | Unregister-Event -ErrorAction SilentlyContinue
}
