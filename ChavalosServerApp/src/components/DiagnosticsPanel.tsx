import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Wrench, Download, Mail, RefreshCw, HardDrive, Cpu,
  MemoryStick, Network, Container, FileText, CheckCircle2,
  ChevronDown, ChevronUp
} from "lucide-react";

interface NetworkInfo {
  ip: string;
  ssid: string;
  adapter: string;
}

interface DiagnosticBundle {
  timestamp: string;
  network: NetworkInfo;
  docker_status: string;
  docker_containers: string[];
  cpu_usage: number;
  memory_mb: number;
  logs: string[];
  app_version: string;
  os_info: string;
}

export default function DiagnosticsPanel() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bundle, setBundle] = useState<DiagnosticBundle | null>(null);
  const [stats, setStats] = useState<{ cpu: number; memory_mb: number }>({ cpu: 0, memory_mb: 0 });
  const [dockerStatus, setDockerStatus] = useState("Verificando...");
  const [containers, setContainers] = useState<string[]>([]);
  const [savedLog, setSavedLog] = useState<string | null>(null);

  // Poll system stats when panel is expanded
  useEffect(() => {
    if (!expanded) return;

    const fetchStats = async () => {
      try {
        const s = await invoke<Record<string, number>>("get_system_stats");
        setStats({ cpu: s.cpu || 0, memory_mb: s.memory_mb || 0 });
      } catch { /* ignore */ }

      try {
        const ds = await invoke<string>("get_docker_status");
        setDockerStatus(ds);
      } catch {
        setDockerStatus("No disponible");
      }

      try {
        const c = await invoke<string[]>("get_docker_containers");
        setContainers(c);
      } catch {
        setContainers([]);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [expanded]);

  const handleExportBundle = useCallback(async () => {
    setLoading(true);
    try {
      await invoke("export_diagnostic_bundle");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadBundle = useCallback(async () => {
    setLoading(true);
    try {
      const b = await invoke<DiagnosticBundle>("get_diagnostic_bundle");
      setBundle(b);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSaveLog = useCallback(async () => {
    try {
      const path = await invoke<string>("save_latest_log");
      setSavedLog(path);
      setTimeout(() => setSavedLog(null), 4000);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSendReport = useCallback(async () => {
    try {
      await invoke("save_latest_log");
      await invoke("send_report_email");
    } catch (e) {
      console.error(e);
    }
  }, []);

  return (
    <div className="diagnostics-panel">
      <div className="diagnostics-header" onClick={() => setExpanded(!expanded)}>
        <div className="diagnostics-title">
          <Wrench size={16} />
          <span>Herramientas de Desarrollador</span>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {expanded && (
        <div className="diagnostics-content">
          {/* Quick Stats */}
          <div className="diag-stats-row">
            <div className="diag-stat">
              <Cpu size={14} />
              <span className="diag-stat-label">CPU</span>
              <span className="diag-stat-value">{stats.cpu.toFixed(1)}s</span>
            </div>
            <div className="diag-stat">
              <MemoryStick size={14} />
              <span className="diag-stat-label">RAM</span>
              <span className="diag-stat-value">{stats.memory_mb.toFixed(0)} MB</span>
            </div>
            <div className="diag-stat">
              <Container size={14} />
              <span className="diag-stat-label">Docker</span>
              <span className="diag-stat-value">{dockerStatus}</span>
            </div>
          </div>

          {/* Docker Containers */}
          {containers.length > 0 && (
            <div className="diag-section">
              <div className="diag-section-title">
                <HardDrive size={12} />
                <span>Contenedores Activos</span>
              </div>
              <div className="diag-containers">
                {containers.map((c, i) => (
                  <div key={i} className="diag-container-item">
                    <CheckCircle2 size={10} className="text-success" />
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="diag-actions">
            <button className="btn secondary small" onClick={handleExportBundle} disabled={loading}>
              <Download size={14} />
              Exportar Diagnóstico (.json)
            </button>
            <button className="btn secondary small" onClick={handleSaveLog}>
              <FileText size={14} />
              Guardar latest.log
            </button>
            <button className="btn secondary small" onClick={handleSendReport}>
              <Mail size={14} />
              Enviar Reporte
            </button>
            <button className="btn secondary small" onClick={handleLoadBundle} disabled={loading}>
              <RefreshCw size={14} className={loading ? "spin" : ""} />
              Ver Resumen
            </button>
          </div>

          {savedLog && (
            <div className="diag-saved-notice">
              <CheckCircle2 size={12} />
              <span>Log guardado en: {savedLog}</span>
            </div>
          )}

          {/* Bundle Preview */}
          {bundle && (
            <div className="diag-bundle-preview">
              <div className="diag-section-title">
                <Network size={12} />
                <span>Resumen del Sistema</span>
              </div>
              <div className="diag-bundle-grid">
                <div className="diag-bundle-item">
                  <span className="label">Versión</span>
                  <span className="value">v{bundle.app_version}</span>
                </div>
                <div className="diag-bundle-item">
                  <span className="label">SO</span>
                  <span className="value">{bundle.os_info}</span>
                </div>
                <div className="diag-bundle-item">
                  <span className="label">IP</span>
                  <span className="value">{bundle.network.ip}</span>
                </div>
                <div className="diag-bundle-item">
                  <span className="label">Wi-Fi</span>
                  <span className="value">{bundle.network.ssid}</span>
                </div>
                <div className="diag-bundle-item">
                  <span className="label">Docker</span>
                  <span className="value">{bundle.docker_status}</span>
                </div>
                <div className="diag-bundle-item">
                  <span className="label">Logs</span>
                  <span className="value">{bundle.logs.length} entradas</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
