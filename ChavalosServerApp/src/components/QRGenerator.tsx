import { useEffect, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { invoke } from "@tauri-apps/api/core";
import { Wifi, RefreshCw, Copy, CheckCircle2, AlertCircle } from "lucide-react";

interface NetworkInfo {
  ip: string;
  ssid: string;
  adapter: string;
}

interface QRGeneratorProps {
  port: number;
  isRunning: boolean;
  onCopy: (text: string, label: string) => void;
  copied: string;
}

export default function QRGenerator({ port, isRunning, onCopy, copied }: QRGeneratorProps) {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNetworkInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await invoke<NetworkInfo>("get_network_info");
      setNetworkInfo(info);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling for network changes
  useEffect(() => {
    fetchNetworkInfo();

    const interval = setInterval(async () => {
      try {
        const changed = await invoke<NetworkInfo | null>("check_network_change");
        if (changed) {
          setNetworkInfo(changed);
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [fetchNetworkInfo]);

  const url = networkInfo ? `http://${networkInfo.ip}:${port}` : "";

  return (
    <div className="qr-panel">
      <div className="qr-header">
        <div className="qr-title">
          <Wifi size={16} />
          <span>Código QR — Acceso Red Local</span>
        </div>
        <button
          className="icon-btn tiny"
          onClick={fetchNetworkInfo}
          title="Actualizar IP"
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} />
        </button>
      </div>

      <div className="qr-content">
        {error ? (
          <div className="qr-error">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        ) : networkInfo ? (
          <>
            <div className="qr-code-wrapper">
              <QRCodeSVG
                value={url}
                size={160}
                bgColor="transparent"
                fgColor={isRunning ? "#4ade80" : "#94a3b8"}
                level="M"
                includeMargin={false}
              />
              {!isRunning && <div className="qr-overlay">Servidor detenido</div>}
            </div>
            <div className="qr-info">
              <div className="qr-url">
                <a href={url} target="_blank" rel="noreferrer">{url}</a>
                <button
                  className="copy-btn"
                  onClick={() => onCopy(url, "QR URL")}
                  title="Copiar URL"
                >
                  {copied === "QR URL" ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                </button>
              </div>
              <div className="qr-meta">
                <span className="qr-tag">
                  <Wifi size={10} />
                  {networkInfo.ssid}
                </span>
                <span className="qr-tag">{networkInfo.adapter}</span>
                <span className="qr-tag ip">{networkInfo.ip}</span>
              </div>
              <p className="qr-hint">
                Escanea con tu teléfono para abrir la tienda en la red local
              </p>
            </div>
          </>
        ) : (
          <div className="qr-loading">
            <RefreshCw size={20} className="spin" />
            <span>Detectando red...</span>
          </div>
        )}
      </div>
    </div>
  );
}
