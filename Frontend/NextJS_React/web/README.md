# Ferreteria Chavalos Web

Punto de Venta web construido con Next.js App Router, Prisma y despliegue en Vercel para la operacion diaria de Ferreteria Chavalos.

## Version actual

- Release: `v1.5.0`
- Estado: Produccion

## Stack principal

- `Next.js` con App Router
- `React 18`
- `Prisma`
- `SWR`
- Cache local-first con `product-catalog-store` + `LocalStorage`

## Scripts principales

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run prisma:generate
```

## Release destacado - v1.5.0

### Progressive Local-First en POS

Se implemento una arquitectura de cache hibrida para el catalogo del POS, con sincronizacion en segundo plano, busqueda local instantanea y fallback remoto inteligente para mantener la operacion de Caja fluida aun bajo latencia o conectividad degradada.

### Refactorizacion estricta de TypeScript

Se reforzaron tipos y contratos de datos en APIs, serializacion y utilidades criticas para reducir deuda tecnica y sostener compatibilidad con TypeScript estricto, Prisma y las validaciones de Vercel.

### Precision numerica y seguridad de cobro

Se introdujo tolerancia numerica contra errores de punto flotante tanto en frontend como en backend, junto con bloqueo estricto de doble submit en Caja para prevenir ventas duplicadas.

### Stock local optimista

Despues de una venta exitosa, el catalogo local descuenta el stock inmediatamente sin esperar la siguiente sincronizacion remota, mejorando consistencia visual y velocidad operativa.

### Timezone de negocio unificado

La capa `business-time.ts` fija `America/Lima` como referencia para dashboard, filtros diarios y consultas operativas, evitando desfases de fecha por ejecucion en UTC.

## Documentacion relacionada

- [GUIA_VERSIONES.md](./GUIA_VERSIONES.md)
- [SECURITY_FIXES.md](./SECURITY_FIXES.md)
