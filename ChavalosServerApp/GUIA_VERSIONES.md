# 🏷️ Guía de Manejo de Versiones — Chavalos Server

## ¿Qué es SemVer?

Usamos **Versionado Semántico** (SemVer): `MAYOR.MENOR.PARCHE`

```
v1.1.0
│ │ │
│ │ └── PARCHE  → corrección de bugs
│ └──── MENOR   → nuevas funcionalidades
└────── MAYOR   → cambios que rompen todo
```

---

## Cuándo subir cada número

| Situación | Acción | Ejemplo |
|-----------|--------|---------|
| Corregí un bug en el QR | Subir PARCHE | `1.1.0` → `1.1.1` |
| Agregué un nuevo botón de reportes | Subir MENOR | `1.1.1` → `1.2.0` |
| Agregué 3 features nuevas | Subir MENOR | `1.2.0` → `1.3.0` |
| Rediseñé toda la app desde cero | Subir MAYOR | `1.3.0` → `2.0.0` |
| Corregí 5 bugs seguidos | Subir PARCHE por cada uno | `1.1.0` → `1.1.1` → `1.1.2` ... |

> **Regla importante**: Cuando subes MENOR, el PARCHE vuelve a 0.  
> Cuando subes MAYOR, MENOR y PARCHE vuelven a 0.

---

## Archivos donde vive la versión

Hay **3 archivos** que siempre deben coincidir:

```
ChavalosServerApp/
├── package.json                    ← "version": "1.1.0"
├── src-tauri/
│   ├── Cargo.toml                  ← version = "1.1.0"
│   └── tauri.conf.json             ← "version": "1.1.0"
```

Y opcionalmente en el código (para mostrarlo en diagnósticos):
```
src-tauri/src/lib.rs                ← app_version: "1.1.0"
```

---

## Ejemplo práctico: Publicar versión 1.2.0

### Paso 1: Cambiar versión en los 3 archivos

**package.json:**
```json
{
  "name": "chavalosserverapp",
  "version": "1.2.0",
  ...
}
```

**src-tauri/Cargo.toml:**
```toml
[package]
name = "chavalos-server"
version = "1.2.0"
```

**src-tauri/tauri.conf.json:**
```json
{
  "productName": "Chavalos Server",
  "version": "1.2.0",
  ...
}
```

**src-tauri/src/lib.rs** (en get_diagnostic_bundle):
```rust
app_version: "1.2.0".to_string(),
```

### Paso 2: Commit y tag en Git

```bash
git add -A
git commit -m "release: v1.2.0 - descripción de cambios"
git tag -a v1.2.0 -m "v1.2.0: Descripción breve"
git push origin main
git push origin v1.2.0
```

### Paso 3: Compilar y distribuir

```bash
cd ChavalosServerApp
npm run tauri build
```

El instalador generado ya tendrá `1.2.0` en su nombre.

---

## Ejemplo de historial de versiones realista

```
v1.0.0  → Primera versión enviada al cliente
v1.1.0  → QR dinámico, diagnóstico, monitor dispositivos, temas
v1.1.1  → Fix: QR no actualizaba al cambiar de Wi-Fi
v1.1.2  → Fix: Docker no se detectaba en algunas PCs
v1.2.0  → Nuevo: Notificaciones push, historial de ventas
v1.2.1  → Fix: Error al exportar logs vacíos
v2.0.0  → Rediseño completo de la interfaz
```

---

## Cómo verificar qué versión tiene el usuario

1. **En el instalador**: el nombre del archivo incluye la versión  
   `Chavalos Server_1.1.0_x64-setup.exe`

2. **En la app**: el panel de Diagnóstico muestra `app_version`

3. **En Git**: ver tags  
   ```bash
   git tag -l          # lista todos los tags
   git log --oneline   # ver commits
   ```

---

## Resumen rápido

```
¿Corregí un bug?          →  1.1.0  →  1.1.1   (solo PARCHE)
¿Agregué algo nuevo?      →  1.1.1  →  1.2.0   (MENOR + reset PARCHE)
¿Rehice todo desde cero?  →  1.2.0  →  2.0.0   (MAYOR + reset todo)
```

Siempre: cambiar los 3 archivos → commit → tag → compilar → enviar.
