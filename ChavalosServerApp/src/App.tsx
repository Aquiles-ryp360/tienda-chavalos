import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { open as openUrl } from '@tauri-apps/api/shell';
import { 
  Power, 
  StopCircle, 
  RefreshCw, 
  ExternalLink, 
  Settings, 
  Download,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
  Server,
  Terminal as TerminalIcon,
  Lock,
  Unlock,
  Play,
  Trash2
} from 'lucide-react';

type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
}

interface ServerInfo {
  local_url: string;
  lan_url: string;
  lan_ip: string;
  qr_path: string | null;
}

interface AppSettings {
  project_path: string;
  port: number;
  mode: 'dev' | 'prod';
  start_minimized: boolean;
  auto_start: boolean;
}

function App() {
  const [status, setStatus] = useState<ServerStatus>('stopped');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll logs
  useEffect(() => {
    if (logsContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      if (isNearBottom) {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [logs]);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    
    // Listen for log events
    const unlistenLog = listen<{ message: string; level: string }>('server-log', (event) => {
      addLog(event.payload.message, event.payload.level as LogEntry['level']);
    });

    // Listen for status changes
    const unlistenStatus = listen<string>('server-status', (event) => {
      setStatus(event.payload as ServerStatus);
    });

    // Listen for server info
    const unlistenInfo = listen<ServerInfo>('server-info', (event) => {
      setServerInfo(event.payload);
    });

    return () => {
      unlistenLog.then(f => f());
      unlistenStatus.then(f => f());
      unlistenInfo.then(f => f());
    };
  }, []);

  const loadSettings = async () => {
    try {
      const loadedSettings = await invoke<AppSettings>('get_settings');
      setSettings(loadedSettings);
    } catch (error) {
      addLog(`Error cargando configuración: ${error}`, 'error');
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      await invoke('save_settings', { settings: newSettings });
      setSettings(newSettings);
      addLog('Configuración guardada', 'success');
      setShowSettings(false);
    } catch (error) {
      addLog(`Error guardando configuración: ${error}`, 'error');
    }
  };

  const addLog = (message: string, level: LogEntry['level'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString('es-MX', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    setLogs(prev => [...prev, { timestamp, message, level }]);
  };

  const handleStart = async () => {
    if (status !== 'stopped') return;
    
    setStatus('starting');
    setLogs([]);
    addLog('Iniciando servidor...', 'info');

    try {
      await invoke('start_server');
    } catch (error) {
      addLog(`Error: ${error}`, 'error');
      setStatus('error');
    }
  };

  const handleStop = async () => {
    if (status !== 'running') return;
    
    setStatus('stopping');
    addLog('Deteniendo servidor...', 'info');

    try {
      await invoke('stop_server');
      setStatus('stopped');
      setServerInfo(null);
      addLog('Servidor detenido', 'success');
    } catch (error) {
      addLog(`Error deteniendo servidor: ${error}`, 'error');
      setStatus('error');
    }
  };

  const handleRestart = async () => {
    await handleStop();
    setTimeout(() => handleStart(), 1000);
  };

  const handleOpenBrowser = async () => {
    if (!serverInfo) return;
    
    try {
      await openUrl(serverInfo.local_url);
    } catch (error) {
      addLog(`Error abriendo navegador: ${error}`, 'error');
    }
  };

  const handleCopyUrl = async () => {
    if (!serverInfo) return;
    
    try {
      await invoke('copy_to_clipboard', { text: serverInfo.lan_url });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      addLog(`Error copiando URL: ${error}`, 'error');
    }
  };

  const handleExportLogs = async () => {
    try {
      const logsText = logs.map(log => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`).join('\n');
      await invoke('export_logs', { logs: logsText });
      addLog('Logs exportados', 'success');
    } catch (error) {
      addLog(`Error exportando logs: ${error}`, 'error');
    }
  };

  const handleOpenQR = async () => {
    if (!serverInfo?.qr_path) return;
    
    try {
      await invoke('open_file', { path: serverInfo.qr_path });
    } catch (error) {
      addLog(`Error abriendo QR: ${error}`, 'error');
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'running': return '#10b981';
      case 'starting': return '#f59e0b';
      case 'stopping': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'running': return 'En ejecución';
      case 'starting': return 'Iniciando...';
      case 'stopping': return 'Deteniendo...';
      case 'error': return 'Error';
      default: return 'Detenido';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'running': return <CheckCircle2 size={20} />;
      case 'starting': return <Loader2 size={20} className="pulse" />;
      case 'stopping': return <Loader2 size={20} className="pulse" />;
      case 'error': return <XCircle size={20} />;
      default: return <StopCircle size={20} />;
    }
  };

  if (showSettings) {
    return <SettingsPanel settings={settings!} onSave={saveSettings} onCancel={() => setShowSettings(false)} />;
  }

  if (showDiagnostic) {
    return <DiagnosticPanel onClose={() => setShowDiagnostic(false)} />;
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f9fafb'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px 30px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
              🏪 Ferretería Chavalos
            </h1>
            <p style={{ fontSize: '14px', opacity: 0.9 }}>Servidor de Gestión</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowDiagnostic(true)}
              style={{
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '500'
              }}
              title="Terminal de diagnóstico"
            >
              <TerminalIcon size={18} />
              Diagnóstico
            </button>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              <Settings size={18} />
              Configuración
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        padding: '20px 30px',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Status Card */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: getStatusColor(),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}>
                {getStatusIcon()}
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>
                  Estado del Servidor
                </h2>
                <p style={{ fontSize: '14px', color: '#6b7280' }}>
                  {getStatusText()}
                </p>
              </div>
            </div>

            {/* Control Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleStart}
                disabled={status !== 'stopped'}
                style={{
                  padding: '12px 24px',
                  background: status === 'stopped' ? '#10b981' : '#d1d5db',
                  color: 'white',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                <Power size={18} />
                Iniciar
              </button>
              <button
                onClick={handleStop}
                disabled={status !== 'running'}
                style={{
                  padding: '12px 24px',
                  background: status === 'running' ? '#ef4444' : '#d1d5db',
                  color: 'white',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                <StopCircle size={18} />
                Detener
              </button>
              <button
                onClick={handleRestart}
                disabled={status !== 'running'}
                style={{
                  padding: '12px 24px',
                  background: status === 'running' ? '#f59e0b' : '#d1d5db',
                  color: 'white',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                <RefreshCw size={18} />
                Reiniciar
              </button>
            </div>
          </div>

          {/* Server Info */}
          {serverInfo && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px',
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid #e5e7eb'
            }}>
              <InfoCard
                icon={<Server size={18} />}
                label="URL Local"
                value={serverInfo.local_url}
                color="#667eea"
              />
              <InfoCard
                icon={<Wifi size={18} />}
                label="IP LAN"
                value={serverInfo.lan_ip}
                color="#10b981"
              />
              <div style={{
                display: 'flex',
                gap: '8px'
              }}>
                <button
                  onClick={handleOpenBrowser}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#667eea',
                    color: 'white',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  <ExternalLink size={16} />
                  Abrir
                </button>
                <button
                  onClick={handleCopyUrl}
                  style={{
                    padding: '12px',
                    background: copied ? '#10b981' : '#6b7280',
                    color: 'white',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Copiar URL LAN"
                >
                  {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                </button>
                {serverInfo.qr_path && (
                  <button
                    onClick={handleOpenQR}
                    style={{
                      padding: '12px',
                      background: '#764ba2',
                      color: 'white',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                    title="Ver código QR"
                  >
                    📱 QR
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Logs Panel */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600' }}>
              Registro de Actividad
            </h3>
            <button
              onClick={handleExportLogs}
              disabled={logs.length === 0}
              style={{
                padding: '8px 16px',
                background: logs.length > 0 ? '#6b7280' : '#d1d5db',
                color: 'white',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: '500'
              }}
            >
              <Download size={14} />
              Exportar
            </button>
          </div>

          <div
            ref={logsContainerRef}
            style={{
              flex: 1,
              background: '#1f2937',
              borderRadius: '8px',
              padding: '16px',
              overflow: 'auto',
              fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
              fontSize: '13px',
              lineHeight: '1.6'
            }}
          >
            {logs.length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center', paddingTop: '20px' }}>
                No hay registros aún...
              </p>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: '4px',
                    color: getLogColor(log.level)
                  }}
                >
                  <span style={{ color: '#9ca3af' }}>[{log.timestamp}]</span>{' '}
                  <span style={{ color: getLevelColor(log.level), fontWeight: '600' }}>
                    [{log.level.toUpperCase()}]
                  </span>{' '}
                  {log.message}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px',
      background: '#f9fafb',
      borderRadius: '8px'
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>{label}</p>
        <p style={{ fontSize: '14px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function SettingsPanel({ settings, onSave, onCancel }: { 
  settings: AppSettings; 
  onSave: (settings: AppSettings) => void; 
  onCancel: () => void;
}) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [selectingPath, setSelectingPath] = useState(false);

  const handleSelectPath = async () => {
    setSelectingPath(true);
    try {
      const path = await invoke<string>('select_folder');
      if (path) {
        setLocalSettings({ ...localSettings, project_path: path });
      }
    } catch (error) {
      console.error('Error seleccionando carpeta:', error);
    }
    setSelectingPath(false);
  };

  return (
    <div style={{
      height: '100vh',
      background: '#f9fafb',
      padding: '30px',
      overflow: 'auto'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '12px',
        padding: '30px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
          ⚙️ Configuración
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Project Path */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Ruta del Proyecto
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={localSettings.project_path}
                readOnly
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: '#f9fafb'
                }}
              />
              <button
                onClick={handleSelectPath}
                disabled={selectingPath}
                style={{
                  padding: '10px 16px',
                  background: '#667eea',
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                {selectingPath ? '...' : 'Buscar'}
              </button>
            </div>
          </div>

          {/* Port */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Puerto
            </label>
            <input
              type="number"
              value={localSettings.port}
              onChange={(e) => setLocalSettings({ ...localSettings, port: parseInt(e.target.value) })}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Mode */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Modo de Ejecución
            </label>
            <select
              value={localSettings.mode}
              onChange={(e) => setLocalSettings({ ...localSettings, mode: e.target.value as 'dev' | 'prod' })}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="dev">Desarrollo (dev)</option>
              <option value="prod">Producción (start)</option>
            </select>
          </div>

          {/* Checkboxes */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={localSettings.start_minimized}
                onChange={(e) => setLocalSettings({ ...localSettings, start_minimized: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '14px' }}>Iniciar minimizado a bandeja</span>
            </label>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={localSettings.auto_start}
                onChange={(e) => setLocalSettings({ ...localSettings, auto_start: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '14px' }}>Iniciar con Windows</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
          <button
            onClick={() => onSave(localSettings)}
            style={{
              flex: 1,
              padding: '12px',
              background: '#10b981',
              color: 'white',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Guardar
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px',
              background: '#6b7280',
              color: 'white',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function getLogColor(level: LogEntry['level']): string {
  switch (level) {
    case 'error': return '#fca5a5';
    case 'warn': return '#fcd34d';
    case 'success': return '#86efac';
    default: return '#d1d5db';
  }
}

function getLevelColor(level: LogEntry['level']): string {
  switch (level) {
    case 'error': return '#ef4444';
    case 'warn': return '#f59e0b';
    case 'success': return '#10b981';
    default: return '#6b7280';
  }
}

// ===== DIAGNOSTIC PANEL =====
interface DiagSession {
  session_id: string;
  expires_at: number;
}

interface DiagRunResult {
  exit_code: number;
  stdout: string;
  stderr: string;
  started_at: number;
  finished_at: number;
}

function DiagnosticPanel({ onClose }: { onClose: () => void }) {
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [session, setSession] = useState<DiagSession | null>(null);
  const [command, setCommand] = useState('');
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [lastResult, setLastResult] = useState<DiagRunResult | null>(null);
  const commandRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    checkEnabled();
  }, []);

  const checkEnabled = async () => {
    try {
      const enabled = await invoke<boolean>('diag_check_enabled');
      setIsEnabled(enabled);
    } catch (error) {
      console.error('Error checking diag enabled:', error);
      setIsEnabled(false);
    }
  };

  const handleUnlock = async () => {
    if (!password.trim()) {
      setUnlockError('Por favor ingresa la contraseña');
      return;
    }

    setUnlocking(true);
    setUnlockError('');

    try {
      const diagSession = await invoke<DiagSession>('diag_unlock', { password });
      setSession(diagSession);
      setIsUnlocked(true);
      setPassword('');
      setOutput('✅ Sesión desbloqueada correctamente\n\n');
    } catch (error) {
      setUnlockError(String(error));
    } finally {
      setUnlocking(false);
    }
  };

  const handleLock = async () => {
    if (session) {
      try {
        await invoke('diag_lock', { sessionId: session.session_id });
      } catch (error) {
        console.error('Error locking session:', error);
      }
    }
    setSession(null);
    setIsUnlocked(false);
    setPassword('');
    setCommand('');
    setOutput('');
    setLastResult(null);
  };

  const handleRun = async () => {
    if (!command.trim() || !session) return;

    setRunning(true);
    const startTime = new Date().toLocaleTimeString();
    setOutput(prev => prev + `\n[${startTime}] Ejecutando comando...\n`);

    try {
      const result = await invoke<DiagRunResult>('diag_run_powershell', {
        sessionId: session.session_id,
        command: command.trim(),
        timeoutMs: null
      });

      const endTime = new Date().toLocaleTimeString();
      const duration = result.finished_at - result.started_at;

      let resultText = `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      resultText += `[${endTime}] Comando completado\n`;
      resultText += `Exit Code: ${result.exit_code}\n`;
      resultText += `Duración: ${duration}ms\n`;
      resultText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      if (result.stdout) {
        resultText += `=== STDOUT ===\n${result.stdout}\n\n`;
      }

      if (result.stderr) {
        resultText += `=== STDERR ===\n${result.stderr}\n\n`;
      }

      setOutput(prev => prev + resultText);
      setLastResult(result);
    } catch (error) {
      const errorText = `\n❌ ERROR: ${error}\n\n`;
      setOutput(prev => prev + errorText);

      // Si la sesión expiró, forzar re-lock
      if (String(error).includes('Sesión inválida') || String(error).includes('expirada')) {
        handleLock();
      }
    } finally {
      setRunning(false);
    }
  };

  const handleClear = () => {
    setOutput('');
    setLastResult(null);
  };

  const insertTemplate = (template: string) => {
    setCommand(template);
    commandRef.current?.focus();
  };

  if (isEnabled === null) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb'
      }}>
        <Loader2 size={40} className="pulse" style={{ color: '#667eea' }} />
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
        padding: '30px'
      }}>
        <div style={{
          maxWidth: '500px',
          background: 'white',
          borderRadius: '12px',
          padding: '30px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          textAlign: 'center'
        }}>
          <XCircle size={48} style={{ color: '#ef4444', marginBottom: '16px' }} />
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>
            Terminal de Diagnóstico Deshabilitado
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '20px', lineHeight: '1.6' }}>
            Esta característica está deshabilitada en modo RELEASE.
            <br />
            Para habilitarla, establece la variable de entorno:
          </p>
          <code style={{
            display: 'block',
            background: '#1f2937',
            color: '#86efac',
            padding: '12px',
            borderRadius: '6px',
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: '14px',
            marginBottom: '20px'
          }}>
            CHAVALOS_DIAG_TERMINAL=1
          </code>
          <button
            onClick={onClose}
            style={{
              padding: '12px 24px',
              background: '#6b7280',
              color: 'white',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#f9fafb'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
        color: 'white',
        padding: '20px 30px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TerminalIcon size={32} />
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
                Terminal de Diagnóstico
              </h1>
              <p style={{ fontSize: '14px', opacity: 0.9 }}>
                {isUnlocked ? '🔓 Desbloqueado' : '🔒 Bloqueado'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {isUnlocked && (
              <button
                onClick={handleLock}
                style={{
                  padding: '10px 16px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: 'white',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                <Lock size={18} />
                Bloquear
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              ✕ Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        padding: '20px 30px',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {!isUnlocked ? (
          // Unlock Panel
          <div style={{
            maxWidth: '500px',
            margin: '40px auto',
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <Unlock size={48} style={{ color: '#667eea', marginBottom: '16px' }} />
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
                Desbloquear Terminal
              </h2>
              <p style={{ color: '#6b7280', fontSize: '14px' }}>
                Ingresa la contraseña de diagnóstico
              </p>
            </div>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              placeholder="Contraseña"
              disabled={unlocking}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                marginBottom: '16px'
              }}
            />

            {unlockError && (
              <div style={{
                padding: '12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#dc2626',
                fontSize: '14px',
                marginBottom: '16px'
              }}>
                {unlockError}
              </div>
            )}

            <button
              onClick={handleUnlock}
              disabled={unlocking}
              style={{
                width: '100%',
                padding: '12px',
                background: unlocking ? '#9ca3af' : '#667eea',
                color: 'white',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {unlocking ? (
                <>
                  <Loader2 size={18} className="pulse" />
                  Desbloqueando...
                </>
              ) : (
                <>
                  <Unlock size={18} />
                  Desbloquear
                </>
              )}
            </button>
          </div>
        ) : (
          // Terminal Interface
          <>
            {/* Quick Templates */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#6b7280' }}>
                📋 Comandos Rápidos
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '8px'
              }}>
                <button
                  onClick={() => insertTemplate('netstat -ano | findstr :3000')}
                  style={{
                    padding: '8px 12px',
                    background: '#f3f4f6',
                    borderRadius: '6px',
                    fontSize: '13px',
                    textAlign: 'left',
                    color: '#374151'
                  }}
                >
                  netstat puerto 3000
                </button>
                <button
                  onClick={() => insertTemplate('Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue')}
                  style={{
                    padding: '8px 12px',
                    background: '#f3f4f6',
                    borderRadius: '6px',
                    fontSize: '13px',
                    textAlign: 'left',
                    color: '#374151'
                  }}
                >
                  TCP Connection 3000
                </button>
                <button
                  onClick={() => insertTemplate('docker ps')}
                  style={{
                    padding: '8px 12px',
                    background: '#f3f4f6',
                    borderRadius: '6px',
                    fontSize: '13px',
                    textAlign: 'left',
                    color: '#374151'
                  }}
                >
                  docker ps
                </button>
                <button
                  onClick={() => insertTemplate('Get-Process node | Select-Object Id, ProcessName, Path')}
                  style={{
                    padding: '8px 12px',
                    background: '#f3f4f6',
                    borderRadius: '6px',
                    fontSize: '13px',
                    textAlign: 'left',
                    color: '#374151'
                  }}
                >
                  Procesos Node
                </button>
              </div>
            </div>

            {/* Command Input */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                Comando PowerShell
              </label>
              <textarea
                ref={commandRef}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Escribe un comando de PowerShell..."
                disabled={running}
                style={{
                  width: '100%',
                  height: '100px',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontFamily: 'Consolas, Monaco, monospace',
                  fontSize: '13px',
                  resize: 'vertical',
                  marginBottom: '12px'
                }}
              />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleRun}
                  disabled={running || !command.trim()}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: running || !command.trim() ? '#d1d5db' : '#10b981',
                    color: 'white',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  {running ? (
                    <>
                      <Loader2 size={18} className="pulse" />
                      Ejecutando...
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Ejecutar
                    </>
                  )}
                </button>
                <button
                  onClick={handleClear}
                  disabled={!output}
                  style={{
                    padding: '12px 20px',
                    background: !output ? '#f3f4f6' : '#ef4444',
                    color: !output ? '#9ca3af' : 'white',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  <Trash2 size={18} />
                  Limpiar
                </button>
              </div>
            </div>

            {/* Output Panel */}
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600' }}>
                  Salida
                </h3>
                {lastResult && (
                  <span style={{
                    padding: '4px 12px',
                    background: lastResult.exit_code === 0 ? '#d1fae5' : '#fee2e2',
                    color: lastResult.exit_code === 0 ? '#065f46' : '#991b1b',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    Exit Code: {lastResult.exit_code}
                  </span>
                )}
              </div>
              <div style={{
                flex: 1,
                background: '#1f2937',
                borderRadius: '8px',
                padding: '16px',
                overflow: 'auto',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: '13px',
                lineHeight: '1.6',
                color: '#d1d5db',
                whiteSpace: 'pre-wrap'
              }}>
                {output || 'Sin salida aún...'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
