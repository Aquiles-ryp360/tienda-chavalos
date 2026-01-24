# 🧪 Guía de Testing - Rediseño de Productos

## ✅ Checklist Visual

### Paso 1: Abrir la página de productos
- [ ] Ir a http://localhost:3001/productos (o puerto actual)
- [ ] Verificar que carga correctamente
- [ ] No hay errores en console

### Paso 2: Verificar tabla de productos
**HEADER**
- [ ] Título grande "Gestión de Productos" (visible desde lejos)
- [ ] Subtítulo gris "Administra el catálogo..." 
- [ ] Botón "+ Nuevo Producto" grande en la derecha

**BUSCADOR**
- [ ] Icono 🔍 a la izquierda
- [ ] Input grande (48px altura)
- [ ] Placeholder claro: "Buscar por SKU o nombre..."
- [ ] Funciona al escribir

**TABLA**
- [ ] Header con columnas: SKU, Nombre, Unidad, Precio, Stock, Mín., Estado, Acciones
- [ ] SKU en badge gris monospace (ej: CAB-001)
- [ ] Nombre completo visible
- [ ] Unidad clara
- [ ] Precio con "S/" en azul (ej: S/ 15.00)
- [ ] Stock en números (ej: 50)
- [ ] Stock Mínimo (ej: 5)
- [ ] Badge de estado:
  - [ ] Verde "OK" si stock > minStock
  - [ ] Naranja "Bajo stock" si stock <= minStock
  - [ ] Rojo "Sin stock" si stock = 0
- [ ] Acciones: ✏️ y 🗑️ (emojis grandes)

**ESPACIADO**
- [ ] Filas con buen espaciado vertical
- [ ] No se siente apretado
- [ ] Fácil de leer

---

### Paso 3: Crear un nuevo producto
1. Click en "+ Nuevo Producto"

**MODAL ABRE**
- [ ] Animación slide-up suave
- [ ] Icono 📦 al lado del título
- [ ] Título grande "Nuevo Producto" (28px+)
- [ ] Subtítulo "Complete los datos del producto"
- [ ] Botón X para cerrar (arriba derecha)

**SECCIÓN 1: IDENTIFICACIÓN**
- [ ] Título de sección visible "IDENTIFICACIÓN"
- [ ] Label "SKU" con asterisco rojo
- [ ] Input con placeholder "Ej: CAB-001"
- [ ] Label "Nombre del Producto" con asterisco rojo
- [ ] Input con placeholder "Ej: Cable de cobre 10mm"
- [ ] Dos inputs lado a lado (desktop)

**SECCIÓN 2: DETALLES**
- [ ] Título "DETALLES"
- [ ] Label "Unidad de Medida" con asterisco rojo
- [ ] Select con opciones: Unidad, Metro, Litro, Kilo, Caja, Paquete, Rollo
- [ ] Label "Descripción (Opcional)"
- [ ] Textarea grande
- [ ] Responsive (desktop: lado a lado, mobile: stack)

**SECCIÓN 3: PRECIO Y STOCK**
- [ ] Título "PRECIO Y STOCK"
- [ ] Label "Precio (S/)" con asterisco rojo
- [ ] Input con símbolo "S/" a la izquierda
- [ ] Placeholder "15.00"
- [ ] Label "Stock Actual" con asterisco rojo
- [ ] Input con placeholder según unidad
- [ ] Label "Stock Mínimo (Alerta)" con asterisco rojo
- [ ] Input con placeholder según unidad

**FOOTER**
- [ ] Botón "Cancelar" gris (izquierda)
- [ ] Botón "Guardar Producto" azul primario (derecha)
- [ ] Botones con altura 44px+

---

### Paso 4: Probar validación en vivo
**Dejar SKU vacío**
- [ ] Error aparece debajo: "El SKU es obligatorio"
- [ ] Texto rojo, pequeño
- [ ] Animación suave

**Escribir SKU muy corto (ej: "A")**
- [ ] Error: "El SKU debe tener al menos 2 caracteres"
- [ ] Se actualiza en vivo

**Dejar Nombre vacío**
- [ ] Error: "El nombre es obligatorio"
- [ ] Desaparece cuando escribes

**Escribir nombre muy corto (ej: "ab")**
- [ ] Error: "El nombre debe tener al menos 3 caracteres"

**Dejar Precio vacío o = 0**
- [ ] Error: "El precio debe ser mayor a S/ 0.00"

**Escribir Precio negativo**
- [ ] Error inmediato

---

### Paso 5: Probar formateo de números

**PRECIO**
1. Escribe: 15
2. Focus en otro campo (blur)
   - [ ] Se formatea a: 15.00
3. Escribe: 15.5
4. Blur
   - [ ] Se formatea a: 15.50

**STOCK (si unidad = UNIDAD)**
1. Escribe: 50
2. Blur
   - [ ] Se mantiene: 50 (entero)
3. Escribe: 50.5
4. Blur
   - [ ] Se redondea a: 50 (entero)

**STOCK (si unidad = METRO)**
1. Escribe: 10.5
2. Blur
   - [ ] Se formatea a: 10.500 (3 decimales)
3. Escribe: 10.1
4. Blur
   - [ ] Se formatea a: 10.100

---

### Paso 6: Completar formulario y guardar

**Llenar todos los campos**:
```
SKU: TEST-001
Nombre: Producto de Prueba
Unidad: UNIDAD
Descripción: Este es un producto de prueba para el rediseño
Precio: 25.50
Stock: 100
Stock Mínimo: 10
```

- [ ] Validación en vivo pasa (sin errores)
- [ ] Botón "Guardar Producto" se habilita (azul fuerte)
- [ ] Click en "Guardar"

**AL GUARDAR**:
- [ ] Spinner aparece en botón
- [ ] Botón deshabilitado
- [ ] Modal se cierra
- [ ] Banner verde aparece arriba: "✓ Producto creado correctamente"
- [ ] Banner desaparece en 4 segundos
- [ ] Tabla se actualiza con el nuevo producto
- [ ] Nuevo producto visible en tabla con badge "OK"

---

### Paso 7: Editar un producto
1. Click en ✏️ en una fila
2. Modal abre pre-llenada
   - [ ] SKU del producto
   - [ ] Nombre del producto
   - [ ] Descripción (si existe)
   - [ ] Unidad seleccionada
   - [ ] Precio formateado (2 decimales)
   - [ ] Stock con decimales si es METRO/LITRO/KILO
   - [ ] Stock Mínimo

3. Cambiar Precio: 25.50 → 30.00
4. Click "Guardar Producto"
   - [ ] Modal cierra
   - [ ] Banner verde: "✓ Producto actualizado correctamente"
   - [ ] Tabla se actualiza
   - [ ] Nuevo precio visible

---

### Paso 8: Probar cancelar
1. Click "+ Nuevo Producto"
2. Escribir datos
3. Click "Cancelar"
   - [ ] Modal se cierra
   - [ ] Cambios no se guardan
   - [ ] Tabla sin cambios

**O** presiona Escape
- [ ] Modal también se cierra con Escape

---

### Paso 9: Eliminar producto
1. Click en 🗑️ en una fila
2. Alert de confirmación
   - [ ] Mensaje: "¿Eliminar este producto?"
3. Click OK
   - [ ] Producto desaparece
   - [ ] Tabla se actualiza
4. Buscar en tabla
   - [ ] Producto no está

---

### Paso 10: Probar responsividad

**MOBILE (max-width: 768px)**

**Header**
- [ ] Título y botón apilados (vertical)
- [ ] Botón full-width

**Buscador**
- [ ] Input full-width

**Modal**
- [ ] Full-width con padding
- [ ] Título más pequeño
- [ ] Inputs en una columna (stack)
- [ ] Botones full-width en footer
- [ ] Scroll interno si es necesario

**Tabla**
- [ ] Scroll horizontal si es necesario
- [ ] Filas compactas pero legibles
- [ ] Acciones aún visibles

---

### Paso 11: Probar accesibilidad

**NAVEGACIÓN CON TECLADO**
1. Abre modal
2. Presiona Tab
   - [ ] Focus pasa por cada input en orden
   - [ ] Focus visible (outline azul)
   - [ ] Inputs en orden: SKU → Nombre → Unidad → Descripción → Precio → Stock → MinStock → Botones

3. Presiona Shift+Tab
   - [ ] Navega hacia atrás

4. Presiona Enter en un input
   - [ ] Pasa al siguiente (si es posible)

5. Presiona Escape en modal
   - [ ] Modal se cierra

6. Presiona Tab en tabla
   - [ ] Focus se ve en botones ✏️ 🗑️

**SCREEN READER (si tienes)**
- [ ] Labels se leen correctamente
- [ ] Asteriscos rojos se comunican
- [ ] Errores se leen
- [ ] Botones tienen aria-label

---

### Paso 12: Probar casos edge

**PRODUCTO SIN DESCRIPCIÓN**
1. Crear producto SIN descripción
2. Guardar
   - [ ] Se guarda correctamente
   - [ ] Campo vacío permitido (es opcional)

**PRODUCTO CON STOCK = 0**
1. Crear con Stock: 0
2. Guardar
   - [ ] En tabla: badge ROJO "Sin stock"

**PRODUCTO CON STOCK = MINSTOCK**
1. Crear con Stock: 5, MinStock: 5
2. En tabla
   - [ ] Badge NARANJA "Bajo stock" (porque stock <= minStock)

**PRECIO DECIMAL COMPLEJO**
1. Crear con Precio: 99.99
2. Editar a: 0.01
3. Blur
   - [ ] Se formatea a: 0.01

**STOCK METRO CON DECIMALES**
1. Crear con Unidad: METRO
2. Stock: 10.555
3. Blur
   - [ ] Se formatea a: 10.555 (hasta 3 decimales)

---

## 📊 Resultados Esperados

### Visual
- ✅ Tipografía grande (16-32px)
- ✅ Botones grandes (44-48px)
- ✅ Colores claros y diferenciados
- ✅ Espacios amplios y aireado
- ✅ Moderno y limpio

### Funcional
- ✅ Creación de productos
- ✅ Edición de productos
- ✅ Eliminación de productos
- ✅ Búsqueda funciona
- ✅ Validación en vivo
- ✅ Formateo automático
- ✅ Confirmación visual

### Técnico
- ✅ Sin errores en console
- ✅ TypeScript limpio
- ✅ Build exitosa
- ✅ Responsive funciona

---

## 🐛 Si Encuentras Errores

### Error: "ProductModal is not exported"
- [ ] Verifica que ProductModal.tsx exista
- [ ] Revisa imports en ProductosView.tsx

### Error: "productValidation is not found"
- [ ] Verifica que productValidation.ts exista
- [ ] Revisa imports en ProductModal.tsx

### Estilos no se aplican
- [ ] Verifica que CSS modules existan:
  - productos.module.css
  - productModal.module.css
- [ ] Revisa imports en componentes

### Validación no funciona
- [ ] Abre console (F12)
- [ ] Verifica que no hay errores JavaScript
- [ ] Intenta cambiar un campo (debe mostrar error si vacío)

### API request falla
- [ ] Verifica que backend está corriendo
- [ ] Revisa network tab en DevTools
- [ ] Confirma que /api/products existe

---

## 📝 Notas Finales

- El servidor debe estar en http://localhost:3001
- Si puerto 3000 está ocupado, Next.js usa 3001
- Build debe pasar sin errores (`npm run build`)
- Dev mode debe estar sin warnings en console
- Todos los archivos están en: `ui/pages/productos/`

¡Listo para usar! 🎉
