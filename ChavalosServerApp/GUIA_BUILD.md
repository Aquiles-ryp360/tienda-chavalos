# 📦 GUÍA RÁPIDA - EMPAQUETADO PARA PRODUCCIÓN

## 🎯 CÓMO GENERAR EL INSTALADOR

```powershell
# 1. Abrir PowerShell en la carpeta ChavalosServerApp
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp

# 2. Ejecutar el script de build
.\build.ps1

# 3. Esperar (10-20 minutos la primera vez)
# El script:
#   ✓ Verifica prerequisitos
#   ✓ Limpia bundle anterior
#   ✓ Compila Frontend (Next.js standalone)
#   ✓ Copia Backend, DB, scripts
#   ✓ Genera MSI/EXE con todo incluido

# 4. Resultado
# MSI: ChavalosServerApp\src-tauri\target\release\bundle\msi\
# EXE: ChavalosServerApp\src-tauri\target\release\bundle\nsis\
```

---

## � VERIFICACIÓN DE RESOURCES EN BUILD

### Pre-Build: Staging de Resources

Antes de que Tauri compile, el script `build.ps1` prepara un staging en:
```
ChavalosServerApp/src-tauri/resources/
├── server-launcher.ps1          [CRÍTICO]
└── bundle/
    └── project/
        ├── web-server/
        │   └── server.js        [CRÍTICO - ANCHOR]
        ├── backend/
        └── deployment/
            └── Hosting/
                └── postgres-local/
                    └── docker-compose.yml   [CRÍTICO]
```

**Validación automática:**
El script verifica que existan los 3 archivos críticos:
- ✅ `server-launcher.ps1` (script de inicio)
- ✅ `bundle/project/web-server/server.js` (Next.js standalone)
- ✅ `docker-compose.yml` (PostgreSQL)

Si falta alguno, el build **FALLA** con un checklist de diagnóstico.

### Post-Build: Verificación del Bundle

Después de `cargo build --release`, el staging se incluye en:
```
src-tauri/target/release/bundle/
├── msi/
│   └── Chavalos Server_1.0.0_x64_es-ES.msi
└── nsis/
    └── Chavalos Server_1.0.0_x64-setup.exe
```

**Logs de verificación:**
- Tamaño del staging en MB
- Lista de primer nivel en `src-tauri/resources/`
- Path del ejecutable generado

### Runtime: Resolución de Resources (main.rs)

En **RELEASE**, el código Rust:

1. **Intenta múltiples candidatos** para cada resource:
   ```rust
   // Para script:
   ["server-launcher.ps1", "resources/server-launcher.ps1"]
   
   // Para anchor (web-server/server.js):
   ["bundle/project/web-server/server.js", "resources/bundle/project/web-server/server.js"]
   ```

2. **Retorna el PRIMER path que existe** en disco

3. **Si ninguno existe**, genera un error con:
   - `resource_dir` actual
   - Lista de candidatos intentados
   - Estado de `exists` para cada uno
   - Hint de posibles causas:
     * Build sin resources (ejecutar `build.ps1` completo)
     * Instalación incorrecta (reinstalar MSI/NSIS)
     * `tauri.conf.json` incorrecto (verificar `bundle.resources`)

4. **Guarda `project_root`** en el state cuando arranca el servidor, para usarlo consistentemente al detener (docker compose down)

### Diagnóstico en UI

Al iniciar el servidor en release, la UI mostrará:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 [DIAGNÓSTICO INICIAL]
  current_dir: C:\Program Files\Chavalos Server
  app_data_dir: C:\Users\...\AppData\Roaming\com.chavalos.server
  resource_dir: C:\Program Files\Chavalos Server\resources
  is_release: true
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📂 [RESOURCE DIR] Contenido de: ...
  📄 server-launcher.ps1
  📁 bundle
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 [RESOURCE] Resolviendo 'server-launcher.ps1' | resource_dir: ...
  - candidato: 'server-launcher.ps1' → resolved: Some(...), exists: true
✅ [RESOURCE] 'server-launcher.ps1' encontrado: ...
✅ Modo PRODUCCIÓN: usando recursos empaquetados
```

Si falla:
```
❌ [RESOURCE] No se encontró 'server-launcher.ps1'
resource_dir: C:\Program Files\Chavalos Server\resources
Candidatos intentados:
  - candidato: 'server-launcher.ps1' → resolved: None, exists: false
  - candidato: 'resources/server-launcher.ps1' → resolved: None, exists: false

💡 POSIBLES CAUSAS:
- Build sin resources: ejecuta build.ps1 completo
- Instalación incorrecta: reinstala el MSI/NSIS
- tauri.conf.json incorrecto: verifica bundle.resources
- Staging incompleto: verifica src-tauri/resources/ antes del build
```

---

## 📋 ARCHIVOS MODIFICADOS

### ✅ Ya implementados (no tocar):

1. **Frontend/NextJS_React/web/next.config.ts**
   - Añadido `output: 'standalone'`

2. **ChavalosServerApp/build.ps1**
   - Script completo de empaquetado
   - Validación de staging (pre-build)
   - Validación post-build

3. **ChavalosServerApp/src-tauri/tauri.conf.json**
   - Incluye `resources/server-launcher.ps1`
   - Incluye `resources/bundle/project/**/*`

4. **ChavalosServerApp/src-tauri/src/main.rs**
   - Helper `resolve_resource_existing()` con múltiples candidatos
   - Diagnóstico detallado (resource_dir, candidatos, exists)
   - Guarda `project_root` en state para stop consistente
   - Sin warnings de clippy/rustfmt

5. **ChavalosServerApp/server-launcher.ps1**
   - Modo dual con validaciones

---

## 🚀 INSTALACIÓN EN PC DESTINO

### Paso 1: Dependencias externas (ANTES del MSI)
```
1. Docker Desktop
   → https://www.docker.com/products/docker-desktop
   → Instalar y ARRANCAR Docker Desktop

2. Node.js LTS (v20.x o superior)
   → https://nodejs.org/
   → Instalar con configuración por defecto
```

### Paso 2: Instalar MSI
```
Doble click en: Chavalos Server_1.0.0_x64_es-ES.msi
Siguiente → Siguiente → Instalar
```

### Paso 3: Ejecutar
```
1. Buscar "Chavalos Server" en el menú inicio
2. Abrir la aplicación
3. Click botón "Iniciar"
4. ✅ Ver logs en la aplicación (sin consola)
5. Abrir navegador: http://localhost:3000
```

---

## 🔍 SOLUCIÓN DE PROBLEMAS

### ❌ "Docker NO está disponible"
```
Causa: Docker Desktop no está corriendo
Solución:
1. Abrir Docker Desktop
2. Esperar a que inicie completamente (icono ballena en bandeja)
3. Volver a intentar "Iniciar" en Chavalos Server
```

### ❌ "Node.js NO está disponible"
```
Causa: Node.js no instalado o no en PATH
Solución:
1. Instalar Node.js desde nodejs.org
2. Reiniciar el sistema
3. Verificar: abrir cmd y escribir: node --version
```

### ❌ "No se encontró server.js"
```
Causa: Build incorrecto o MSI corrupto
Solución:
1. En tu PC de desarrollo:
   cd ChavalosServerApp
   .\build.ps1
2. Reinstalar MSI en PC destino
```

### ❌ "PostgreSQL no está listo"
```
Causa: Docker tarda en iniciar el contenedor
Solución:
1. Esperar 30-60 segundos
2. Si persiste, abrir Docker Desktop y verificar que el contenedor está corriendo
```

---

## 📊 ESTRUCTURA FINAL

### En tu PC (después del build):
```
ChavalosServerApp/
├── bundle/                         ← Staging (temporal)
│   └── project/
│       ├── web-server/            ← Next.js standalone
│       ├── deployment/            ← Docker + scripts
│       └── backend/               ← APIs
│
└── src-tauri/
    └── target/
        └── release/
            └── bundle/
                ├── msi/           ← 🎯 INSTALADOR MSI (DISTRIBUIR ESTE)
                └── nsis/          ← Instalador EXE (alternativo)
```

### En PC destino (después de instalar MSI):
```
C:\Program Files\Chavalos Server\
├── Chavalos Server.exe            ← App Tauri (UI)
└── resources/
    ├── server-launcher.ps1
    └── bundle/
        └── project/               ← Todo tu proyecto empaquetado
            ├── web-server/        ← Next.js listo para correr
            ├── deployment/        ← docker-compose.yml
            └── backend/           ← APIs
```

---

## ✅ CHECKLIST PRE-DISTRIBUCIÓN

Antes de dar el MSI a usuarios, verificar:

- [ ] `build.ps1` completó sin errores
- [ ] Existe MSI en `src-tauri/target/release/bundle/msi/`
- [ ] Tamaño MSI razonable (< 200 MB)
- [ ] Probado en PC limpia:
  - [ ] Docker Desktop instalado
  - [ ] Node.js instalado
  - [ ] MSI instala sin errores
  - [ ] App abre correctamente
  - [ ] Click "Iniciar" funciona
  - [ ] Logs aparecen en tiempo real
  - [ ] http://localhost:3000 responde

---

## 🎓 RESUMEN DE MEJORAS

| Aspecto | Antes (repo manual) | Ahora (MSI auto-contenido) |
|---------|---------------------|----------------------------|
| **Instalación** | Clonar repo + setup manual | Solo MSI |
| **Dependencias** | npm install en destino | Ya compilado (solo Node runtime) |
| **Rutas** | Hardcoded D:\Aquiles\... | Automáticas (recursos Tauri) |
| **Ejecución** | Consolas PowerShell | UI con logs integrados |
| **Configuración** | Manual (docker-compose, Next) | Automática (checks integrados) |
| **Distribución** | Compartir repo completo (~500MB) | Solo MSI (~60-150MB) |

---

## 📞 COMANDOS ÚTILES

```powershell
# Limpiar todo y rebuild completo
cd ChavalosServerApp
Remove-Item bundle -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item src-tauri\target\release\bundle -Recurse -Force -ErrorAction SilentlyContinue
.\build.ps1

# Verificar prerequisitos
node --version
npm --version
rustc --version
cargo --version
docker --version

# Ver logs de Tauri en desarrollo
npm run tauri:dev

# Solo build UI (sin MSI)
npm run build
```

---

## 🔧 TROUBLESHOOTING Y PRUEBAS DEL LAUNCHER

### 1️⃣ Validar Sintaxis de server-launcher.ps1

**Antes de hacer build**, verifica que el launcher no tenga errores de sintaxis:

```powershell
# Parse check (valida sin ejecutar)
pwsh -NoProfile -NonInteractive -Command "[ScriptBlock]::Create((Get-Content -Raw -LiteralPath '.\server-launcher.ps1')) | Out-Null"

# Si sale sin error = ✅ Sintaxis correcta
# Si muestra ParserError = ❌ Código duplicado o encoding roto
```

**Signos de archivo corrupto:**
- Error: `ParserError: Missing closing '}' in statement block`
- Error: `The string is missing the terminator: "`
- Archivo tiene >500 líneas (debería tener ~500 máximo)
- Al abrirlo ves bloques de código duplicados al final

**Solución si está corrupto:**
```powershell
# Ver el tamaño real
(Get-Item .\server-launcher.ps1).Length

# Si es >50KB, revisar manualmente y eliminar duplicados
code .\server-launcher.ps1
# Ir al final del archivo y buscar código pegado 2 veces
# Guardar como UTF-8 con BOM
```

---

### 2️⃣ Ejecutar Launcher Manualmente (Modo Dev)

Prueba el launcher directamente **sin empaquetar**:

```powershell
# Ir a la raíz del proyecto
cd D:\Aquiles\Tienda_Chavalos_Virtual_web

# Ejecutar el launcher en modo desarrollo
pwsh -File .\ChavalosServerApp\server-launcher.ps1 -ProjectRoot . -Mode dev -Port 3000
```

**Qué esperar:**
1. ✅ Docker check → PostgreSQL up
2. ✅ IP LAN detectada (ej: 192.168.1.100)
3. ✅ QR code generado
4. ✅ **READINESS CHECK**: Esperando puerto 3000...
5. ✅ Puerto verificado y aceptando conexiones
6. 📋 Líneas parseables:
   ```
   LOCAL_URL=http://127.0.0.1:3000
   LAN_URL=http://192.168.1.100:3000
   QR_PATH=D:\Aquiles\...\LAN-QR.png
   LOG_PATH=C:\Users\...\AppData\Roaming\com.chavalos.server\logs\server-20260117_143022.log
   ```
7. ✅ Next.js: `Ready on http://0.0.0.0:3000`

**Si falla el readiness check:**
- Verifica que el puerto 3000 no esté ocupado: `netstat -ano | findstr :3000`
- Revisa el log completo: `notepad $env:APPDATA\com.chavalos.server\logs\server-*.log`
- Busca errores de Node/Next en stderr

---

### 3️⃣ Verificar Puerto con Test-NetConnection

**Antes de arrancar el launcher:**
```powershell
# Puerto debe estar libre
Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Detailed

# Si ves "TcpTestSucceeded : False" = ✅ Puerto libre
# Si ves "TcpTestSucceeded : True"  = ❌ Ya está ocupado
```

**Después de "SERVICIOS LISTOS":**
```powershell
# En otra terminal (mientras launcher corre)
Test-NetConnection -ComputerName localhost -Port 3000

# DEBE mostrar: TcpTestSucceeded : True
```

**Ver qué proceso usa el puerto 3000:**
```powershell
# Buscar el PID
netstat -ano | findstr :3000

# Ver detalles del proceso
Get-Process -Id <PID>
```

---

### 4️⃣ Verificar Logs de Node/Next

El launcher v3.0 guarda **todo lo que emite Node**:

```powershell
# Abrir el log más reciente
$logDir = "$env:APPDATA\com.chavalos.server\logs"
$latest = Get-ChildItem $logDir -Filter "server-*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
notepad $latest.FullName
```

**Buscar en el log:**
- `[NODE-STDOUT]` → Salida estándar de Node (Ready, compilando, etc.)
- `[NODE-STDERR]` → Errores y warnings de Node
- `[ERROR]` → Errores del launcher mismo
- `Exit Code:` → Código de salida si Node/Next falló

**Escenarios comunes:**

| Síntoma | Log muestra | Causa |
|---------|-------------|-------|
| UI dice "OK" pero navegador falla | No hay `Ready` en STDOUT | Node no arrancó o murió al instante |
| Puerto no abre | Error en STDERR: `EADDRINUSE` | Puerto ocupado |
| Build de Next falla | `Module not found` | Falta dependencia o build incompleto |
| Prisma error | `Can't reach database` | PostgreSQL no está corriendo |

---

### 5️⃣ Validación Durante el Build

El `build.ps1` ahora hace **parse check automático**:

```powershell
# Al copiar server-launcher.ps1 a resources, verás:

🔍 Validando sintaxis de server-launcher.ps1...
✅ Sintaxis de server-launcher.ps1 validada correctamente
   Tamaño: 20485 bytes
   Hash (primeros 16): 3A7F9B2C1D8E4...
```

**Si falla:**
```
❌ ERROR: server-launcher.ps1 tiene errores de sintaxis:
ParserError: Missing closing '}' in statement block

💡 SOLUCIÓN:
   1. Revisa el archivo fuente: ChavalosServerApp\server-launcher.ps1
   2. Verifica que no tenga código duplicado o caracteres raros
   3. Asegúrate de que esté en UTF-8 con BOM
   4. Prueba manualmente: pwsh -File '.\server-launcher.ps1' -ProjectRoot . -Port 3000
```

**El build se detiene** para que corrijas el problema antes de empaquetar corrupto.

---

### 6️⃣ Testing Post-Instalación

Después de instalar el MSI/NSIS:

```powershell
# Ubicación por defecto
cd "C:\Users\<TU_USUARIO>\AppData\Local\Chavalos Server"

# Ver los resources instalados
Get-ChildItem resources -Recurse | Select-Object FullName

# Verificar que server-launcher.ps1 esté ahí
Test-Path "resources\server-launcher.ps1"

# Ver el log del último inicio
$logDir = "$env:APPDATA\com.chavalos.server\logs"
Get-ChildItem $logDir -Filter "server-*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content
```

---

### 7️⃣ Comandos Útiles de Diagnóstico

```powershell
# Ver todos los procesos Node corriendo
Get-Process -Name node | Format-Table Id, ProcessName, Path -AutoSize

# Ver puertos abiertos por Node
netstat -ano | findstr node

# Matar todos los procesos Node del proyecto (usar con cuidado)
Get-Process -Name node | Where-Object { $_.Path -like "*Tienda_Chavalos_Virtual_web*" } | Stop-Process -Force

# Ver contenedores Docker corriendo
docker ps

# Ver logs de PostgreSQL
docker logs ferreteria-postgres-1

# Reiniciar PostgreSQL
docker compose down
docker compose up -d

# Limpiar todo y empezar de cero
docker compose down -v
Remove-Item data -Recurse -Force -ErrorAction SilentlyContinue
docker compose up -d
```

---

**✅ Con estas pruebas puedes diagnosticar cualquier fallo antes o después del empaquetado.**

---

