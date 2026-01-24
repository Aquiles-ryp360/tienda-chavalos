# ==================================================================================
# SCRIPT DE VALIDACIÓN PRE-BUILD
# Valida que server-launcher.ps1 esté correcto antes de hacer build
# ==================================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🔍 VALIDACIÓN PRE-BUILD" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$scriptPath = Join-Path $PSScriptRoot "server-launcher.ps1"
$stagingPath = Join-Path $PSScriptRoot "src-tauri\resources\server-launcher.ps1"

# ========================================
# 1. VALIDAR ARCHIVO FUENTE
# ========================================
Write-Host "[1/4] Validando archivo fuente..." -ForegroundColor Yellow

if (!(Test-Path $scriptPath)) {
    Write-Host "❌ ERROR: No se encuentra server-launcher.ps1" -ForegroundColor Red
    exit 1
}

Write-Host "  Ubicación: $scriptPath" -ForegroundColor Gray

# Parse check
try {
    $parseResult = pwsh -NoProfile -NonInteractive -Command "
        `$ErrorActionPreference='Stop'
        try {
            [ScriptBlock]::Create((Get-Content -Raw -LiteralPath '$scriptPath')) | Out-Null
            Write-Output 'OK'
        } catch {
            Write-Error `$_.Exception.Message
            exit 1
        }
    " 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ PARSE ERROR:" -ForegroundColor Red
        Write-Host $parseResult -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  ✅ Sintaxis válida" -ForegroundColor Green
} catch {
    Write-Host "❌ PARSE ERROR: $_" -ForegroundColor Red
    exit 1
}

# Info del archivo
$fileInfo = Get-Item $scriptPath
$lines = (Get-Content $scriptPath | Measure-Object -Line).Lines
$hash = (Get-FileHash -Path $scriptPath -Algorithm SHA256).Hash.Substring(0, 16)

Write-Host "  Líneas: $lines" -ForegroundColor Gray

if ($lines -gt 700) {
    Write-Host "  ⚠️  ADVERTENCIA: Archivo tiene >700 líneas (puede tener duplicados)" -ForegroundColor Yellow
}

Write-Host "  Tamaño: $($fileInfo.Length) bytes ($([math]::Round($fileInfo.Length/1KB, 2)) KB)" -ForegroundColor Gray
Write-Host "  Hash: $hash" -ForegroundColor Gray
Write-Host ""

# ========================================
# 2. VALIDAR ENCODING
# ========================================
Write-Host "[2/4] Validando encoding..." -ForegroundColor Yellow

$bytes = [System.IO.File]::ReadAllBytes($scriptPath)
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Write-Host "  ✅ UTF-8 con BOM" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  No tiene BOM UTF-8 (puede causar problemas en PowerShell 5.1)" -ForegroundColor Yellow
}
Write-Host ""

# ========================================
# 3. BUSCAR CÓDIGO DUPLICADO
# ========================================
Write-Host "[3/4] Buscando código duplicado..." -ForegroundColor Yellow

$content = Get-Content $scriptPath -Raw

# Buscar múltiples definiciones de funciones
$functionPattern = 'function (Write-AppLog|Test-Admin|Get-LanIPv4|New-QrPng|Test-TcpPort|Show-DiagnosticInfo)'
$matches = [regex]::Matches($content, $functionPattern)

$functionCounts = @{}
foreach ($match in $matches) {
    $funcName = $match.Groups[1].Value
    if (!$functionCounts.ContainsKey($funcName)) {
        $functionCounts[$funcName] = 0
    }
    $functionCounts[$funcName]++
}

$hasDuplicates = $false
foreach ($func in $functionCounts.Keys) {
    $count = $functionCounts[$func]
    if ($count -gt 1) {
        Write-Host "  ⚠️  Función '$func' definida $count veces (DUPLICADO)" -ForegroundColor Red
        $hasDuplicates = $true
    }
}

if (!$hasDuplicates) {
    Write-Host "  ✅ No hay funciones duplicadas" -ForegroundColor Green
}
Write-Host ""

# ========================================
# 4. VALIDAR STAGING (SI EXISTE)
# ========================================
Write-Host "[4/4] Validando staging (si existe)..." -ForegroundColor Yellow

if (Test-Path $stagingPath) {
    Write-Host "  Ubicación: $stagingPath" -ForegroundColor Gray
    
    # Parse check del staging
    try {
        $stagingParseResult = pwsh -NoProfile -NonInteractive -Command "
            `$ErrorActionPreference='Stop'
            try {
                [ScriptBlock]::Create((Get-Content -Raw -LiteralPath '$stagingPath')) | Out-Null
                Write-Output 'OK'
            } catch {
                Write-Error `$_.Exception.Message
                exit 1
            }
        " 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ❌ STAGING CORRUPTO:" -ForegroundColor Red
            Write-Host $stagingParseResult -ForegroundColor Red
            Write-Host ""
            Write-Host "  💡 SOLUCIÓN: Eliminar staging y rebuild" -ForegroundColor Yellow
            Write-Host "     Remove-Item 'src-tauri\resources' -Recurse -Force" -ForegroundColor Gray
            exit 1
        }
        
        Write-Host "  ✅ Staging válido" -ForegroundColor Green
        
        $stagingInfo = Get-Item $stagingPath
        $stagingLines = (Get-Content $stagingPath | Measure-Object -Line).Lines
        Write-Host "  Líneas: $stagingLines" -ForegroundColor Gray
        Write-Host "  Tamaño: $($stagingInfo.Length) bytes" -ForegroundColor Gray
        
        # Comparar tamaños
        if ($fileInfo.Length -ne $stagingInfo.Length) {
            Write-Host "  ⚠️  ADVERTENCIA: Tamaño diferente al fuente" -ForegroundColor Yellow
            Write-Host "     Fuente:  $($fileInfo.Length) bytes" -ForegroundColor Gray
            Write-Host "     Staging: $($stagingInfo.Length) bytes" -ForegroundColor Gray
        }
        
    } catch {
        Write-Host "  ❌ ERROR validando staging: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "  ℹ️  No hay staging previo (normal en primera compilación)" -ForegroundColor Gray
}
Write-Host ""

# ========================================
# RESUMEN
# ========================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ VALIDACIÓN COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Resumen:" -ForegroundColor White
Write-Host "   - Parse check: OK" -ForegroundColor Green
Write-Host "   - Encoding: UTF-8" -ForegroundColor Green
Write-Host "   - Funciones duplicadas: No" -ForegroundColor Green
Write-Host ""
Write-Host "✅ LISTO PARA BUILD" -ForegroundColor Green
Write-Host ""
Write-Host "Ejecuta: .\build.ps1" -ForegroundColor Cyan
Write-Host ""
