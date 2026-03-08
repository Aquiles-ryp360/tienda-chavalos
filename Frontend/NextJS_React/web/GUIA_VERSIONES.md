# Guia de Versiones - Ferreteria Chavalos Web

## Release actual

- Version vigente: `v1.5.0`
- Tipo de release: `MINOR`
- Estado: Produccion

## Politica de versionado

Este proyecto usa Versionado Semantico (`SemVer`):

```text
MAYOR.MENOR.PARCHE
```

- `MAYOR`: cambios incompatibles o redisenos que obligan a adaptar flujos existentes.
- `MENOR`: nuevas capacidades, mejoras arquitectonicas o ampliaciones funcionales compatibles.
- `PARCHE`: correcciones puntuales de bugs o ajustes internos sin cambiar el comportamiento esperado del producto.

## Archivos que deben coincidir

En el POS web la version del release debe mantenerse alineada en:

```text
Frontend/NextJS_React/web/package.json
Frontend/NextJS_React/web/package-lock.json
```

## Changelog oficial - v1.5.0

### Resumen ejecutivo

La version `v1.5.0` consolida la migracion del POS a una arquitectura Progressive Local-First y endurece el flujo transaccional de Caja para produccion en Vercel con Prisma y Supabase.

### Novedades principales

#### 1. Arquitectura Progressive Local-First

- Se implemento un motor de cache hibrido para catalogo basado en `product-catalog-store`, `useSyncExternalStore`, `LocalStorage` y `SWR`.
- El catalogo puede descargarse en segundo plano para habilitar busquedas instantaneas en `CajaView` y resiliencia operativa ante latencia o conectividad degradada.
- El POS ahora combina resultados locales con fallback remoto inteligente hacia la capa online respaldada por Supabase.

#### 2. Refactorizacion estricta de TypeScript

- Se continuo la eliminacion de deuda tecnica en tipados de ventas, productos y utilidades relacionadas con serializacion, formato y PDF.
- Se reforzo la inferencia tipada sobre Prisma y los contratos de API para mantener compatibilidad con las validaciones de Vercel, TypeScript estricto y ESLint.

#### 3. Correccion de bug de precision numerica

- Se agrego `QUANTITY_EPSILON` y saneamiento numerico simetrico en frontend y backend.
- Las cantidades de unidades discretas ahora toleran residuos flotantes de JavaScript como `1.0000000000000002`.
- Esto evita rechazos falsos en ventas de unidades enteras como `UNIDAD`, `PIEZA` o equivalentes discretos.

#### 4. Seguridad transaccional y UX en POS

- Se implemento bloqueo reentrante de checkout con `submitLockRef` e `isSubmitting` para prevenir doble cobro por doble click o taps repetidos.
- El flujo de Caja ahora aplica una Optimistic UI que descuenta el stock del catalogo local inmediatamente despues de una venta exitosa.
- La experiencia de caja queda alineada con el stock esperado sin depender del siguiente ciclo de sincronizacion en segundo plano.

#### 5. Estandarizacion de timezone de negocio

- Se creo `business-time.ts` para fijar `America/Lima` como zona horaria de negocio.
- Dashboard, filtros de ventas y cierres diarios dejan de depender del timezone UTC del runtime de Vercel.
- Se reduce el riesgo de registrar o visualizar ventas en el dia equivocado cerca del cambio de fecha UTC.

## Historial reciente

| Version | Tipo | Resumen |
| --- | --- | --- |
| `v1.5.0` | Minor | Progressive Local-First, precision numerica, bloqueo de doble cobro, stock optimista y timezone de negocio |
| `v1.4.1` | Parche | Release estable anterior antes de la actualizacion arquitectonica local-first |

## Checklist para futuros releases

1. Actualizar `package.json`.
2. Sincronizar `package-lock.json`.
3. Documentar el release en este archivo.
4. Reflejar el estado del release en `README.md` cuando el cambio impacte arquitectura, despliegue o flujo operativo.
5. Generar tag Git del release si aplica al proceso de despliegue.
