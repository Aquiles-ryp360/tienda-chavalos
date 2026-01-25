# 📑 ÍNDICE DE DOCUMENTACIÓN - EXPOSICIÓN LAN

## 🎯 DOCUMENTOS POR NIVEL DE EXPERIENCIA

### **🚀 Inicio Rápido (Principiante)**
1. **[README_LAN.md](./README_LAN.md)** ⭐ EMPEZAR AQUÍ
   - Opción automática con scripts
   - Opción manual paso a paso
   - Verificación rápida
   - Problemas comunes

2. **[QUICKSTART_VISUAL.md](./QUICKSTART_VISUAL.md)** 📱
   - Diagramas visuales
   - Pasos con emojis
   - Ejemplos de pantallas
   - Checklist visual

### **📚 Guía Completa (Intermedio)**
3. **[GUIA_EXPOSICION_LAN.md](./GUIA_EXPOSICION_LAN.md)** 📖
   - Guía paso a paso detallada
   - Configuración de Firewall
   - Troubleshooting extenso
   - Comandos de PowerShell
   - Recomendaciones de seguridad
   - Lista de verificación funcional

### **🔧 Detalles Técnicos (Avanzado)**
4. **[CHANGELOG_EXPOSICION_LAN.md](./CHANGELOG_EXPOSICION_LAN.md)** 📝
   - Todos los cambios aplicados al código
   - Archivos modificados con diffs
   - Archivos nuevos creados
   - Verificaciones de infraestructura
   - Métricas de compatibilidad

---

## 🛠️ SCRIPTS AUTOMATIZADOS

### **Scripts de PowerShell**

1. **[Configurar-LAN.ps1](./Configurar-LAN.ps1)** ⚙️
   - **Propósito:** Configuración inicial (una sola vez)
   - **Requiere:** PowerShell como Administrador
   - **Hace:**
     - Detecta IP local
     - Verifica Docker Desktop
     - Configura Firewall (puerto 3000)
     - Opción para puerto 5432 (PostgreSQL)
     - Muestra resumen de configuración

2. **[Iniciar-LAN.ps1](./Iniciar-LAN.ps1)** 🚀
   - **Propósito:** Inicio rápido de servicios
   - **Requiere:** PowerShell normal (NO Admin)
   - **Hace:**
     - Verifica Docker Desktop
     - Inicia PostgreSQL en Docker
     - Detecta IP local
     - Inicia Next.js en modo LAN
     - Muestra URLs de acceso

---

## 📂 ESTRUCTURA DE ARCHIVOS

```
D:\Aquiles\Tienda_Chavalos_Virtual_web\
│
├── 📄 README_LAN.md                    ⭐ EMPEZAR AQUÍ
├── 📄 QUICKSTART_VISUAL.md             📱 Guía visual
├── 📄 GUIA_EXPOSICION_LAN.md           📖 Guía completa
├── 📄 CHANGELOG_EXPOSICION_LAN.md      📝 Cambios técnicos
├── 📄 INDICE_DOCUMENTACION_LAN.md      📑 Este archivo
│
├── 🔧 Configurar-LAN.ps1               ⚙️ Setup inicial (Admin)
├── 🚀 Iniciar-LAN.ps1                  🚀 Inicio rápido (Normal)
│
├── Frontend/
│   └── NextJS_React/
│       └── web/
│           ├── package.json            ✅ Modificado (dev: 0.0.0.0)
│           ├── app/
│           │   └── layout.tsx          ✅ Modificado (viewport)
│           ├── lib/
│           │   └── auth-session.ts     ✅ Modificado (cookies)
│           └── styles/
│               └── globals.css         ✅ Modificado (móvil)
│
└── Despliegue/
    └── Hosting/
        └── postgres-local/
            └── docker-compose.yml      ✅ Verificado (puerto 5432)
```

---

## 🎯 FLUJO DE TRABAJO RECOMENDADO

### **Primera Vez (Setup Inicial)**

```
1. Leer: README_LAN.md (5 min)
   ↓
2. Ejecutar: Configurar-LAN.ps1 como Admin (2 min)
   ↓
3. Revisar: QUICKSTART_VISUAL.md para ver qué esperar
   ↓
4. Ejecutar: Iniciar-LAN.ps1 (1 min)
   ↓
5. Probar desde móvil
   ↓
6. Si hay problemas: Consultar GUIA_EXPOSICION_LAN.md → Troubleshooting
```

### **Uso Diario**

```
1. Ejecutar: Iniciar-LAN.ps1
   ↓
2. Conectar móvil a WiFi
   ↓
3. Abrir: http://IP:3000
   ↓
4. Trabajar normalmente
   ↓
5. Ctrl+C para detener Next.js
```

---

## 📋 DOCUMENTOS POR PROPÓSITO

### **¿Quieres empezar rápido?**
→ [README_LAN.md](./README_LAN.md)

### **¿Prefieres ver diagramas?**
→ [QUICKSTART_VISUAL.md](./QUICKSTART_VISUAL.md)

### **¿Necesitas troubleshooting?**
→ [GUIA_EXPOSICION_LAN.md](./GUIA_EXPOSICION_LAN.md) (Sección Troubleshooting)

### **¿Quieres saber qué cambió en el código?**
→ [CHANGELOG_EXPOSICION_LAN.md](./CHANGELOG_EXPOSICION_LAN.md)

### **¿Necesitas automatizar todo?**
→ [Configurar-LAN.ps1](./Configurar-LAN.ps1) + [Iniciar-LAN.ps1](./Iniciar-LAN.ps1)

### **¿Problemas de seguridad?**
→ [GUIA_EXPOSICION_LAN.md](./GUIA_EXPOSICION_LAN.md) (Sección Seguridad)

---

## 🔍 REFERENCIA RÁPIDA DE COMANDOS

### **Firewall**
```powershell
# Crear regla
New-NetFirewallRule -DisplayName "Next.js Ferreteria (Puerto 3000)" `
  -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow `
  -Profile Private,Domain

# Verificar reglas
Get-NetFirewallRule -DisplayName "*Ferreteria*"

# Deshabilitar regla
Disable-NetFirewallRule -DisplayName "Next.js Ferreteria (Puerto 3000)"

# Eliminar regla
Remove-NetFirewallRule -DisplayName "Next.js Ferreteria (Puerto 3000)"
```

### **Docker (PostgreSQL)**
```powershell
cd Despliegue\Hosting\postgres-local

# Iniciar
docker compose up -d

# Verificar
docker compose ps

# Logs
docker compose logs -f

# Reiniciar
docker compose restart

# Detener
docker compose stop

# Detener y borrar datos
docker compose down -v
```

### **Next.js**
```powershell
cd Frontend\NextJS_React\web

# Instalar (primera vez)
npm install

# Generar Prisma
npm run prisma:generate

# Migrar DB
npm run db:migrate

# Seed DB
npm run db:seed

# Iniciar (modo LAN)
npm run dev

# Build
npm run build

# Producción
npm run start
```

### **Red**
```powershell
# Ver IP local
ipconfig

# Probar conectividad
Test-NetConnection 192.168.1.50 -Port 3000

# Ver procesos en puerto 3000
netstat -ano | findstr :3000

# Matar proceso
taskkill /PID <ID> /F
```

---

## 📊 TABLA DE COMPATIBILIDAD

| Característica | Windows 10 | Windows 11 | Móvil Android | Móvil iOS | Tablet |
|---------------|------------|------------|---------------|-----------|--------|
| PowerShell Scripts | ✅ | ✅ | - | - | - |
| Docker Desktop | ✅ | ✅ | - | - | - |
| Next.js Server | ✅ | ✅ | - | - | - |
| Acceso Browser | ✅ | ✅ | ✅ | ✅ | ✅ |
| Touch UI | - | - | ✅ | ✅ | ✅ |
| PDF Generation | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cookies Auth | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## ⚠️ NOTAS IMPORTANTES

### **Seguridad**
- ⚠️ Esta configuración es SOLO para red local/desarrollo
- ⚠️ NO exponer a internet sin HTTPS y medidas adicionales
- ⚠️ Usar red "Privada" en Windows, no "Pública"
- ⚠️ Firewall solo permite perfiles Private/Domain

### **Requisitos**
- ✅ Docker Desktop instalado y corriendo
- ✅ Node.js 18+ instalado
- ✅ PowerShell 5.1+ (incluido en Windows)
- ✅ Red WiFi/LAN disponible
- ✅ Privilegios de Administrador (solo para setup inicial)

### **Limitaciones**
- ⚠️ PostgreSQL NO expuesto a red (solo localhost)
- ⚠️ Cookies requieren `secure: false` en desarrollo
- ⚠️ Sin HTTPS en desarrollo (solo HTTP)
- ⚠️ Sin autenticación adicional en red local

---

## 🆘 SOPORTE Y AYUDA

### **Orden de consulta recomendado:**

1. **Problema general o no sabes por dónde empezar**
   → [README_LAN.md](./README_LAN.md) → Problemas Comunes

2. **Error específico durante configuración**
   → [GUIA_EXPOSICION_LAN.md](./GUIA_EXPOSICION_LAN.md) → Troubleshooting

3. **No entiendes qué hace el script**
   → [QUICKSTART_VISUAL.md](./QUICKSTART_VISUAL.md) → Diagramas

4. **Quieres saber qué cambió en el código**
   → [CHANGELOG_EXPOSICION_LAN.md](./CHANGELOG_EXPOSICION_LAN.md)

5. **Error de compilación o TypeScript**
   → Revisar logs de Next.js + Consola del navegador

---

## 📞 CONTACTO Y FEEDBACK

Si encuentras:
- ❌ Errores en la documentación
- 💡 Mejoras posibles
- 🐛 Bugs no documentados
- ❓ Casos de uso no cubiertos

Por favor documenta:
1. Sistema operativo y versión
2. Versión de Docker/Node.js
3. Error exacto (captura de pantalla)
4. Pasos para reproducir
5. Lo que esperabas vs lo que obtuviste

---

## 🎓 RECURSOS ADICIONALES

### **Tecnologías Usadas**
- Next.js 15: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- PostgreSQL: https://www.postgresql.org/docs
- Docker: https://docs.docker.com

### **PowerShell**
- Comandos básicos: https://learn.microsoft.com/powershell
- Firewall: https://learn.microsoft.com/windows/security/threat-protection/windows-firewall

### **Networking**
- TCP/IP básico
- Puertos y protocolos
- Firewall de Windows

---

## ✅ CHECKLIST DE VERIFICACIÓN

### **Después de la configuración inicial:**
- [ ] `Configurar-LAN.ps1` ejecutado exitosamente
- [ ] Firewall muestra regla "Next.js Ferreteria"
- [ ] IP local detectada correctamente
- [ ] Docker Desktop está corriendo
- [ ] PostgreSQL inicia sin errores
- [ ] Next.js muestra "Network: http://IP:3000"

### **Prueba funcional:**
- [ ] Login desde localhost funciona
- [ ] Login desde IP funciona
- [ ] Login desde móvil funciona
- [ ] Crear producto funciona
- [ ] Realizar venta funciona
- [ ] Ver ventas funciona
- [ ] PDF se genera correctamente

---

## 🎉 CONCLUSIÓN

Esta documentación cubre:

1. ✅ Configuración inicial completa
2. ✅ Scripts automatizados
3. ✅ Troubleshooting extenso
4. ✅ Guías visuales
5. ✅ Referencia técnica
6. ✅ Comandos útiles
7. ✅ Seguridad básica

**Tu aplicación está lista para acceso en red local.**

---

**Última actualización:** 15 de enero de 2026  
**Versión:** 1.0.0 - Exposición LAN  
**Mantenido por:** DevOps Team
