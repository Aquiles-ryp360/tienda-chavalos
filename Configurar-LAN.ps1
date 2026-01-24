# Script de Configuración Rápida para Exposición LAN
# Ferretería Chavalos - Windows PowerShell
# Ejecutar como Administrador para configurar Firewall

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CONFIGURACIÓN LAN - FERRETERÍA CHAVALOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Función para verificar si se ejecuta como administrador
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Verificar privilegios de administrador
if (-not (Test-Administrator)) {
    Write-Host "❌ ERROR: Este script requiere privilegios de Administrador" -ForegroundColor Red
    Write-Host "   Por favor, cierra esta ventana y ejecuta PowerShell como Administrador" -ForegroundColor Yellow
    Write-Host "   (Click derecho en PowerShell > Ejecutar como Administrador)" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Presiona Enter para salir"
    exit 1
}

Write-Host "✅ Ejecutando con privilegios de Administrador" -ForegroundColor Green
Write-Host ""

# Paso 1: Obtener IP local
Write-Host "[1/4] Detectando IP local del servidor..." -ForegroundColor Yellow
Write-Host ""

$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | 
    Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual" } | 
    Select-Object -First 1).IPAddress

if ($ipAddress) {
    Write-Host "  📍 IP detectada: $ipAddress" -ForegroundColor Green
    Write-Host "  📱 Acceso desde móvil: http://${ipAddress}:3000" -ForegroundColor Cyan
} else {
    Write-Host "  ⚠️  No se pudo detectar IP automáticamente" -ForegroundColor Yellow
    Write-Host "  Ejecuta manualmente: ipconfig" -ForegroundColor Yellow
}
Write-Host ""

# Paso 2: Verificar Docker
Write-Host "[2/4] Verificando Docker Desktop..." -ForegroundColor Yellow

$dockerRunning = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if ($dockerRunning) {
    Write-Host "  ✅ Docker Desktop está corriendo" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Docker Desktop no está corriendo" -ForegroundColor Red
    Write-Host "  Por favor, inicia Docker Desktop antes de continuar" -ForegroundColor Yellow
}
Write-Host ""

# Paso 3: Configurar Firewall
Write-Host "[3/4] Configurando Firewall de Windows..." -ForegroundColor Yellow

# Verificar si la regla ya existe
$existingRule = Get-NetFirewallRule -DisplayName "Next.js Ferreteria (Puerto 3000)" -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "  ℹ️  La regla de firewall ya existe" -ForegroundColor Cyan
    $response = Read-Host "  ¿Deseas recrearla? (S/N)"
    
    if ($response -eq "S" -or $response -eq "s") {
        Remove-NetFirewallRule -DisplayName "Next.js Ferreteria (Puerto 3000)" -ErrorAction SilentlyContinue
        Write-Host "  ✅ Regla anterior eliminada" -ForegroundColor Green
    } else {
        Write-Host "  ⏭️  Manteniendo regla existente" -ForegroundColor Yellow
        Write-Host ""
        Start-Sleep -Seconds 1
        $existingRule = $null
    }
}

if (-not $existingRule) {
    try {
        New-NetFirewallRule -DisplayName "Next.js Ferreteria (Puerto 3000)" `
            -Direction Inbound `
            -LocalPort 3000 `
            -Protocol TCP `
            -Action Allow `
            -Profile Private,Domain `
            -Description "Permite acceso a Next.js desde red local" `
            -ErrorAction Stop | Out-Null
        
        Write-Host "  ✅ Regla de Firewall creada exitosamente" -ForegroundColor Green
        Write-Host "  Puerto 3000 (TCP) abierto para red Privada/Dominio" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Error al crear regla de Firewall: $_" -ForegroundColor Red
    }
}
Write-Host ""

# Paso 4: Información de PostgreSQL (opcional)
Write-Host "[4/4] Configuración de PostgreSQL..." -ForegroundColor Yellow

$response = Read-Host "  ¿Deseas abrir puerto 5432 (PostgreSQL) en Firewall? (NO recomendado) (S/N)"

if ($response -eq "S" -or $response -eq "s") {
    $existingPgRule = Get-NetFirewallRule -DisplayName "PostgreSQL Ferreteria (Puerto 5432)" -ErrorAction SilentlyContinue
    
    if (-not $existingPgRule) {
        try {
            New-NetFirewallRule -DisplayName "PostgreSQL Ferreteria (Puerto 5432)" `
                -Direction Inbound `
                -LocalPort 5432 `
                -Protocol TCP `
                -Action Allow `
                -Profile Private,Domain `
                -Description "Permite acceso a PostgreSQL desde red local (desarrollo)" `
                -ErrorAction Stop | Out-Null
            
            Write-Host "  ✅ Puerto 5432 abierto (SOLO para desarrollo)" -ForegroundColor Yellow
            Write-Host "  ⚠️  RECUERDA cerrarlo cuando no sea necesario" -ForegroundColor Red
        } catch {
            Write-Host "  ❌ Error al crear regla: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "  ℹ️  La regla ya existe" -ForegroundColor Cyan
    }
} else {
    Write-Host "  ✅ Puerto 5432 NO expuesto (recomendado)" -ForegroundColor Green
    Write-Host "  DATABASE_URL debe apuntar a localhost" -ForegroundColor Green
}
Write-Host ""

# Resumen final
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESUMEN DE CONFIGURACIÓN" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar reglas activas
$rulesCreated = Get-NetFirewallRule -DisplayName "*Ferreteria*" | Select-Object DisplayName, Enabled

if ($rulesCreated) {
    Write-Host "📋 Reglas de Firewall activas:" -ForegroundColor Green
    $rulesCreated | ForEach-Object {
        $status = if ($_.Enabled) { "✅" } else { "❌" }
        Write-Host "  $status $($_.DisplayName)" -ForegroundColor $(if ($_.Enabled) { "Green" } else { "Red" })
    }
} else {
    Write-Host "⚠️  No se encontraron reglas de Firewall" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🌐 Acceso desde red local:" -ForegroundColor Cyan
if ($ipAddress) {
    Write-Host "   http://${ipAddress}:3000" -ForegroundColor White
    Write-Host "   http://${ipAddress}:3000/login" -ForegroundColor White
} else {
    Write-Host "   http://TU_IP_LOCAL:3000" -ForegroundColor White
    Write-Host "   (Ejecuta 'ipconfig' para obtener tu IP)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📚 PRÓXIMOS PASOS:" -ForegroundColor Cyan
Write-Host "  1. Iniciar PostgreSQL:" -ForegroundColor White
Write-Host "     cd Despliegue\Hosting\postgres-local" -ForegroundColor Gray
Write-Host "     docker compose up -d" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Iniciar Next.js:" -ForegroundColor White
Write-Host "     cd Frontend\NextJS_React\web" -ForegroundColor Gray
Write-Host "     npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Conectar desde móvil a la misma WiFi" -ForegroundColor White
Write-Host "     y abrir: http://${ipAddress}:3000" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ CONFIGURACIÓN COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Opción para probar conectividad
$testConnection = Read-Host "¿Deseas probar la conectividad del puerto 3000? (S/N)"

if ($testConnection -eq "S" -or $testConnection -eq "s") {
    Write-Host ""
    Write-Host "Probando conectividad..." -ForegroundColor Yellow
    
    if ($ipAddress) {
        $result = Test-NetConnection -ComputerName $ipAddress -Port 3000 -WarningAction SilentlyContinue
        
        if ($result.TcpTestSucceeded) {
            Write-Host "✅ Puerto 3000 es accesible" -ForegroundColor Green
        } else {
            Write-Host "❌ Puerto 3000 NO es accesible" -ForegroundColor Red
            Write-Host "   Asegúrate de que Next.js esté corriendo (npm run dev)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "Presiona Enter para salir..." -ForegroundColor Gray
Read-Host
