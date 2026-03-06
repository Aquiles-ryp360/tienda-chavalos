# prepare-installer.v11.ps1
# ============================================
# Preparación de instalador MSI (Tauri v2)
# Estrategia: Full Node Sidecar (node.exe + backend optimizado)
# ============================================
# v11 changes:
# - Logging con timestamp + niveles
# - Runner unificado con heartbeat y logs por comando
# - Resolución robusta de npm/npx (npm.cmd o npm.ps1)
# - Reintentos de npm ci/install por EBUSY/EPERM/unlink
# - Robocopy con /TEE + robocopy.log y códigos 0..7 como OK
# - Prisma generate omitido por defecto en standalone
# - Obfuscator no interactivo con npx --yes
#
# v11 failsafe (basado en v5):
# - TIMEOUT en TODOS los comandos (BuildTimeoutSec, ToolTimeoutSec) — previene hang infinito
# - Ensure-PersistentConsole: si se lanza por doble-click, relanza con -NoExit
# - Stop-ProcessTreeSafe: NUNCA mata el proceso actual ni ancestros
# - Heartbeat visible: si no hay output por N segundos, imprime "(sigue ejecutándose...)"
# - Crash report con tail de TODOS los logs + pause interactivo (-NoPauseOnFail para CI)
# - Salida EN VIVO a consola (como v5) + logging simultáneo a archivo
# Optimizado para la estructura real del repo "Tienda_Chavalos_Virtual_web":
#   - Tauri:         .\ChavalosServerApp
#   - Backend Next:   .\Frontend\NextJS_React\web
#   - Prisma global:  .\Base_de_datos\Prisma
#   - Docker compose: .\Despliegue\Hosting\postgres-local\docker-compose.yml
#
# Mantiene robustez:
#   - Si no existen esas rutas, hace fallback a autodetección limitada (sin rastrear todo el repo si no hace falta).
#   - Idempotente: limpia destinos y staging antes de copiar.
#
# Requisitos: PowerShell, robocopy, node, npm (rustc opcional)
# Ofuscación: javascript-obfuscator accesible via npx (recomendado instalarlo en ChavalosServerApp devDependencies)
# ============================================

[CmdletBinding()]
param(
  [string]$TauriPath,
  [string]$BackendPath,
  [switch]$SkipObfuscation,
  [switch]$DevMode,
  [string]$NodeExePath,
  [switch]$SkipPrismaGenerate,
  [switch]$DisableFastPaths,  # si lo activas, ignora rutas sugeridas y fuerza autodetección
  [switch]$OptimizeSize,      # si lo activas, excluye archivos de desarrollo (mapas, .git, etc.)
  [ValidateRange(5, 600)][int]$HeartbeatSeconds = 20,
  [ValidateRange(60, 14400)][int]$BuildTimeoutSec = 3600,
  [ValidateRange(30, 7200)][int]$ToolTimeoutSec = 1800,
  [switch]$NoPauseOnFail
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:RepoRoot = $null
$script:LogsRoot = $null
$script:MainLogPath = $null
$script:NpmBackendCiLogPath = $null
$script:NpmBackendBuildLogPath = $null
$script:RobocopyLogPath = $null
$script:CrashReportPath = $null
$script:HeartbeatSeconds = $HeartbeatSeconds
$script:BuildTimeoutSec = $BuildTimeoutSec
$script:ToolTimeoutSec = $ToolTimeoutSec
$script:ProcessTempRoot = $null
$script:NpmCachePath = $null
$script:IsInteractive = [Environment]::UserInteractive

# -------------------------
# Anti-cierre de terminal (Failsafe)
# Evita que la ventana desaparezca al hacer doble-click sobre el script
# -------------------------
function Ensure-PersistentConsole {
  # Si ya fue relanzado, no hacer nada (evita loop infinito)
  if ($env:CHAVALOS_RELAUNCHED -eq '1') { return }

  $parentProcess = $null
  try {
    $ppid = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID" -ErrorAction SilentlyContinue).ParentProcessId
    if ($ppid) { $parentProcess = Get-Process -Id $ppid -ErrorAction SilentlyContinue }
  } catch {}

  $isTransient = $false
  if ($parentProcess) {
    $parentName = $parentProcess.ProcessName.ToLowerInvariant()
    # explorer.exe = doble-click, cmd = ventana transitoria
    if ($parentName -in @('explorer', 'cmd')) {
      $isTransient = $true
    }
  }

  if ($isTransient -and $PSCommandPath) {
    Write-Host "[FAILSAFE] Ventana transitoria detectada. Relanzando con -NoExit..." -ForegroundColor Yellow
    $env:CHAVALOS_RELAUNCHED = '1'
    $pwshExe = if (Get-Command pwsh -ErrorAction SilentlyContinue) { (Get-Command pwsh).Source } else { 'powershell.exe' }
    $scriptArgs = @('-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath)
    foreach ($key in $PSBoundParameters.Keys) {
      $val = $PSBoundParameters[$key]
      if ($val -is [switch]) { if ($val.IsPresent) { $scriptArgs += "-$key" } }
      else { $scriptArgs += @("-$key", "$val") }
    }
    Start-Process $pwshExe -ArgumentList $scriptArgs
    exit 0
  }
}
Ensure-PersistentConsole

# -------------------------
# Kill seguro (NUNCA mata al proceso actual ni ancestros)
# -------------------------
function Get-AncestorPids {
  $result = @($PID)
  try {
    $p = $PID
    for ($i = 0; $i -lt 10; $i++) {
      $parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$p" -ErrorAction SilentlyContinue).ParentProcessId
      if (-not $parent -or $parent -le 0 -or $parent -eq $p) { break }
      $result += $parent
      $p = $parent
    }
  } catch {}
  return $result
}

function Stop-ProcessTreeSafe {
  param(
    [Parameter(Mandatory = $true)][int]$ProcessId,
    [string]$Reason = "timeout"
  )
  if ($ProcessId -le 0) { return }

  $ancestors = Get-AncestorPids
  if ($ProcessId -in $ancestors) {
    Write-Warn "[KILL-SAFE] BLOQUEADO: PID $ProcessId es ancestro del proceso actual. NO se mata."
    return
  }

  $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if (-not $proc) { return }

  Write-Warn ("[KILL-SAFE] Matando PID {0} ({1}). Razón: {2}" -f $ProcessId, $proc.ProcessName, $Reason)

  # Matar hijos directos primero
  try {
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
      if ($child.ProcessId -in $ancestors) { continue }
      try {
        Write-Info ("[KILL-SAFE]   hijo PID {0} ({1})" -f $child.ProcessId, $child.Name)
        Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue
      } catch {}
    }
  } catch {}

  # Matar el proceso principal
  try { Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue } catch {}
}

function Ensure-Dir {
  param([string]$Path)
  if (-not [string]::IsNullOrWhiteSpace($Path) -and -not (Test-Path $Path)) {
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
  }
}

function Remove-DirSafe {
  param([string]$Path)
  if (-not [string]::IsNullOrWhiteSpace($Path) -and (Test-Path $Path)) {
    Remove-Item -Recurse -Force -Path $Path
  }
}

# -------------------------
# Logging helpers
# -------------------------
function Get-Stamp {
  return (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')
}

function Write-LogLine {
  param(
    [Parameter(Mandatory = $true)][string]$Level,
    [Parameter(Mandatory = $true)][string]$Text,
    [ConsoleColor]$Color = [ConsoleColor]::White
  )
  $line = "[{0}] [{1}] {2}" -f (Get-Stamp), $Level.ToUpperInvariant(), $Text
  Write-Host $line -ForegroundColor $Color
  if ($script:MainLogPath) {
    Add-Content -Path $script:MainLogPath -Value $line -Encoding UTF8
  }
}

function Write-Info  { param([string]$Text) Write-LogLine -Level 'INFO'  -Text $Text -Color ([ConsoleColor]::Cyan) }
function Write-Ok    { param([string]$Text) Write-LogLine -Level 'OK'    -Text $Text -Color ([ConsoleColor]::Green) }
function Write-Warn  { param([string]$Text) Write-LogLine -Level 'WARN'  -Text $Text -Color ([ConsoleColor]::Yellow) }
function Write-Fail  { param([string]$Text) Write-LogLine -Level 'FAIL'  -Text $Text -Color ([ConsoleColor]::Red) }
function Write-Phase { param([string]$Text) Write-LogLine -Level 'PHASE' -Text $Text -Color ([ConsoleColor]::Magenta) }

function Write-ToolLine {
  param(
    [Parameter(Mandatory = $true)][string]$Text,
    [string]$LogPath
  )
  Write-Host $Text
  if ($LogPath) {
    Add-Content -Path $LogPath -Value $Text -Encoding UTF8
  }
}

function Format-CommandPreview {
  param([string[]]$Arguments)
  if (-not $Arguments -or $Arguments.Count -eq 0) { return '' }
  $parts = foreach ($arg in $Arguments) {
    if ($null -eq $arg) { '""'; continue }
    $text = [string]$arg
    if ($text -match '\s|"') {
      '"' + ($text -replace '"', '\"') + '"'
    } else {
      $text
    }
  }
  return ($parts -join ' ')
}

function Convert-ToProcessArgumentString {
  param([string[]]$Arguments)

  if (-not $Arguments -or $Arguments.Count -eq 0) { return '' }

  $quoted = foreach ($arg in $Arguments) {
    if ($null -eq $arg -or $arg.Length -eq 0) {
      '""'
      continue
    }

    if ($arg -notmatch '[\s"]') {
      $arg
      continue
    }

    $builder = New-Object System.Text.StringBuilder
    [void]$builder.Append('"')
    $backslashes = 0

    foreach ($ch in $arg.ToCharArray()) {
      if ($ch -eq '\') {
        $backslashes++
        continue
      }

      if ($ch -eq '"') {
        [void]$builder.Append(('\' * ($backslashes * 2 + 1)))
        [void]$builder.Append('"')
        $backslashes = 0
        continue
      }

      if ($backslashes -gt 0) {
        [void]$builder.Append(('\' * $backslashes))
        $backslashes = 0
      }

      [void]$builder.Append($ch)
    }

    if ($backslashes -gt 0) {
      [void]$builder.Append(('\' * ($backslashes * 2)))
    }

    [void]$builder.Append('"')
    $builder.ToString()
  }

  return ($quoted -join ' ')
}

function Resolve-ToolCommand {
  param([Parameter(Mandatory = $true)][string]$ToolName)

  $normalized = $ToolName.ToLowerInvariant()
  if ($normalized -in @('npm', 'npx')) {
    $cmd = Get-Command ("$ToolName.cmd") -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd -and $cmd.Source) {
      return @{ FilePath = $cmd.Source; PrefixArgs = @(); ResolvedAs = "$ToolName.cmd" }
    }

    $ps1 = Get-Command ("$ToolName.ps1") -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($ps1 -and $ps1.Source) {
      $pwsh = Get-Command "pwsh" -ErrorAction SilentlyContinue | Select-Object -First 1
      if (-not $pwsh) { $pwsh = Get-Command "powershell.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 }
      if (-not $pwsh -or -not $pwsh.Source) {
        throw "Se encontró '$($ps1.Source)', pero no hay pwsh/powershell para ejecutarlo."
      }
      return @{
        FilePath   = $pwsh.Source
        PrefixArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $ps1.Source)
        ResolvedAs = "$ToolName.ps1 via pwsh"
      }
    }

    $generic = Get-Command $ToolName -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($generic -and $generic.Source) {
      return @{ FilePath = $generic.Source; PrefixArgs = @(); ResolvedAs = $generic.CommandType.ToString() }
    }

    $all = Get-Command $ToolName -All -ErrorAction SilentlyContinue |
      Select-Object CommandType, Name, Source |
      Format-Table -AutoSize |
      Out-String
    if ([string]::IsNullOrWhiteSpace($all)) { $all = '(sin resultados)' }

    Write-Fail "No se encontró '$ToolName' en PATH."
    Write-Warn "Diagnóstico Get-Command $ToolName -All:"
    foreach ($line in ($all -split "`r?`n")) {
      if (-not [string]::IsNullOrWhiteSpace($line)) {
        Write-Warn ("  " + $line.TrimEnd())
      }
    }
    throw "No se encontró '$ToolName'. Revisa PATH/nvm y el log para diagnóstico detallado."
  }

  $resolved = Get-Command $ToolName -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $resolved -or -not $resolved.Source) {
    throw "No se encontró '$ToolName' en PATH."
  }
  return @{ FilePath = $resolved.Source; PrefixArgs = @(); ResolvedAs = $resolved.CommandType.ToString() }
}

function Initialize-RunLogs {
  param([Parameter(Mandatory = $true)][string]$RepoRoot)

  $runStamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
  $logsBase = Join-Path (Join-Path $RepoRoot "logs") "prepare-installer"
  $script:LogsRoot = Join-Path $logsBase $runStamp
  Ensure-Dir $script:LogsRoot

  $script:MainLogPath = Join-Path $script:LogsRoot 'prepare-installer.log'
  $script:NpmBackendCiLogPath = Join-Path $script:LogsRoot 'npm-backend-ci.log'
  $script:NpmBackendBuildLogPath = Join-Path $script:LogsRoot 'npm-backend-build.log'
  $script:RobocopyLogPath = Join-Path $script:LogsRoot 'robocopy.log'
  $script:CrashReportPath = Join-Path $script:LogsRoot 'crash-report.txt'
  $script:ProcessTempRoot = Join-Path $script:LogsRoot 'runtime-tmp'
  $script:NpmCachePath = Join-Path $script:LogsRoot 'npm-cache'

  Ensure-Dir $script:ProcessTempRoot
  Ensure-Dir $script:NpmCachePath

  foreach ($f in @($script:MainLogPath, $script:NpmBackendCiLogPath, $script:NpmBackendBuildLogPath, $script:RobocopyLogPath)) {
    Set-Content -Path $f -Value ("[{0}] [INFO] log creado: {1}" -f (Get-Stamp), (Split-Path $f -Leaf)) -Encoding UTF8
  }
}

# -------------------------
# Command runner (stdout+stderr a consola+archivo con heartbeat)
# -------------------------
function Invoke-LoggedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Tool,
    [string[]]$Arguments = @(),
    [string]$WorkingDirectory,
    [string]$Title,
    [string]$LogPath,
    [int[]]$SuccessExitCodes = @(0),
    [int]$TimeoutSeconds = 0
  )

  if (-not $Title) {
    $Title = "$Tool $((Format-CommandPreview $Arguments).Trim())".Trim()
  }

  $resolved = Resolve-ToolCommand -ToolName $Tool
  $finalArgs = @()
  if ($resolved.PrefixArgs) { $finalArgs += [string[]]$resolved.PrefixArgs }
  if ($Arguments) { $finalArgs += [string[]]$Arguments }

  $preview = Format-CommandPreview $finalArgs
  Write-Phase $Title
  Write-Info ("Resolved {0}: {1} ({2})" -f $Tool, $resolved.FilePath, $resolved.ResolvedAs)
  Write-Info ("CMD: {0} {1}" -f $resolved.FilePath, $preview)
  if ($WorkingDirectory) { Write-Info ("CWD: " + $WorkingDirectory) }

  if ($LogPath) {
    Ensure-Dir (Split-Path $LogPath -Parent)
    Add-Content -Path $LogPath -Value ("[{0}] [INFO] START {1}" -f (Get-Stamp), $Title) -Encoding UTF8
  }

  $process = $null
  $queue = [System.Collections.Concurrent.ConcurrentQueue[string]]::new()
  $outputHandler = $null
  $errorHandler = $null

  $startedAt = Get-Date
  $lastHeartbeat = $startedAt
  $lastLine = ''
  $drainOutputQueue = {
    while ($true) {
      $line = $null
      if (-not $queue.TryDequeue([ref]$line)) { break }
      if ([string]::IsNullOrWhiteSpace($line)) { continue }
      $script:__tmpLastLine = $line
      Write-ToolLine -Text $line -LogPath $LogPath
    }
  }

  try {
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $resolved.FilePath
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $psi.WorkingDirectory = if ($WorkingDirectory) { $WorkingDirectory } else { (Get-Location).Path }

    if ($script:ProcessTempRoot) {
      Ensure-Dir $script:ProcessTempRoot
      $psi.EnvironmentVariables['TEMP'] = $script:ProcessTempRoot
      $psi.EnvironmentVariables['TMP'] = $script:ProcessTempRoot
    }

    $normalizedTool = $Tool.ToLowerInvariant()
    if (($normalizedTool -eq 'npm' -or $normalizedTool -eq 'npx') -and $script:NpmCachePath) {
      Ensure-Dir $script:NpmCachePath
      $psi.EnvironmentVariables['npm_config_cache'] = $script:NpmCachePath
      $psi.EnvironmentVariables['NPM_CONFIG_CACHE'] = $script:NpmCachePath
    }

    if ($psi.PSObject.Properties.Name -contains 'ArgumentList') {
      foreach ($arg in $finalArgs) {
        [void]$psi.ArgumentList.Add([string]$arg)
      }
    } else {
      $psi.Arguments = Convert-ToProcessArgumentString -Arguments $finalArgs
    }

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $psi
    $process.EnableRaisingEvents = $true

    # NOTA: NO usar ScriptBlocks como DataReceivedEventHandler
    # porque se ejecutan en threads del ThreadPool sin Runspace de PowerShell
    # y causan "There is no Runspace available to run scripts in this thread".
    # Register-ObjectEvent crea su propio Runspace y es thread-safe.
    $outputEvent = $null
    $errorEvent = $null

    if (-not $process.Start()) {
      throw "No se pudo iniciar el proceso '$($resolved.FilePath)'."
    }

    $outputEvent = Register-ObjectEvent -InputObject $process -EventName OutputDataReceived -MessageData $queue -Action {
      if ($null -ne $EventArgs.Data) {
        $Event.MessageData.Enqueue([string]$EventArgs.Data)
      }
    }
    $errorEvent = Register-ObjectEvent -InputObject $process -EventName ErrorDataReceived -MessageData $queue -Action {
      if ($null -ne $EventArgs.Data) {
        $Event.MessageData.Enqueue([string]$EventArgs.Data)
      }
    }

    $process.BeginOutputReadLine()
    $process.BeginErrorReadLine()

    if ($TimeoutSeconds -gt 0) {
      Write-Info ("Timeout configurado: {0}s" -f $TimeoutSeconds)
    }

    $timedOut = $false
    while (-not $process.HasExited) {
      $script:__tmpLastLine = $lastLine

      & $drainOutputQueue

      $lastLine = $script:__tmpLastLine

      $now = Get-Date
      $elapsed = [int]($now - $startedAt).TotalSeconds

      # --- TIMEOUT CHECK ---
      if ($TimeoutSeconds -gt 0 -and $elapsed -ge $TimeoutSeconds) {
        Write-Host ""
        Write-Host "  ╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Yellow
        Write-Host "  ║  TIEMPO LÍMITE ALCANZADO                                    ║" -ForegroundColor Yellow
        Write-Host "  ╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Yellow
        Write-Host ("  ║  Tarea: {0}" -f $Title).PadRight(63) + "║" -ForegroundColor Yellow
        Write-Host ("  ║  Tiempo transcurrido: {0}s ({1:N1} min)" -f $elapsed, ($elapsed/60)).PadRight(63) + "║" -ForegroundColor Yellow
        Write-Host "  ╠══════════════════════════════════════════════════════════════╣" -ForegroundColor Yellow
        Write-Host "  ║  [S] Seguir esperando (+15 min)                             ║" -ForegroundColor Cyan
        Write-Host "  ║  [C] Cancelar este proceso                                  ║" -ForegroundColor Red
        Write-Host "  ╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Yellow
        Write-Host ""

        $decision = $null
        while ($decision -ne 'S' -and $decision -ne 'C') {
          $decision = (Read-Host "  ¿Seguir o Cancelar? (S/C)").Trim().ToUpper()
        }

        if ($decision -eq 'S') {
          $TimeoutSeconds += 900  # +15 minutos
          Write-Ok ("Extendido: nuevo límite = {0}s ({1:N0} min). Continuando..." -f $TimeoutSeconds, ($TimeoutSeconds/60))
          continue
        }

        # Cancelar
        $timedOut = $true
        Write-Fail ("[CANCELADO] '{0}' cancelado por el usuario tras {1}s. Matando proceso PID {2}..." -f $Title, $elapsed, $process.Id)
        Stop-ProcessTreeSafe -ProcessId $process.Id -Reason ("cancelado por usuario tras {0}s en '{1}'" -f $elapsed, $Title)
        Start-Sleep -Milliseconds 500
        if (-not $process.HasExited) {
          try { $process.Kill() } catch {}
        }
        break
      }

      # --- HEARTBEAT ---
      if ($script:HeartbeatSeconds -gt 0 -and ($now - $lastHeartbeat).TotalSeconds -ge $script:HeartbeatSeconds) {
        $lastPreview = if ($lastLine) { $lastLine } else { '(sin salida aun)' }
        Write-Info ("(sigue ejecutándose...) {0} | t={1}s | last={2}" -f $Title, $elapsed, $lastPreview)
        $lastHeartbeat = $now
      }

      Start-Sleep -Milliseconds 250
    }

    if (-not $timedOut) {
      $process.WaitForExit()
    }

    $script:__tmpLastLine = $lastLine
    & $drainOutputQueue
    $lastLine = $script:__tmpLastLine

    # --- HANDLE TIMEOUT ---
    if ($timedOut) {
      $tailText = ''
      if ($LogPath -and (Test-Path $LogPath)) {
        Write-Fail ("Log del proceso: " + $LogPath)
        Write-Fail "--- Últimas 80 líneas del log ---"
        Get-Content -Path $LogPath -Tail 80 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ -ForegroundColor DarkGray }
        $tailText = "`nComando: $($resolved.FilePath) $preview"
      }
      throw ("[TIMEOUT] '{0}' excedió {1}s.{2}" -f $Title, $TimeoutSeconds, $tailText)
    }

    $exitCode = [int]$process.ExitCode
    if ([string]::IsNullOrWhiteSpace($lastLine) -and $LogPath -and (Test-Path $LogPath)) {
      $tail = (Get-Content -Path $LogPath -Tail 20 -ErrorAction SilentlyContinue) -join " | "
      if ($tail) { $lastLine = $tail }
    }

    if ($SuccessExitCodes -notcontains $exitCode) {
      # --- MOSTRAR TAIL DEL LOG Y COMANDO FALLIDO ---
      if ($LogPath -and (Test-Path $LogPath)) {
        Write-Fail ("--- Últimas 80 líneas del log ({0}) ---" -f $LogPath)
        Get-Content -Path $LogPath -Tail 80 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ -ForegroundColor DarkGray }
        Write-Fail ("Comando fallido: {0} {1}" -f $resolved.FilePath, $preview)
        Write-Warn "Sugerencia: abre el log completo y busca ERROR o WARN"
      }
      throw "Falló '$Title' con código $exitCode. Última línea: $lastLine"
    }

    if ($LogPath) {
      Add-Content -Path $LogPath -Value ("[{0}] [OK] END {1} (exit={2}, t={3}s)" -f (Get-Stamp), $Title, $exitCode, ([int]((Get-Date) - $startedAt).TotalSeconds)) -Encoding UTF8
    }
    Write-Ok ("$Title OK (exit=$exitCode, t=$([int]((Get-Date) - $startedAt).TotalSeconds)s)")
    return $exitCode
  }
  finally {
    if ($outputEvent) { try { Unregister-Event -SourceIdentifier $outputEvent.Name -ErrorAction SilentlyContinue } catch {} }
    if ($errorEvent) { try { Unregister-Event -SourceIdentifier $errorEvent.Name -ErrorAction SilentlyContinue } catch {} }
    if ($process) {
      try { $process.CancelOutputRead() } catch {}
      try { $process.CancelErrorRead() } catch {}
      if (-not $process.HasExited) {
        Stop-ProcessTreeSafe -ProcessId $process.Id -Reason "cleanup finally"
        if (-not $process.HasExited) { try { $process.Kill() } catch {} }
      }
      $process.Dispose()
    }
  }
}

function Exec-Command {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [string[]]$Arguments = @(),
    [string]$WorkingDirectory,
    [string]$Title,
    [string]$LogPath,
    [int[]]$SuccessExitCodes = @(0),
    [int]$TimeoutSeconds = 0
  )
  Invoke-LoggedCommand -Tool $Command -Arguments $Arguments -WorkingDirectory $WorkingDirectory -Title $Title -LogPath $LogPath -SuccessExitCodes $SuccessExitCodes -TimeoutSeconds $TimeoutSeconds
}

function Stop-RepoNodeProcesses {
  param([Parameter(Mandatory=$true)][string]$RepoRoot)

  if ([string]::IsNullOrWhiteSpace($RepoRoot)) { return }

  try {
    $needle = $RepoRoot.ToLowerInvariant()
    if ($needle.Length -lt 3) { return }

    $procs = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.CommandLine -and ($_.CommandLine.ToLowerInvariant().Contains($needle)) }
    $killed = 0
    foreach ($p in $procs) {
      try {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        $killed++
      } catch {}
    }
    if ($killed -gt 0) {
      Write-Warn ("Procesos node.exe cerrados en repo: " + $killed)
    }
  } catch {}
}

function Get-NpmLockedPathsFromText {
  param([string]$Text)

  $paths = New-Object System.Collections.Generic.List[string]
  if ([string]::IsNullOrWhiteSpace($Text)) { return @() }

  $patterns = @(
    "unlink '(?<p>[A-Za-z]:\\[^']+)'",
    "path (?<p>[A-Za-z]:\\[^`r`n]+)"
  )

  foreach ($pattern in $patterns) {
    $matches = [regex]::Matches($Text, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach ($m in $matches) {
      $p = $m.Groups['p'].Value.Trim()
      if (-not [string]::IsNullOrWhiteSpace($p) -and -not $paths.Contains($p)) {
        $paths.Add($p)
      }
    }
  }

  return $paths.ToArray()
}

function Invoke-NpmRetryCleanup {
  param(
    [string]$WorkingDirectory,
    [string[]]$LockedPaths = @()
  )

  if ([string]::IsNullOrWhiteSpace($WorkingDirectory) -or -not (Test-Path $WorkingDirectory)) {
    return
  }

  foreach ($lockedPath in $LockedPaths) {
    try {
      if (Test-Path -LiteralPath $lockedPath) {
        try {
          [System.IO.File]::SetAttributes($lockedPath, [System.IO.FileAttributes]::Normal)
        } catch {}
        Write-Warn ("Lock detectado en: " + $lockedPath)
      }
    } catch {}
  }

  $nodeModules = Join-Path $WorkingDirectory "node_modules"
  if (Test-Path $nodeModules) {
    try {
      Remove-Item -LiteralPath $nodeModules -Recurse -Force -ErrorAction Stop
      Write-Info ("Cleanup npm retry: eliminado " + $nodeModules)
    } catch {
      Write-Warn ("Cleanup npm retry: no se pudo eliminar node_modules en primer intento: " + $_.Exception.Message)
      try {
        cmd /c "rmdir /s /q `"$nodeModules`""
        if ($LASTEXITCODE -eq 0 -and -not (Test-Path $nodeModules)) {
          Write-Info ("Cleanup npm retry: eliminado por rmdir " + $nodeModules)
        } else {
          Write-Warn ("Cleanup npm retry: node_modules sigue presente en " + $nodeModules)
        }
      } catch {
        Write-Warn ("Cleanup npm retry: fallo rmdir: " + $_.Exception.Message)
      }
    }
  }
}

function Exec-Command-Retry {
  param(
    [Parameter(Mandatory=$true)][string]$Command,
    [Parameter(Mandatory=$true)][string[]]$Arguments,
    [int]$Retries = 4,
    [string]$WorkingDirectory,
    [string]$Title,
    [string]$LogPath,
    [int[]]$SuccessExitCodes = @(0),
    [int]$TimeoutSeconds = 0,
    [string[]]$RetryText = @('EBUSY', 'resource busy or locked', 'EPERM', 'unlink', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'network', 'socket hang up', 'fetch failed')
  )

  for ($attempt = 1; $attempt -le ($Retries + 1); $attempt++) {
    try {
      Exec-Command -Command $Command -Arguments $Arguments -WorkingDirectory $WorkingDirectory -Title $Title -LogPath $LogPath -SuccessExitCodes $SuccessExitCodes -TimeoutSeconds $TimeoutSeconds | Out-Null
      return
    } catch {
      $msg = ($_ | Out-String)
      if ($LogPath -and (Test-Path $LogPath)) {
        $tail = (Get-Content -Path $LogPath -Tail 80 -ErrorAction SilentlyContinue) -join "`n"
        if ($tail) { $msg = $msg + "`n" + $tail }
      }

      $shouldRetry = $false
      $matchedPattern = ''
      foreach ($t in $RetryText) {
        if ($msg -match [regex]::Escape($t)) {
          $shouldRetry = $true
          $matchedPattern = $t
          break
        }
      }

      if ($shouldRetry -and ($attempt -le $Retries)) {
        $networkPatterns = @('ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'network', 'socket hang up', 'fetch failed')
        $isNetworkError = $matchedPattern -in $networkPatterns
        $delay = if ($isNetworkError) { 5 * $attempt } else { 2 * $attempt }
        $reason = if ($isNetworkError) { "error de red ($matchedPattern)" } else { "bloqueo de archivos ($matchedPattern)" }
        Write-Warn "Reintentando '$Command' por $reason (retry $attempt/$Retries) en ${delay}s..."

        if (-not $isNetworkError) {
          Stop-RepoNodeProcesses -RepoRoot $script:RepoRoot
        }

        $normalizedCommand = $Command.ToLowerInvariant()
        $isNpmInstallFlow = $normalizedCommand -eq 'npm' -and ($Arguments -contains 'ci' -or $Arguments -contains 'install')
        if ($isNpmInstallFlow) {
          $lockedPaths = Get-NpmLockedPathsFromText -Text $msg
          Invoke-NpmRetryCleanup -WorkingDirectory $WorkingDirectory -LockedPaths $lockedPaths
        }

        Start-Sleep -Seconds $delay
        continue
      }
      throw
    }
  }
}
# -------------------------
# Robocopy wrapper (0..7 OK, >=8 error)
# -------------------------
function Robocopy-Mirror {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [string[]]$ExcludeDirs = @(),
    [string[]]$ExcludeFiles = @(),
    [string[]]$ExtraArgs = @()
  )

  Ensure-Dir $Destination

  $args = @(
    $Source, $Destination,
    "/MIR",
    "/R:2", "/W:2", "/MT:4", "/NP"
  )

  if ($script:RobocopyLogPath) {
    $args += ("/LOG+:{0}" -f $script:RobocopyLogPath)
    $args += "/TEE"
  }

  if ($null -ne $ExcludeDirs -and $ExcludeDirs.Count -gt 0) { $args += "/XD"; $args += $ExcludeDirs }
  if ($null -ne $ExcludeFiles -and $ExcludeFiles.Count -gt 0) { $args += "/XF"; $args += $ExcludeFiles }
  if ($null -ne $ExtraArgs -and $ExtraArgs.Count -gt 0) { $args += $ExtraArgs }

  $title = "robocopy " + (Split-Path $Source -Leaf) + " -> " + (Split-Path $Destination -Leaf)
  $code = Invoke-LoggedCommand -Tool "robocopy" -Arguments $args -Title $title -LogPath $script:RobocopyLogPath -SuccessExitCodes @(0,1,2,3,4,5,6,7) -TimeoutSeconds $script:ToolTimeoutSec
  if ($code -ge 8) { throw "robocopy falló ($code) de '$Source' a '$Destination'" }
  return $code
}

# -------------------------
# Detection helpers (limitados)
# -------------------------
function Find-RepoRoot {
  param([string]$StartPath)
  $current = (Resolve-Path $StartPath).Path
  while ($true) {
    if (Test-Path (Join-Path $current ".git")) { return $current }
    $parent = Split-Path $current -Parent
    if ([string]::IsNullOrEmpty($parent) -or $parent -eq $current) { return $null }
    $current = $parent
  }
}

function Find-TauriPathFast {
  param([string]$RepoRoot)
  $candidate = Join-Path $RepoRoot "ChavalosServerApp"
  if (Test-Path (Join-Path $candidate "src-tauri\tauri.conf.json")) { return $candidate }
  return $null
}

function Find-BackendPathFast {
  param([string]$RepoRoot)
  $candidate = Join-Path $RepoRoot "Frontend\NextJS_React\web"
  if (Test-Path (Join-Path $candidate "package.json")) { return $candidate }
  return $null
}

function Find-DockerComposeFast {
  param([string]$RepoRoot)
  $candidate = Join-Path $RepoRoot "Despliegue\Hosting\postgres-local\docker-compose.yml"
  if (Test-Path $candidate) { return $candidate }
  return $null
}

function Find-PrismaGlobalFast {
  param([string]$RepoRoot)
  $candidate = Join-Path $RepoRoot "Base_de_datos\Prisma"
  if (Test-Path (Join-Path $candidate "schema.prisma")) { return $candidate }
  return $null
}

function Find-TauriPathFallback {
  param([string]$RepoRoot, [string]$Provided)

  if ($Provided) {
    $full = (Resolve-Path $Provided -ErrorAction Stop).Path
    if (Test-Path (Join-Path $full "src-tauri\tauri.conf.json")) { return $full }
    if ((Split-Path $full -Leaf) -eq "src-tauri" -and (Test-Path (Join-Path $full "tauri.conf.json"))) { return (Split-Path $full -Parent) }
    throw "No se encontró tauri.conf.json en '$Provided'. Pasa la raíz del proyecto Tauri o la carpeta src-tauri."
  }

  # Fallback limitado: busca tauri.conf.json sin node_modules/target/.git
  $hits = Get-ChildItem -Path $RepoRoot -Filter "tauri.conf.json" -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\|\\target\\|\\.git\\' -and $_.FullName -match '\\src-tauri\\' }

  if (-not $hits) { throw "No se encontró tauri.conf.json bajo src-tauri. Indica la ruta con -TauriPath." }

  $ranked = $hits | Sort-Object { $_.FullName.Split([IO.Path]::DirectorySeparatorChar).Count }
  if ($ranked.Count -gt 1) {
    Write-Warn "Múltiples proyectos Tauri detectados (tomando el más cercano al repo root):"
    $ranked | Select-Object -First 5 | ForEach-Object { Write-Warn (" - " + $_.Directory.FullName) }
  }
  return (Split-Path $ranked[0].Directory.FullName -Parent)
}

function Test-PackageLooksLikeNext {
  param([string]$PackageJsonPath)
  try { $json = Get-Content -Raw $PackageJsonPath | ConvertFrom-Json } catch { return $false }
  $dir = Split-Path $PackageJsonPath -Parent

  $hasNextDep = $false
  if ($null -ne $json.dependencies -and $json.dependencies.PSObject.Properties.Name -contains "next") { $hasNextDep = $true }
  if (-not $hasNextDep -and $null -ne $json.devDependencies -and $json.devDependencies.PSObject.Properties.Name -contains "next") { $hasNextDep = $true }

  $hasConfig = (Test-Path (Join-Path $dir "next.config.js")) -or (Test-Path (Join-Path $dir "next.config.mjs")) -or (Test-Path (Join-Path $dir "next.config.ts"))
  $hasBuild  = ($null -ne $json.scripts -and $json.scripts.PSObject.Properties.Name -contains "build")

  return (($hasNextDep -or $hasConfig) -and $hasBuild)
}

function Find-BackendPathFallback {
  param([string]$RepoRoot, [string]$Provided)

  if ($Provided) {
    $full = (Resolve-Path $Provided -ErrorAction Stop).Path
    $pkg  = Join-Path $full "package.json"
    if (-not (Test-Path $pkg)) { throw "BackendPath no contiene package.json: '$full'" }
    if (-not (Test-PackageLooksLikeNext $pkg)) { throw "El backend provisto no parece Next.js válido en '$full'." }
    return $full
  }

  # Fallback limitado: solo busca dentro de Frontend\ y bundle\ si existen (evita rastrear todo el repo)
  $rootsToScan = @()
  $r1 = Join-Path $RepoRoot "Frontend"
  $r2 = Join-Path $RepoRoot "bundle"
  if (Test-Path $r1) { $rootsToScan += $r1 }
  if (Test-Path $r2) { $rootsToScan += $r2 }
  if ($rootsToScan.Count -eq 0) { $rootsToScan = @($RepoRoot) }

  $candidates = @()
  foreach ($root in $rootsToScan) {
    $packages = Get-ChildItem -Path $root -Filter "package.json" -File -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -notmatch '\\node_modules\\|\\.git\\|\\dist\\|\\build\\|\\target\\|\\.next\\' }
    foreach ($pkg in $packages) {
      if (Test-PackageLooksLikeNext $pkg.FullName) {
        $candidates += $pkg.Directory.FullName
      }
    }
  }
  $candidates = $candidates | Select-Object -Unique
  if (-not $candidates) { throw "No se detectó backend Next.js. Indica la ruta con -BackendPath." }

  # Heurística simple para tu repo:
  $preferred = $candidates | Where-Object { $_.ToLowerInvariant() -like "*nextjs_react*" -or $_.ToLowerInvariant() -like "*web*" } | Select-Object -First 1
  if ($preferred) { return $preferred }
  return $candidates[0]
}

function Get-RustHostTriple {
  $rust = & rustc -vV 2>$null
  if ($LASTEXITCODE -eq 0 -and $rust) {
    $hostLine = $rust | Where-Object { $_ -like "host:*" } | Select-Object -First 1
    if ($hostLine) {
      $triple = ($hostLine -replace "host:\s*", "").Trim()
      if ($triple) { return $triple }
    }
  }
  if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { return "aarch64-pc-windows-msvc" }
  return "x86_64-pc-windows-msvc"
}

function Measure-DirSizeMB {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return 0 }
  $size = (Get-ChildItem -Path $Path -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
  return [math]::Round(($size / 1MB), 2)
}

# -------------------------
# Prisma helpers
# -------------------------
function Copy-PrismaTo {
  param([string]$SourcePrismaDir, [string]$DestPrismaDir)
  Remove-DirSafe $DestPrismaDir
    $null = Robocopy-Mirror $SourcePrismaDir $DestPrismaDir -ExcludeDirs @(".git","node_modules",".vscode","coverage","dist","build","target") -ExcludeFiles @("*.map")
}

# -------------------------
# Ofuscación (solo JS propio; NO .next / NO node_modules)
# En tu repo casi todo es TS/TSX; esto suele encontrar 0 archivos y se omitirá (normal).
# -------------------------
# OPTIMIZACION v11: Usa la API de Node.js directamente en vez de npx CLI.
#   npx --yes javascript-obfuscator tarda MINUTOS por download/resolve.
#   Node.js API: ~2-5 segundos para un server.js de 6KB.
#   Cadena de fallbacks: 1) node API local  2) bin local  3) npx (con timeout 60s)
# -------------------------
function Obfuscate-Staging {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)][string]$StagingRoot,
        [switch]$RequireObfuscation,
        [switch]$HardObfuscation
    )

    $serverJs = Join-Path $StagingRoot "server.js"
    if (-not (Test-Path $serverJs)) {
        Write-Info "Obfuscation: no se encontró server.js en staging (nada que ofuscar)."
        return
    }

    $fileSizeKB = [math]::Round((Get-Item $serverJs).Length / 1KB, 1)
    Write-Info ("Obfuscation: server.js encontrado ({0} KB)" -f $fileSizeKB)

    $tmpRoot = if ($script:ProcessTempRoot) { $script:ProcessTempRoot } else { $env:TEMP }
    Ensure-Dir $tmpRoot
    $tmp = Join-Path $tmpRoot ("chavalos_obf_" + [Guid]::NewGuid().ToString("N") + ".js")

    # --- Opciones de ofuscación ---
    $optsSafe = @{
        target = 'node'
        compact = $true
        stringArray = $true
        stringArrayThreshold = 0.75
    }
    if ($HardObfuscation) {
        $optsSafe['controlFlowFlattening'] = $true
        $optsSafe['controlFlowFlatteningThreshold'] = 0.5
        $optsSafe['deadCodeInjection'] = $true
        $optsSafe['deadCodeInjectionThreshold'] = 0.2
        $optsSafe['renameGlobals'] = $true
    }
    $optsJson = ($optsSafe | ConvertTo-Json -Compress)

    # --- Buscar javascript-obfuscator como módulo de Node ---
    $obfModulePaths = @()
    # 1. ChavalosServerApp/node_modules (donde está instalado)
    $tauriNM = Join-Path $script:RepoRoot "ChavalosServerApp\node_modules\javascript-obfuscator"
    if (Test-Path (Join-Path $tauriNM "index.js")) { $obfModulePaths += $tauriNM }
    # 2. Backend node_modules
    $backendNM = Join-Path $StagingRoot "node_modules\javascript-obfuscator"
    if (Test-Path (Join-Path $backendNM "index.js")) { $obfModulePaths += $backendNM }

    # --- Buscar bin local ---
    $obfBinPaths = @()
    $tauriBin = Join-Path $script:RepoRoot "ChavalosServerApp\node_modules\.bin\javascript-obfuscator.cmd"
    if (Test-Path $tauriBin) { $obfBinPaths += $tauriBin }

    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    $obfuscated = $false

    # =============================================
    # INTENTO 1: Node.js API directa (MAS RAPIDO, ~2-5s)
    # Evita todo el overhead de npx/CLI/cmd wrapper
    # =============================================
    if ($nodeCmd -and $obfModulePaths.Count -gt 0) {
        foreach ($modPath in $obfModulePaths) {
            Write-Info ("Obfuscation intento: Node.js API desde '{0}'" -f $modPath)

            # Escapar rutas para JS
            $jsServerPath = $serverJs.Replace('\', '\\')
            $jsOutputPath = $tmp.Replace('\', '\\')
            $jsModulePath = $modPath.Replace('\', '\\')

            $jsScript = @"
const fs = require('fs');
try {
  const JavaScriptObfuscator = require('$jsModulePath');
  const code = fs.readFileSync('$jsServerPath', 'utf8');
  const opts = $optsJson;
  const result = JavaScriptObfuscator.obfuscate(code, opts);
  fs.writeFileSync('$jsOutputPath', result.getObfuscatedCode(), 'utf8');
  console.log('OK: obfuscated ' + code.length + ' -> ' + result.getObfuscatedCode().length + ' bytes');
  process.exit(0);
} catch(e) {
  console.error('FAIL: ' + e.message);
  process.exit(1);
}
"@
            $jsFile = Join-Path $tmpRoot ("chavalos_obf_script_" + [Guid]::NewGuid().ToString("N") + ".js")
            Set-Content -Path $jsFile -Value $jsScript -Encoding UTF8

            try {
                $sw = [System.Diagnostics.Stopwatch]::StartNew()
                Exec-Command -Command "node" -Arguments @($jsFile) -WorkingDirectory $StagingRoot -Title "obfuscation (Node API)" -LogPath $script:MainLogPath -TimeoutSeconds $script:ToolTimeoutSec | Out-Null
                $sw.Stop()
                Write-Info ("Obfuscation via Node API: {0}ms" -f $sw.ElapsedMilliseconds)

                if (Test-Path $tmp) {
                    Copy-Item -Force $tmp $serverJs
                    Remove-Item -Force $tmp -ErrorAction SilentlyContinue
                    Remove-Item -Force $jsFile -ErrorAction SilentlyContinue
                    Write-Ok ("Obfuscation: server.js ofuscado correctamente ({0} KB, {1}ms)" -f $fileSizeKB, $sw.ElapsedMilliseconds)
                    $obfuscated = $true
                    return
                }
            } catch {
                Write-Warn ("Obfuscation Node API falló: {0}" -f $_.Exception.Message)
            }
            Remove-Item -Force $jsFile -ErrorAction SilentlyContinue
        }
    }

    # =============================================
    # INTENTO 2: Bin local directo (sin npx, ~5-15s)
    # =============================================
    if (-not $obfuscated -and $obfBinPaths.Count -gt 0) {
        foreach ($binPath in $obfBinPaths) {
            Write-Info ("Obfuscation intento: bin local '{0}'" -f $binPath)

            $cliArgs = @($serverJs, "--output", $tmp, "--target", "node", "--compact", "true", "--string-array", "true", "--string-array-threshold", "0.75")
            if ($HardObfuscation) {
                $cliArgs += @("--control-flow-flattening", "true", "--control-flow-flattening-threshold", "0.5",
                              "--dead-code-injection", "true", "--dead-code-injection-threshold", "0.2",
                              "--rename-globals", "true")
            }

            try {
                $sw = [System.Diagnostics.Stopwatch]::StartNew()
                Exec-Command -Command $binPath -Arguments $cliArgs -WorkingDirectory $StagingRoot -Title "obfuscation (local bin)" -LogPath $script:MainLogPath -TimeoutSeconds $script:ToolTimeoutSec | Out-Null
                $sw.Stop()

                if (Test-Path $tmp) {
                    Copy-Item -Force $tmp $serverJs
                    Remove-Item -Force $tmp -ErrorAction SilentlyContinue
                    Write-Ok ("Obfuscation: server.js ofuscado (bin local, {0}ms)" -f $sw.ElapsedMilliseconds)
                    $obfuscated = $true
                    return
                }
            } catch {
                Write-Warn ("Obfuscation bin local falló: {0}" -f $_.Exception.Message)
            }
        }
    }

    # =============================================
    # INTENTO 3: npx como último recurso (timeout 60s)
    # =============================================
    if (-not $obfuscated) {
        Write-Warn ("Obfuscation: intentando npx como fallback (timeout {0}s)..." -f $script:ToolTimeoutSec)

        $npxArgs = @("--yes", "javascript-obfuscator", $serverJs, "--output", $tmp,
                     "--target", "node", "--compact", "true",
                     "--string-array", "true", "--string-array-threshold", "0.75")

        try {
            Exec-Command -Command "npx" -Arguments $npxArgs -WorkingDirectory $StagingRoot -Title "obfuscation (npx fallback)" -LogPath $script:MainLogPath -TimeoutSeconds $script:ToolTimeoutSec | Out-Null

            if (Test-Path $tmp) {
                Copy-Item -Force $tmp $serverJs
                Remove-Item -Force $tmp -ErrorAction SilentlyContinue
                Write-Ok "Obfuscation: server.js ofuscado (npx fallback)."
                $obfuscated = $true
                return
            }
        } catch {
            Write-Warn ("Obfuscation npx fallback falló: {0}" -f $_.Exception.Message)
        }
    }

    if (-not $obfuscated) {
        $msg = "Falló la ofuscación de server.js en todos los intentos. Se deja sin ofuscar."
        if ($RequireObfuscation) { throw $msg } else { Write-Warn $msg }
    }
}


# =========================
# MAIN
# =========================
try {
  Write-Phase "Preparación de instalador (Full Node Sidecar)"

  $startPath = if ($PSCommandPath) { (Split-Path $PSCommandPath -Parent) } else { (Get-Location).Path }
  $repoRoot = Find-RepoRoot $startPath
  if (-not $repoRoot) {
    $repoRoot = (Resolve-Path $startPath).Path
    Write-Warn "No se encontró .git. Usando como RepoRoot: $repoRoot"
  }

  $script:RepoRoot = $repoRoot
  Initialize-RunLogs -RepoRoot $repoRoot
  Write-Info ("LogsRoot   : " + $script:LogsRoot)
  Write-Info ("Heartbeat  : " + $script:HeartbeatSeconds + "s")

  # 1) Detección preferente (fast paths) según tu árbol
  Write-Phase "1) Detección de rutas"
  if (-not $DisableFastPaths) {
    if (-not $TauriPath)   { $TauriPath   = Find-TauriPathFast   $repoRoot }
    if (-not $BackendPath) { $BackendPath = Find-BackendPathFast $repoRoot }
  }

  # 1b) Fallback (si faltan)
  $tauriRoot   = Find-TauriPathFallback  -RepoRoot $repoRoot -Provided $TauriPath
  $backendRoot = Find-BackendPathFallback -RepoRoot $repoRoot -Provided $BackendPath

  # Fast paths extra: docker/prisma
  $dockerSrc = $null
  $prismaGlobalSrc = $null
  if (-not $DisableFastPaths) {
    $dockerSrc = Find-DockerComposeFast $repoRoot
    $prismaGlobalSrc = Find-PrismaGlobalFast $repoRoot
  }

  Write-Info ("RepoRoot   : " + $repoRoot)
  Write-Info ("TauriPath  : " + $tauriRoot)
  Write-Info ("BackendPath: " + $backendRoot)

  # 2) Limpieza destinos
  Write-Phase "2) Limpiando destinos"
  $destBinaries   = Join-Path $tauriRoot "src-tauri\binaries"
  $destResources  = Join-Path $tauriRoot "src-tauri\resources"
  $destBackend    = Join-Path $destResources "backend"

  Remove-DirSafe $destBinaries
  Remove-DirSafe $destResources
  Ensure-Dir $destBinaries
  Ensure-Dir $destResources

  # 3) Build backend
  Write-Phase "3) Build backend"
  if (-not $DevMode) {
    if (Test-Path (Join-Path $backendRoot "package-lock.json")) {
      Exec-Command-Retry -Command "npm" -Arguments @("ci") -Retries 4 -WorkingDirectory $backendRoot -Title "npm ci (backend)" -LogPath $script:NpmBackendCiLogPath -TimeoutSeconds $script:BuildTimeoutSec
    }
    else {
      Exec-Command-Retry -Command "npm" -Arguments @("install") -Retries 4 -WorkingDirectory $backendRoot -Title "npm install (backend)" -LogPath $script:NpmBackendCiLogPath -TimeoutSeconds $script:BuildTimeoutSec
    }
  } else {
    Write-Warn "DevMode activo: se omite reinstalación limpia."
    if (-not (Test-Path (Join-Path $backendRoot "node_modules"))) {
      Exec-Command-Retry -Command "npm" -Arguments @("install") -Retries 4 -WorkingDirectory $backendRoot -Title "npm install (backend devmode)" -LogPath $script:NpmBackendCiLogPath -TimeoutSeconds $script:BuildTimeoutSec
    }
  }

  Exec-Command -Command "npm" -Arguments @("run", "build") -WorkingDirectory $backendRoot -Title "npm run build (backend)" -LogPath $script:NpmBackendBuildLogPath -TimeoutSeconds $script:BuildTimeoutSec | Out-Null
  if (-not (Test-Path (Join-Path $backendRoot ".next"))) {
    throw "Build no generó .next en '$backendRoot'."
  }

  $nextMode = if (Test-Path (Join-Path $backendRoot ".next\standalone")) { "standalone" } else { "next start" }
  Write-Ok ("Modo Next.js detectado: " + $nextMode)

  # 4) Staging fuera del repo
  Write-Phase "4) Copia a staging"
  $stagingBase = Join-Path $repoRoot ".tmp"
  Ensure-Dir $stagingBase
  $stagingRoot = Join-Path $stagingBase "chavalos-build-staging"
  Remove-DirSafe $stagingRoot
  Ensure-Dir $stagingRoot

  # ============================================
  # CONFIGURACIÓN DE EXCLUSIONES
  # ============================================
  # POR DEFECTO: No se excluye NADA. Copia todo tal cual está en el standalone.
  # Robocopy /XD excluye por NOMBRE a CUALQUIER profundidad (no solo raíz),
  # lo cual destruye carpetas legítimas dentro de node_modules como:
  #   - node_modules/next/dist/        (excluído si "dist" en /XD)
  #   - node_modules/next/dist/build/  (excluído si "build" en /XD)
  #
  # CATEGORÍAS DE ARCHIVOS (para referencia y futura UI):
  # ┌─────────────────────┬────────────────────────────────────┬──────────────┐
  # │ Categoría           │ Ejemplos                           │ Riesgo       │
  # ├─────────────────────┼────────────────────────────────────┼──────────────┤
  # │ Source Maps         │ *.map                              │ Ninguno      │
  # │ Control de versión  │ .git                               │ Ninguno      │
  # │ Config de editor    │ .vscode                            │ Ninguno      │
  # │ Cache de build      │ .turbo, cache                      │ Ninguno      │
  # │ Reportes de test    │ coverage                           │ Ninguno      │
  # │ Build artifacts     │ build, target, dist                │ ⚠️ ALTO      │
  # │ Dependencias dev    │ @types/*, eslint*, prettier*       │ Bajo (peso)  │
  # └─────────────────────┴────────────────────────────────────┴──────────────┘
  #
  # Con -OptimizeSize: excluye SOLO los de riesgo Ninguno.
  # Sin -OptimizeSize (defecto): copia TODO tal cual.
  # ============================================

  if ($OptimizeSize) {
    Write-Warn "OptimizeSize activo: excluyendo archivos de desarrollo (source maps, .git, .vscode, .turbo)"
    $excludeFiles = @("*.map")
    $excludeDirsCommon = @(".git", ".vscode", ".turbo")
  }
  else {
    Write-Info "Modo COMPLETO: copiando todos los archivos sin exclusiones (máxima compatibilidad)"
    $excludeFiles = @()
    $excludeDirsCommon = @()
  }

  # Copiar env (no .env.local por defecto)
  foreach ($envFile in @(".env.production", ".env")) {
    $srcEnv = Join-Path $backendRoot $envFile
    if (Test-Path $srcEnv) {
      Copy-Item -Force $srcEnv -Destination (Join-Path $stagingRoot $envFile)
    }
  }

  # Prisma del backend (preferido para runtime): Frontend\NextJS_React\web\prisma
  $backendPrisma = $null
  if (Test-Path (Join-Path $backendRoot "prisma\schema.prisma")) {
    $backendPrisma = (Join-Path $backendRoot "prisma")
  }
  elseif (Test-Path (Join-Path $backendRoot "Prisma\schema.prisma")) {
    $backendPrisma = (Join-Path $backendRoot "Prisma")
  }

  if ($nextMode -eq "standalone") {
    # Standalone: copiar .next/standalone como raíz (incluye node_modules minimal y server.js)
    $standaloneSrc = Join-Path $backendRoot ".next\standalone"
    if (-not (Test-Path $standaloneSrc)) {
      throw "Se detectó standalone pero no existe: $standaloneSrc"
    }
    $null = Robocopy-Mirror $standaloneSrc $stagingRoot -ExcludeDirs $excludeDirsCommon -ExcludeFiles $excludeFiles

    # static
    $staticSrc = Join-Path $backendRoot ".next\static"
    if (Test-Path $staticSrc) {
      $staticExcludeDirs = if ($OptimizeSize) { @("cache") } else { @() }
      $null = Robocopy-Mirror $staticSrc (Join-Path $stagingRoot ".next\static") -ExcludeDirs $staticExcludeDirs -ExcludeFiles $excludeFiles
    }

    # public
    $publicSrc = Join-Path $backendRoot "public"
    if (Test-Path $publicSrc) {
      $null = Robocopy-Mirror $publicSrc (Join-Path $stagingRoot "public") -ExcludeDirs $excludeDirsCommon -ExcludeFiles $excludeFiles
    }

    # Prisma overlay a la raíz del staging (si existe) para que `--schema` sea alcanzable
    if ($backendPrisma) {
      Copy-PrismaTo -SourcePrismaDir $backendPrisma -DestPrismaDir (Join-Path $stagingRoot "prisma")
    }

    Write-Info "Standalone: NO se ejecuta npm install --omit=dev (usa node_modules minimal generado por Next)."
  }
  else {
    # next start: copiar .next, public, package.json (+lock) y luego instalar node_modules producción
    $nextExcludeDirs = if ($OptimizeSize) { @("cache") } else { @() }
    $null = Robocopy-Mirror (Join-Path $backendRoot ".next") (Join-Path $stagingRoot ".next") -ExcludeDirs $nextExcludeDirs -ExcludeFiles $excludeFiles

    $publicSrc = Join-Path $backendRoot "public"
    if (Test-Path $publicSrc) {
      $null = Robocopy-Mirror $publicSrc (Join-Path $stagingRoot "public") -ExcludeDirs $excludeDirsCommon -ExcludeFiles $excludeFiles
    }

    Copy-Item -Force (Join-Path $backendRoot "package.json") -Destination (Join-Path $stagingRoot "package.json")
    if (Test-Path (Join-Path $backendRoot "package-lock.json")) {
      Copy-Item -Force (Join-Path $backendRoot "package-lock.json") -Destination (Join-Path $stagingRoot "package-lock.json")
    }

    # Next configs si existen
    $nextConfigs = Get-ChildItem -Path $backendRoot -Filter "next.config.*" -File -ErrorAction SilentlyContinue
    foreach ($cfg in $nextConfigs) {
      Copy-Item -Force $cfg.FullName -Destination (Join-Path $stagingRoot $cfg.Name)
    }

    if ($backendPrisma) {
      Copy-PrismaTo -SourcePrismaDir $backendPrisma -DestPrismaDir (Join-Path $stagingRoot "prisma")
    }
  }

  # Resumen de staging
  $stagingSize = (Get-ChildItem $stagingRoot -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
  $stagingFiles = @(Get-ChildItem $stagingRoot -Recurse -File -ErrorAction SilentlyContinue).Count
  $stagingMB = [math]::Round(($stagingSize / 1MB), 2)
  Write-Ok "Staging completo: $stagingFiles archivos, $stagingMB MB"
  if (-not $OptimizeSize) {
    Write-Info "  Modo: COMPLETO (sin exclusiones — máxima compatibilidad)"
  } else {
    Write-Info "  Modo: OPTIMIZADO (excluidos: *.map, .git, .vscode, .turbo, cache)"
  }

  # 5) Ofuscación
  Write-Phase "5) Ofuscación"
  if (-not $SkipObfuscation) {
    Obfuscate-Staging $stagingRoot
  } else {
    Write-Warn "SkipObfuscation activo: se omite ofuscación."
  }

  # 6) Instalación producción (solo next start)
  Write-Phase "6) Dependencias de producción"
  if ($nextMode -ne "standalone") {
    if (-not $DevMode) {
      if (Test-Path (Join-Path $stagingRoot "package-lock.json")) {
        Exec-Command-Retry -Command "npm" -Arguments @("ci", "--omit=dev") -Retries 4 -WorkingDirectory $stagingRoot -Title "npm ci --omit=dev (staging)" -LogPath $script:NpmBackendCiLogPath -TimeoutSeconds $script:BuildTimeoutSec
      }
      else {
        Exec-Command-Retry -Command "npm" -Arguments @("install", "--omit=dev") -Retries 4 -WorkingDirectory $stagingRoot -Title "npm install --omit=dev (staging)" -LogPath $script:NpmBackendCiLogPath -TimeoutSeconds $script:BuildTimeoutSec
      }
    } else {
      if (-not (Test-Path (Join-Path $stagingRoot "node_modules"))) {
        Exec-Command-Retry -Command "npm" -Arguments @("install", "--omit=dev") -Retries 4 -WorkingDirectory $stagingRoot -Title "npm install --omit=dev (staging devmode)" -LogPath $script:NpmBackendCiLogPath -TimeoutSeconds $script:BuildTimeoutSec
      }
      else {
        Write-Warn "DevMode: usando node_modules existente en staging."
      }
    }
  }

  # Copia final a resources/backend
  Write-Phase "7) Copia final a resources"
  Remove-DirSafe $destBackend
  $null = Robocopy-Mirror $stagingRoot $destBackend

  # Validación mínima runtime
  if ($nextMode -eq "standalone") {
    if (-not (Test-Path (Join-Path $destBackend "server.js"))) {
      throw "Standalone: no se encontró server.js en '$destBackend'. Revisa .next/standalone."
    }
  }
  else {
    if (-not (Test-Path (Join-Path $destBackend ".next"))) {
      throw "next start: faltó .next en '$destBackend'."
    }
    if (-not (Test-Path (Join-Path $destBackend "node_modules"))) {
      throw "next start: faltó node_modules en '$destBackend'."
    }
  }

  # 8) Sidecar node.exe
  Write-Phase "8) Node sidecar"
  $nodePath = $null
  if ($NodeExePath) {
    if (-not (Test-Path $NodeExePath)) {
      throw "NodeExePath no existe: $NodeExePath"
    }
    $nodePath = (Resolve-Path $NodeExePath).Path
  }
  else {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
      throw "No se encontró node.exe en PATH. Pasa -NodeExePath."
    }
    $nodePath = $nodeCmd.Source
  }

  $rustTriple = Get-RustHostTriple
  $nodeDest = Join-Path $destBinaries ("node-" + $rustTriple + ".exe")
  Copy-Item -Force $nodePath $nodeDest
  Write-Ok ("Node sidecar: " + $nodeDest)

  # 9) Recursos adicionales (docker + Prisma global)
  Write-Phase "9) Recursos adicionales"
  if (-not $dockerSrc) {
    $dockerCandidates = @(
      (Join-Path $repoRoot "docker-compose.yml"),
      (Join-Path $repoRoot "Despliegue\Hosting\postgres-local\docker-compose.yml")
    )
    $dockerSrc = $dockerCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  }

  if ($dockerSrc) {
    Copy-Item -Force $dockerSrc (Join-Path $destResources "docker-compose.yml")
    Write-Info ("docker-compose copiado desde: " + $dockerSrc)
  }
  else {
    Write-Warn "No se encontró docker-compose.yml"
  }

  # Prisma global: Base_de_datos\Prisma (schema único)
  if (-not $prismaGlobalSrc) { $prismaGlobalSrc = Find-PrismaGlobalFast $repoRoot }
  if ($prismaGlobalSrc) {
    $prismaGlobalDest = Join-Path $destResources "Prisma"
    Copy-PrismaTo -SourcePrismaDir $prismaGlobalSrc -DestPrismaDir $prismaGlobalDest
    Write-Info ("Prisma global copiado desde: " + $prismaGlobalSrc)
  }
  else {
    Write-Warn "No se encontró Prisma global (Base_de_datos/Prisma)."
  }

  # Prisma generate (omitido por defecto en standalone)
  Write-Phase "10) Prisma generate"
  $effectiveSkipPrismaGenerate = $false
  if ($SkipPrismaGenerate.IsPresent) {
    $effectiveSkipPrismaGenerate = $true
  }
  elseif ($nextMode -eq "standalone") {
    $effectiveSkipPrismaGenerate = $true
    Write-Warn "Standalone detectado: Prisma generate se omite por defecto para evitar mismatch."
  }

  if (-not $effectiveSkipPrismaGenerate) {
    $schemaPath = $null
    $schema1 = Join-Path $destBackend "prisma\schema.prisma"
    $schema2 = Join-Path $destResources "Prisma\schema.prisma"

    if (Test-Path $schema1) {
      $schemaPath = $schema1
    }
    elseif (Test-Path $schema2) {
      $schemaPath = $schema2
    }

    if ($schemaPath) {
      Write-Info ("Ejecutando prisma generate con schema: " + $schemaPath)
      Exec-Command -Command "npx" -Arguments @("prisma", "generate", "--schema", $schemaPath) -WorkingDirectory $destBackend -Title "npx prisma generate" -LogPath $script:MainLogPath -TimeoutSeconds $script:ToolTimeoutSec | Out-Null
      Write-Ok "Prisma generate: OK"
    }
    else {
      Write-Warn "Prisma generate: no encontré schema.prisma en backend ni en resources/Prisma. Se omite."
    }
  }
  else {
    Write-Warn "SkipPrismaGenerate activo: se omite prisma generate."
  }

  # 11) Resumen final
  $sizeMB = Measure-DirSizeMB $destResources
  Write-Ok "===== Resumen ====="
  Write-Ok ("Backend          : " + $backendRoot)
  Write-Ok ("Modo Next.js      : " + $nextMode)
  Write-Ok ("Resources size    : " + $sizeMB + " MB")
  Write-Ok ("Node bin          : " + $nodeDest)
  Write-Ok ("Resources backend : " + $destBackend)
  Write-Ok ("Logs run          : " + $script:LogsRoot)
  Write-Ok "Listo para ejecutar: npm run tauri build (dentro de ChavalosServerApp)."

  exit 0
}
catch {
  $msg = $_.Exception.Message
  if (-not $msg) { $msg = $_.ToString() }

  $stack = ($_ | Out-String)
  $detail = ($_ | Format-List * -Force | Out-String)

  if (-not $script:CrashReportPath) {
    $fallbackBase = if ($script:RepoRoot) { $script:RepoRoot } else { (Get-Location).Path }
    $fallbackRoot = Join-Path $fallbackBase "logs\prepare-installer\fallback"
    Ensure-Dir $fallbackRoot
    $script:CrashReportPath = Join-Path $fallbackRoot ("crash-report-" + (Get-Date).ToString('yyyyMMdd_HHmmss') + ".txt")
  }

  # Recopilar tail de todos los logs disponibles
  $logTails = ""
  $logFiles = @($script:MainLogPath, $script:NpmBackendCiLogPath, $script:NpmBackendBuildLogPath, $script:RobocopyLogPath) |
    Where-Object { $_ -and (Test-Path $_) }
  foreach ($lf in $logFiles) {
    $tail = Get-Content -Path $lf -Tail 40 -ErrorAction SilentlyContinue
    if ($tail) {
      $logTails += "`r`n--- Tail: $(Split-Path $lf -Leaf) ---`r`n"
      $logTails += ($tail -join "`r`n")
    }
  }

  $crashText = @(
    "timestamp : $(Get-Stamp)",
    "message   : $msg",
    "repoRoot  : $script:RepoRoot",
    "logsRoot  : $script:LogsRoot",
    "crashFile : $($script:CrashReportPath)",
    "",
    "--- Stack ---",
    $stack,
    "",
    "--- Detail ---",
    $detail,
    "",
    "--- Log Tails ---",
    $logTails
  ) -join "`r`n"

  Set-Content -Path $script:CrashReportPath -Value $crashText -Encoding UTF8

  Write-Fail "========================================="
  Write-Fail ("ERROR: " + $msg)
  Write-Fail "========================================="
  if ($script:LogsRoot) {
    Write-Fail ("Logs en     : " + $script:LogsRoot)
  }
  Write-Fail ("Crash report: " + $script:CrashReportPath)

  # Mostrar tail del log principal en consola
  if ($script:MainLogPath -and (Test-Path $script:MainLogPath)) {
    Write-Warn "--- Últimas 30 líneas del log principal ---"
    Get-Content -Path $script:MainLogPath -Tail 30 -ErrorAction SilentlyContinue | ForEach-Object {
      Write-Host $_ -ForegroundColor DarkGray
    }
  }

  Write-Warn "Sugerencia: abre el crash report y los logs para buscar ERROR"

  # Pause en modo interactivo (a menos que -NoPauseOnFail)
  if ($script:IsInteractive -and -not $NoPauseOnFail) {
    Write-Host ""
    Read-Host "Presiona ENTER para cerrar"
  }

  exit 1
}


# =========================================
# COMANDOS DE PRUEBA
# =========================================
# Ejecución normal (con pause en caso de error):
#   .\prepare-installer.v11.ps1
#
# Sin pause al fallar (para CI/scripts):
#   .\prepare-installer.v11.ps1 -NoPauseOnFail
#
# Sin ofuscación:
#   .\prepare-installer.v11.ps1 -SkipObfuscation
#
# Sin prisma generate:
#   .\prepare-installer.v11.ps1 -SkipPrismaGenerate
#
# Con timeout personalizado (build 45min, tools 10min):
#   .\prepare-installer.v11.ps1 -BuildTimeoutSec 2700 -ToolTimeoutSec 600
#
# Ver dónde quedan los logs:
#   Los logs se guardan en: <RepoRoot>\logs\prepare-installer\YYYYMMDD_HHMMSS\
#   Ejemplo: D:\Aquiles\Tienda_Chavalos_Virtual_web\logs\prepare-installer\20260209_143022\
#   Archivos: prepare-installer.log, npm-backend-ci.log, npm-backend-build.log, robocopy.log, crash-report.txt

