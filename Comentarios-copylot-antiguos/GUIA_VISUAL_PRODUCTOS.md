# 🎯 Guía Visual Rápida - Rediseño Productos

## Antes vs Después

### TABLA DE PRODUCTOS
**Antes:**
- Tipografía pequeña (0.875rem)
- Botones pequeños en cada fila
- Badges simples

**Ahora:**
- Tipografía más grande (0.95rem)
- Acciones con emojis grandes (✏️ 🗑️)
- Badges coloridos con estado claro
- SKU en monospace con badge gris
- Precio con "S/" en azul
- Stock bajo resaltado en rojo
- Búsqueda con icono grande 🔍

### MODAL DE PRODUCTO
**Antes:**
- Modal pequeño (500px max)
- Título pequeño
- Inputs compactos
- Validación por alert

**Ahora:**
- Modal cómodo (720px max)
- **Header mejora**: icono + título grande + subtítulo
- **3 secciones claras** con espacios amplios
- **Inputs grandes** (min 44px altura)
- **Validación en vivo** con mensajes debajo del campo
- **Formateo automático** (Precio: 15.00, Stock: 50.000)
- **Spinner de carga** al guardar
- **Banner de confirmación** cuando se guarda

## Nuevos Archivos

```
Frontend/NextJS_React/web/ui/pages/productos/
├── ProductosView.tsx (MODIFICADO)
│   └── Componente principal con tabla mejorada
├── ProductModal.tsx (NUEVO ✨)
│   └── Modal con validación en vivo y formateo
├── productValidation.ts (NUEVO ✨)
│   └── Funciones de validación y formateo
├── productos.module.css (REDISEÑADO)
│   └── Estilos de tabla y header
└── productModal.module.css (NUEVO ✨)
    └── Estilos del modal
```

## Tipografía

### Títulos
```
Modal: "Nuevo Producto"
└─ Tamaño: 28px (1.75rem)
   Peso: Bold 800
   Color: var(--text)

Subtítulo: "Complete los datos del producto"
└─ Tamaño: 15px (0.95rem)
   Color: var(--text-secondary)
```

### Inputs & Labels
```
Label: "SKU"
└─ Tamaño: 16px (0.95rem)
   Peso: Bold 600
   Asterisco: rojo si requerido

Input: [texto usuario]
└─ Tamaño: 16px (0.95rem)
   Altura: 44-48px
   Border: 2px suave
   Focus: Shadow azul
```

## Colores

| Elemento | Color | RGB |
|----------|-------|-----|
| Primario (botones) | Azul | var(--primary) |
| Bajo Stock | Naranja | #ea580c |
| Sin Stock | Rojo | #991b1b |
| OK | Verde | #065f46 |
| Texto | Gris oscuro | var(--text) |
| Secundario | Gris | #9ca3af |

## Flujos de Usuario

### 1. Crear Producto
```
[Página Productos]
        ↓
    [Botón "+ Nuevo Producto"]
        ↓
[Modal abre con animación]
        ↓
[Usuario completa campos]
        ↓
[Validación en vivo (errores debajo del campo)]
        ↓
[Botón "Guardar Producto" se habilita]
        ↓
[Click Guardar]
        ↓
[Spinner mientras se guarda]
        ↓
[Modal cierra + Banner verde de éxito]
        ↓
[Tabla se actualiza]
```

### 2. Editar Producto
```
[Tabla: Click en ✏️]
        ↓
[Modal abre pre-llenada]
        ↓
[Usuario modifica campos]
        ↓
[Validación en vivo]
        ↓
[Click Guardar]
        ↓
[Confirmación visual]
```

### 3. Eliminar Producto
```
[Tabla: Click en 🗑️]
        ↓
[Confirmación por alert]
        ↓
[Producto eliminado]
        ↓
[Tabla se actualiza]
```

## Validaciones Implementadas

### SKU
- Requerido
- 2-50 caracteres
- Mensaje: "El SKU es obligatorio" / "El SKU debe tener al menos 2 caracteres"

### Nombre
- Requerido
- 3-200 caracteres
- Mensaje: "El nombre es obligatorio" / "El nombre debe tener al menos 3 caracteres"

### Precio
- Requerido
- Mayor a 0
- Máximo 999,999.99
- Formato: Siempre 2 decimales al blur
- Mensaje: "El precio debe ser mayor a S/ 0.00"

### Stock
- Requerido
- Mayor o igual a 0
- Si unidad METRO/LITRO/KILO: permite decimales (hasta 3)
- Si unidad UNIDAD/CAJA/PAQUETE/ROLLO: solo enteros
- Mensaje: "El stock no puede ser negativo"

### Stock Mínimo
- Requerido
- Mayor o igual a 0
- Sigue mismo formato que Stock
- Mensaje: "El stock mínimo no puede ser negativo"

## Accesibilidad

✅ Navegación por teclado
- Tab: moverse entre campos
- Enter: enviar formulario
- Escape: cerrar modal
- Shift+Tab: ir atrás

✅ Labels claros
- Todos los inputs tienen `<label>`
- Campos requeridos marcados con "*"
- Placeholders descriptivos

✅ Focus visible
- Outline azul en campos
- Contraste >= 4.5:1
- Símbolos visibles

✅ ARIA attributes
- aria-invalid para campos con error
- aria-describedby para mensajes de error
- aria-label en botones sin texto

## Placeholders de Ejemplo

| Campo | Placeholder |
|-------|-------------|
| SKU | "Ej: CAB-001" |
| Nombre | "Ej: Cable de cobre 10mm" |
| Descripción | "Ej: Cable de cobre de alta calidad..." |
| Precio | "15.00" |
| Stock | "50" o "10.500" (según unidad) |
| Stock Mín | "5" o "5.000" (según unidad) |

## Tamaños Responsivos

### Desktop (≥768px)
- Modal: 720px max-width
- Grid: 2 columnas
- Typography: full size
- Padding: 2rem

### Mobile (<768px)
- Modal: full-width - 2rem
- Grid: 1 columna (stack)
- Typography: slightly reduced
- Padding: 1.5rem
- Buttons: full-width en footer

## Estados del Modal

| Estado | Apariencia |
|--------|-----------|
| Cargando | Spinner girador en botón |
| Guardando | Botón deshabilitado, spinner |
| Éxito | Banner verde arriba |
| Error | Mensaje rojo debajo del campo |
| Vacío | Campos con placeholder |
| Pre-llenado | Campos con datos actuales |

## Tips de UX

1. **Para tu mamá**: Tipografía grande, botones claros, colores obviamente diferentes
2. **Validación amigable**: Mensajes en español plano, sin jerga técnica
3. **Visual feedback**: Colores indican estado (verde=ok, naranja=alerta, rojo=problema)
4. **Eficiencia**: Una sección a la vez, no sobrecarga
5. **Confirmación**: Banner verde cuando se guarda, no espanta

## Próximas Mejoras Posibles

- [ ] Autoguardado (guardar mientras escribes)
- [ ] Historial de cambios
- [ ] Duplicar producto
- [ ] Importar productos (CSV)
- [ ] Códigos de barras
- [ ] Imágenes de productos
- [ ] Predefinir Stock Mínimo por categoría
