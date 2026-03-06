import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sun, Moon, MonitorSmartphone } from "lucide-react";
import { useTheme, ThemeMode } from "../hooks/useTheme";

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  const options: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: "light",  label: "Claro",   icon: <Sun size={14} /> },
    { value: "dark",   label: "Oscuro",  icon: <Moon size={14} /> },
    { value: "system", label: "Sistema", icon: <MonitorSmartphone size={14} /> },
  ];

  const handleChange = async (mode: ThemeMode) => {
    setTheme(mode);
    // Persist to settings
    try {
      const settings = await invoke<Record<string, unknown>>("get_settings");
      await invoke("save_settings", {
        settings: { ...settings, theme: mode },
      });
    } catch {
      // Ignore — setting will still work in memory
    }
  };

  return (
    <div className="theme-selector">
      <label className="theme-label">Tema</label>
      <div className="theme-options">
        {options.map((opt) => (
          <button
            key={opt.value}
            className={`theme-option ${theme === opt.value ? "active" : ""}`}
            onClick={() => handleChange(opt.value)}
            title={opt.label}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
