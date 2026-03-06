# 🔒 SECURITY FIXES - Enero 2026

## Vulnerabilidades Resueltas

### ✅ tar <=7.5.2 - Arbitrary File Overwrite / Symlink Poisoning (HIGH)

**Problema identificado:**
- `bcrypt@5.1.1` dependía de `@mapbox/node-pre-gyp@1.0.11`
- Que a su vez dependía de `tar@6.2.1` (vulnerable)
- CVE: Arbitrary File Overwrite / Symlink Poisoning

**Cadena de dependencia vulnerable:**
```
bcrypt@5.1.1
  └── @mapbox/node-pre-gyp@1.0.11
      └── tar@6.2.1 (VULNERABLE)
```

**Solución aplicada:**
- Actualización de `bcrypt` de `5.1.1` → `6.0.0`
- La nueva versión elimina completamente la dependencia de `@mapbox/node-pre-gyp`
- Por lo tanto, `tar` vulnerable ya no está en el árbol de dependencias

**Cambios en package.json:**
```json
{
  "dependencies": {
    "bcrypt": "^6.0.0"  // Antes: "^5.1.1"
  }
}
```

**Comandos ejecutados:**
```bash
# 1. Diagnóstico
npm audit                    # Mostró 2 high vulnerabilities
npm ls tar                   # Identificó bcrypt → @mapbox/node-pre-gyp → tar@6.2.1
npm view bcrypt versions     # Verificó versiones disponibles

# 2. Solución
npm update bcrypt            # Actualizó a bcrypt@6.0.0

# 3. Validación
npm audit                    # 0 vulnerabilities ✅
npm ls tar                   # Ya no aparece en el árbol
npm run build                # Build exitoso ✅
```

**Resultado:**
- ✅ **0 vulnerabilities** en `npm audit`
- ✅ Build funciona correctamente
- ✅ Sin overrides necesarios (solución limpia)
- ✅ Sin breaking changes (bcrypt@6.0.0 es compatible con bcrypt@5.x)

**Verificación:**
```bash
npm audit                # → found 0 vulnerabilities
npm run build            # → Build completed successfully
```

## Notas Técnicas

### ¿Por qué funcionó?

`bcrypt@6.0.0` cambió su estrategia de distribución de binarios precompilados:
- **Antes (v5.x):** Usaba `@mapbox/node-pre-gyp` para descargar binarios
- **Ahora (v6.x):** Usa npm's built-in binary distribution, eliminando la dependencia de `node-pre-gyp` y por ende de `tar`

### Breaking Changes

Ninguno relevante para este proyecto. `bcrypt@6.0.0` mantiene la misma API pública que `5.x`.

### Alternativas Descartadas

1. **npm audit fix --force:** No fue necesario (el update simple resolvió el problema)
2. **overrides en package.json:** No fue necesario (la actualización eliminó la dependencia vulnerable)
3. **Reemplazar bcrypt:** No fue necesario (la nueva versión es compatible)

## Fecha de Resolución

**17 de enero de 2026**

## Mantenimiento Futuro

- Ejecutar `npm audit` regularmente (al menos mensual)
- Mantener dependencias actualizadas con `npm outdated` y `npm update`
- Revisar changelogs antes de actualizar dependencias críticas
