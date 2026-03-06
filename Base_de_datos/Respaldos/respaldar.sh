#!/bin/bash
# ============================================================
#  respaldar.sh — Respaldar la BD de Ferretería Chavalos
#  Uso: bash respaldar.sh
#  Genera: ferreteria_dump.sql  y  ferreteria_dump.dump
#  en Base_de_datos/Respaldos/
# ============================================================

set -e

CARPETA="$(cd "$(dirname "$0")" && pwd)"
CONTENEDOR="ferreteria_chavalos_db"
USUARIO="ferre"
BD="ferreteria"

echo ""
echo "=== Respaldo de BD: Ferretería Chavalos ==="
echo ""

# Verificar que el contenedor está corriendo
if ! docker inspect -f '{{.State.Running}}' "$CONTENEDOR" 2>/dev/null | grep -q true; then
    echo "ERROR: El contenedor '$CONTENEDOR' no está corriendo."
    echo "Levántalo con: docker compose -f Despliegue/Hosting/postgres-local/docker-compose.yml up -d"
    exit 1
fi

echo "[1/4] Contenedor '$CONTENEDOR' activo"

# Contar registros
echo "[2/4] Datos actuales:"
docker exec "$CONTENEDOR" psql -U "$USUARIO" -d "$BD" -t -c "SELECT '  Productos: ' || count(*) FROM products;"
docker exec "$CONTENEDOR" psql -U "$USUARIO" -d "$BD" -t -c "SELECT '  Presentaciones: ' || count(*) FROM product_presentations;"
docker exec "$CONTENEDOR" psql -U "$USUARIO" -d "$BD" -t -c "SELECT '  Ventas: ' || count(*) FROM sales;"
docker exec "$CONTENEDOR" psql -U "$USUARIO" -d "$BD" -t -c "SELECT '  Usuarios: ' || count(*) FROM users;"

# Dump SQL (texto legible)
echo "[3/4] Exportando dump SQL..."
docker exec "$CONTENEDOR" pg_dump -U "$USUARIO" -d "$BD" \
    --clean --if-exists --no-owner --no-privileges \
    > "$CARPETA/ferreteria_dump.sql"
echo "       -> ferreteria_dump.sql"

# Dump binario (comprimido, recomendado para restaurar)
echo "[4/4] Exportando dump binario..."
docker exec "$CONTENEDOR" pg_dump -U "$USUARIO" -d "$BD" \
    -Fc --no-owner --no-privileges -f /tmp/ferreteria_dump.dump
docker cp "${CONTENEDOR}:/tmp/ferreteria_dump.dump" "$CARPETA/ferreteria_dump.dump"
echo "       -> ferreteria_dump.dump"

# Resumen
SQL_SIZE=$(du -h "$CARPETA/ferreteria_dump.sql" | cut -f1)
DUMP_SIZE=$(du -h "$CARPETA/ferreteria_dump.dump" | cut -f1)

echo ""
echo "=== Respaldo completado ==="
echo "  SQL:     ferreteria_dump.sql   ($SQL_SIZE)"
echo "  Binario: ferreteria_dump.dump  ($DUMP_SIZE)"
echo "  Ruta:    $CARPETA"
echo ""
echo "Para restaurar en otra máquina, copia estos archivos y lee:"
echo "  Base_de_datos/GUIA_RESPALDOS.md"
echo ""
