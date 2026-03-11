#!/usr/bin/env bash
# =============================================================================
# scripts/clean-git-history.sh
# Limpia credenciales sensibles del historial de Git usando git-filter-repo.
#
# CUÁNDO USAR:
#   Si 'git log --all --full-history -- "**/.env" "**/.env.local"' muestra
#   que alguno de esos archivos fue commiteado en algún momento.
#
# PRERREQUISITOS:
#   pip install git-filter-repo   (alternativa: usar BFG Repo Cleaner)
#
# advertencia: REESCRIBE LA HISTORIA DEL REPO. Coordinar con todo el equipo.
#   Todos deben hacer 'git clone' fresco tras ejecutar esto.
# =============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "=== Paso 1: Verificar si .env fue commiteado alguna vez ==="
ENV_IN_HISTORY=$(git log --all --full-history --name-only --format="" -- \
  "**/.env" "**/.env.*" "*.env" | grep -v '^$' | grep -v '\.example' || true)

if [ -z "$ENV_IN_HISTORY" ]; then
  echo "✅ Ningún archivo .env fue commiteado. El historial está limpio."
  exit 0
fi

echo "⚠️  Se encontraron archivos .env en el historial:"
echo "$ENV_IN_HISTORY"
echo ""

read -p "¿Continuar con la limpieza del historial? Esta operación es IRREVERSIBLE. [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelado."
  exit 1
fi

echo ""
echo "=== Paso 2: Crear backup del repo antes de reescribir ==="
BACKUP_DIR="${REPO_ROOT}/../repo-backup-$(date +%Y%m%d-%H%M%S)"
cp -r "$REPO_ROOT/.git" "$BACKUP_DIR"
echo "✅ Backup en: $BACKUP_DIR"

echo ""
echo "=== Paso 3: Eliminar .env y .env.local del historial completo ==="
# git-filter-repo es la herramienta oficial recomendada por Git
# Elimina los archivos de TODOS los commits manteniendo el resto intacto
git filter-repo \
  --path "Frontend/NextJS_React/web/.env" --invert-paths \
  --path "Frontend/NextJS_React/web/.env.local" --invert-paths \
  --path ".env" --invert-paths \
  --path ".env.local" --invert-paths \
  --force

echo ""
echo "=== Paso 4: Limpiar objetos huérfanos ==="
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "✅ Historial limpiado. Pasos siguientes:"
echo "   1. Rotar la contraseña de Supabase en: https://supabase.com/dashboard → Settings → Database"
echo "   2. Hacer push forzado: git push --force-with-lease origin main"
echo "   3. Notificar a todos los colaboradores para hacer 'git clone' fresco"
echo "   4. Revocar y regenerar cualquier token de API expuesto"
echo ""
echo "⚠️  Si el repo estaba en GitHub, GitHub puede cachear blobs por hasta 90 días."
echo "   Contactar a GitHub Support para solicitar purga inmediata si es urgente."
