import { Power, Loader2, AlertTriangle } from "lucide-react";
import { useAutostart } from "../hooks/useAutostart";

/**
 * Toggle para la sección de Configuración.
 * Controla si Chavalos Server se inicia automáticamente con el sistema operativo.
 */
export default function AutostartToggle() {
  const { enabled, loading, error, toggle } = useAutostart();

  return (
    <div className="autostart-toggle">
      <div className="autostart-row">
        <div className="autostart-info">
          <Power size={16} className="autostart-icon" />
          <div>
            <span className="autostart-label">
              Iniciar Chavalos Server al encender el equipo
            </span>
            <span className="autostart-hint">
              {enabled
                ? "La app se abrirá automáticamente con Windows"
                : "La app no se abrirá al iniciar el sistema"}
            </span>
          </div>
        </div>

        <button
          className={`toggle-switch ${enabled ? "active" : ""} ${loading ? "loading" : ""}`}
          onClick={toggle}
          disabled={loading}
          title={enabled ? "Desactivar inicio automático" : "Activar inicio automático"}
          aria-label="Inicio automático"
          aria-pressed={enabled}
          role="switch"
        >
          <span className="toggle-knob">
            {loading && <Loader2 size={12} className="spin" />}
          </span>
        </button>
      </div>

      {error && (
        <div className="autostart-error">
          <AlertTriangle size={13} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
