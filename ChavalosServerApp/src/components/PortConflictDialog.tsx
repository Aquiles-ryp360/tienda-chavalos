import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle, Skull, RefreshCw, Settings, Zap,
  Monitor, HardDrive, ArrowRight, CheckCircle2, XCircle, Loader2,
} from "lucide-react";

// ===========================================
// TYPES
// ===========================================

export interface PortConflict {
  port: number;
  pid: number;
  process_name: string;
  memory_kb: number;
}

interface Props {
  conflict: PortConflict;
  onResolved: () => void;       // Re-try starting the server
  onChangePort: (port: number) => void; // Change port and retry
  onDismiss: () => void;        // Close dialog without action
}

type ActionState = "idle" | "killing" | "suggesting" | "killed" | "error";

// ===========================================
// COMPONENT
// ===========================================

export default function PortConflictDialog({ conflict, onResolved, onChangePort, onDismiss }: Props) {
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [suggestedPort, setSuggestedPort] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const memoryMB = (conflict.memory_kb / 1024).toFixed(1);

  // ---- Kill the occupying process ----
  const handleKill = async () => {
    setActionState("killing");
    setErrorMsg("");
    try {
      await invoke("kill_port_process", { port: conflict.port });
      setActionState("killed");
      // Auto-retry after short delay
      setTimeout(() => onResolved(), 1200);
    } catch (e: unknown) {
      setErrorMsg(String(e));
      setActionState("error");
    }
  };

  // ---- Suggest an alternative port ----
  const handleSuggest = async () => {
    setActionState("suggesting");
    setErrorMsg("");
    try {
      const port = await invoke<number>("suggest_available_port", { desired: conflict.port });
      setSuggestedPort(port);
      setActionState("idle");
    } catch (e: unknown) {
      setErrorMsg(String(e));
      setActionState("error");
    }
  };

  // ---- Accept suggested port ----
  const handleAcceptPort = () => {
    if (suggestedPort) {
      onChangePort(suggestedPort);
    }
  };

  // ---- Retry (check if port is now free) ----
  const handleRetry = async () => {
    setActionState("killing");
    setErrorMsg("");
    try {
      const conflict2 = await invoke<PortConflict | null>("check_port", { port: conflict.port });
      if (conflict2) {
        setErrorMsg(`El puerto ${conflict.port} sigue ocupado por '${conflict2.process_name}' (PID ${conflict2.pid})`);
        setActionState("error");
      } else {
        setActionState("killed");
        setTimeout(() => onResolved(), 500);
      }
    } catch {
      onResolved();
    }
  };

  return (
    <div className="port-conflict-overlay">
      <div className="port-conflict-dialog">
        {/* Header */}
        <div className="pcd-header">
          <div className="pcd-icon-wrap warning">
            <AlertTriangle size={28} />
          </div>
          <div>
            <h2>Conflicto de Puerto</h2>
            <p className="pcd-subtitle">El puerto <strong>{conflict.port}</strong> está siendo usado por otro proceso</p>
          </div>
          <button className="pcd-close" onClick={onDismiss} title="Cerrar">
            <XCircle size={20} />
          </button>
        </div>

        {/* Process info card */}
        <div className="pcd-info-card">
          <div className="pcd-info-row">
            <Monitor size={14} />
            <span className="pcd-info-label">Proceso:</span>
            <span className="pcd-info-value">{conflict.process_name}</span>
          </div>
          <div className="pcd-info-row">
            <Zap size={14} />
            <span className="pcd-info-label">PID:</span>
            <span className="pcd-info-value">{conflict.pid}</span>
          </div>
          <div className="pcd-info-row">
            <HardDrive size={14} />
            <span className="pcd-info-label">Memoria:</span>
            <span className="pcd-info-value">{memoryMB} MB</span>
          </div>
        </div>

        {/* Status message */}
        {actionState === "killed" && (
          <div className="pcd-status success">
            <CheckCircle2 size={16} />
            <span>Proceso terminado. Reiniciando servidor...</span>
          </div>
        )}
        {actionState === "error" && (
          <div className="pcd-status error">
            <XCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Suggested port */}
        {suggestedPort && actionState !== "killed" && (
          <div className="pcd-suggested">
            <div className="pcd-suggested-text">
              <ArrowRight size={14} />
              <span>Puerto alternativo disponible: <strong>{suggestedPort}</strong></span>
            </div>
            <button className="btn primary small" onClick={handleAcceptPort}>
              <CheckCircle2 size={14} /> Usar puerto {suggestedPort}
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="pcd-actions">
          <button
            className="btn danger pcd-btn"
            onClick={handleKill}
            disabled={actionState === "killing" || actionState === "killed"}
          >
            {actionState === "killing" ? <Loader2 size={16} className="spin" /> : <Skull size={16} />}
            Matar proceso
          </button>

          <button
            className="btn secondary pcd-btn"
            onClick={handleSuggest}
            disabled={actionState === "killing" || actionState === "killed" || actionState === "suggesting"}
          >
            {actionState === "suggesting" ? <Loader2 size={16} className="spin" /> : <Settings size={16} />}
            Sugerir otro puerto
          </button>

          <button
            className="btn secondary pcd-btn"
            onClick={handleRetry}
            disabled={actionState === "killing" || actionState === "killed"}
          >
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>

        {/* Help text */}
        <div className="pcd-help">
          <p><strong>¿Qué pasó?</strong> Otro programa (o una instancia anterior del servidor) está usando el puerto {conflict.port}.</p>
          <p><strong>Opciones:</strong></p>
          <ul>
            <li><Skull size={12} /> <strong>Matar proceso</strong> — Fuerza el cierre del programa ocupante y reinicia el servidor automáticamente.</li>
            <li><Settings size={12} /> <strong>Sugerir otro puerto</strong> — Busca un puerto libre y cambia la configuración.</li>
            <li><RefreshCw size={12} /> <strong>Reintentar</strong> — Si ya cerraste el programa manualmente, reintentá.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
