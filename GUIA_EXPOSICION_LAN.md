# 🌐 GUÍA DE EXPOSICIÓN EN RED LOCAL (LAN)

> **Objetivo:** Acceder a la aplicación Ferretería Chavalos desde dispositivos móviles y otras PCs en la misma red WiFi/LAN.

---

## 📋 CHECKLIST RÁPIDO

- [ ] Docker Desktop instalado y corriendo
- [ ] PostgreSQL en Docker ejecutándose
- [ ] Firewall de Windows configurado (puertos 3000 y opcional 5432)
- [ ] IP local del servidor identificada
- [ ] Next.js configurado para escuchar en 0.0.0.0
- [ ] Conexión desde móvil verificada

---

## 🚀 PASOS DE CONFIGURACIÓN

### **1. Verificar Base de Datos PostgreSQL**

#### a) Iniciar PostgreSQL en Docker

```powershell
# Navegar al directorio de docker-compose
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\Despliegue\Hosting\postgres-local

# Iniciar el contenedor (primera vez o después de detener)
docker compose up -d

# Verificar que esté corriendo
docker compose ps
```

**Salida esperada:**
```
NAME                       IMAGE                 STATUS
ferreteria_chavalos_db     postgres:16-alpine    Up
```

#### b) Verificar archivo .env (DATABASE_URL)

```powershell
# Desde Frontend/NextJS_React/web/
cat .env
```

**Debe contener:**
```env
DATABASE_URL="postgresql://ferre:ferre123@localhost:5432/ferreteria?schema=public"
SESSION_SECRET="cambiar-por-secret-seguro-en-produccion-min-32-caracteres"
NODE_ENV="development"
NEXT_PUBLIC_APP_NAME="Ferretería Chavalos"
```

✅ **CORRECTO:** `@localhost:5432` (porque Next.js corre en el mismo servidor que Docker)

---

### **2. Configurar Firewall de Windows**

#### a) Permitir puerto 3000 (Next.js)

**Opción 1 - PowerShell (Recomendado):**

```powershell
# Ejecutar PowerShell como Administrador
# Abrir puerto 3000 TCP (Next.js)

New-NetFirewallRule -DisplayName "Next.js Ferreteria (Puerto 3000)" `
  -Direction Inbound `
  -LocalPort 3000 `
  -Protocol TCP `
  -Action Allow `
  -Profile Private,Domain `
  -Description "Permite acceso a Next.js desde red local"
```

**Opción 2 - netsh:**

```powershell
netsh advfirewall firewall add rule name="Next.js Ferreteria" dir=in action=allow protocol=TCP localport=3000 profile=private,domain
```

#### b) (OPCIONAL) Permitir puerto 5432 (PostgreSQL)

⚠️ **SOLO si necesitas acceso directo a la DB desde otra PC (NO recomendado en producción)**

```powershell
New-NetFirewallRule -DisplayName "PostgreSQL Ferreteria (Puerto 5432)" `
  -Direction Inbound `
  -LocalPort 5432 `
  -Protocol TCP `
  -Action Allow `
  -Profile Private,Domain `
  -Description "Permite acceso a PostgreSQL desde red local (desarrollo)"
```

#### c) Verificar reglas creadas

```powershell
Get-NetFirewallRule -DisplayName "*Ferreteria*" | Select-Object DisplayName, Enabled, Direction
```

**Salida esperada:**
```
DisplayName                          Enabled Direction
-----------                          ------- ---------
Next.js Ferreteria (Puerto 3000)     True    Inbound
```

---

### **3. Identificar IP Local del Servidor**

```powershell
# Ver configuración de red
ipconfig

# Buscar la IP de tu adaptador WiFi/Ethernet
# Ejemplo de salida:
```

```
Adaptador de LAN inalámbrica Wi-Fi:
   Dirección IPv4. . . . . . . . . . . . : 192.168.1.50
   Máscara de subred . . . . . . . . . . : 255.255.255.0
   Puerta de enlace predeterminada . . . : 192.168.1.1
```

📝 **Anota tu IP:** `192.168.1.50` (ejemplo)

---

### **4. Iniciar Next.js en Modo LAN**

#### a) Instalar dependencias (primera vez)

```powershell
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\Frontend\NextJS_React\web

npm install
```

#### b) Ejecutar Prisma Generate (primera vez o después de cambios en schema)

```powershell
npm run prisma:generate
```

#### c) Iniciar servidor de desarrollo

```powershell
npm run dev
```

**Salida esperada:**
```
▲ Next.js 15.1.0
- Local:        http://localhost:3000
- Network:      http://192.168.1.50:3000

✓ Ready in 2.3s
```

✅ **Verificar que aparezca "Network:"** con tu IP local

---

## 📱 PRUEBAS DE ACCESO

### **5. Probar desde el Servidor (PC Principal)**

```
http://localhost:3000
```

o

```
http://192.168.1.50:3000
```

### **6. Probar desde Móvil/Tablet**

1. **Conectar el dispositivo móvil a la misma red WiFi**
2. **Abrir navegador** (Chrome, Safari, etc.)
3. **Escribir en la barra de direcciones:**

```
http://192.168.1.50:3000
```

*(Reemplazar `192.168.1.50` por TU IP real)*

### **7. Probar desde Otra PC en la Red**

**Opción A - Navegador:**
```
http://192.168.1.50:3000
```

**Opción B - Verificar conectividad (PowerShell):**
```powershell
Test-NetConnection 192.168.1.50 -Port 3000
```

**Salida esperada:**
```
TcpTestSucceeded : True
```

---

## ✅ LISTA DE VERIFICACIÓN DE FUNCIONALIDAD

### **Login desde Móvil**
- [ ] Abrir `http://IP_DEL_SERVIDOR:3000/login`
- [ ] Usuario: `admin` / Contraseña: (la que configuraste)
- [ ] Verificar que inicie sesión correctamente
- [ ] La cookie `ferre_session` debe guardarse

### **Productos desde Móvil**
- [ ] Navegar a `/productos`
- [ ] Ver lista de productos
- [ ] Crear nuevo producto:
  - SKU autogenerado funciona
  - Formulario es legible (texto mínimo 16px)
  - Botones son clickeables (min 44px)
- [ ] Editar producto existente
- [ ] Buscar productos

### **Ventas (Caja) desde Móvil**
- [ ] Navegar a `/caja`
- [ ] Buscar y agregar producto al carrito
- [ ] Cambiar cantidad
- [ ] Ajustar precio (si aplica)
- [ ] Completar venta
- [ ] Ver recibo generado (PDF)

### **Ver Ventas**
- [ ] Navegar a `/ventas`
- [ ] Ver lista de ventas
- [ ] Ver detalle de venta
- [ ] Editar recibo

---

## 🔧 TROUBLESHOOTING

### ❌ Problema: "No se puede acceder desde móvil"

**Solución:**

1. **Verificar que Next.js está escuchando en 0.0.0.0:**
```powershell
# En package.json debe estar:
"dev": "next dev -H 0.0.0.0 -p 3000"
```

2. **Verificar Firewall:**
```powershell
Get-NetFirewallRule -DisplayName "*Ferreteria*"
# Debe mostrar la regla como Enabled: True
```

3. **Verificar que ambos dispositivos están en la MISMA red:**
```powershell
# En el servidor
ipconfig
# Verifica la IP (ej: 192.168.1.50)

# En el móvil, ir a Configuración > WiFi > Ver detalles
# Debe tener IP en el mismo rango (ej: 192.168.1.x)
```

4. **Temporalmente desactivar Firewall para probar:**
```powershell
# SOLO PARA DEBUG - Desactivar temporalmente
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled False

# DESPUÉS DE PROBAR - Reactivar INMEDIATAMENTE
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled True
```

---

### ❌ Problema: "Error al conectar a la base de datos"

**Solución:**

```powershell
# 1. Verificar que Docker Desktop está corriendo
# 2. Verificar contenedor PostgreSQL
docker compose ps

# 3. Ver logs del contenedor
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\Despliegue\Hosting\postgres-local
docker compose logs

# 4. Reiniciar contenedor
docker compose restart

# 5. Si persiste, recrear desde cero
docker compose down
docker compose up -d
```

---

### ❌ Problema: "Las cookies no funcionan desde IP"

**Causa:** Configuración incorrecta de cookies en `auth-session.ts`

**Verificar:**

```typescript
// lib/auth-session.ts
cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // ✅ Debe ser false en dev
  sameSite: 'lax', // ✅ Correcto para LAN
  maxAge: 60 * 60 * 8,
  path: '/',
  // ✅ NO DEBE tener domain fijo
})
```

---

### ❌ Problema: "Formularios difíciles de usar en móvil"

**Solución:** Los estilos ya están optimizados en `globals.css` y módulos CSS:

- Inputs mínimo 48px de altura
- Font-size 16px (evita zoom en iOS)
- Botones con área de toque mínima 44px
- Modal fullscreen en móviles
- Grid responsive en caja

Si ves problemas, limpia la caché del navegador móvil.

---

## 🛡️ SEGURIDAD EN RED LOCAL

### **Recomendaciones:**

1. ✅ **Usar perfil de red "Privada"** en Windows
2. ✅ **Firewall SOLO permite perfiles Private/Domain** (no Public)
3. ✅ **DATABASE_URL apunta a localhost** (no exponer Postgres a la red)
4. ❌ **NO exponer puerto 5432** a la red si no es necesario
5. ✅ **SESSION_SECRET único y seguro** (min 32 caracteres)
6. ✅ **Cookies con httpOnly: true** (protege contra XSS)

### **Desactivar regla de Firewall (cuando ya no necesites acceso LAN):**

```powershell
# Deshabilitar temporalmente
Disable-NetFirewallRule -DisplayName "Next.js Ferreteria (Puerto 3000)"

# Eliminar regla completamente
Remove-NetFirewallRule -DisplayName "Next.js Ferreteria (Puerto 3000)"
```

---

## 📊 COMANDOS ÚTILES DE MONITOREO

### Ver conexiones activas en el puerto 3000

```powershell
netstat -ano | findstr :3000
```

### Ver logs de Next.js en tiempo real

```powershell
# (Automático cuando ejecutas npm run dev)
# Ctrl+C para detener
```

### Ver logs de PostgreSQL

```powershell
cd D:\Aquiles\Tienda_Chavalos_Virtual_web\Despliegue\Hosting\postgres-local
docker compose logs -f ferreteria_db
```

---

## 🎯 RESUMEN EJECUTIVO

| Componente | Puerto | Acceso LAN | Firewall Requerido |
|------------|--------|------------|-------------------|
| Next.js | 3000 | ✅ SÍ | ✅ SÍ |
| PostgreSQL | 5432 | ❌ NO (solo localhost) | ❌ NO |

**IP del Servidor:** `192.168.1.50` (ejemplo - usar tu IP real)

**URLs de acceso:**
- Servidor: `http://localhost:3000`
- Red local: `http://192.168.1.50:3000`
- Login: `http://192.168.1.50:3000/login`
- Caja: `http://192.168.1.50:3000/caja`
- Productos: `http://192.168.1.50:3000/productos`

---

## 📝 NOTAS FINALES

- **Esta configuración es SOLO para desarrollo/uso interno en red local**
- **NO exponer a internet sin configurar HTTPS y seguridad adicional**
- **Para producción, usar Vercel/Railway con PostgreSQL managed**
- **Los cambios ya están aplicados en el código (package.json, auth-session.ts, CSS)**

---

## 🆘 SOPORTE ADICIONAL

Si encuentras problemas no cubiertos en esta guía:

1. Revisar logs de Next.js (terminal donde ejecutaste `npm run dev`)
2. Revisar logs de Docker (`docker compose logs`)
3. Verificar consola del navegador (F12) en móvil/PC cliente
4. Verificar que `NODE_ENV=development` en `.env`

---

✅ **GUÍA COMPLETADA - Tu aplicación ya está lista para acceso LAN**
