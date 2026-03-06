#!/usr/bin/env pwsh
# ============================================================
#  respaldar.ps1 — Respaldar la BD de Ferretería Chavalos
#  Uso: .\respaldar.ps1
#  Genera: ferreteria_dump.sql  y  ferreteria_dump.dump
#  en Base_de_datos/Respaldos/
# ============================================================

$ErrorActionPreference = "Stop"
$carpeta = Split-Path -Parent $MyInvocation.MyCommand.Path
$contenedor = "ferreteria_chavalos_db"
$usuario = "ferre"
$bd = "ferreteria"
$fecha = Get-Date -Format "yyyy-MM-dd_HHmm"

Write-Host ""
Write-Host "=== Respaldo de BD: Ferreteria Chavalos ===" -ForegroundColor Cyan
Write-Host ""

# Verificar que el contenedor esta corriendo
$estado = docker inspect -f '{{.State.Running}}' $contenedor 2>$null
if ($estado -ne "true") {
    Write-Host "ERROR: El contenedor '$contenedor' no esta corriendo." -ForegroundColor Red
    Write-Host "Levantalo con: docker compose -f Despliegue/Hosting/postgres-local/docker-compose.yml up -d"
    exit 1
}

Write-Host "[1/4] Contenedor '$contenedor' activo" -ForegroundColor Green

# Contar registros
Write-Host "[2/4] Datos actuales:" -ForegroundColor Yellow
docker exec $contenedor psql -U $usuario -d $bd -t -c "SELECT 'Productos: ' || count(*) FROM products;"
docker exec $contenedor psql -U $usuario -d $bd -t -c "SELECT 'Presentaciones: ' || count(*) FROM product_presentations;"
docker exec $contenedor psql -U $usuario -d $bd -t -c "SELECT 'Ventas: ' || count(*) FROM sales;"
docker exec $contenedor psql -U $usuario -d $bd -t -c "SELECT 'Usuarios: ' || count(*) FROM users;"

# Dump SQL (texto legible)
Write-Host "[3/4] Exportando dump SQL..." -ForegroundColor Yellow
docker exec $contenedor pg_dump -U $usuario -d $bd --clean --if-exists --no-owner --no-privileges > "$carpeta\ferreteria_dump.sql"
Write-Host "       -> ferreteria_dump.sql" -ForegroundColor Green

# Dump binario (comprimido, recomendado para restaurar)
Write-Host "[4/4] Exportando dump binario..." -ForegroundColor Yellow
docker exec $contenedor pg_dump -U $usuario -d $bd -Fc --no-owner --no-privileges -f /tmp/ferreteria_dump.dump
docker cp "${contenedor}:/tmp/ferreteria_dump.dump" "$carpeta\ferreteria_dump.dump"
Write-Host "       -> ferreteria_dump.dump" -ForegroundColor Green

# Resumen
$sqlSize = [math]::Round((Get-Item "$carpeta\ferreteria_dump.sql").Length / 1KB, 1)
$dumpSize = [math]::Round((Get-Item "$carpeta\ferreteria_dump.dump").Length / 1KB, 1)

Write-Host ""
Write-Host "=== Respaldo completado ===" -ForegroundColor Cyan
Write-Host "  SQL:     ferreteria_dump.sql   ($sqlSize KB)"
Write-Host "  Binario: ferreteria_dump.dump  ($dumpSize KB)"
Write-Host "  Ruta:    $carpeta"
Write-Host ""
Write-Host "Para restaurar en otra maquina, copia estos archivos y lee:" -ForegroundColor Yellow
Write-Host "  Base_de_datos/GUIA_RESPALDOS.md"
Write-Host ""
