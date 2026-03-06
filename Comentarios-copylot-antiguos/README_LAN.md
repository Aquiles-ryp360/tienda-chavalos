# 🚀 INICIO RÁPIDO - EXPOSICIÓN EN RED LOCAL

## ⚡ Opción 1: Script Automático (Recomendado)

### Paso 1: Configurar Firewall (Una sola vez)

```powershell
# Ejecutar PowerShell como Administrador
cd D:\Aquiles\Tienda_Chavalos_Virtual_web
.\Configurar-LAN.ps1
```

### Paso 2: Iniciar Servicios

```powershell
# Ejecutar PowerShell normal (NO requiere Admin)
cd D:\Aquiles\Tienda_Chavalos_Virtual_web
.\Iniciar-LAN.ps1
```

✅ **¡Listo!** El script detectará tu IP y mostrará la URL de acceso.

---

## 🛠️ Opción 2: Manual

### 1. Configurar Firewall (PowerShell como Admin)

```powershell
New-NetFirewallRule -DisplayName "Next.js Ferreteria (Puerto 3000)" `
  -Direction Inbound `
  -LocalPort 3000 `
  -Protocol TCP `
  -Action Allow `
  -Profile Private,Domain
```

### 2. Iniciar PostgreSQL

```powershell
cd Despliegue\Hosting\postgres-local
docker compose up -d
```

### 3. Iniciar Next.js

```powershell
cd Frontend\NextJS_React\web
npm run dev
```

### 4. Obtener tu IP

```powershell
ipconfig
# Busca tu IPv4 (ej: 192.168.1.50)
```

---

## 📱 Acceder desde Móvil

1. **Conectar el móvil a la misma WiFi**
2. **Abrir navegador**
3. **Ir a:** `http://TU_IP:3000`

Ejemplo: `http://192.168.1.50:3000`

---

## 📚 Documentación Completa

- **Guía detallada:** [GUIA_EXPOSICION_LAN.md](./GUIA_EXPOSICION_LAN.md)
- **Troubleshooting:** Ver sección en la guía completa
- **Seguridad:** Configuración en guía completa

---

## ✅ Verificación Rápida

### ¿Firewall configurado?
```powershell
Get-NetFirewallRule -DisplayName "*Ferreteria*"
```

### ¿PostgreSQL corriendo?
```powershell
docker compose ps
```

### ¿Puerto 3000 accesible?
```powershell
Test-NetConnection TU_IP -Port 3000
```

---

## 🎯 Cambios Aplicados

- ✅ `package.json`: Next.js escucha en `0.0.0.0:3000`
- ✅ `auth-session.ts`: Cookies sin `domain` fijo
- ✅ `globals.css`: Estilos móviles optimizados
- ✅ `productos.module.css`: Responsive mejorado
- ✅ `caja.module.css`: Responsive mejorado
- ✅ `layout.tsx`: Viewport configurado
- ✅ Todos los `fetch()` usan rutas relativas

---

## 🆘 Problemas Comunes

### No puedo acceder desde móvil
- Verifica que ambos estén en la misma WiFi
- Revisa el Firewall: `Get-NetFirewallRule -DisplayName "*Ferreteria*"`
- Verifica que Next.js muestre "Network: http://TU_IP:3000"

### Error de base de datos
```powershell
cd Despliegue\Hosting\postgres-local
docker compose restart
```

### Puerto ya en uso
```powershell
# Ver qué proceso usa el puerto 3000
netstat -ano | findstr :3000

# Detener proceso (ID en última columna)
taskkill /PID <ID> /F
```

---

✅ **TU APLICACIÓN YA ESTÁ LISTA PARA LAN**
