# 💝 Instrucciones para Mamá - Chavalos Server

## 🎯 ¿Qué es esto?

Una aplicación que convierte el proyecto de la tienda en algo **SÚPER FÁCIL** de usar.

**Antes**: Abrir terminal, escribir comandos, esperar, rezar... 😰  
**Ahora**: Un solo clic y listo ✨

---

## 📥 Paso 1: Instalar la Aplicación

### ¿Dónde está el instalador?

Busca un archivo llamado:
```
Chavalos Server_1.0.0_x64_es-MX.msi
```

Lo encontrarás en:
- Una memoria USB que te pasó Aquiles
- En la carpeta de Descargas
- O en esta ubicación:
  ```
  D:\Aquiles\Tienda_Chavalos_Virtual_web\ChavalosServerApp\src-tauri\target\release\bundle\msi\
  ```

### Instalación (Solo 3 clicks)

1. **Doble clic** en el archivo `.msi`
2. Aparecerá una ventana de instalación:
   - Clic en **"Next"** (Siguiente)
   - Clic en **"Next"** otra vez
   - Clic en **"Install"** (Instalar)
3. Si aparece una ventana pidiendo permisos (UAC):
   - Clic en **"Sí"**

**¡Listo!** 🎉 La aplicación está instalada.

---

## 🚀 Paso 2: Primera Vez - Configuración

### Abrir la aplicación

Busca en el menú inicio de Windows:
- Escribe: **"Chavalos"**
- Aparecerá **"Chavalos Server"**
- Haz clic

O usa el acceso directo en el escritorio si lo creaste.

### Configurar la ruta del proyecto

**La primera vez que la abras**, necesitas decirle dónde está el proyecto:

1. En la ventana, busca arriba a la derecha un botón que dice **"⚙️ Configuración"**
2. Haz clic en él
3. Verás una pantalla con varios campos
4. Busca donde dice **"Ruta del Proyecto"**
5. Al lado hay un botón **"Buscar"** → haz clic
6. En la ventana que aparece, navega hasta:
   ```
   D:\Aquiles\Tienda_Chavalos_Virtual_web
   ```
   (Es la carpeta principal del proyecto)
7. Selecciónala y presiona **"Seleccionar carpeta"**
8. Verás que la ruta se llenó automáticamente
9. Presiona el botón verde **"Guardar"** abajo

**¡Perfecto!** 👏 Ya configuraste todo.

---

## 💚 Paso 3: Usar la Aplicación (Día a Día)

### Para Iniciar el Servidor

Es MUY simple:

1. **Abre la aplicación** (si no está abierta)
2. **Asegúrate de que Docker Desktop esté corriendo**:
   - Busca el ícono de Docker en la bandeja (abajo a la derecha)
   - Debe estar con luz verde
   - Si no: abre Docker Desktop desde el menú inicio
3. **Presiona el botón verde "Iniciar"** 🟢

### ¿Qué va a pasar?

Verás mensajes apareciendo en la pantalla:
```
✅ Docker está disponible
✅ PostgreSQL está listo
✅ IP LAN detectada: 192.168.1.10
✅ Servidor iniciado correctamente
```

**Espera entre 30 segundos y 1 minuto** (la primera vez puede tardar más).

### Cuando esté listo:

La ventana te mostrará:
- **URL Local**: `http://localhost:3000`
- **IP LAN**: Tu dirección IP local
- Un botón **"Abrir en navegador"**
- Un botón **"📱 QR"** para escanear desde el celular

**Presiona "Abrir en navegador"** y verás la página de la tienda 🛒

---

## 🛑 Para Detener el Servidor

Cuando termines de usarlo:

1. Presiona el botón rojo **"Detener"** 🔴
2. Espera unos segundos
3. Verás el mensaje: **"Servidor detenido"**

**¡Y listo!**

---

## 🔄 Para Reiniciar (si algo no funciona)

Si algo se traba o quieres reiniciar:

1. Presiona el botón naranja **"Reiniciar"** 🟠
2. Automáticamente se detiene y vuelve a iniciar

---

## 📱 Acceso desde el Celular

Cuando el servidor esté corriendo:

### Opción 1: Escanear QR
1. Presiona el botón **"📱 QR"**
2. Se abrirá una imagen con un código QR
3. Abre la cámara del celular
4. Escanea el código
5. Se abrirá la página automáticamente

### Opción 2: Escribir la URL
1. Anota la **"IP LAN"** que aparece en la ventana
   - Ejemplo: `192.168.1.10`
2. En tu celular, abre el navegador
3. Escribe: `http://192.168.1.10:3000`
4. Presiona Enter

**Importante**: El celular debe estar conectado a la misma red Wi-Fi que la computadora.

---

## 💡 Trucos y Consejos

### La aplicación siempre está en la bandeja

Cuando cierres la ventana con la X, **la aplicación NO se cierra completamente**.

Se va a la **bandeja del sistema** (abajo a la derecha, donde está el reloj).

**Para verla de nuevo:**
- Busca el ícono de Chavalos Server en la bandeja
- Haz clic y la ventana vuelve a aparecer

**Para cerrarla completamente:**
- Clic derecho en el ícono de la bandeja
- Selecciona **"Salir"**

### Si cierras la ventana, el servidor sigue funcionando

Esto es útil si quieres dejar el servidor corriendo sin tener la ventana abierta.

### Exportar los mensajes (logs)

Si algo no funciona y quieres mostrárselo a Aquiles:

1. Presiona el botón **"Exportar"** arriba del panel de mensajes
2. Elige dónde guardar el archivo
3. Envíaselo a Aquiles

---

## ❓ ¿Qué hacer si...?

### "Docker NO está disponible"

**Solución**:
1. Abre **Docker Desktop** desde el menú inicio
2. Espera a que el ícono de Docker en la bandeja esté **verde**
3. Intenta de nuevo en la aplicación

### "No se detectó IP LAN"

**Solución**:
- Verifica que estés conectada a Wi-Fi
- El servidor igual funcionará en la computadora (localhost)
- Solo no podrás acceder desde el celular

### "Error iniciando PostgreSQL"

**Solución**:
1. Presiona **"Detener"** en la aplicación
2. Abre Docker Desktop
3. Ve a la pestaña **"Containers"**
4. Si hay contenedores corriendo, detenlos
5. Vuelve a la aplicación y presiona **"Iniciar"**

### La aplicación no abre

**Solución**:
1. Busca en el Administrador de Tareas (Ctrl + Shift + Esc)
2. Si ves "Chavalos Server", ciérralo
3. Vuelve a abrir la aplicación

### "Script no encontrado"

**Solución**:
1. Ve a **⚙️ Configuración**
2. Verifica que la **"Ruta del Proyecto"** sea:
   ```
   D:\Aquiles\Tienda_Chavalos_Virtual_web
   ```
3. Si no, usa el botón **"Buscar"** para corregirla

---

## 🎓 Resumen Ultra Rápido

```
1. Abre "Chavalos Server"
2. Asegúrate que Docker esté verde
3. Presiona "Iniciar" 🟢
4. Espera 30-60 segundos
5. Presiona "Abrir en navegador" 🌐
6. ¡A trabajar! 🛒
7. Al terminar: "Detener" 🔴
```

---

## 📞 Si Tienes Dudas

**Llama/escribe a Aquiles** 😊

No te preocupes si algo no funciona a la primera, es normal. Con un par de veces ya le agarrarás el truco.

---

## ❤️ ¡Disfrútalo!

Esta aplicación fue hecha especialmente para que puedas manejar la tienda sin complicaciones.

**Recuerda**:
- ✅ Un clic para iniciar
- ✅ Un clic para detener
- ✅ Todo visual, nada de comandos
- ✅ Funciona en segundo plano

**¡Mucho éxito con la Ferretería Chavalos!** 🏪✨

---

_Con cariño, Aquiles 💙_
