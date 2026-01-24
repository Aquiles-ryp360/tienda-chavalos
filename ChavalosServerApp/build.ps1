# ================================================================================================
# BUILD SCRIPT - CHAVALOS SERVER APP
# Genera instalador MSI/EXE auto-contenido con Frontend + Backend + Base de datos empaquetados
# ================================================================================================

# Agregar Rust al PATH si no está disponible
if (!(Get-Command rustc -ErrorAction SilentlyContinue)) {
    $env:Path += ";$env:USERPROFILE\.cargo\bin"
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  🏗️  BUILD CHAVALOS SERVER APP" -ForegroundColor Cyan
Write-Host "  (Empaquetado Auto-Contenido)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# ========= RUTAS =========
$rootPath = Split-Path -Parent $PSScriptRoot
$frontendPath = Join-Path $rootPath "Frontend\NextJS_React\web"
$backendPath = Join-Path $rootPath "Backend"
$realDbPath = Join-Path $rootPath "Despliegue\Hosting\postgres-local"
$deployPath = Join-Path $rootPath "Despliegue"
$bundlePath = Join-Path $PSScriptRoot "bundle"
$projectBundlePath = Join-Path $bundlePath "project"

# ========= [1/7] PREREQUISITOS =========
Write-Host "[1/7] Verificando prerequisitos..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js no encontrado. Instala Node.js desde https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "✅ npm: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm no encontrado" -ForegroundColor Red
    exit 1
}

# Check Rust
try {
    $rustVersion = rustc --version
    Write-Host "✅ Rust: $rustVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Rust no encontrado. Instala Rust desde https://rustup.rs" -ForegroundColor Red
    Write-Host "   Ejecuta: winget install Rustlang.Rustup" -ForegroundColor Yellow
    exit 1
}

# Check Cargo
try {
    $cargoVersion = cargo --version
    Write-Host "✅ Cargo: $cargoVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Cargo no encontrado" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ========= [2/7] LIMPIAR BUNDLE ANTERIOR =========
Write-Host "[2/7] Limpiando bundle anterior..." -ForegroundColor Yellow

# Matar procesos Node.js que puedan estar bloqueando archivos
Write-Host "Deteniendo procesos Node.js..." -ForegroundColor Gray
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*Tienda_Chavalos_Virtual_web*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

if (Test-Path $bundlePath) {
    Write-Host "Eliminando $bundlePath" -ForegroundColor Gray
    
    # Intentar eliminar, con reintento si falla
    $retries = 3
    $deleted = $false
    
    for ($i = 1; $i -le $retries; $i++) {
        try {
            Remove-Item -Path $bundlePath -Recurse -Force -ErrorAction Stop
            $deleted = $true
            break
        } catch {
            if ($i -lt $retries) {
                Write-Host "Reintento $i/$retries (archivo en uso, esperando...)" -ForegroundColor Yellow
                Start-Sleep -Seconds 2
            } else {
                Write-Host "❌ No se pudo eliminar bundle. Cierra VS Code, terminales y procesos Node.js, luego reintenta." -ForegroundColor Red
                Write-Host "   O ejecuta manualmente: Get-Process node | Stop-Process -Force" -ForegroundColor Yellow
                exit 1
            }
        }
    }
}

# Crear estructura del bundle
New-Item -ItemType Directory -Path $projectBundlePath -Force | Out-Null
Write-Host "✅ Bundle limpio creado en: $projectBundlePath" -ForegroundColor Green
Write-Host ""

# ========= [3/7] BUILD FRONTEND (NEXT.JS STANDALONE) =========
Write-Host "[3/7] Compilando Frontend (Next.js en modo standalone)..." -ForegroundColor Yellow

if (!(Test-Path $frontendPath)) {
    Write-Host "❌ Frontend no encontrado en: $frontendPath" -ForegroundColor Red
    exit 1
}

Push-Location $frontendPath
try {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "🔍 PRE-BUILD: LIMPIEZA Y PREPARACIÓN" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    
    # ========= A) CERRAR PROCESOS QUE BLOQUEAN NODE_MODULES =========
    Write-Host "[A] Detectando procesos Node.js que puedan bloquear archivos..." -ForegroundColor Yellow
    
    # Obtener todos los procesos node.exe relacionados con el proyecto
    $projectNodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -like "*Tienda_Chavalos_Virtual_web*"
    }
    
    if ($projectNodeProcesses) {
        Write-Host "⚠️  Procesos Node.js detectados en el proyecto:" -ForegroundColor Yellow
        foreach ($proc in $projectNodeProcesses) {
            Write-Host "   PID: $($proc.Id) | Path: $($proc.Path)" -ForegroundColor Gray
        }
        
        Write-Host "Cerrando procesos Node.js del proyecto..." -ForegroundColor Gray
        $projectNodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host "✅ Procesos cerrados" -ForegroundColor Green
    } else {
        Write-Host "✅ No hay procesos Node.js bloqueando" -ForegroundColor Green
    }
    
    # ========= B) ELIMINAR NODE_MODULES CON REINTENTOS =========
    Write-Host ""
    Write-Host "[B] Limpiando node_modules..." -ForegroundColor Yellow
    
    $nodeModulesPath = Join-Path $frontendPath "node_modules"
    if (Test-Path $nodeModulesPath) {
        $deleteRetries = 5
        $deleted = $false
        
        for ($i = 1; $i -le $deleteRetries; $i++) {
            Write-Host "Intento $i/$deleteRetries de eliminar node_modules..." -ForegroundColor Gray
            
            try {
                Remove-Item -Path $nodeModulesPath -Recurse -Force -ErrorAction Stop
                $deleted = $true
                Write-Host "✅ node_modules eliminado correctamente" -ForegroundColor Green
                break
            } catch {
                if ($i -lt $deleteRetries) {
                    Write-Host "⚠️  EBUSY: Archivos bloqueados. Esperando $i segundos..." -ForegroundColor Yellow
                    Start-Sleep -Seconds $i
                    
                    # En el último intento antes del fallback, intentar liberar handles
                    if ($i -eq ($deleteRetries - 1)) {
                        Write-Host "Intentando liberar handles bloqueados..." -ForegroundColor Gray
                        [System.GC]::Collect()
                        [System.GC]::WaitForPendingFinalizers()
                        Start-Sleep -Seconds 2
                    }
                } else {
                    # Fallback: renombrar en vez de eliminar
                    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
                    $oldModulesPath = Join-Path $frontendPath "node_modules.old.$timestamp"
                    
                    Write-Host "⚠️  No se pudo eliminar. Renombrando a: node_modules.old.$timestamp" -ForegroundColor Yellow
                    try {
                        Rename-Item -Path $nodeModulesPath -NewName "node_modules.old.$timestamp" -Force
                        Write-Host "✅ Renombrado exitoso (se limpiará al final)" -ForegroundColor Green
                        $deleted = $true
                    } catch {
                        Write-Host "❌ Error crítico: No se puede liberar node_modules" -ForegroundColor Red
                        Write-Host "   Mensaje: $_" -ForegroundColor Red
                        Write-Host ""
                        Write-Host "💡 SOLUCIÓN MANUAL REQUERIDA:" -ForegroundColor Yellow
                        Write-Host "   1. Cierra VS Code, terminales y cualquier proceso Node.js" -ForegroundColor White
                        Write-Host "   2. Ejecuta: Get-Process node | Stop-Process -Force" -ForegroundColor White
                        Write-Host "   3. Elimina manualmente: $nodeModulesPath" -ForegroundColor White
                        Write-Host "   4. Re-ejecuta build.ps1" -ForegroundColor White
                        throw "node_modules bloqueado - intervención manual requerida"
                    }
                }
            }
        }
    } else {
        Write-Host "✅ node_modules no existe (instalación limpia)" -ForegroundColor Green
    }
    
    # ========= C) VERIFICAR CONECTIVIDAD =========
    Write-Host ""
    Write-Host "[C] Verificando conectividad de red..." -ForegroundColor Yellow
    
    $connectivityOk = $true
    
    # Test npm registry
    Write-Host "Testeando registry.npmjs.org..." -ForegroundColor Gray
    try {
        $npmTest = Test-NetConnection -ComputerName registry.npmjs.org -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
        if ($npmTest) {
            Write-Host "  ✅ registry.npmjs.org accesible" -ForegroundColor Green
        } else {
            Write-Host "  ❌ registry.npmjs.org NO accesible" -ForegroundColor Red
            $connectivityOk = $false
        }
    } catch {
        Write-Host "  ⚠️  No se pudo verificar registry.npmjs.org" -ForegroundColor Yellow
    }
    
    # Test Prisma assets
    Write-Host "Testeando binaries.prisma.sh..." -ForegroundColor Gray
    try {
        $prismaTest = Test-NetConnection -ComputerName binaries.prisma.sh -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
        if ($prismaTest) {
            Write-Host "  ✅ binaries.prisma.sh accesible" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  binaries.prisma.sh NO accesible (Prisma puede fallar)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ⚠️  No se pudo verificar binaries.prisma.sh" -ForegroundColor Yellow
    }
    
    if (!$connectivityOk) {
        Write-Host ""
        Write-Host "❌ ERROR DE CONECTIVIDAD" -ForegroundColor Red
        Write-Host "   No se puede alcanzar registry.npmjs.org" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 SOLUCIONES:" -ForegroundColor Yellow
        Write-Host "   1. Verifica tu conexión a Internet" -ForegroundColor White
        Write-Host "   2. Verifica configuración de proxy/firewall" -ForegroundColor White
        Write-Host "   3. Intenta: npm config set registry https://registry.npmjs.org/" -ForegroundColor White
        throw "Sin conectividad a npm registry"
    }
    
    # ========= D) CONFIGURAR NPM PARA ROBUSTEZ =========
    Write-Host ""
    Write-Host "[D] Configurando npm para builds robustos..." -ForegroundColor Yellow
    
    npm config set fetch-retries 5
    npm config set fetch-retry-factor 2
    npm config set fetch-retry-mintimeout 20000
    npm config set fetch-retry-maxtimeout 120000
    npm config set fetch-timeout 120000
    
    Write-Host "  ✅ Configuración aplicada:" -ForegroundColor Green
    Write-Host "     - fetch-retries: 5" -ForegroundColor Gray
    Write-Host "     - fetch-timeout: 120s" -ForegroundColor Gray
    Write-Host "     - retry mintimeout: 20s" -ForegroundColor Gray
    Write-Host "     - retry maxtimeout: 120s" -ForegroundColor Gray
    
    # ========= E) INSTALAR DEPENDENCIAS CON REINTENTOS =========
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "📦 INSTALACIÓN DE DEPENDENCIAS" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    
    $packageLockPath = Join-Path $frontendPath "package-lock.json"
    $useNpmCi = Test-Path $packageLockPath
    
    if ($useNpmCi) {
        Write-Host "[E] Usando npm ci (package-lock.json detectado)..." -ForegroundColor Yellow
        $installCmd = "npm ci --no-audit --no-fund"
    } else {
        Write-Host "[E] Usando npm install (sin package-lock.json)..." -ForegroundColor Yellow
        $installCmd = "npm install --no-audit --no-fund"
    }
    
    $maxInstallRetries = 3
    $installSuccess = $false
    $waitTimes = @(5, 15, 30) # segundos de espera entre reintentos
    
    for ($attempt = 1; $attempt -le $maxInstallRetries; $attempt++) {
        Write-Host ""
        Write-Host "Intento $attempt/$maxInstallRetries de instalación..." -ForegroundColor Cyan
        
        # Ejecutar instalación
        Invoke-Expression $installCmd
        
        if ($LASTEXITCODE -eq 0) {
            $installSuccess = $true
            Write-Host "✅ Dependencias instaladas correctamente" -ForegroundColor Green
            break
        } else {
            $errorMsg = "Instalación falló con código de salida: $LASTEXITCODE"
            Write-Host "❌ $errorMsg" -ForegroundColor Red
            
            if ($attempt -lt $maxInstallRetries) {
                $waitTime = $waitTimes[$attempt - 1]
                Write-Host "⏳ Esperando $waitTime segundos antes de reintentar..." -ForegroundColor Yellow
                
                # En el segundo intento, limpiar caché
                if ($attempt -eq 2) {
                    Write-Host "   🧹 Limpiando caché de npm..." -ForegroundColor Gray
                    npm cache clean --force 2>&1 | Out-Null
                    Write-Host "   ✅ Caché limpiado" -ForegroundColor Green
                }
                
                Start-Sleep -Seconds $waitTime
            } else {
                # Último intento falló - recopilar diagnóstico
                Write-Host ""
                Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
                Write-Host "❌ FALLO CRÍTICO EN INSTALACIÓN DE DEPENDENCIAS" -ForegroundColor Red
                Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
                Write-Host ""
                
                # Buscar logs de npm
                $npmCacheDir = npm config get cache
                $npmLogsDir = Join-Path $npmCacheDir "_logs"
                
                if (Test-Path $npmLogsDir) {
                    $latestLog = Get-ChildItem $npmLogsDir -Filter "*debug*.log" -ErrorAction SilentlyContinue | 
                                 Sort-Object LastWriteTime -Descending | 
                                 Select-Object -First 1
                    
                    if ($latestLog) {
                        Write-Host "📋 LOG DE ERROR:" -ForegroundColor Yellow
                        Write-Host "   $($latestLog.FullName)" -ForegroundColor Gray
                        Write-Host ""
                        Write-Host "Últimas 30 líneas del log:" -ForegroundColor Yellow
                        Get-Content $latestLog.FullName -Tail 30 | ForEach-Object {
                            Write-Host "   $_" -ForegroundColor Gray
                        }
                    }
                }
                
                Write-Host ""
                Write-Host "💡 DIAGNÓSTICO Y SOLUCIONES:" -ForegroundColor Yellow
                Write-Host "   1. Si ves ECONNRESET/ETIMEDOUT:" -ForegroundColor White
                Write-Host "      - Problema de red/firewall" -ForegroundColor Gray
                Write-Host "      - Verifica conexión a Internet" -ForegroundColor Gray
                Write-Host "      - Prueba con VPN/otra red" -ForegroundColor Gray
                Write-Host ""
                Write-Host "   2. Si ves EBUSY en @prisma/client:" -ForegroundColor White
                Write-Host "      - Cierra VS Code y todas las terminales" -ForegroundColor Gray
                Write-Host "      - Ejecuta: Get-Process node | Stop-Process -Force" -ForegroundColor Gray
                Write-Host "      - Elimina manualmente node_modules" -ForegroundColor Gray
                Write-Host ""
                Write-Host "   3. Si falla postinstall de @prisma/engines:" -ForegroundColor White
                Write-Host "      - Verifica acceso a binaries.prisma.sh" -ForegroundColor Gray
                Write-Host "      - Intenta: npm cache clean --force" -ForegroundColor Gray
                Write-Host "      - Considera usar variable PRISMA_SKIP_POSTINSTALL_GENERATE=1" -ForegroundColor Gray
                Write-Host ""
                
                throw "npm $($useNpmCi ? 'ci' : 'install') falló después de $maxInstallRetries intentos"
            }
        }
    }
    
    if (!$installSuccess) {
        throw "Instalación de dependencias falló"
    }
    
    # ========= F) GENERAR CLIENTE PRISMA =========
    Write-Host ""
    Write-Host "[F] Generando cliente Prisma..." -ForegroundColor Yellow
    npm run prisma:generate
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "❌ prisma:generate falló" -ForegroundColor Red
        throw "prisma:generate falló" 
    }
    Write-Host "✅ Cliente Prisma generado" -ForegroundColor Green
    
    # ========= G) BUILD DE NEXT.JS =========
    Write-Host ""
    Write-Host "[G] Ejecutando build de Next.js..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "❌ npm run build falló" -ForegroundColor Red
        throw "npm run build falló" 
    }
    Write-Host "✅ Build de Next.js completado" -ForegroundColor Green
    
    # ========= H) VERIFICAR STANDALONE =========
    Write-Host ""
    Write-Host "[H] Verificando output standalone..." -ForegroundColor Yellow
    
    $standalonePath = Join-Path $frontendPath ".next\standalone"
    $standaloneServerJs = Join-Path $standalonePath "server.js"
    
    if (!(Test-Path $standalonePath)) {
        Write-Host "❌ ERROR: No se generó .next/standalone/" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 VERIFICA:" -ForegroundColor Yellow
        Write-Host "   - Frontend/NextJS_React/web/next.config.ts debe tener:" -ForegroundColor White
        Write-Host "     output: 'standalone'" -ForegroundColor Gray
        throw "No se generó standalone build. Verifica next.config.ts"
    }
    
    if (!(Test-Path $standaloneServerJs)) {
        Write-Host "❌ ERROR: No se generó .next/standalone/server.js" -ForegroundColor Red
        throw "Next no generó standalone correctamente"
    }
    
    $serverJsSize = (Get-Item $standaloneServerJs).Length
    Write-Host "✅ Standalone build verificado:" -ForegroundColor Green
    Write-Host "   - Path: $standalonePath" -ForegroundColor Gray
    Write-Host "   - server.js: $serverJsSize bytes" -ForegroundColor Gray
    
    # ========= I) COPIAR OUTPUT AL BUNDLE =========
    Write-Host ""
    Write-Host "[I] Copiando output standalone al bundle..." -ForegroundColor Yellow
    
    $webServerPath = Join-Path $projectBundlePath "web-server"
    New-Item -ItemType Directory -Path $webServerPath -Force | Out-Null
    
    # Copiar standalone build
    Write-Host "Copiando .next/standalone..." -ForegroundColor Gray
    Copy-Item -Path "$standalonePath\*" -Destination $webServerPath -Recurse -Force
    
    # Copiar .next/static
    $staticSrc = Join-Path $frontendPath ".next\static"
    $staticDst = Join-Path $webServerPath ".next\static"
    if (Test-Path $staticSrc) {
        Write-Host "Copiando .next/static..." -ForegroundColor Gray
        New-Item -ItemType Directory -Path $staticDst -Force | Out-Null
        Copy-Item -Path "$staticSrc\*" -Destination $staticDst -Recurse -Force
    }
    
    # Copiar public
    $publicSrc = Join-Path $frontendPath "public"
    $publicDst = Join-Path $webServerPath "public"
    if (Test-Path $publicSrc) {
        Write-Host "Copiando public..." -ForegroundColor Gray
        New-Item -ItemType Directory -Path $publicDst -Force | Out-Null
        Copy-Item -Path "$publicSrc\*" -Destination $publicDst -Recurse -Force
    }
    
    Write-Host "✅ Output copiado al bundle" -ForegroundColor Green
    
    # ========= J) LIMPIEZA FINAL =========
    Write-Host ""
    Write-Host "[J] Limpieza final..." -ForegroundColor Yellow
    
    # Intentar eliminar node_modules.old.* si quedaron
    Get-ChildItem -Path $frontendPath -Filter "node_modules.old.*" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "Eliminando $($_.Name)..." -ForegroundColor Gray
        try {
            Remove-Item -Path $_.FullName -Recurse -Force -ErrorAction Stop
            Write-Host "  ✅ Eliminado" -ForegroundColor Green
        } catch {
            Write-Host "  ⚠️  No se pudo eliminar (no crítico)" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host "✅ FRONTEND COMPILADO Y EMPAQUETADO EXITOSAMENTE" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
    Write-Host "❌ ERROR COMPILANDO FRONTEND" -ForegroundColor Red
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
    Write-Host ""
    Write-Host "Mensaje de error: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
} finally {
    Pop-Location
}
Write-Host ""

# ========= [4/7] BUILD BACKEND (SI EXISTE) =========
Write-Host "[4/7] Verificando Backend..." -ForegroundColor Yellow

if (Test-Path $backendPath) {
    $backendPackageJson = Join-Path $backendPath "package.json"
    if (Test-Path $backendPackageJson) {
        Write-Host "Backend detectado. Copiando archivos..." -ForegroundColor Gray
        $backendBundlePath = Join-Path $projectBundlePath "backend"
        Copy-Item -Path $backendPath -Destination $backendBundlePath -Recurse -Force
        Write-Host "✅ Backend copiado" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Backend sin package.json, copiando solo archivos necesarios" -ForegroundColor Yellow
        $backendBundlePath = Join-Path $projectBundlePath "backend"
        Copy-Item -Path $backendPath -Destination $backendBundlePath -Recurse -Force
    }
} else {
    Write-Host "⚠️  No se encontró Backend, omitiendo..." -ForegroundColor Yellow
}
Write-Host ""

# ========= [5/7] COPIAR BASE DE DATOS =========
Write-Host "[5/7] Copiando configuración de Base de Datos..." -ForegroundColor Yellow

if (Test-Path $realDbPath) {
    # Crear estructura en el bundle
    $dbBundlePath = Join-Path $projectBundlePath "deployment\Hosting\postgres-local"
    New-Item -ItemType Directory -Path (Split-Path $dbBundlePath) -Force | Out-Null
    Copy-Item -Path $realDbPath -Destination $dbBundlePath -Recurse -Force
    Write-Host "✅ Configuración de DB copiada desde Despliegue/Hosting/postgres-local" -ForegroundColor Green
} else {
    Write-Host "❌ Configuración de DB no encontrada en: $realDbPath" -ForegroundColor Red
    exit 1
}
Write-Host ""

# ========= [6/7] COPIAR SCRIPTS DE DESPLIEGUE =========
Write-Host "[6/7] Copiando scripts de despliegue..." -ForegroundColor Yellow

if (Test-Path $deployPath) {
    Write-Host "✅ Scripts de despliegue ya incluidos en paso anterior" -ForegroundColor Green
} else {
    Write-Host "⚠️  No se encontró carpeta Despliegue" -ForegroundColor Yellow
}
Write-Host ""

# ========= [6.5/7] STAGING DE RESOURCES PARA TAURI =========
Write-Host "[6.5/7] Preparando staging de resources para empaquetado..." -ForegroundColor Yellow

$tauriResourcesPath = Join-Path $PSScriptRoot "src-tauri\resources"

# Limpiar staging anterior
if (Test-Path $tauriResourcesPath) {
    Write-Host "Limpiando staging anterior..." -ForegroundColor Gray
    Remove-Item -Path $tauriResourcesPath -Recurse -Force
}

# Crear estructura de staging
New-Item -ItemType Directory -Path $tauriResourcesPath -Force | Out-Null

# Copiar server-launcher.ps1
$serverLauncherSrc = Join-Path $PSScriptRoot "server-launcher.ps1"
$serverLauncherDst = Join-Path $tauriResourcesPath "server-launcher.ps1"

if (!(Test-Path $serverLauncherSrc)) {
    Write-Host "❌ server-launcher.ps1 no encontrado en: $serverLauncherSrc" -ForegroundColor Red
    exit 1
}

# ========= VALIDAR SINTAXIS DEL FUENTE PRIMERO =========
Write-Host ""
Write-Host "🔍 [PASO 1/2] Validando sintaxis del FUENTE: server-launcher.ps1..." -ForegroundColor Yellow

function Test-PowerShellSyntax {
    param(
        [string]$FilePath,
        [string]$Description
    )
    
    Write-Host "   Validando: $Description" -ForegroundColor Gray
    Write-Host "   Ruta: $FilePath" -ForegroundColor Gray
    
    # Validar que el archivo existe y tiene contenido
    if (!(Test-Path $FilePath)) {
        throw "Archivo no encontrado: $FilePath"
    }
    
    $fileInfo = Get-Item $FilePath
    $lineCount = (Get-Content $FilePath | Measure-Object -Line).Lines
    Write-Host "   Líneas: $lineCount | Tamaño: $($fileInfo.Length) bytes ($([math]::Round($fileInfo.Length/1024, 2)) KB)" -ForegroundColor Gray
    
    # Parse check usando -Command con ScriptBlock::Create (NO -File con .tmp)
    # IMPORTANTE: Escapar correctamente para que el shell padre no expanda variables
    $escapedPath = $FilePath -replace "'", "''"
    $parseCommand = @"
`$ErrorActionPreference = 'Stop'
try {
    `$content = Get-Content -Raw -LiteralPath '$escapedPath'
    [ScriptBlock]::Create(`$content) | Out-Null
    Write-Output 'PARSE_OK'
    exit 0
} catch {
    Write-Output "PARSE_ERROR: `$(`$_.Exception.Message)"
    exit 1
}
"@
    
    $output = pwsh -NoProfile -NonInteractive -Command $parseCommand 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -ne 0) {
        Write-Host "" -ForegroundColor Red
        Write-Host "❌ PARSE ERROR en $Description" -ForegroundColor Red
        Write-Host "" -ForegroundColor Red
        Write-Host $output -ForegroundColor Red
        Write-Host "" -ForegroundColor Red
        Write-Host "💡 DIAGNÓSTICO:" -ForegroundColor Yellow
        Write-Host "   Archivo: $FilePath" -ForegroundColor White
        Write-Host "   Líneas: $lineCount (esperado: ~600-700)" -ForegroundColor White
        
        if ($lineCount -gt 750) {
            Write-Host "   ⚠️  ADVERTENCIA: Archivo tiene más líneas de lo esperado" -ForegroundColor Yellow
            Write-Host "   Posible código duplicado al final. Abre el archivo y revisa." -ForegroundColor Yellow
        }
        
        Write-Host "" -ForegroundColor White
        Write-Host "💡 SOLUCIONES:" -ForegroundColor Yellow
        Write-Host "   1. Abre: code '$FilePath'" -ForegroundColor White
        Write-Host "   2. Busca bloques duplicados al final del archivo" -ForegroundColor White
        Write-Host "   3. Verifica llaves {}, try/catch/finally balanceadas" -ForegroundColor White
        Write-Host "   4. Guarda en UTF-8 con BOM" -ForegroundColor White
        Write-Host "   5. Prueba manualmente: pwsh -File '$FilePath' -ProjectRoot . -Port 3000" -ForegroundColor White
        throw "Parse error en $Description"
    }
    
    # Calcular hash
    $fileHash = (Get-FileHash -Path $FilePath -Algorithm SHA256).Hash.Substring(0, 16)
    Write-Host "   ✅ Sintaxis válida | Hash: $fileHash" -ForegroundColor Green
}

try {
    Test-PowerShellSyntax -FilePath $serverLauncherSrc -Description "server-launcher.ps1 (FUENTE)"
} catch {
    Write-Host "" -ForegroundColor Red
    Write-Host "❌ BUILD ABORTADO: El archivo fuente tiene errores de sintaxis" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔍 [PASO 2/2] Copiando y validando STAGING..." -ForegroundColor Yellow
Write-Host "Copiando server-launcher.ps1 al staging..." -ForegroundColor Gray

# Copiar con encoding UTF-8 BOM explícito (evita caracteres raros)
$sourceContent = Get-Content -Path $serverLauncherSrc -Raw
[System.IO.File]::WriteAllText($serverLauncherDst, $sourceContent, [System.Text.UTF8Encoding]::new($true))
Write-Host "   ✅ Copiado con UTF-8 BOM" -ForegroundColor Gray

# Validar inmediatamente después de copiar
try {
    Test-PowerShellSyntax -FilePath $serverLauncherDst -Description "server-launcher.ps1 (STAGING)"
} catch {
    Write-Host "" -ForegroundColor Red
    Write-Host "❌ BUILD ABORTADO: El archivo en staging está corrupto" -ForegroundColor Red
    Write-Host "   Esto NO debería pasar si el fuente está OK." -ForegroundColor Red
    Write-Host "   Posible problema: encoding, permisos o Copy-Item falló." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ server-launcher.ps1 validado en FUENTE y STAGING" -ForegroundColor Green
Write-Host ""

# Copiar bundle/project completo
$bundleProjectSrc = Join-Path $bundlePath "project"
$bundleProjectDst = Join-Path $tauriResourcesPath "bundle\project"

if (!(Test-Path $bundleProjectSrc)) {
    Write-Host "❌ bundle/project no encontrado en: $bundleProjectSrc" -ForegroundColor Red
    exit 1
}

Write-Host "Copiando bundle/project al staging..." -ForegroundColor Gray
# Asegurar que el directorio destino existe explicitamente
New-Item -ItemType Directory -Path $bundleProjectDst -Force | Out-Null
# Copiar el contenido recursivamente
Copy-Item -Path "$bundleProjectSrc\*" -Destination $bundleProjectDst -Recurse -Force

# Validar archivos clave
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📋 VALIDACIÓN CRÍTICA DE RECURSOS" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

$criticalFiles = @(
    @{
        Path = $serverLauncherDst
        Name = "server-launcher.ps1"
        Description = "Script de inicio del servidor"
    },
    @{
        Path = Join-Path $bundleProjectDst "web-server\server.js"
        Name = "web-server/server.js"
        Description = "Punto de entrada Next.js standalone"
    },
    @{
        Path = Join-Path $bundleProjectDst "deployment\Hosting\postgres-local\docker-compose.yml"
        Name = "deployment/.../docker-compose.yml"
        Description = "Configuración PostgreSQL"
    }
)

$allOk = $true
$missingFiles = @()

foreach ($file in $criticalFiles) {
    Write-Host "[VALIDANDO] $($file.Name)" -ForegroundColor Yellow
    Write-Host "   Path: $($file.Path)" -ForegroundColor Gray
    
    if (Test-Path $file.Path) {
        $fileInfo = Get-Item $file.Path
        $fileHash = (Get-FileHash -Path $file.Path -Algorithm SHA256).Hash.Substring(0, 12)
        Write-Host "   ✅ EXISTE | Tamaño: $($fileInfo.Length) bytes | Hash: $fileHash" -ForegroundColor Green
    } else {
        Write-Host "   ❌ NO ENCONTRADO" -ForegroundColor Red
        $allOk = $false
        $missingFiles += $file.Name
    }
    Write-Host ""
}

if (-not $allOk) {
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
    Write-Host "❌ BUILD ABORTADO: ARCHIVOS CRÍTICOS FALTANTES" -ForegroundColor Red
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
    Write-Host ""
    Write-Host "Archivos faltantes:" -ForegroundColor Red
    foreach ($missing in $missingFiles) {
        Write-Host "  - $missing" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "💡 DIAGNÓSTICO:" -ForegroundColor Yellow
    Write-Host "   1. Verifica que build.ps1 completó el paso [3/7] (build frontend)" -ForegroundColor White
    Write-Host "   2. Verifica que build.ps1 completó el paso [5/7] (empaquetar bundle)" -ForegroundColor White
    Write-Host "   3. Revisa si hubo errores en pasos anteriores" -ForegroundColor White
    Write-Host "   4. Bundle src: $bundleProjectSrc" -ForegroundColor White
    Write-Host "   5. Bundle dst: $bundleProjectDst" -ForegroundColor White
    exit 1
}

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ TODOS LOS RECURSOS CRÍTICOS VALIDADOS" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""

# Legacy checks (mantener para compatibilidad)
$scriptCheck = Test-Path $serverLauncherDst
$anchorCheck = Test-Path (Join-Path $bundleProjectDst "web-server\server.js")
$dockerCheck = Test-Path (Join-Path $bundleProjectDst "deployment\Hosting\postgres-local\docker-compose.yml")

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📋 VALIDACIÓN DE STAGING DE RESOURCES" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Verificar server-launcher.ps1
Write-Host ""
Write-Host "[CRÍTICO] server-launcher.ps1:" -ForegroundColor Yellow
Write-Host "  Path: $serverLauncherDst" -ForegroundColor Gray
if ($scriptCheck) {
    $scriptSize = (Get-Item $serverLauncherDst).Length
    Write-Host "  ✅ Existe ($scriptSize bytes)" -ForegroundColor Green
} else {
    Write-Host "  ❌ NO ENCONTRADO" -ForegroundColor Red
}

# Verificar web-server/server.js
Write-Host ""
Write-Host "[CRÍTICO] bundle/project/web-server/server.js:" -ForegroundColor Yellow
$anchorPath = Join-Path $bundleProjectDst "web-server\server.js"
Write-Host "  Path: $anchorPath" -ForegroundColor Gray
if ($anchorCheck) {
    $anchorSize = (Get-Item $anchorPath).Length
    Write-Host "  ✅ Existe ($anchorSize bytes)" -ForegroundColor Green
} else {
    Write-Host "  ❌ NO ENCONTRADO" -ForegroundColor Red
}

# Verificar docker-compose.yml
Write-Host ""
Write-Host "[CRÍTICO] docker-compose.yml:" -ForegroundColor Yellow
$dockerPath = Join-Path $bundleProjectDst "deployment\Hosting\postgres-local\docker-compose.yml"
Write-Host "  Path: $dockerPath" -ForegroundColor Gray
if ($dockerCheck) {
    $dockerSize = (Get-Item $dockerPath).Length
    Write-Host "  ✅ Existe ($dockerSize bytes)" -ForegroundColor Green
} else {
    Write-Host "  ❌ NO ENCONTRADO" -ForegroundColor Red
}

# Mostrar tamaño total del staging
Write-Host ""
Write-Host "[INFO] Tamaño total del staging:" -ForegroundColor Yellow
$stagingSize = (Get-ChildItem -Path $tauriResourcesPath -Recurse | Measure-Object -Property Length -Sum).Sum
$stagingSizeMB = [math]::Round($stagingSize / 1048576, 2)
Write-Host "  $stagingSizeMB MB en $tauriResourcesPath" -ForegroundColor White

# Listar estructura de primer nivel
Write-Host ""
Write-Host "[INFO] Estructura del staging:" -ForegroundColor Yellow
Get-ChildItem -Path $tauriResourcesPath | ForEach-Object {
    $marker = if ($_.PSIsContainer) { "📁" } else { "📄" }
    Write-Host "  $marker $($_.Name)" -ForegroundColor White
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

if (!$scriptCheck -or !$anchorCheck -or !$dockerCheck) {
    Write-Host ""
    Write-Host "❌ STAGING DE RESOURCES INCOMPLETO" -ForegroundColor Red
    Write-Host ""
    Write-Host "CHECKLIST DE DIAGNÓSTICO:" -ForegroundColor Yellow
    Write-Host "  1. ¿Falló el build del Frontend? Revisa errores arriba" -ForegroundColor White
    Write-Host "  2. ¿Existe bundle/project en ChavalosServerApp/bundle/? Debe contener:" -ForegroundColor White
    Write-Host "     - web-server/server.js (Next.js standalone)" -ForegroundColor White
    Write-Host "     - deployment/Hosting/postgres-local/docker-compose.yml" -ForegroundColor White
    Write-Host "  3. ¿Existe server-launcher.ps1 en ChavalosServerApp/?" -ForegroundColor White
    Write-Host ""
    Write-Host "PATHS ESPERADOS:" -ForegroundColor Yellow
    Write-Host "  Script source: $serverLauncherSrc" -ForegroundColor Gray
    Write-Host "  Bundle source: $bundleProjectSrc" -ForegroundColor Gray
    Write-Host "  Staging dest: $tauriResourcesPath" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "✅ Staging de resources completado correctamente" -ForegroundColor Green
Write-Host ""

# ========= [7/7] BUILD TAURI + INSTALADOR =========
Write-Host "[7/7] Instalando dependencias de Tauri UI..." -ForegroundColor Yellow

# Asegurarse de estar en el directorio de ChavalosServerApp
Push-Location $PSScriptRoot
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error instalando dependencias de Tauri" -ForegroundColor Red
        exit 1
    }

    Write-Host "Compilando UI de Tauri..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error compilando UI de Tauri" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "Compilando aplicación Tauri + generando MSI/EXE..." -ForegroundColor Yellow
    Write-Host "ADVERTENCIA: Este paso puede tardar 10-20 minutos la primera vez" -ForegroundColor Yellow
    Write-Host "Rust compila en modo release con optimizaciones completas" -ForegroundColor Gray
    Write-Host ""

    npm run tauri:build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error compilando aplicación Tauri" -ForegroundColor Red
        exit 1
    }

    Write-Host "[OK] Aplicacion Tauri compilada" -ForegroundColor Green
    Write-Host ""
} finally {
    Pop-Location
}

# ========= POST-BUILD VALIDATION =========
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📋 VALIDACIÓN POST-BUILD" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Verificar que el ejecutable fue generado
$exePath = "src-tauri\target\release\Chavalos Server.exe"
if (Test-Path $exePath) {
    $exeSize = (Get-Item $exePath).Length
    $exeSizeMB = [math]::Round($exeSize / 1048576, 2)
    Write-Host "✅ Ejecutable generado: $exePath ($exeSizeMB MB)" -ForegroundColor Green
} else {
    Write-Host "⚠️  No se encontró el ejecutable en: $exePath" -ForegroundColor Yellow
}

# Verificar que el staging de resources todavía existe (debug)
$resourcesStillThere = Test-Path $tauriResourcesPath
Write-Host "📂 Staging de resources: $(if($resourcesStillThere){'Presente'}else{'Removido'})" -ForegroundColor $(if($resourcesStillThere){'Green'}else{'Gray'})

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# ========= RESULTADO FINAL =========
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  [OK] BUILD COMPLETADO EXITOSAMENTE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$bundleDir = "src-tauri\target\release\bundle"
if (Test-Path $bundleDir) {
    Write-Host "[INFO] Instaladores generados en:" -ForegroundColor White
    Write-Host "   $bundleDir" -ForegroundColor Yellow
    Write-Host ""
    
    # List MSI files
    $msiFiles = Get-ChildItem "$bundleDir\msi\*.msi" -ErrorAction SilentlyContinue
    if ($msiFiles) {
        Write-Host "[MSI] Instalador MSI (recomendado):" -ForegroundColor Green
        foreach ($file in $msiFiles) {
            $sizeMB = [math]::Round($file.Length / 1048576, 2)
            Write-Host ("   - {0} ({1} MB)" -f $file.Name, $sizeMB) -ForegroundColor White
            Write-Host ("     Ruta: {0}" -f $file.FullName) -ForegroundColor Gray
        }
        Write-Host ""
    }
    
    # List NSIS files
    $nsisFiles = Get-ChildItem "$bundleDir\nsis\*.exe" -ErrorAction SilentlyContinue
    if ($nsisFiles) {
        Write-Host "[EXE] Instalador EXE (alternativo):" -ForegroundColor Green
        foreach ($file in $nsisFiles) {
            $sizeMB = [math]::Round($file.Length / 1048576, 2)
            Write-Host ("   - {0} ({1} MB)" -f $file.Name, $sizeMB) -ForegroundColor White
            Write-Host ("     Ruta: {0}" -f $file.FullName) -ForegroundColor Gray
        }
        Write-Host ""
    }
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "[INFO] CONTENIDO DEL INSTALADOR:" -ForegroundColor Cyan
    Write-Host "   [OK] Aplicacion Tauri (UI de control)" -ForegroundColor Green
    Write-Host "   [OK] Frontend Next.js (standalone)" -ForegroundColor Green
    Write-Host "   [OK] Backend (APIs y servicios)" -ForegroundColor Green
    Write-Host "   [OK] Base de datos (docker-compose PostgreSQL)" -ForegroundColor Green
    Write-Host "   [OK] Scripts de despliegue" -ForegroundColor Green
    Write-Host "   [OK] server-launcher.ps1" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "[REQUISITOS] EN PC DESTINO:" -ForegroundColor Yellow
    Write-Host "   1. Docker Desktop (para PostgreSQL)" -ForegroundColor White
    Write-Host "   2. Node.js (version LTS)" -ForegroundColor White
    Write-Host "   3. Instalar el MSI generado" -ForegroundColor White
    Write-Host ""
    Write-Host "[SETUP] Despues de instalar:" -ForegroundColor Green
    Write-Host "   1. Abrir 'Chavalos Server'" -ForegroundColor White
    Write-Host "   2. Click 'Iniciar'" -ForegroundColor White
    Write-Host "   3. Listo! (logs en vivo, sin consola)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "[WARN] No se encontro el directorio de salida" -ForegroundColor Yellow
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Open bundle folder
$openFolder = Read-Host "Abrir carpeta con los instaladores? (S/N)"
if ($openFolder -eq "S" -or $openFolder -eq "s") {
    if (Test-Path $bundleDir) {
        Start-Process explorer.exe -ArgumentList $bundleDir
    }
}
