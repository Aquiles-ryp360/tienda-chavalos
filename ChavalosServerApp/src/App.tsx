import React, { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Play, Square, Settings, Terminal, Copy, Download,
  Globe, Wifi, Monitor, ChevronDown, ChevronUp, RefreshCw,
  CheckCircle2, Loader2, AlertCircle, XCircle, FolderOpen,
  QrCode, Wrench, Users, LayoutDashboard,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import QRGenerator from "./components/QRGenerator";
import DiagnosticsPanel from "./components/DiagnosticsPanel";
import DeviceMonitor from "./components/DeviceMonitor";
import ThemeSelector from "./components/ThemeSelector";
import PortConflictDialog, { type PortConflict } from "./components/PortConflictDialog";
import AutostartToggle from "./components/AutostartToggle";
import { useTheme } from "./hooks/useTheme";

// ===========================================
// TYPES
// ===========================================

interface LogEntry { message: string; level: string; ts: string }
interface ServerInfo { local_url: string; lan_url: string; lan_ip: string }
interface BootStage { stage: string; message: string }
interface AppSettings { project_path: string; port: number; auto_start: boolean; theme: string }
interface NetworkInfo { ip: string; ssid: string; adapter: string }

type ServerStatus = "stopped" | "starting" | "running" | "error";
type TabId = "dashboard" | "qr" | "devices" | "diagnostics";

// ===========================================
// COMPONENT
// ===========================================

export default function App() {
  const [status, setStatus] = useState<ServerStatus>("stopped");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [bootStage, setBootStage] = useState<BootStage | null>(null);
  const [settings, setSettings] = useState<AppSettings>({ project_path: "", port: 3000, auto_start: false, theme: "system" });
  const [showSettings, setShowSettings] = useState(false);
  const [showLogs, setShowLogs] = useState(true);
  const [copied, setCopied] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [portConflict, setPortConflict] = useState<PortConflict | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  // Timestamp helper
  const now = () => new Date().toLocaleTimeString("es-NI", { hour12: false });

  // ---- Listeners ----
  useEffect(() => {
    const unlisten: (() => void)[] = [];

    listen<{ message: string; level: string }>("server-log", (e) => {
      setLogs((prev) => {
        const next = [...prev, { ...e.payload, ts: now() }];
        return next.length > 500 ? next.slice(-400) : next;
      });
    }).then((u) => unlisten.push(u));

    listen<string>("server-status", (e) => {
      setStatus(e.payload as ServerStatus);
    }).then((u) => unlisten.push(u));

    listen<ServerInfo>("server-info", (e) => {
      setInfo(e.payload);
    }).then((u) => unlisten.push(u));

    listen<BootStage>("boot-stage", (e) => {
      setBootStage(e.payload);
    }).then((u) => unlisten.push(u));

    listen<PortConflict>("port-conflict", (e) => {
      setPortConflict(e.payload);
    }).then((u) => unlisten.push(u));

    // Load settings
    invoke<AppSettings>("get_settings").then(setSettings).catch(console.error);

    return () => { unlisten.forEach((u) => u()); };
  }, []);

  // ---- Network change polling with toast notification ----
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const changed = await invoke<NetworkInfo | null>("check_network_change");
        if (changed) {
          toast.success(
            `Red actualizada: ${changed.ssid} — ${changed.ip}`,
            {
              duration: 5000,
              icon: "📡",
              style: {
                background: resolvedTheme === "dark" ? "#1e293b" : "#f1f5f9",
                color: resolvedTheme === "dark" ? "#f1f5f9" : "#0f172a",
                border: "1px solid #3b82f6",
              },
            }
          );
          // Update server info if server is running
          if (info) {
            setInfo({
              ...info,
              lan_url: `http://${changed.ip}:${settings.port}`,
              lan_ip: changed.ip,
            });
          }
        }
      } catch { /* ignore */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [info, settings.port, resolvedTheme]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Auto-start
  useEffect(() => {
    if (settings.auto_start && status === "stopped") {
      handleStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.auto_start]);

  // ---- Actions ----
  const handleStart = async () => {
    try {
      setLogs([]);
      setInfo(null);
      setBootStage(null);
      setPortConflict(null);
      await invoke("start_server");
    } catch (e: unknown) {
      // Don't show port conflict as a generic error — the dialog handles it
      const msg = String(e);
      if (!msg.includes("Puerto") || !msg.includes("ocupado")) {
        setLogs((p) => [...p, { message: `Error: ${msg}`, level: "error", ts: now() }]);
      }
      setStatus("error");
    }
  };

  const handleStop = async () => {
    try {
      await invoke("stop_server");
      setInfo(null);
      setBootStage(null);
    } catch (e: unknown) {
      setLogs((p) => [...p, { message: `Error: ${e}`, level: "error", ts: now() }]);
    }
  };

  const handleRestart = async () => {
    await handleStop();
    setTimeout(handleStart, 1500);
  };

  // ---- Port conflict handlers ----
  const handlePortConflictResolved = () => {
    setPortConflict(null);
    setStatus("stopped");
    // Auto-retry start
    setTimeout(handleStart, 500);
  };

  const handlePortConflictChangePort = async (newPort: number) => {
    const newSettings = { ...settings, port: newPort };
    setSettings(newSettings);
    try {
      await invoke("save_settings", { settings: newSettings });
      toast.success(`Puerto cambiado a ${newPort}`, {
        icon: "🔄",
        style: {
          background: resolvedTheme === "dark" ? "#1e293b" : "#f1f5f9",
          color: resolvedTheme === "dark" ? "#f1f5f9" : "#0f172a",
        },
      });
    } catch { /* ignore */ }
    setPortConflict(null);
    setStatus("stopped");
    setTimeout(handleStart, 500);
  };

  const handlePortConflictDismiss = () => {
    setPortConflict(null);
    setStatus("stopped");
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await invoke("copy_to_clipboard", { text });
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    } catch { /* ignore */ }
  };

  const handleExportLogs = async () => {
    const text = logs.map((l) => `[${l.ts}] [${l.level.toUpperCase()}] ${l.message}`).join("\n");
    try { await invoke("export_logs", { logs: text }); } catch { /* ignore */ }
  };

  const handleSelectFolder = async () => {
    try {
      const folder = await invoke<string>("select_folder");
      setSettings((s) => ({ ...s, project_path: folder }));
    } catch { /* ignore */ }
  };

  const handleSaveSettings = async () => {
    try {
      await invoke("save_settings", { settings });
      setShowSettings(false);
      toast.success("Configuración guardada", {
        style: {
          background: resolvedTheme === "dark" ? "#1e293b" : "#f1f5f9",
          color: resolvedTheme === "dark" ? "#f1f5f9" : "#0f172a",
        },
      });
    } catch (e: unknown) {
      setLogs((p) => [...p, { message: `Error guardando: ${e}`, level: "error", ts: now() }]);
    }
  };

  // ---- Status visuals ----
  const statusConfig: Record<ServerStatus, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
    stopped:  { color: "#94a3b8", bg: "var(--badge-stopped)",  label: "Detenido",     icon: <Square size={16} /> },
    starting: { color: "#facc15", bg: "var(--badge-starting)", label: "Iniciando...", icon: <Loader2 size={16} className="spin" /> },
    running:  { color: "#4ade80", bg: "var(--badge-running)",  label: "Corriendo",    icon: <CheckCircle2 size={16} /> },
    error:    { color: "#f87171", bg: "var(--badge-error)",    label: "Error",        icon: <AlertCircle size={16} /> },
  };
  const sc = statusConfig[status];

  // ---- Tab config ----
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard",   label: "Panel",          icon: <LayoutDashboard size={16} /> },
    { id: "qr",          label: "QR",             icon: <QrCode size={16} /> },
    { id: "devices",     label: "Dispositivos",   icon: <Users size={16} /> },
    { id: "diagnostics", label: "Diagnóstico",    icon: <Wrench size={16} /> },
  ];

  // ---- RENDER ----
  return (
    <div className="app">
      <Toaster position="top-right" />

      {/* ===== PORT CONFLICT DIALOG ===== */}
      {portConflict && (
        <PortConflictDialog
          conflict={portConflict}
          onResolved={handlePortConflictResolved}
          onChangePort={handlePortConflictChangePort}
          onDismiss={handlePortConflictDismiss}
        />
      )}

      {/* ===== HEADER ===== */}
      <header className="header">
        <div className="header-left">
          <h1>🏪 Chavalos Server</h1>
          <div className="status-badge" style={{ color: sc.color, background: sc.bg }}>
            {sc.icon}
            <span>{sc.label}</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={() => setShowSettings(!showSettings)} title="Configuración">
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* ===== BOOT STAGE ===== */}
      {bootStage && status === "starting" && (
        <div className="boot-stage">
          <Loader2 size={14} className="spin" />
          <span className="stage-label">{bootStage.stage}</span>
          <span>{bootStage.message}</span>
        </div>
      )}

      {/* ===== SETTINGS PANEL ===== */}
      {showSettings && (
        <div className="settings-panel">
          <h3>⚙️ Configuración</h3>
          <div className="settings-grid">
            <div className="settings-col">
              <div className="field">
                <label>Carpeta del proyecto</label>
                <div className="field-row">
                  <input value={settings.project_path} onChange={(e) => setSettings({ ...settings, project_path: e.target.value })} />
                  <button className="icon-btn small" onClick={handleSelectFolder}><FolderOpen size={14} /></button>
                </div>
              </div>
              <div className="field">
                <label>Puerto</label>
                <input type="number" value={settings.port} onChange={(e) => setSettings({ ...settings, port: Number(e.target.value) })} />
              </div>
              <div className="field checkbox">
                <label>
                  <input type="checkbox" checked={settings.auto_start} onChange={(e) => setSettings({ ...settings, auto_start: e.target.checked })} />
                  Auto-iniciar al abrir
                </label>
              </div>
            </div>
            <div className="settings-col">
              <ThemeSelector />
              <AutostartToggle />
            </div>
          </div>
          <div className="field-actions">
            <button className="btn secondary" onClick={() => setShowSettings(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleSaveSettings}>Guardar</button>
          </div>
        </div>
      )}

      {/* ===== TAB NAVIGATION ===== */}
      <nav className="tab-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ===== TAB CONTENT ===== */}
      <div className="tab-content">
        {/* --- DASHBOARD TAB --- */}
        {activeTab === "dashboard" && (
          <>
            {/* Server Info Cards */}
            {info && status === "running" && (
              <div className="info-cards">
                <InfoCard label="Local" icon={<Monitor size={16} />} url={info.local_url} onCopy={handleCopy} copied={copied} />
                <InfoCard label="Red LAN" icon={<Wifi size={16} />} url={info.lan_url} onCopy={handleCopy} copied={copied} />
                <InfoCard label="IP" icon={<Globe size={16} />} url={info.lan_ip} onCopy={handleCopy} copied={copied} raw />
              </div>
            )}

            {/* Controls */}
            <div className="controls">
              {status === "stopped" || status === "error" ? (
                <button className="btn success wide" onClick={handleStart}>
                  <Play size={16} /> Iniciar Servidor
                </button>
              ) : status === "running" ? (
                <>
                  <button className="btn danger" onClick={handleStop}><Square size={16} /> Detener</button>
                  <button className="btn secondary" onClick={handleRestart}><RefreshCw size={16} /> Reiniciar</button>
                </>
              ) : (
                <button className="btn disabled" disabled><Loader2 size={16} className="spin" /> Iniciando...</button>
              )}
            </div>

            {/* Logs */}
            <div className="logs-section">
              <div className="logs-header" onClick={() => setShowLogs(!showLogs)}>
                <div className="logs-title">
                  <Terminal size={16} />
                  <span>Consola</span>
                  <span className="log-count">{logs.length}</span>
                </div>
                <div className="logs-actions">
                  <button className="icon-btn tiny" onClick={(e) => { e.stopPropagation(); handleExportLogs(); }} title="Exportar"><Download size={14} /></button>
                  <button className="icon-btn tiny" onClick={(e) => { e.stopPropagation(); setLogs([]); }} title="Limpiar"><XCircle size={14} /></button>
                  {showLogs ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </div>
              </div>
              {showLogs && (
                <div className="logs-container" ref={logRef}>
                  {logs.length === 0 && <div className="log-empty">Sin logs. Inicia el servidor para ver actividad.</div>}
                  {logs.map((l, i) => (
                    <div key={i} className={`log-line ${l.level}`}>
                      <span className="log-ts">{l.ts}</span>
                      <span className="log-msg">{l.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* --- QR TAB --- */}
        {activeTab === "qr" && (
          <QRGenerator
            port={settings.port}
            isRunning={status === "running"}
            onCopy={handleCopy}
            copied={copied}
          />
        )}

        {/* --- DEVICES TAB --- */}
        {activeTab === "devices" && (
          <DeviceMonitor isRunning={status === "running"} />
        )}

        {/* --- DIAGNOSTICS TAB --- */}
        {activeTab === "diagnostics" && (
          <DiagnosticsPanel />
        )}
      </div>
    </div>
  );
}

// ===== Sub-component: InfoCard =====
function InfoCard({ label, icon, url, onCopy, copied, raw }: {
  label: string; icon: React.ReactNode; url: string; onCopy: (t: string, l: string) => void; copied: string; raw?: boolean
}) {
  return (
    <div className="info-card">
      <div className="info-label">{icon} {label}</div>
      <div className="info-value">
        {raw ? <span>{url}</span> : <a href={url} target="_blank" rel="noreferrer">{url}</a>}
        <button className="copy-btn" onClick={() => onCopy(url, label)} title="Copiar">
          {copied === label ? <CheckCircle2 size={12} /> : <Copy size={12} />}
        </button>
      </div>
    </div>
  );
}
