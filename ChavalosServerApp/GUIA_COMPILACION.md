# 🔨 Guía de Compilación de Ejecutables — Chavalos Server

## Requisitos previos

Antes de compilar necesitas tener instalado:

| Herramienta | Para qué | Verificar |
|-------------|----------|-----------|
| Node.js | Frontend React/Vite | `node -v` |
| Rust | Backend Tauri | `rustc --version` |
| Visual Studio Build Tools | Compilar C++ en Windows | Instalado con Rust |

---

## Comando de compilación

Desde la carpeta `ChavalosServerApp/`:

```powershell
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp
npm run tauri build
```

Esto ejecuta automáticamente:
1. `npm run build` → Compila React/Vite (genera `dist/`)
2. `cargo build --release` → Compila Rust optimizado
3. Empaqueta todo en instaladores MSI y NSIS

---

## ¿Dónde quedan los archivos generados?

```
ChavalosServerApp/
└── src-tauri/
    └── target/
        └── release/
            ├── chavalos-server.exe          ← ejecutable directo (no usar solo)
            └── bundle/
                ├── msi/
                │   └── Chavalos Server_1.1.0_x64_es-ES.msi    ← instalador MSI
                └── nsis/
                    └── Chavalos Server_1.1.0_x64-setup.exe     ← instalador NSIS
```

### ¿Cuál enviar al usuario?

| Formato | Recomendado | Descripción |
|---------|:-----------:|-------------|
| **NSIS** `.exe` | ✅ Sí | Instalador clásico "Siguiente → Siguiente → Instalar" |
| **MSI** `.msi` | ⚠️ Opcional | Instalador corporativo (para empresas con GPO) |

**Envía el `.exe` de la carpeta `nsis/`**. Es el más familiar para usuarios de Windows.

---

## Proceso completo paso a paso

### 1. Verificar que todo compila limpio

```powershell
# Verificar TypeScript (frontend)
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp
npx tsc --noEmit

# Verificar Rust (backend)
cd src-tauri
cargo check
```

Si ambos pasan sin errores, puedes compilar.

### 2. Actualizar la versión (si aplica)

Cambiar versión en los 3 archivos (ver GUIA_VERSIONES.md):
- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

### 3. Compilar

```powershell
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp
npm run tauri build
```

⏱️ **Tiempo estimado**: 3-8 minutos (primera vez más largo por dependencias).

### 4. Verificar el resultado

```powershell
# Ver que se generaron los instaladores
Get-ChildItem src-tauri\target\release\bundle\nsis\
Get-ChildItem src-tauri\target\release\bundle\msi\
```

### 5. Probar antes de enviar

Ejecuta el instalador en tu propia PC para verificar que:
- Se instala correctamente
- La app abre sin errores
- El servidor inicia y todas las features funcionan

### 6. Enviar al usuario

Sube el archivo `.exe` (de `nsis/`) a donde lo compartas con el cliente (USB, Drive, etc.)

---

## Errores comunes y soluciones

### Error: "npm run build failed"
```
Causa: Error de TypeScript en el frontend
Solución: npx tsc --noEmit   (ver qué archivo falla)
```

### Error: "cargo build failed"
```
Causa: Error de Rust en el backend
Solución: cd src-tauri && cargo check   (ver detalles del error)
```

### Error: "failed to bundle project"
```
Causa: Falta algún recurso (icono, binario sidecar, etc.)
Solución: Verificar que existan:
  - src-tauri/icons/icon.ico
  - src-tauri/binaries/node-x86_64-pc-windows-msvc.exe
  - src-tauri/resources/backend/server.js
```

### Error: "node sidecar not found"
```
Causa: El binario de Node.js no está en binaries/
Solución: Copiar node.exe a src-tauri/binaries/ con el nombre correcto:
  node-x86_64-pc-windows-msvc.exe
```

### La compilación es muy lenta
```
La primera vez compila TODAS las dependencias de Rust.
Las siguientes veces solo recompila tu código (mucho más rápido).
Si quieres limpiar y recompilar todo:
  cd src-tauri && cargo clean && cd .. && npm run tauri build
```

---

## Modo desarrollo vs producción

| | Desarrollo | Producción |
|--|-----------|------------|
| Comando | `npm run tauri dev` | `npm run tauri build` |
| Node.js | Usa tu `node` del PATH | Usa el sidecar empaquetado |
| Velocidad | Rápido (sin optimizar) | Lento (optimizado) |
| Resultado | App abierta en vivo | Instalador .exe/.msi |
| Uso | Mientras programas | Para enviar al cliente |

---

## Checklist antes de enviar una actualización

```
□ Código sin errores (tsc + cargo check)
□ Versión actualizada en los 3 archivos
□ Compilación exitosa (npm run tauri build)
□ Probé el instalador en mi PC
□ Commit + tag en Git
□ Subí a GitHub (git push + git push --tags)
□ Envié el .exe al usuario
```

---

## Comando rápido: Todo en uno

```powershell
# Desde ChavalosServerApp/
npx tsc --noEmit; if ($?) { cd src-tauri; cargo check; if ($?) { cd ..; npm run tauri build } }
```

Esto verifica TypeScript → verifica Rust → compila solo si ambos pasan.
