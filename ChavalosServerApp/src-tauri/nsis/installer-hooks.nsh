; Chavalos Server - NSIS Install Hook
; Mata TODOS los procesos que puedan bloquear archivos .node/.dll antes de actualizar

!macro CUSTOM_PRE_INSTALL
  ; === PASO 1: Cerrar la app Chavalos Server ===
  nsExec::ExecToLog 'taskkill /F /IM "Chavalos Server.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM "chavalos-server.exe" /T'
  
  ; === PASO 2: Matar Node.js (sidecar + genérico) ===
  ; Estos procesos bloquean bcrypt.node, prisma query_engine, etc.
  nsExec::ExecToLog 'taskkill /F /IM "node-x86_64-pc-windows-msvc.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM node.exe /T'
  
  ; === PASO 3: Matar por puerto 3000 via PowerShell ===
  nsExec::ExecToLog 'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"'
  
  ; === PASO 4: Esperar liberación de file handles (4 seg) ===
  Sleep 4000
  
  ; === PASO 5: Segundo barrido por si quedó algo ===
  nsExec::ExecToLog 'taskkill /F /IM "node-x86_64-pc-windows-msvc.exe" /T'
  nsExec::ExecToLog 'taskkill /F /IM node.exe /T'
  Sleep 1500
!macroend
