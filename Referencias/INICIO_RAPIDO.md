# 🚀 INICIO RÁPIDO - Ferretería Chavalos

## 🎯 Opción A: Setup Automático (Recomendado)

### Ejecutar script todo-en-uno
```powershell
cd d:\Aquiles\Tienda_Chavalos_Virtual_web
.\setup-postgres.ps1
```

Este script automáticamente:
- ✅ Levanta PostgreSQL con Docker
- ✅ Instala dependencias
- ✅ Genera cliente Prisma
- ✅ Crea migraciones
- ✅ Carga datos de prueba

---

## 📋 Opción B: Setup Manual (Paso a Paso)

### 1. Levantar PostgreSQL con Docker
```powershell
cd Despliegue\Hosting\postgres-local
docker compose up -d
```

### 2. Verificar que PostgreSQL está saludable (espera 10-15 segundos)
```powershell
docker compose ps
```
Debe mostrar `ferreteria_db` con estado **healthy**.

### 3. Navegar al proyecto Next.js
```powershell
cd ..\..\..\Frontend\NextJS_React\web
```

### 4. Instalar dependencias
```powershell
npm install
```

### 5. Generar cliente de Prisma
```powershell
npm run prisma:generate
```

### 6. Crear base de datos con migraciones
```powershell
npx prisma migrate dev --name init_pg
```

### 7. Cargar datos iniciales (usuarios y productos de ejemplo)
```powershell
npm run db:seed
```

### 8. Iniciar servidor de desarrollo
```powershell
npm run dev
```

### 9. Abrir navegador
Ir a: **http://localhost:3000**

### 10. Iniciar sesión
- **Admin:** usuario: `admin` contraseña: `admin123`
- **Cajero:** usuario: `cajero` contraseña: `cajero123`

---

## ✅ ¡Todo listo!

Ahora puedes:
- Gestionar productos (solo ADMIN)
- Realizar ventas desde Caja
- Ver historial de ventas
- Generar boletas en PDF

---

## 🔧 Comandos útiles

```powershell
# Ver base de datos en interfaz gráfica
npm run prisma:studio

# Resetear base de datos (CUIDADO: borra todo)
npx prisma migrate reset

# Ver logs en tiempo real
# (El servidor ya muestra logs automáticamente)
```

---

## 📁 Archivos importantes

- **Docker Compose:** `d:\Aquiles\Tienda_Chavalos_Virtual_web\Despliegue\Hosting\postgres-local\docker-compose.yml`
- **Schema Prisma:** `d:\Aquiles\Tienda_Chavalos_Virtual_web\Base_de_datos\Prisma\schema.prisma`
- **Configuración:** `d:\Aquiles\Tienda_Chavalos_Virtual_web\Frontend\NextJS_React\web\.env`
- **Datos PostgreSQL:** Volumen Docker `ferreteria_pgdata`

---

## ⚠️ Solución de problemas

### Error: "Cannot find module '@prisma/client'"
```powershell
npm run prisma:generate
```

### Error: "Table 'User' does not exist"
```powershell
npm run prisma:migrate
```

### Puerto 3000 ocupado
```powershell
# Cambiar puerto temporalmente
$env:PORT=3001; npm run dev
```

---

**¡Listo para comenzar! 🎉**
