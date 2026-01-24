# 🔧 COMANDOS DE VALIDACIÓN Y PRUEBA

## ✅ ESTADO ACTUAL
- ✅ server-launcher.ps1 → Parse OK (605 líneas, 23.46 KB)
- ✅ build.ps1 → Validación automática agregada
- ✅ No hay código duplicado
- ✅ Listo para build

---

## 📋 COMANDOS DE VALIDACIÓN

### 1️⃣ Validación Completa Pre-Build (RECOMENDADO)

```powershell
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp
.\validate-prebuild.ps1
```

**Qué valida:**
- ✅ Parse check del fuente
- ✅ Encoding UTF-8
- ✅ Funciones duplicadas
- ✅ Staging (si existe)

---

### 2️⃣ Parse Check Manual (Fuente) - MÉTODO CORRECTO

```powershell
# Parse check del fuente usando -Command (NO -File con .tmp)
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp

pwsh -NoProfile -NonInteractive -Command "
    `$ErrorActionPreference='Stop'
    try {
        [ScriptBlock]::Create((Get-Content -Raw -LiteralPath '.\server-launcher.ps1')) | Out-Null
        Write-Host '✅ PARSE OK' -ForegroundColor Green
        exit 0
    } catch {
        Write-Host '❌ PARSE ERROR:' `$_.Exception.Message -ForegroundColor Red
        exit 1
    }
"

# NOTA: NO uses "pwsh -File" con archivos .tmp - PowerShell lo rechaza
# El build.ps1 ahora usa -Command correctamente
```

---

### 3️⃣ Parse Check Manual (Staging) - MÉTODO CORRECTO

```powershell
# Después de ejecutar build.ps1, valida el archivo copiado
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp

pwsh -NoProfile -NonInteractive -Command "
    `$ErrorActionPreference='Stop'
    try {
        [ScriptBlock]::Create((Get-Content -Raw -LiteralPath '.\src-tauri\resources\server-launcher.ps1')) | Out-Null
        Write-Host '✅ STAGING OK' -ForegroundColor Green
        exit 0
    } catch {
        Write-Host '❌ STAGING CORRUPTO:' `$_.Exception.Message -ForegroundColor Red
        exit 1
    }
"
```

---

### 4️⃣ Ejecutar Build Completo

```powershell
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp

# Limpiar staging anterior (opcional pero recomendado)
Remove-Item "src-tauri\resources" -Recurse -Force -ErrorAction SilentlyContinue

# Ejecutar build
.\build.ps1
```

**El build ahora incluye:**
- ✅ Parse check automático del fuente
- ✅ Parse check automático del staging
- ✅ Validación de recursos críticos (server.js, docker-compose.yml)
- ✅ Aborta si encuentra errores

---

### 5️⃣ Ejecución Manual del Launcher (Modo Dev)

```powershell
# Probar el launcher directamente sin empaquetar
cd D:\Aquiles\Tienda_Chavalos_Virtual_web

pwsh -File .\ChavalosServerApp\server-launcher.ps1 -ProjectRoot . -Mode dev -Port 3000
```

**Qué esperar:**
1. 🔍 DIAGNÓSTICO DEL SISTEMA (nueva función)
   - PowerShell version
   - Permisos (admin o no)
   - Rutas clave
   - server.js / package.json
2. Docker check
3. PostgreSQL up
4. IP LAN detectada
5. **[READINESS CHECK]** Verificando puerto 3000...
6. ✅ Puerto verificado
7. Líneas parseables:
   ```
   LOCAL_URL=http://127.0.0.1:3000
   LAN_URL=http://192.168.1.100:3000
   QR_PATH=...
   LOG_PATH=...
   ```
8. Next.js arranca y muestra: `Ready on http://0.0.0.0:3000`

---

### 6️⃣ Verificar Logs de Node/Next

```powershell
# Ver el log más reciente
$logDir = "$env:APPDATA\com.chavalos.server\logs"
$latest = Get-ChildItem $logDir -Filter "server-*.log" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if ($latest) {
    notepad $latest.FullName
} else {
    Write-Host "No hay logs todavía"
}
```

---

### 7️⃣ Verificar Puerto 3000

```powershell
# Ver si el puerto está abierto
Test-NetConnection -ComputerName localhost -Port 3000

# Ver qué proceso usa el puerto
netstat -ano | findstr :3000

# Si quieres ver el PID completo
$pid = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess
if ($pid) {
    Get-Process -Id $pid | Format-Table Id, ProcessName, Path -AutoSize
}
```

---

### 8️⃣ Limpiar Todo (Reset Completo)

```powershell
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp

# 1. Matar procesos Node
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*Tienda_Chavalos_Virtual_web*" } | Stop-Process -Force

# 2. Bajar Docker
cd ..\Despliegue\Hosting\postgres-local
docker compose down
cd ..\..\..\ChavalosServerApp

# 3. Limpiar bundles
Remove-Item "bundle" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "src-tauri\resources" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "src-tauri\target\release" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "✅ Limpieza completa" -ForegroundColor Green
```

---

### 9️⃣ Testing Post-Instalación (Después de MSI)

```powershell
# Ubicación por defecto de la instalación
cd "C:\Users\$env:USERNAME\AppData\Local\Chavalos Server"

# Verificar que server-launcher.ps1 esté instalado
if (Test-Path "resources\server-launcher.ps1") {
    Write-Host "✅ Launcher instalado" -ForegroundColor Green
    
    # Parse check
    pwsh -NoProfile -Command "[ScriptBlock]::Create((Get-Content -Raw -LiteralPath '.\resources\server-launcher.ps1')) | Out-Null; if (`$?) { Write-Host '✅ PARSE OK' -ForegroundColor Green } else { Write-Host '❌ CORRUPTO' -ForegroundColor Red }"
} else {
    Write-Host "❌ Launcher NO encontrado" -ForegroundColor Red
}

# Verificar server.js
if (Test-Path "resources\bundle\project\web-server\server.js") {
    Write-Host "✅ server.js instalado" -ForegroundColor Green
} else {
    Write-Host "❌ server.js NO encontrado" -ForegroundColor Red
}

# Verificar docker-compose.yml
if (Test-Path "resources\bundle\project\deployment\Hosting\postgres-local\docker-compose.yml") {
    Write-Host "✅ docker-compose.yml instalado" -ForegroundColor Green
} else {
    Write-Host "❌ docker-compose.yml NO encontrado" -ForegroundColor Red
}
```

---

## 🔍 DIAGNÓSTICO DE ERRORES COMUNES

### Error: "ParserError: Unexpected token '}'"

**Causa:** Código duplicado o llaves desbalanceadas

**Solución:**
```powershell
# Ver líneas del archivo
$file = ".\server-launcher.ps1"
$lines = (Get-Content $file | Measure-Object -Line).Lines
Write-Host "Líneas: $lines"

# Si tiene >650 líneas, probablemente hay duplicados
# Abrir y revisar manualmente
code $file
```

### Error: "ERR_CONNECTION_REFUSED en localhost:3000"

**Causa:** Node no arrancó o murió inmediatamente

**Diagnóstico:**
```powershell
# 1. Ver el log
notepad "$env:APPDATA\com.chavalos.server\logs\server-*.log"

# 2. Buscar en el log:
#    - [NODE-STDOUT] → ¿Hay "Ready"?
#    - [NODE-STDERR] → ¿Qué error muestra?
#    - Exit Code → ¿Con qué código terminó?

# 3. Verificar puerto
Test-NetConnection -ComputerName localhost -Port 3000
```

### Error: "staging corrupto" durante build

**Causa:** Copia anterior con contenido basura

**Solución:**
```powershell
# Eliminar staging y rebuild
Remove-Item "src-tauri\resources" -Recurse -Force
.\build.ps1
```

---

## ✅ CHECKLIST PRE-BUILD

Antes de hacer `.\build.ps1`:

- [ ] Ejecutar `.\validate-prebuild.ps1` → debe decir "LISTO PARA BUILD"
- [ ] Parse check manual → debe decir "✅ PARSE OK"
- [ ] Archivo tiene <650 líneas (605 actualmente)
- [ ] No hay procesos Node corriendo del proyecto
- [ ] Staging limpio (o eliminado)

---

## 🚀 FLUJO DE TRABAJO COMPLETO

```powershell
# 1. Validar pre-build
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp
.\validate-prebuild.ps1

# 2. Si todo OK, hacer build
.\build.ps1

# 3. Esperar (10-20 min)
# El build ahora validará automáticamente:
#   - Parse del fuente
#   - Parse del staging
#   - Existencia de server.js
#   - Existencia de docker-compose.yml

# 4. Si falla, el error será claro:
#   - PARSE ERROR → archivo tiene errores de sintaxis
#   - MISSING FILE → falta archivo crítico
#   - BUILD FAILED → Rust/Cargo error

# 5. Si todo OK, el MSI/EXE estará en:
#   src-tauri\target\release\bundle\msi\
#   src-tauri\target\release\bundle\nsis\

# 6. Instalar y probar
# Abrir la app, click "Iniciar Servidor"
# Abrir navegador: http://localhost:3000
# Debe cargar la interfaz ✅
```

---

**✅ SISTEMA 100% BUILDABLE CON VALIDACIONES ESTRICTAS**
