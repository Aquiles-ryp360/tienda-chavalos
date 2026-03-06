#!/bin/bash
# ============================================================
#  restaurar.sh — Restaurar la BD de Ferretería Chavalos
#  Uso: bash restaurar.sh
#  Requiere: ferreteria_dump.dump en esta misma carpeta
# ============================================================

set -e

CARPETA="$(cd "$(dirname "$0")" && pwd)"
CONTENEDOR="ferreteria_chavalos_db"
USUARIO="ferre"
BD="ferreteria"
DUMP="$CARPETA/ferreteria_dump.dump"

echo ""
echo "=== Restaurar BD: Ferretería Chavalos ==="
echo ""

# Verificar que existe el dump
if [ ! -f "$DUMP" ]; then
    echo "ERROR: No se encontró ferreteria_dump.dump en:"
    echo "  $CARPETA"
    echo ""
    echo "Primero genera un respaldo con: bash respaldar.sh"
    exit 1
fi

# Verificar que el contenedor está corriendo
if ! docker inspect -f '{{.State.Running}}' "$CONTENEDOR" 2>/dev/null | grep -q true; then
    echo "ERROR: El contenedor '$CONTENEDOR' no está corriendo."
    echo "Levántalo con: docker compose -f Despliegue/Hosting/postgres-local/docker-compose.yml up -d"
    exit 1
fi

echo "[1/3] Contenedor '$CONTENEDOR' activo"

# Copiar dump al contenedor
echo "[2/3] Copiando dump al contenedor..."
docker cp "$DUMP" "${CONTENEDOR}:/tmp/ferreteria_dump.dump"

# Restaurar
echo "[3/3] Restaurando base de datos..."
docker exec -i "$CONTENEDOR" pg_restore -U "$USUARIO" -d "$BD" \
    --clean --if-exists --no-owner --no-privileges \
    /tmp/ferreteria_dump.dump || true

# Verificar
echo ""
echo "=== Verificación ==="
docker exec "$CONTENEDOR" psql -U "$USUARIO" -d "$BD" -t -c "SELECT '  Productos: ' || count(*) FROM products;"
docker exec "$CONTENEDOR" psql -U "$USUARIO" -d "$BD" -t -c "SELECT '  Presentaciones: ' || count(*) FROM product_presentations;"
docker exec "$CONTENEDOR" psql -U "$USUARIO" -d "$BD" -t -c "SELECT '  Ventas: ' || count(*) FROM sales;"
docker exec "$CONTENEDOR" psql -U "$USUARIO" -d "$BD" -t -c "SELECT '  Usuarios: ' || count(*) FROM users;"

echo ""
echo "=== Restauración completada ==="
echo ""
