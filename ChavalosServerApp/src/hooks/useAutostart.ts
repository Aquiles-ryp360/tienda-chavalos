import { useState, useEffect, useCallback } from "react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

export interface UseAutostart {
  /** true = la app se inicia con el sistema */
  enabled: boolean;
  /** true mientras se lee o cambia el estado */
  loading: boolean;
  /** mensaje de error si el SO bloqueó la acción */
  error: string | null;
  /** Alternar el estado (toggle) */
  toggle: () => Promise<void>;
  /** Forzar activar */
  activate: () => Promise<void>;
  /** Forzar desactivar */
  deactivate: () => Promise<void>;
}

/**
 * Hook para controlar el autostart de la aplicación al encender el equipo.
 * Usa el plugin `tauri-plugin-autostart` internamente.
 */
export function useAutostart(): UseAutostart {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Leer estado inicial
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await isEnabled();
        if (!cancelled) {
          setEnabled(current);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(`No se pudo leer el estado de inicio automático: ${e}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const activate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await enable();
      const confirmed = await isEnabled();
      setEnabled(confirmed);
      if (!confirmed) {
        setError("El sistema no permitió activar el inicio automático.");
      }
    } catch (e) {
      setError(`Error al activar inicio automático: ${e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const deactivate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await disable();
      const confirmed = await isEnabled();
      setEnabled(confirmed);
    } catch (e) {
      setError(`Error al desactivar inicio automático: ${e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = useCallback(async () => {
    if (enabled) {
      await deactivate();
    } else {
      await activate();
    }
  }, [enabled, activate, deactivate]);

  return { enabled, loading, error, toggle, activate, deactivate };
}
