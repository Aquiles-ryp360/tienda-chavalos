# Verificación de Resources Empaquetados

## Problema resuelto
- ✅ La app instalada ahora usa **MODO PRODUCCIÓN** obligatorio
- ✅ No hay fallback a DEV en builds release
- ✅ Logs de diagnóstico completos para debugging
- ✅ Resolución correcta de resources usando archivo ancla

## Cambios realizados

### 1. `src-tauri/src/main.rs`
**Antes:**
- Intentaba resolver `bundle/project` directamente (puede fallar con directorios)
- Permitía fallback a DEV en release
- Logs mínimos

**Ahora:**
- ✅ Resuelve archivo ancla: `bundle/project/web-server/server.js`
- ✅ Deriva `project_root` desde el ancla: `server.js -> web-server -> project`
- ✅ En **RELEASE**: error inmediato si faltan resources (sin fallback DEV)
- ✅ En **DEBUG**: intenta resources primero, luego fallback DEV
- ✅ Logs de diagnóstico completos:
  - `current_dir()`
  - Resultado de `resolve_resource("server-launcher.ps1")`
  - Resultado de `resolve_resource("bundle/project/web-server/server.js")`
  - Estado `exists()` de cada path
  - Modo final (PROD/DEV)

### 2. `src-tauri/tauri.conf.json`
**Antes:**
```json
"resources": [
  "../server-launcher.ps1",
  "../bundle/project/**"
]
```

**Ahora:**
```json
"resources": [
  "../server-launcher.ps1",
  "../bundle/project/**/*"
]
```

El glob `**/*` asegura que todos los archivos dentro de subcarpetas se incluyan (importante en Windows).

## Verificación ANTES de instalar MSI

### Paso 1: Build release
```powershell
cd ChavalosServerApp
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

### Paso 2: Verificar resources en target/release
Después del build, verifica que existan estos archivos:

```powershell
# Navegar a la carpeta de resources
cd src-tauri\target\release

# Verificar estructura (debe verse así):
# resources/
#   ├── server-launcher.ps1
#   └── bundle/
#       └── project/
#           ├── web-server/
#           │   ├── server.js
#           │   ├── .next/
#           │   └── public/
#           ├── backend/
#           └── deployment/
```

**Comando para verificar:**
```powershell
# Listar resources
Get-ChildItem -Path ".\src-tauri\target\release" -Recurse -Filter "resources" | Get-ChildItem -Recurse

# Verificar archivos clave
Test-Path ".\src-tauri\target\release\resources\server-launcher.ps1"
Test-Path ".\src-tauri\target\release\resources\bundle\project\web-server\server.js"
```

### Paso 3: Verificar bundle MSI
Los instaladores MSI/NSIS están en:
```
src-tauri\target\release\bundle\msi\*.msi
src-tauri\target\release\bundle\nsis\*.exe
```

**⚠️ IMPORTANTE:** Si `resources/` NO existe o está vacío:
1. El problema está en `build.ps1` (no creó `bundle/project/`) O
2. El problema está en `tauri.conf.json` (glob no incluye archivos)

## Verificación DESPUÉS de instalar MSI

### Logs esperados en la UI
Al presionar "Iniciar" en la app instalada, debes ver:

```
🔍 [DIAGNÓSTICO] current_dir: C:\Program Files\Chavalos Server
🔍 [DIAGNÓSTICO] is_release: true
🔍 [DIAGNÓSTICO] resolve_resource('server-launcher.ps1'): Some("C:\\Program Files\\Chavalos Server\\resources\\server-launcher.ps1")
🔍 [DIAGNÓSTICO] script exists: true
🔍 [DIAGNÓSTICO] resolve_resource('bundle/project/web-server/server.js'): Some("C:\\Program Files\\Chavalos Server\\resources\\bundle\\project\\web-server\\server.js")
🔍 [DIAGNÓSTICO] anchor exists: true
✅ Modo PRODUCCIÓN: usando recursos empaquetados
📂 Script final: "C:\\Program Files\\Chavalos Server\\resources\\server-launcher.ps1"
📂 Proyecto final: "C:\\Program Files\\Chavalos Server\\resources\\bundle\\project"
```

### Errores posibles y soluciones

#### ❌ Error: "No se encontró server-launcher.ps1 en resources empaquetados"
**Causa:** El script no se copió a resources durante el build.

**Solución:**
1. Verificar que `ChavalosServerApp/server-launcher.ps1` existe
2. Verificar glob en `tauri.conf.json`: `"../server-launcher.ps1"`
3. Rebuild: `powershell -ExecutionPolicy Bypass -File .\build.ps1`

#### ❌ Error: "No se encontró bundle/project/web-server/server.js"
**Causa:** El bundle no se creó o no se copió correctamente.

**Solución:**
1. Verificar que `ChavalosServerApp/bundle/project/web-server/server.js` existe después de `build.ps1`
2. Verificar paso [3/7] del build:
   - ¿Se creó `.next/standalone`?
   - ¿Se copió a `bundle/project/web-server`?
3. Verificar glob en `tauri.conf.json`: `"../bundle/project/**/*"`
4. Rebuild completo

#### ⚠️ Warning: Logs dicen "Modo DESARROLLO" en app instalada
**Causa:** El build fue en modo debug (`npm run tauri dev`) en lugar de release.

**Solución:**
```powershell
# Usar build script (hace tauri build release)
powershell -ExecutionPolicy Bypass -File .\build.ps1

# O manualmente:
npm run tauri:build
```

## Testing local (sin instalar)

Para probar el modo producción sin instalar el MSI:

```powershell
# Ejecutar el EXE release directamente
.\src-tauri\target\release\chavalos-server.exe
```

Esto debe mostrar los logs de diagnóstico. Si dice "Modo PRODUCCIÓN" y encuentra los resources, el MSI estará correcto.

## Checklist final

- [ ] `build.ps1` ejecutado sin errores
- [ ] `bundle/project/web-server/server.js` existe antes de tauri build
- [ ] `src-tauri/target/release/resources/server-launcher.ps1` existe después del build
- [ ] `src-tauri/target/release/resources/bundle/project/web-server/server.js` existe
- [ ] EXE local muestra "Modo PRODUCCIÓN" en logs
- [ ] MSI instalado muestra "Modo PRODUCCIÓN" y paths dentro de "C:\Program Files\Chavalos Server\resources\"
- [ ] Servidor inicia correctamente sin errores de "Script no encontrado"
