# 🚀 Guía Rápida - Chavalos Server App

## Para Usuarios (Tu Mamá)

### Instalación (Una sola vez)

1. **Doble clic** en `Chavalos Server_1.0.0_x64_es-MX.msi`
2. Presiona **Next → Next → Install**
3. Busca "Chavalos Server" en el menú inicio

### Uso Diario

1. **Abre la aplicación** (icono en escritorio o menú inicio)
2. **Primera vez**: Ve a ⚙️ Configuración
   - Haz clic en **Buscar**
   - Selecciona: `D:\Aquiles\Tienda_Chavalos_Virtual_web`
   - Presiona **Guardar**
3. **Presiona el botón verde "Iniciar"** 🚀
4. Espera 30-60 segundos (verás mensajes en el panel de logs)
5. **Cuando diga "✅ Servidor iniciado"**:
   - Presiona **"Abrir en navegador"**
   - O escanea el código QR desde tu celular

### Detener el Servidor

- Presiona el botón rojo **"Detener"**

### Cerrar la Aplicación

- ❌ Al cerrar la ventana, el servidor sigue corriendo en la bandeja
- ✅ Para cerrar completamente: Clic derecho en el ícono de la bandeja → **Salir**

---

## Para Desarrolladores

### Quick Start

```powershell
# Clonar/navegar al proyecto
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp

# Instalar dependencias (primera vez)
npm install

# Modo desarrollo (hot reload)
npm run tauri:dev
```

### Compilar Instalador MSI

```powershell
# Instalar Rust (primera vez)
winget install Rustlang.Rustup

# Build completo (15-20 min primera vez)
.\build.ps1

# Output: src-tauri/target/release/bundle/msi/*.msi
```

### Comandos Útiles

```powershell
# Solo frontend
npm run dev

# Solo build frontend
npm run build

# Limpiar cache
Remove-Item -Recurse .\src-tauri\target
Remove-Item -Recurse .\node_modules
npm install
```

### Modificar Configuración

**Cambiar puerto/modo predeterminado:**

Edita [src-tauri/src/main.rs](src-tauri/src/main.rs):
```rust
AppSettings {
    project_path: default_path,
    port: 3000,          // ← Cambia aquí
    mode: "dev".to_string(),  // ← O aquí
    // ...
}
```

**Personalizar UI:**

Edita [src/App.tsx](src/App.tsx) - Estilos inline en cada componente.

### Testing del Script PowerShell

```powershell
# Ejecutar directamente sin la app
.\server-launcher.ps1 `
    -ProjectPath "D:\Aquiles\Tienda_Chavalos_Virtual_web" `
    -Mode dev `
    -Port 3000
```

---

## Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| "Docker no disponible" | Abre Docker Desktop y espera que esté verde |
| "Script no encontrado" | Verifica la ruta del proyecto en Configuración |
| "Firewall no configurado" | Ejecuta como Administrador (clic derecho → Ejecutar como admin) |
| "Build falla" | Instala Visual Studio Build Tools: `winget install Microsoft.VisualStudio.2022.BuildTools` |

---

## Estructura de Archivos

```
ChavalosServerApp/
├── 📄 README.md                 ← Documentación completa
├── 📄 QUICKSTART.md             ← Esta guía
├── 📄 build.ps1                 ← Compilar instalador
├── 📄 dev.ps1                   ← Modo desarrollo
├── 📄 server-launcher.ps1       ← Script PowerShell (el "engine")
├── 📄 package.json              ← Dependencias Node
├── 📂 src/                      ← Frontend React
│   ├── App.tsx                  ← UI principal
│   └── main.tsx
├── 📂 src-tauri/                ← Backend Rust
│   ├── src/main.rs              ← Comandos Tauri
│   ├── Cargo.toml               ← Dependencias Rust
│   └── tauri.conf.json          ← Config de la app
└── 📂 .vscode/                  ← Configuración VS Code
```

---

## Recursos

- **Tauri Docs**: https://tauri.app/
- **Rust**: https://rustup.rs/
- **Reportar bugs**: Contacta a Aquiles

---

**Tip**: Agrega el proyecto a favoritos de Windows Explorer para acceso rápido:
```
D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp
```
