import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Users, RefreshCw, Smartphone, Monitor } from "lucide-react";

interface ConnectedDevice {
  ip: string;
  address: string;
  state: string;
}

interface DeviceMonitorProps {
  isRunning: boolean;
}

export default function DeviceMonitor({ isRunning }: DeviceMonitorProps) {
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDevices = useCallback(async () => {
    if (!isRunning) {
      setDevices([]);
      return;
    }
    setLoading(true);
    try {
      const result = await invoke<ConnectedDevice[]>("get_connected_devices");
      setDevices(result);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, [isRunning]);

  // Poll every 8 seconds when server is running
  useEffect(() => {
    if (!isRunning) {
      setDevices([]);
      return;
    }

    fetchDevices();
    const interval = setInterval(fetchDevices, 8000);
    return () => clearInterval(interval);
  }, [isRunning, fetchDevices]);

  return (
    <div className="devices-panel">
      <div className="devices-header">
        <div className="devices-title">
          <Users size={16} />
          <span>Dispositivos Conectados</span>
          <span className="device-count">{devices.length}</span>
        </div>
        <button
          className="icon-btn tiny"
          onClick={fetchDevices}
          title="Actualizar"
          disabled={!isRunning}
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} />
        </button>
      </div>

      <div className="devices-content">
        {!isRunning ? (
          <div className="devices-empty">
            <Monitor size={20} />
            <span>Inicia el servidor para monitorear dispositivos</span>
          </div>
        ) : devices.length === 0 ? (
          <div className="devices-empty">
            <Smartphone size={20} />
            <span>Sin dispositivos conectados</span>
          </div>
        ) : (
          <div className="devices-list">
            {devices.map((d, i) => (
              <div key={i} className="device-item">
                <Smartphone size={14} />
                <div className="device-info">
                  <span className="device-ip">{d.ip}</span>
                  <span className="device-addr">{d.address}</span>
                </div>
                <span className={`device-status ${d.state.toLowerCase()}`}>
                  {d.state}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
