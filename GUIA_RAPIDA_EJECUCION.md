# Guía rápida: Ejecutar Ferretería Chavalos en Linux

1. **Levantar la base de datos**
   ```bash
   cd /mnt/datos_win/Aquiles/Tienda_Chavalos_Virtual_web
   docker compose -f Despliegue/Hosting/postgres-local/docker-compose.yml up -d
   ```

2. **Restaurar respaldo**
   ```bash
   cd Base_de_datos/Respaldos
   bash restaurar.sh
   ```

3. **Instalar dependencias y preparar frontend**
   ```bash
   cd Frontend/NextJS_React/web
   npm install
   npm run prisma:generate
   npx prisma db push --schema=prisma/schema.prisma
   ```

4. **Ejecutar en segundo plano**
   ```bash
   nohup npm run dev > /tmp/ferreteria-dev.log 2>&1 &
   # Para ver logs: tail -f /tmp/ferreteria-dev.log
   ```

5. **Acceder a la web**
   - http://localhost:3000

---

**Detener el servidor:**
```bash
kill $(lsof -ti :3000)
```

**Tip:** Si usás tmux, podés reconectar a la terminal cuando quieras.
