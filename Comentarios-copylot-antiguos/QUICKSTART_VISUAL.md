# 📱 ACCESO MÓVIL - GUÍA VISUAL RÁPIDA

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│         🏠 PC SERVIDOR (Windows)                    │
│                                                     │
│  ┌──────────────────────────────────────┐          │
│  │ 🐳 Docker Desktop                    │          │
│  │    └─ PostgreSQL (puerto 5432)       │          │
│  └──────────────────────────────────────┘          │
│                                                     │
│  ┌──────────────────────────────────────┐          │
│  │ ⚡ Next.js                            │          │
│  │    └─ Puerto 3000 (0.0.0.0)          │          │
│  └──────────────────────────────────────┘          │
│                                                     │
│  📍 IP: 192.168.1.50                                │
│                                                     │
└─────────────────────────────────────────────────────┘
                        │
                        │  WiFi
                        │  (misma red)
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ┌────────┐     ┌────────┐     ┌────────┐
   │ 📱 Móvil│     │ 📱 Móvil│     │ 💻 Laptop│
   │ Android│     │  iOS   │     │ Windows │
   └────────┘     └────────┘     └────────┘
        │               │               │
        └───────────────┴───────────────┘
                        │
           http://192.168.1.50:3000
```

---

## 🚀 PASOS EN ORDEN

### **EN EL SERVIDOR (PC PRINCIPAL)**

```
1️⃣  Abrir PowerShell como ADMINISTRADOR
    │
    ├─ Click derecho en Inicio > PowerShell (Admin)
    │
    └─ cd D:\Aquiles\Tienda_Chavalos_Virtual_web

2️⃣  Configurar Firewall (una sola vez)
    │
    └─ .\Configurar-LAN.ps1
       │
       ├─ ✅ Detecta IP: 192.168.1.50
       ├─ ✅ Verifica Docker
       └─ ✅ Abre puerto 3000

3️⃣  Iniciar servicios
    │
    ├─ Cerrar PowerShell Admin
    ├─ Abrir PowerShell NORMAL
    │
    └─ .\Iniciar-LAN.ps1
       │
       ├─ 🚀 Inicia PostgreSQL
       ├─ 🚀 Inicia Next.js
       └─ 🌐 Muestra: http://192.168.1.50:3000
```

---

### **EN EL MÓVIL/TABLET**

```
1️⃣  Conectar a WiFi
    │
    └─ Misma red que el servidor
       (ej: "Mi_Casa_WiFi")

2️⃣  Abrir navegador
    │
    ├─ Chrome
    ├─ Safari
    └─ Firefox

3️⃣  Escribir URL
    │
    └─ http://192.168.1.50:3000
       │
       └─ (Usar la IP que te mostró el script)

4️⃣  Login
    │
    ├─ Usuario: admin
    └─ Contraseña: tu contraseña

5️⃣  ¡A trabajar! 🎉
    │
    ├─ 📦 Productos
    ├─ 💰 Caja (Ventas)
    └─ 📊 Ver Ventas
```

---

## 🖥️ PANTALLA DEL SERVIDOR

```powershell
PS D:\Aquiles\Tienda_Chavalos_Virtual_web> .\Iniciar-LAN.ps1

========================================
  INICIO RÁPIDO - FERRETERÍA CHAVALOS
========================================

[1/3] Verificando Docker...
  ✅ Docker Desktop está corriendo

[2/3] Iniciando PostgreSQL en Docker...
  ✅ PostgreSQL iniciado correctamente

[3/3] Detectando IP local...
  📍 IP detectada: 192.168.1.50

========================================
  SERVICIOS INICIADOS
========================================

  ✅ PostgreSQL: localhost:5432
  🌐 Next.js: http://192.168.1.50:3000

========================================

🚀 Iniciando Next.js en modo LAN...

📱 ACCESO DESDE MÓVIL:
   1. Conecta tu móvil a la misma WiFi
   2. Abre el navegador
   3. Ve a: http://192.168.1.50:3000

💻 ACCESO LOCAL:
   http://localhost:3000

========================================

⚡ Iniciando servidor de desarrollo...
(Presiona Ctrl+C para detener)

▲ Next.js 15.1.0
- Local:        http://localhost:3000
- Network:      http://192.168.1.50:3000  ← 🎯 Esta URL

✓ Ready in 2.3s
```

---

## 📱 PANTALLA DEL MÓVIL

### **1. Login**
```
┌────────────────────────────┐
│   Ferretería Chavalos      │
│                            │
│   ┌──────────────────────┐ │
│   │ Usuario              │ │
│   └──────────────────────┘ │
│                            │
│   ┌──────────────────────┐ │
│   │ Contraseña           │ │
│   └──────────────────────┘ │
│                            │
│   ┌──────────────────────┐ │
│   │   Iniciar Sesión     │ │
│   └──────────────────────┘ │
└────────────────────────────┘
```

### **2. Dashboard**
```
┌────────────────────────────┐
│ 👤 admin      [Cerrar]     │
├────────────────────────────┤
│                            │
│  ┌──────────────────────┐  │
│  │   📦 Productos       │  │
│  └──────────────────────┘  │
│                            │
│  ┌──────────────────────┐  │
│  │   💰 Caja (Ventas)   │  │
│  └──────────────────────┘  │
│                            │
│  ┌──────────────────────┐  │
│  │   📊 Ver Ventas      │  │
│  └──────────────────────┘  │
│                            │
└────────────────────────────┘
```

### **3. Productos (optimizado móvil)**
```
┌────────────────────────────┐
│ [← Volver]  [+ Producto]   │
├────────────────────────────┤
│ 🔍 Buscar productos...     │
├────────────────────────────┤
│                            │
│ TALADRO-001  [✏️] [🗑️]     │
│ Taladro percutor          │
│ S/ 150.00 | Stock: 5      │
│ ──────────────────────     │
│                            │
│ MARTILLO-002 [✏️] [🗑️]     │
│ Martillo garra            │
│ S/ 25.00 | Stock: 12      │
│ ──────────────────────     │
│                            │
│ (scroll para más...)       │
│                            │
└────────────────────────────┘
```

### **4. Caja (optimizado móvil)**
```
┌────────────────────────────┐
│ Productos disponibles      │
├────────────────────────────┤
│                            │
│ [Taladro]  [Martillo]      │
│ S/ 150.00  S/ 25.00        │
│                            │
├────────────────────────────┤
│ Carrito de compra          │
├────────────────────────────┤
│ Taladro x1       S/ 150.00 │
│ [−] 1 [+]        [Eliminar]│
│ ──────────────────────     │
│                            │
│ Martillo x2       S/ 50.00 │
│ [−] 2 [+]        [Eliminar]│
│ ──────────────────────     │
│                            │
│ TOTAL:           S/ 200.00 │
│                            │
│ [  Completar Venta  ]      │
│                            │
└────────────────────────────┘
```

---

## ✅ CHECKLIST VISUAL

### **Antes de empezar**
- [ ] 🐳 Docker Desktop instalado
- [ ] 📦 Node.js instalado
- [ ] 📁 Proyecto descargado
- [ ] 📶 WiFi disponible

### **Configuración (una vez)**
- [ ] ⚙️ Ejecutar `Configurar-LAN.ps1` como Admin
- [ ] 🔥 Firewall configurado (puerto 3000)
- [ ] 📍 IP detectada correctamente

### **Cada vez que uses**
- [ ] 🚀 Ejecutar `Iniciar-LAN.ps1`
- [ ] 📱 Conectar móvil a misma WiFi
- [ ] 🌐 Abrir `http://IP:3000` en móvil
- [ ] 👤 Login exitoso
- [ ] ✨ Sistema funcionando

---

## 🎯 URLS IMPORTANTES

### **Desarrollo Local**
```
http://localhost:3000           → Dashboard
http://localhost:3000/login     → Login
http://localhost:3000/productos → Productos
http://localhost:3000/caja      → Caja
http://localhost:3000/ventas    → Ver Ventas
```

### **Desde Móvil** (cambiar IP)
```
http://192.168.1.50:3000           → Dashboard
http://192.168.1.50:3000/login     → Login
http://192.168.1.50:3000/productos → Productos
http://192.168.1.50:3000/caja      → Caja
http://192.168.1.50:3000/ventas    → Ver Ventas
```

---

## 🚨 INDICADORES DE PROBLEMAS

### **❌ No puedo acceder desde móvil**

```
Posibles causas:
├─ ❌ Móvil en WiFi diferente
├─ ❌ Firewall no configurado
├─ ❌ Next.js no está corriendo
├─ ❌ IP incorrecta
└─ ❌ Antivirus bloqueando

Solución:
├─ ✅ Verifica WiFi (misma red)
├─ ✅ Ejecuta: Get-NetFirewallRule -DisplayName "*Ferreteria*"
├─ ✅ Verifica que Next.js muestre "Network: http://IP:3000"
└─ ✅ Ejecuta: ipconfig (confirmar IP)
```

### **❌ Error de base de datos**

```
Posibles causas:
├─ ❌ Docker Desktop no corriendo
├─ ❌ PostgreSQL no iniciado
└─ ❌ DATABASE_URL incorrecta

Solución:
├─ ✅ Abre Docker Desktop
├─ ✅ cd Despliegue\Hosting\postgres-local
├─ ✅ docker compose up -d
└─ ✅ docker compose logs
```

### **❌ Página en blanco o error 500**

```
Posibles causas:
├─ ❌ Cookies bloqueadas
├─ ❌ JavaScript deshabilitado
└─ ❌ Error en el servidor

Solución:
├─ ✅ Revisa consola del navegador (F12)
├─ ✅ Revisa logs de Next.js (terminal)
├─ ✅ Limpia caché del navegador
└─ ✅ Intenta modo incógnito
```

---

## 🎉 INDICADORES DE ÉXITO

### **✅ Todo funciona correctamente cuando ves:**

```
Servidor (PowerShell):
  ✅ PostgreSQL: localhost:5432
  ✅ Next.js: http://192.168.1.50:3000
  ✓ Ready in 2.3s

Móvil (navegador):
  ✅ Login exitoso
  ✅ Dashboard visible
  ✅ Productos se cargan
  ✅ Puedes crear/editar
  ✅ Ventas funcionan
  ✅ PDF se genera

Firewall:
  ✅ Get-NetFirewallRule muestra "Next.js Ferreteria"
  ✅ Enabled: True

Red:
  ✅ Test-NetConnection IP -Port 3000 → TcpTestSucceeded: True
```

---

## 📞 COMANDOS DE EMERGENCIA

```powershell
# Reiniciar todo
cd D:\Aquiles\Tienda_Chavalos_Virtual_web

# 1. Detener Next.js (Ctrl+C en su terminal)

# 2. Reiniciar PostgreSQL
cd Despliegue\Hosting\postgres-local
docker compose restart

# 3. Reiniciar Next.js
cd ..\..\Frontend\NextJS_React\web
npm run dev

# 4. Si nada funciona, desactivar Firewall temporalmente (solo para probar)
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled False
# ⚠️ REACTIVAR INMEDIATAMENTE después de probar:
Set-NetFirewallProfile -Profile Domain,Private,Public -Enabled True
```

---

✅ **¡LISTO! Tu sistema está configurado para acceso LAN**

📚 Ver documentación completa en: [GUIA_EXPOSICION_LAN.md](./GUIA_EXPOSICION_LAN.md)
