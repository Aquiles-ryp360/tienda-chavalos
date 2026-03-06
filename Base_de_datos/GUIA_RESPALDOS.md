# Guía de Respaldos — Base de Datos Ferretería Chavalos

> Todos los respaldos y scripts se encuentran en:  
> `Base_de_datos/Respaldos/`

---

## Estructura de la carpeta

```
Base_de_datos/
├── Prisma/
│   └── schema.prisma          ← Esquema maestro de la BD
└── Respaldos/
    ├── GUIA_RESPALDOS.md      ← Esta guía
    ├── respaldar.ps1          ← Script para respaldar (Windows)
    ├── respaldar.sh           ← Script para respaldar (Linux)
    ├── restaurar.ps1          ← Script para restaurar (Windows)
    ├── restaurar.sh           ← Script para restaurar (Linux)
    ├── ferreteria_dump.sql    ← Último respaldo SQL (texto)
    └── ferreteria_dump.dump   ← Último respaldo binario (recomendado)
```

---

## 1. Respaldar (Exportar datos)

### En Windows (PowerShell)

```powershell
cd Base_de_datos\Respaldos
.\respaldar.ps1
```

### En Linux (Bash)

```bash
cd Base_de_datos/Respaldos
bash respaldar.sh
```

Ambos scripts:
- Verifican que el contenedor PostgreSQL esté activo
- Muestran cuántos datos hay (productos, ventas, etc.)
- Generan dos archivos:
  - `ferreteria_dump.sql` — texto legible, útil para revisar
  - `ferreteria_dump.dump` — binario comprimido, recomendado para restaurar

---

## 2. Pasar datos a otra máquina

### Qué archivos copiar

Solo necesitas **uno** de estos dos:

| Archivo | Tamaño aprox. | Para qué |
|---------|---------------|----------|
| `ferreteria_dump.dump` | ~44 KB | **Recomendado** — restauración rápida y confiable |
| `ferreteria_dump.sql` | ~84 KB | Alternativa si quieres revisar el SQL a mano |

### Cómo transferirlos

```bash
# USB / disco externo
cp Base_de_datos/Respaldos/ferreteria_dump.dump /media/usb/

# SCP por red (desde la máquina destino)
scp usuario@IP_ORIGEN:/ruta/proyecto/Base_de_datos/Respaldos/ferreteria_dump.dump .

# Red local con Python (en la máquina origen)
cd Base_de_datos/Respaldos
python3 -m http.server 8080
# En la máquina destino:
wget http://IP_ORIGEN:8080/ferreteria_dump.dump
```

### Dónde ponerlos en la máquina destino

Colocar el archivo en la **misma ruta**:

```
Tienda_Chavalos_Virtual_web/
└── Base_de_datos/
    └── Respaldos/
        └── ferreteria_dump.dump   ← Aquí
```

---

## 3. Restaurar (Importar datos)

**Requisitos previos:**
1. Docker corriendo con el contenedor PostgreSQL activo
2. Tablas creadas (haber ejecutado `npm run db:migrate` al menos una vez)

### En Windows (PowerShell)

```powershell
cd Base_de_datos\Respaldos
.\restaurar.ps1
```

### En Linux (Bash)

```bash
cd Base_de_datos/Respaldos
bash restaurar.sh
```

Ambos scripts:
- Verifican que existe el dump y que PostgreSQL está activo
- Restauran todos los datos (reemplaza lo que haya en la BD)
- Muestran el conteo final para verificar

### Restaurar manualmente (sin scripts)

```bash
# Con dump binario (recomendado)
docker cp Base_de_datos/Respaldos/ferreteria_dump.dump ferreteria_chavalos_db:/tmp/
docker exec -i ferreteria_chavalos_db pg_restore -U ferre -d ferreteria \
    --clean --if-exists --no-owner --no-privileges /tmp/ferreteria_dump.dump

# Con dump SQL
docker cp Base_de_datos/Respaldos/ferreteria_dump.sql ferreteria_chavalos_db:/tmp/
docker exec -i ferreteria_chavalos_db psql -U ferre -d ferreteria \
    --single-transaction -f /tmp/ferreteria_dump.sql
```

---

## 4. Flujo completo: Windows → Linux

```
┌─────────────────────────────────────┐
│  WINDOWS (origen)                   │
│                                     │
│  1. .\respaldar.ps1                 │
│  2. Copiar ferreteria_dump.dump     │
│     a USB / red / etc.              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  LINUX (destino)                    │
│                                     │
│  1. Poner dump en                   │
│     Base_de_datos/Respaldos/        │
│  2. Levantar PostgreSQL (Docker)    │
│  3. npm run db:migrate              │
│  4. bash restaurar.sh               │
│  5. npm run dev                     │
└─────────────────────────────────────┘
```

---

## 5. Verificar datos

Después de restaurar, verifica que todo esté bien:

```bash
docker exec ferreteria_chavalos_db psql -U ferre -d ferreteria -c \
  'SELECT count(*) AS productos FROM products;
   SELECT count(*) AS ventas FROM sales;
   SELECT count(*) AS usuarios FROM users;'
```

O abre Prisma Studio para verlo con interfaz gráfica:

```bash
cd Frontend/NextJS_React/web
npm run prisma:studio
# Abre http://localhost:5555
```

---

## Credenciales por defecto

| Dato | Valor |
|------|-------|
| **Contenedor Docker** | `ferreteria_chavalos_db` |
| **Usuario BD** | `ferre` |
| **Contraseña BD** | `ferre123` |
| **Base de datos** | `ferreteria` |
| **Puerto** | `5432` |
| **Usuario admin app** | `admin` / `admin123` |
| **Usuario cajero app** | `cajero1` / `cajero123` |
