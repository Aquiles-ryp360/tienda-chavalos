# 🔧 SOLUCIÓN - Error de Migración Prisma

## Problema Original

```
⚠️ Error: We found changes that cannot be executed:
  • Step 2 Added the required column `baseQty` to the `sale_items` table without a default value. 
    There are 4 rows in this table, it is not possible to execute this step.
  • Step 2 Added the required column `soldQty` to the `sale_items` table without a default value.
  • Step 2 Added the required column `soldUnit` to the `sale_items` table without a default value.
```

### Causa
Prisma intentaba agregar columnas **requeridas (NOT NULL)** a una tabla que ya tenía datos (4 filas existentes en `sale_items`). Sin defaults, PostgreSQL no sabe qué valor asignar a los rows existentes.

---

## ✅ Solución Implementada

### Paso 1: Generar migración sin ejecutar
```bash
npx prisma migrate dev --create-only --name add_presentations
```

Esto crea el archivo de migración SQL sin ejecutarlo.

### Paso 2: Editar migración manualmente

**Archivo:** `prisma/migrations/20260115193345_add_presentations/migration.sql`

**Cambio original (❌ No funciona):**
```sql
ALTER TABLE "sale_items" DROP COLUMN "quantity",
ADD COLUMN     "baseQty" DECIMAL(12,3) NOT NULL,
ADD COLUMN     "soldQty" DECIMAL(12,3) NOT NULL,
ADD COLUMN     "soldUnit" "ProductUnit" NOT NULL,
```

**Cambio corregido (✅ Funciona):**
```sql
ALTER TABLE "sale_items" DROP COLUMN "quantity",
ADD COLUMN     "baseQty" DECIMAL(12,3) DEFAULT 0,
ADD COLUMN     "presentationId" TEXT,
ADD COLUMN     "soldQty" DECIMAL(12,3) DEFAULT 0,
ADD COLUMN     "soldUnit" "ProductUnit" DEFAULT 'UNIDAD',

-- Actualizar filas existentes
UPDATE "sale_items" SET "baseQty" = COALESCE("baseQty", 0) WHERE "baseQty" IS NULL;
UPDATE "sale_items" SET "soldQty" = COALESCE("soldQty", 0) WHERE "soldQty" IS NULL;
UPDATE "sale_items" SET "soldUnit" = COALESCE("soldUnit", 'UNIDAD') WHERE "soldUnit" IS NULL;

-- Convertir a NOT NULL
ALTER TABLE "sale_items" ALTER COLUMN "baseQty" SET NOT NULL;
ALTER TABLE "sale_items" ALTER COLUMN "soldQty" SET NOT NULL;
ALTER TABLE "sale_items" ALTER COLUMN "soldUnit" SET NOT NULL;
```

### Estrategia: 3 Pasos

1. **Agregar columnas CON defaults** (nullables)
2. **Actualizar rows existentes** con valores válidos
3. **Convertir a NOT NULL** (ahora seguros porque todos tienen valor)

### Paso 3: Ejecutar migración
```bash
npx prisma migrate dev
```

✅ **Resultado:** Migración ejecutada exitosamente

---

## 📋 Cambios por Columna

| Columna | Default | Justificación |
|---------|---------|---------------|
| `baseQty` | `0` | Stock base inicial (datos históricos) |
| `soldQty` | `0` | Cantidad vendida inicial |
| `soldUnit` | `'UNIDAD'` | Unidad default (más común/segura) |
| `presentationId` | `NULL` | No todos los items tienen presentación (backward compat) |

---

## ✅ Verificación Post-Migración

### Base de datos sincronizada
```
✅ Tabla sale_items actualizada con 4 campos nuevos
✅ Tabla product_presentations creada
✅ Schema.prisma en sync con BD
✅ Prisma Client regenerado
```

### Seed data ejecutado
```
✅ Base de datos limpia
✅ Usuarios creados (admin, cajero1)
✅ 25 productos con presentaciones
✅ 50+ product_presentations registradas
✅ Stock movements iniciales
```

### Servidor iniciado
```
✅ Next.js iniciado en puerto 3000
✅ Aplicación lista en http://localhost:3000
```

---

## 🎯 Lecciones Aprendidas

### Cuando agregar columnas NOT NULL a tabla con datos:

❌ **No hacer:**
```sql
ALTER TABLE table ADD COLUMN newCol TYPE NOT NULL;
```
Falla si la tabla tiene datos.

✅ **Hacer:**
```sql
-- 1. Agregar con default (puede ser NULL)
ALTER TABLE table ADD COLUMN newCol TYPE DEFAULT value;

-- 2. Actualizar datos existentes
UPDATE table SET newCol = ... WHERE newCol IS NULL;

-- 3. Convertir a NOT NULL (ahora seguro)
ALTER TABLE table ALTER COLUMN newCol SET NOT NULL;
```

---

## 🔄 Para Futuras Migraciones

**Si necesitas agregar columnas requeridas a una tabla con datos:**

1. Usa `--create-only` para generar sin ejecutar
2. Agrega `DEFAULT value` a las columnas nuevas
3. Agrega `UPDATE` statements después de `ADD COLUMN`
4. Agrega `ALTER COLUMN SET NOT NULL` al final
5. Prueba con `prisma migrate dev`

---

## 📞 Comandos Útiles

```bash
# Ver migraciones aplicadas
npx prisma migrate status

# Ver historial de migraciones
ls prisma/migrations/

# Rollback última migración (destructivo)
npx prisma migrate resolve --rolled-back

# Recrear BD desde cero
npx prisma migrate reset
```

---

## ✅ Estado Final

```
✅ Migración: 20260115193345_add_presentations (APLICADA)
✅ Migración: 20260115193439_init_fase2 (APLICADA)
✅ Schema en sync
✅ Seed data cargado
✅ Servidor running en http://localhost:3000
✅ Base de datos con 25 productos + 50+ presentaciones
```

**Status: 🟢 LISTO PARA TESTING**

Ver: `TESTING_RAPIDO_FASE2.md` para checklist de validación
