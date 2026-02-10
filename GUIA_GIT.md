# 🛠️ Guía Rápida de Git — Tienda Chavalos Virtual

> Referencia personal para commits, ramas, restauración y más.
> Todos los comandos se ejecutan desde la raíz del proyecto en PowerShell.

---

## 📌 Tabla de contenido

1. [Configuración inicial](#1-configuración-inicial)
2. [Commits (guardar cambios)](#2-commits-guardar-cambios)
3. [Ramas (branches)](#3-ramas-branches)
4. [Restaurar / deshacer cambios](#4-restaurar--deshacer-cambios)
5. [Stash (guardar cambios temporalmente)](#5-stash-guardar-cambios-temporalmente)
6. [Historial y logs](#6-historial-y-logs)
7. [Tags (versiones)](#7-tags-versiones)
8. [Remotos (GitHub / GitLab)](#8-remotos-github--gitlab)
9. [Flujo típico de trabajo](#9-flujo-típico-de-trabajo)
10. [Solución de problemas comunes](#10-solución-de-problemas-comunes)

---

## 1. Configuración inicial

```powershell
# Configurar nombre y email (una sola vez)
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"

# Ver configuración actual
git config --list

# Inicializar un repo nuevo (si no existe)
git init
```

---

## 2. Commits (guardar cambios)

### Ver estado actual
```powershell
git status                  # Muestra archivos modificados/nuevos/eliminados
git status -s               # Versión corta
```

### Agregar archivos al staging
```powershell
git add .                   # Agrega TODOS los cambios
git add archivo.ts          # Agrega un archivo específico
git add Frontend/           # Agrega toda una carpeta
git add *.ts                # Agrega todos los .ts
```

### Hacer commit
```powershell
git commit -m "feat: descripción corta del cambio"

# Agregar y commitear en un solo paso (solo archivos ya trackeados)
git commit -am "fix: corregir error en ventas"
```

### Convención de mensajes de commit (recomendada)
```
feat:     Nueva funcionalidad
fix:      Corrección de bug
docs:     Solo documentación
style:    Formato (no afecta lógica)
refactor: Reestructuración de código
test:     Agregar o modificar tests
chore:    Tareas de mantenimiento (scripts, config)
build:    Cambios en build/empaquetado
```

### Ejemplos reales para este proyecto
```powershell
git commit -m "feat: agregar módulo de ventas con PDF"
git commit -m "fix: corregir cálculo de precio total en carrito"
git commit -m "chore: actualizar prepare-installer.ps1 para v1.0.0"
git commit -m "docs: agregar guía de Git"
```

---

## 3. Ramas (branches)

### Ver ramas
```powershell
git branch                  # Ver ramas locales (* = rama actual)
git branch -a               # Ver locales + remotas
git branch -v               # Ver con último commit de cada rama
```

### Crear y cambiar de rama
```powershell
# Crear una rama nueva
git branch nombre-rama

# Cambiar a una rama
git checkout nombre-rama
# o (más moderno):
git switch nombre-rama

# Crear y cambiar en un solo paso
git checkout -b nombre-rama
# o:
git switch -c nombre-rama
```

### Ejemplos de nombres de rama
```powershell
git checkout -b feature/carrito-mejorado
git checkout -b fix/error-login
git checkout -b release/v1.1.0
git checkout -b hotfix/precio-negativo
```

### Fusionar ramas (merge)
```powershell
# Primero, ir a la rama destino (ej: main)
git checkout main

# Fusionar la otra rama
git merge feature/carrito-mejorado

# Si hay conflictos, resolverlos manualmente y luego:
git add .
git commit -m "merge: integrar carrito mejorado"
```

### Eliminar una rama
```powershell
git branch -d nombre-rama        # Eliminar rama ya fusionada
git branch -D nombre-rama        # Forzar eliminación (sin fusionar)
git push origin --delete nombre   # Eliminar rama remota
```

---

## 4. Restaurar / deshacer cambios

### ⚠️ CUIDADO: algunos comandos son irreversibles

### Descartar cambios en archivos (NO commiteados)
```powershell
# Descartar cambios en un archivo específico
git checkout -- archivo.ts
# o (más moderno):
git restore archivo.ts

# Descartar TODOS los cambios no commiteados
git restore .
```

### Quitar archivos del staging (después de git add)
```powershell
git reset HEAD archivo.ts
# o (más moderno):
git restore --staged archivo.ts

# Quitar todo del staging
git restore --staged .
```

### Deshacer el último commit (manteniendo los cambios)
```powershell
# Los archivos vuelven a staging
git reset --soft HEAD~1

# Los archivos vuelven a "modificados" (fuera de staging)
git reset --mixed HEAD~1       # Este es el default
git reset HEAD~1               # Equivalente
```

### Deshacer el último commit (ELIMINANDO cambios) ⚠️
```powershell
git reset --hard HEAD~1        # ¡¡IRREVERSIBLE!! Pierdes los cambios
```

### Modificar el último commit (ej: olvidaste un archivo)
```powershell
git add archivo-olvidado.ts
git commit --amend -m "feat: mensaje corregido"
# Esto REEMPLAZA el último commit, no crea uno nuevo
```

### Revertir un commit antiguo (crea un nuevo commit que deshace)
```powershell
git revert abc1234             # Usa el hash del commit
# Esto es SEGURO: no reescribe historial
```

---

## 5. Stash (guardar cambios temporalmente)

Útil cuando necesitas cambiar de rama pero no quieres hacer commit aún.

```powershell
# Guardar cambios actuales en el stash
git stash
git stash save "descripción de lo que estaba haciendo"

# Ver lista de stashes guardados
git stash list

# Recuperar el último stash (y eliminarlo del stash)
git stash pop

# Recuperar el último stash (manteniéndolo en la lista)
git stash apply

# Recuperar un stash específico
git stash apply stash@{2}

# Eliminar un stash
git stash drop stash@{0}

# Eliminar todos los stashes
git stash clear
```

### Ejemplo práctico
```powershell
# Estás trabajando en algo, pero necesitas cambiar a main urgente
git stash save "WIP: formulario de productos"
git checkout main
# ... haces lo urgente ...
git checkout feature/productos
git stash pop                  # Recuperas tu trabajo
```

---

## 6. Historial y logs

```powershell
# Ver historial de commits
git log

# Historial compacto (una línea por commit)
git log --oneline

# Historial con gráfico de ramas
git log --oneline --graph --all

# Historial bonito con colores
git log --oneline --graph --all --decorate

# Ver los últimos N commits
git log -5

# Ver qué cambió en un commit específico
git show abc1234

# Ver quién modificó cada línea de un archivo
git blame archivo.ts

# Ver diferencias entre working directory y último commit
git diff

# Ver diferencias del staging
git diff --staged
```

---

## 7. Tags (versiones)

```powershell
# Crear un tag (versión)
git tag v1.0.0
git tag -a v1.0.0 -m "Release versión 1.0.0 - Primera entrega"

# Ver tags
git tag
git tag -l "v1.*"             # Filtrar por patrón

# Ver info de un tag
git show v1.0.0

# Subir tags al remoto
git push origin v1.0.0        # Un tag específico
git push origin --tags         # Todos los tags

# Eliminar un tag
git tag -d v1.0.0              # Local
git push origin --delete v1.0.0  # Remoto
```

---

## 8. Remotos (GitHub / GitLab)

```powershell
# Ver remotos configurados
git remote -v

# Agregar un remoto
git remote add origin https://github.com/usuario/tienda-chavalos.git

# Subir cambios al remoto
git push origin main
git push -u origin main        # -u establece upstream (solo la primera vez)

# Bajar cambios del remoto
git pull origin main

# Clonar un repositorio
git clone https://github.com/usuario/tienda-chavalos.git
```

---

## 9. Flujo típico de trabajo

### Para una nueva funcionalidad:
```powershell
# 1. Asegurarte de estar en main actualizado
git checkout main
git pull origin main

# 2. Crear rama para la funcionalidad
git checkout -b feature/nueva-funcionalidad

# 3. Trabajar, hacer commits pequeños
git add .
git commit -m "feat: parte 1 de nueva funcionalidad"
# ... más trabajo ...
git add .
git commit -m "feat: completar nueva funcionalidad"

# 4. Volver a main y fusionar
git checkout main
git merge feature/nueva-funcionalidad

# 5. Subir a remoto
git push origin main

# 6. Eliminar la rama (ya no se necesita)
git branch -d feature/nueva-funcionalidad
```

### Para un hotfix urgente:
```powershell
git stash                      # Guardar trabajo actual si hay algo
git checkout main
git checkout -b hotfix/bug-critico
# ... arreglar el bug ...
git commit -am "fix: corregir bug crítico en checkout"
git checkout main
git merge hotfix/bug-critico
git push origin main
git branch -d hotfix/bug-critico
git checkout mi-rama-anterior
git stash pop                  # Recuperar trabajo previo
```

---

## 10. Solución de problemas comunes

### "Ya hice git add pero no quiero ese archivo"
```powershell
git restore --staged archivo.ts
```

### "Quiero deshacer todo y volver al último commit"
```powershell
git restore .                  # Descarta cambios en archivos
git clean -fd                  # Elimina archivos nuevos no trackeados
```

### "Tengo conflictos de merge"
```powershell
# 1. Abrir los archivos con conflictos (marcados con <<<<<<<)
# 2. Elegir qué código mantener
# 3. Guardar y:
git add .
git commit -m "merge: resolver conflictos"
```

### "Subí algo que no debía al repo"
```powershell
# Quitar del tracking sin borrar el archivo local
git rm --cached archivo-secreto.env
echo "archivo-secreto.env" >> .gitignore
git commit -m "chore: remover archivo sensible del tracking"
```

### "Quiero ver qué archivos ignora mi .gitignore"
```powershell
git status --ignored
git check-ignore -v *          # Muestra qué regla ignora cada archivo
```

### "Quiero limpiar archivos que el .gitignore ahora excluye"
```powershell
# Remover del cache de Git (sin borrar archivos locales)
git rm -r --cached .
git add .
git commit -m "chore: limpiar cache de Git según .gitignore actualizado"
```

---

## 📋 Cheat Sheet Express

| Acción                        | Comando                                  |
|-------------------------------|------------------------------------------|
| Ver estado                    | `git status`                             |
| Agregar todo                  | `git add .`                              |
| Commit                        | `git commit -m "mensaje"`                |
| Ver ramas                     | `git branch`                             |
| Crear rama                    | `git checkout -b nombre`                 |
| Cambiar rama                  | `git switch nombre`                      |
| Fusionar rama                 | `git merge nombre`                       |
| Deshacer cambios              | `git restore .`                          |
| Deshacer staging              | `git restore --staged .`                 |
| Deshacer último commit        | `git reset --soft HEAD~1`                |
| Guardar temporal              | `git stash`                              |
| Recuperar temporal            | `git stash pop`                          |
| Ver historial                 | `git log --oneline --graph --all`        |
| Crear tag                     | `git tag -a v1.0.0 -m "Release"`        |
| Subir a remoto                | `git push origin main`                   |

---

*Guía creada para el proyecto Tienda Chavalos Virtual — v1.0.0*
