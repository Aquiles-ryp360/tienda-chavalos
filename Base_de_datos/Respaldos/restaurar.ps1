#!/usr/bin/env pwsh
# ============================================================
#  restaurar.ps1 — Restaurar la BD de Ferretería Chavalos
#  Uso: .\restaurar.ps1
#  Requiere: ferreteria_dump.dump en esta misma carpeta
# ============================================================

$ErrorActionPreference = "Stop"
$carpeta = Split-Path -Parent $MyInvocation.MyCommand.Path
$contenedor = "ferreteria_chavalos_db"
$usuario = "ferre"
$bd = "ferreteria"
$dump = "$carpeta\ferreteria_dump.dump"

Write-Host ""
Write-Host "=== Restaurar BD: Ferreteria Chavalos ===" -ForegroundColor Cyan
Write-Host ""

# Verificar que existe el dump
if (-not (Test-Path $dump)) {
    Write-Host "ERROR: No se encontro ferreteria_dump.dump en:" -ForegroundColor Red
    Write-Host "  $carpeta"
    Write-Host ""
    Write-Host "Primero genera un respaldo con: .\respaldar.ps1"
    exit 1
}

# Verificar que el contenedor esta corriendo
$estado = docker inspect -f '{{.State.Running}}' $contenedor 2>$null
if ($estado -ne "true") {
    Write-Host "ERROR: El contenedor '$contenedor' no esta corriendo." -ForegroundColor Red
    Write-Host "Levantalo con: docker compose -f Despliegue/Hosting/postgres-local/docker-compose.yml up -d"
    exit 1
}

Write-Host "[1/3] Contenedor '$contenedor' activo" -ForegroundColor Green

# Copiar dump al contenedor
Write-Host "[2/3] Copiando dump al contenedor..." -ForegroundColor Yellow
docker cp $dump "${contenedor}:/tmp/ferreteria_dump.dump"

# Restaurar
Write-Host "[3/3] Restaurando base de datos..." -ForegroundColor Yellow
docker exec -i $contenedor pg_restore -U $usuario -d $bd --clean --if-exists --no-owner --no-privileges /tmp/ferreteria_dump.dump 2>$null

# Verificar
Write-Host ""
Write-Host "=== Verificacion ===" -ForegroundColor Cyan
docker exec $contenedor psql -U $usuario -d $bd -t -c "SELECT '  Productos: ' || count(*) FROM products;"
docker exec $contenedor psql -U $usuario -d $bd -t -c "SELECT '  Presentaciones: ' || count(*) FROM product_presentations;"
docker exec $contenedor psql -U $usuario -d $bd -t -c "SELECT '  Ventas: ' || count(*) FROM sales;"
docker exec $contenedor psql -U $usuario -d $bd -t -c "SELECT '  Usuarios: ' || count(*) FROM users;"

Write-Host ""
Write-Host "=== Restauracion completada ===" -ForegroundColor Cyan
Write-Host ""
