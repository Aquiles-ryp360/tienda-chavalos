use std::borrow::Cow;
// Prevents additional console window on Windows in release
#[cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod diag_terminal;

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{
    CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem,
    Window,
};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// ===== HELPER: RESOLVE RESOURCE WITH MULTIPLE CANDIDATES =====
/// Attempts to resolve a resource file by trying multiple path candidates.
/// Returns the first path that actually exists on disk.
/// Logs diagnostic information to help debug resource resolution issues.
fn resolve_resource_existing(
    app_handle: &tauri::AppHandle,
    window: &Window,
    resource_name: &str,
    candidates: &[&str],
) -> Result<PathBuf, String> {
    let resource_dir = app_handle
        .path_resolver()
        .resource_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "<no resource_dir>".to_string());

    window
        .emit(
            "server-log",
            LogPayload {
                message: format!(
                    "🔍 [RESOURCE] Resolviendo '{}' | resource_dir: {}",
                    resource_name, resource_dir
                ),
                level: "info".to_string(),
            },
        )
        .ok();

    let mut diagnostics = Vec::new();

    for candidate in candidates {
        let resolved = app_handle.path_resolver().resolve_resource(candidate);
        let exists = resolved.as_ref().map(|p| p.exists()).unwrap_or(false);

        let diagnostic = format!(
            "  - candidato: '{}' → resolved: {:?}, exists: {}",
            candidate,
            resolved.as_ref().map(|p| p.to_string_lossy().to_string()),
            exists
        );
        diagnostics.push(diagnostic.clone());

        window
            .emit(
                "server-log",
                LogPayload {
                    message: diagnostic,
                    level: "info".to_string(),
                },
            )
            .ok();

        if exists {
            let final_path = resolved.unwrap();
            window
                .emit(
                    "server-log",
                    LogPayload {
                        message: format!(
                            "✅ [RESOURCE] '{}' encontrado: {:?}",
                            resource_name, final_path
                        ),
                        level: "success".to_string(),
                    },
                )
                .ok();
            return Ok(final_path);
        }
    }

    // None found - build detailed error
    let error_msg = format!(
        "❌ [RESOURCE] No se encontró '{}'\n\
         resource_dir: {}\n\
         Candidatos intentados:\n{}\n\
         \n\
         💡 POSIBLES CAUSAS:\n\
         - Build sin resources: ejecuta build.ps1 completo\n\
         - Instalación incorrecta: reinstala el MSI/NSIS\n\
         - tauri.conf.json incorrecto: verifica bundle.resources\n\
         - Staging incompleto: verifica src-tauri/resources/ antes del build",
        resource_name,
        resource_dir,
        diagnostics.join("\n")
    );

    window
        .emit(
            "server-log",
            LogPayload {
                message: error_msg.clone(),
                level: "error".to_string(),
            },
        )
        .ok();

    Err(error_msg)
}

// State structures
#[derive(Default, Serialize, Deserialize, Clone)]
struct AppSettings {
    project_path: String,
    port: u16,
    mode: String,
    start_minimized: bool,
    auto_start: bool,
}

#[derive(Default)]
struct ServerState {
    process: Option<Child>,
    status: String,
    /// Path to project root used when starting server (for consistent stop)
    project_root: Option<PathBuf>,
}

struct AppState {
    server: Mutex<ServerState>,
    settings: Mutex<AppSettings>,
}

// Get settings file path
fn get_settings_path() -> PathBuf {
    let mut path = tauri::api::path::app_data_dir(&tauri::Config::default())
        .unwrap_or_else(|| PathBuf::from("."));
    path.push("chavalos-server");
    fs::create_dir_all(&path).ok();
    path.push("settings.json");
    path
}

// Load settings
fn load_settings() -> AppSettings {
    let path = get_settings_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(settings) = serde_json::from_str(&content) {
                return settings;
            }
        }
    }

    // Default settings - try to detect project path
    let default_path = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| String::from("D:\\Aquiles\\Tienda_Chavalos_Virtual_web"));

    AppSettings {
        project_path: default_path,
        port: 3000,
        mode: "dev".to_string(),
        start_minimized: false,
        auto_start: false,
    }
}

// Save settings
fn save_settings_to_file(settings: &AppSettings) -> Result<(), String> {
    let path = get_settings_path();
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Error serializando settings: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Error escribiendo settings: {}", e))?;
    Ok(())
}

// Commands
#[tauri::command]
fn get_settings(state: tauri::State<AppState>) -> Result<AppSettings, String> {
    let settings = state.settings.lock().unwrap();
    Ok(settings.clone())
}

#[tauri::command]
fn save_settings(settings: AppSettings, state: tauri::State<AppState>) -> Result<(), String> {
    save_settings_to_file(&settings)?;
    let mut app_settings = state.settings.lock().unwrap();
    *app_settings = settings.clone();

    // Handle auto-start
    #[cfg(target_os = "windows")]
    {
        use tauri::api::path::local_data_dir;
        if let Some(mut startup_path) = local_data_dir() {
            startup_path
                .push("Microsoft\\Windows\\Start Menu\\Programs\\Startup\\ChavalosServer.lnk");

            if settings.auto_start {
                // Create shortcut (simplified - in production use proper Windows API)
                // This would require additional Windows-specific crates
            } else {
                // Remove shortcut if exists
                let _ = fs::remove_file(startup_path);
            }
        }
    }

    Ok(())
}

#[tauri::command]
async fn start_server(window: Window, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let settings = state.settings.lock().unwrap().clone();
    // ===== PATH NORMALIZATION HELPER =====
    fn normalize_win_path(p: &str) -> Cow<str> {
        if p.starts_with(r"\\?\UNC\") {
            Cow::Owned(format!(r"\\{}", &p[8..]))
        } else if p.starts_with(r"\\?\") {
            Cow::Borrowed(&p[4..])
        } else {
            Cow::Borrowed(p)
        }
    }

    // Check if already running
    {
        let server = state.server.lock().unwrap();
        if server.process.is_some() {
            return Err("Servidor ya está corriendo".to_string());
        }
    }

    // Emit status change
    window.emit("server-status", "starting").ok();
    window
        .emit(
            "server-log",
            LogPayload {
                message: "Iniciando servidor...".to_string(),
                level: "info".to_string(),
            },
        )
        .ok();

    // ===== DIAGNÓSTICO COMPLETO =====
    let app_handle = window.app_handle();
    let is_release = !cfg!(debug_assertions);

    // Log environment info
    let current_dir = std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| "<unknown>".to_string());

    let app_data_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "<no app_data_dir>".to_string());

    let resource_dir = app_handle
        .path_resolver()
        .resource_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "<no resource_dir>".to_string());

    window
        .emit(
            "server-log",
            LogPayload {
                message: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━".to_string(),
                level: "info".to_string(),
            },
        )
        .ok();

    window
        .emit(
            "server-log",
            LogPayload {
                message: "🔍 [DIAGNÓSTICO INICIAL]".to_string(),
                level: "info".to_string(),
            },
        )
        .ok();

    window
        .emit(
            "server-log",
            LogPayload {
                message: format!("  current_dir: {}", current_dir),
                level: "info".to_string(),
            },
        )
        .ok();

    window
        .emit(
            "server-log",
            LogPayload {
                message: format!("  app_data_dir: {}", app_data_dir),
                level: "info".to_string(),
            },
        )
        .ok();

    window
        .emit(
            "server-log",
            LogPayload {
                message: format!("  resource_dir: {}", resource_dir),
                level: "info".to_string(),
            },
        )
        .ok();

    window
        .emit(
            "server-log",
            LogPayload {
                message: format!("  is_release: {}", is_release),
                level: "info".to_string(),
            },
        )
        .ok();

    window
        .emit(
            "server-log",
            LogPayload {
                message: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━".to_string(),
                level: "info".to_string(),
            },
        )
        .ok();

    // List resource_dir contents if it exists (for debugging)
    if let Some(resource_dir_path) = app_handle.path_resolver().resource_dir() {
        if resource_dir_path.exists() {
            window
                .emit(
                    "server-log",
                    LogPayload {
                        message: format!("📂 [RESOURCE DIR] Contenido de: {:?}", resource_dir_path),
                        level: "info".to_string(),
                    },
                )
                .ok();

            if let Ok(entries) = fs::read_dir(&resource_dir_path) {
                for entry in entries.flatten() {
                    let name = entry.file_name();
                    let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
                    let marker = if is_dir { "📁" } else { "📄" };
                    window
                        .emit(
                            "server-log",
                            LogPayload {
                                message: format!("  {} {}", marker, name.to_string_lossy()),
                                level: "info".to_string(),
                            },
                        )
                        .ok();
                }
            }

            window
                .emit(
                    "server-log",
                    LogPayload {
                        message: "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━".to_string(),
                        level: "info".to_string(),
                    },
                )
                .ok();
        }
    }

    // ===== RESOLVE RESOURCES WITH MULTIPLE CANDIDATES =====
    let script_candidates = ["server-launcher.ps1", "resources/server-launcher.ps1"];

    let anchor_candidates = [
        "bundle/project/web-server/server.js",
        "resources/bundle/project/web-server/server.js",
    ];

    let script_path = resolve_resource_existing(
        &app_handle,
        &window,
        "server-launcher.ps1",
        &script_candidates,
    );

    let anchor_path = resolve_resource_existing(
        &app_handle,
        &window,
        "bundle/project/web-server/server.js",
        &anchor_candidates,
    );

    // ===== DETERMINAR MODO Y PATHS =====
    let (final_script_path, final_project_path, is_production) = if is_release {
        // EN RELEASE: SOLO MODO PRODUCCIÓN, SIN FALLBACK DEV
        let script = script_path.map_err(|e| {
            format!(
                "❌ [RELEASE] server-launcher.ps1 no encontrado en resources empaquetados.\n{}",
                e
            )
        })?;

        let anchor = anchor_path.map_err(|e| {
                format!("❌ [RELEASE] bundle/project/web-server/server.js no encontrado en resources empaquetados.\n{}", e)
            })?;

        // Derivar project_root desde anchor (server.js -> web-server -> project)
        let project_root = anchor
            .parent() // web-server
            .and_then(|p| p.parent()) // project
            .ok_or("❌ [RELEASE] No se pudo derivar project_root desde anchor")?;

        window
            .emit(
                "server-log",
                LogPayload {
                    message: "✅ Modo PRODUCCIÓN: usando recursos empaquetados".to_string(),
                    level: "success".to_string(),
                },
            )
            .ok();

        (script, project_root.to_path_buf(), true)
    } else {
        // EN DEBUG: Intentar resources primero, sino fallback DEV
        match (script_path, anchor_path) {
            (Ok(script), Ok(anchor)) => {
                // Resources disponibles en debug (testing PROD mode)
                let project_root = anchor
                    .parent()
                    .and_then(|p| p.parent())
                    .ok_or("❌ [DEBUG] No se pudo derivar project_root desde anchor")?;

                window
                    .emit(
                        "server-log",
                        LogPayload {
                            message:
                                "✅ [DEBUG] Modo PRODUCCIÓN: usando recursos empaquetados (testing)"
                                    .to_string(),
                            level: "success".to_string(),
                        },
                    )
                    .ok();

                (script, project_root.to_path_buf(), true)
            }
            _ => {
                // Fallback a DEV mode
                window
                    .emit(
                        "server-log",
                        LogPayload {
                            message:
                                "⚠️  [DEBUG] Modo DESARROLLO: usando ruta del proyecto (fallback)"
                                    .to_string(),
                            level: "warn".to_string(),
                        },
                    )
                    .ok();

                let dev_script = PathBuf::from(&settings.project_path)
                    .join("ChavalosServerApp")
                    .join("server-launcher.ps1");

                let dev_project = PathBuf::from(&settings.project_path);

                if !dev_script.exists() {
                    return Err(format!(
                        "❌ [DEBUG] Script no encontrado en DEV: {:?}",
                        dev_script
                    ));
                }

                (dev_script, dev_project, false)
            }
        }
    };


    // Log RAW paths
    window.emit("server-log", LogPayload {
        message: format!("RAW_SCRIPT_PATH={:?}", final_script_path),
        level: "info".to_string(),
    }).ok();
    window.emit("server-log", LogPayload {
        message: format!("RAW_PROJECT_ROOT={:?}", final_project_path),
        level: "info".to_string(),
    }).ok();

    // Normalize paths
    let norm_script_path = normalize_win_path(final_script_path.to_str().unwrap());
    let norm_project_root = normalize_win_path(final_project_path.to_str().unwrap());

    // Log normalized paths
    window.emit("server-log", LogPayload {
        message: format!("NORM_SCRIPT_PATH={}", norm_script_path),
        level: "info".to_string(),
    }).ok();
    window.emit("server-log", LogPayload {
        message: format!("NORM_PROJECT_ROOT={}", norm_project_root),
        level: "info".to_string(),
    }).ok();


    // Build PowerShell command with normalized paths
    let mut cmd = Command::new("powershell.exe");
    let mut ps_args = vec![
        "-ExecutionPolicy", "Bypass",
        "-NoProfile",
        "-File", norm_script_path.as_ref(),
        "-ProjectRoot", norm_project_root.as_ref(),
        "-Mode",
        if is_production { "prod" } else { &settings.mode },
        "-Port", &settings.port.to_string(),
    ];
    cmd.args(&ps_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW on Windows
    }


    // Log the exact command
    window.emit("server-log", LogPayload {
        message: format!("CMD=powershell.exe {}", ps_args.join(" ")), // already normalized
        level: "info".to_string(),
    }).ok();

    let mut child = cmd.spawn().map_err(|e| format!("Error iniciando PowerShell: {}", e))?;

    // Capture stdout
    if let Some(stdout) = child.stdout.take() {
        let window_clone = window.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
                let level = if line.contains("ERROR") || line.contains("❌") {
                    "error"
                } else if line.contains("WARN") || line.contains("⚠️") {
                    "warn"
                } else if line.contains("✅") || line.contains("OK") {
                    "success"
                } else {
                    "info"
                };

                window_clone
                    .emit(
                        "server-log",
                        LogPayload {
                            message: line.clone(),
                            level: level.to_string(),
                        },
                    )
                    .ok();

                // Parse server info from output
                if line.contains("http://") {
                    if let Some(url_start) = line.find("http://") {
                        if let Some(url_end) = line[url_start..].find(char::is_whitespace) {
                            let url = &line[url_start..url_start + url_end];

                            // Parse IP
                            if let Some(ip_start) = url.find("://").map(|i| i + 3) {
                                if let Some(ip_end) = url[ip_start..].find(':') {
                                    let ip = &url[ip_start..ip_start + ip_end];

                                    window_clone
                                        .emit(
                                            "server-info",
                                            ServerInfo {
                                                local_url: format!("http://localhost:{}", 3000),
                                                lan_url: url.to_string(),
                                                lan_ip: ip.to_string(),
                                                qr_path: Some(
                                                    PathBuf::from(&line)
                                                        .parent()
                                                        .unwrap()
                                                        .join("LAN-QR.png")
                                                        .to_string_lossy()
                                                        .to_string(),
                                                ),
                                            },
                                        )
                                        .ok();
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    // Capture stderr
    if let Some(stderr) = child.stderr.take() {
        let window_clone = window.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                window_clone
                    .emit(
                        "server-log",
                        LogPayload {
                            message: line,
                            level: "error".to_string(),
                        },
                    )
                    .ok();
            }
        });
    }

    // Store process AND project_root
    {
        let mut server = state.server.lock().unwrap();
        server.process = Some(child);
        server.status = "running".to_string();
        server.project_root = Some(final_project_path.clone());
    }

    window.emit("server-status", "running").ok();
    window
        .emit(
            "server-log",
            LogPayload {
                message: "Servidor iniciado correctamente".to_string(),
                level: "success".to_string(),
            },
        )
        .ok();

    Ok(())
}

#[tauri::command]
async fn stop_server(window: Window, state: tauri::State<'_, AppState>) -> Result<(), String> {
    window
        .emit(
            "server-log",
            LogPayload {
                message: "Deteniendo servidor...".to_string(),
                level: "info".to_string(),
            },
        )
        .ok();

    let mut server = state.server.lock().unwrap();

    if let Some(mut process) = server.process.take() {
        // Lógica que depende de `process`
        let _ = process.kill();

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        if let Some(stdout) = stdout {
            let window_clone = Arc::clone(&window_arc);
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines().map_while(Result::ok) {
                    let level = if line.contains("ERROR") || line.contains("❌") {
                        "error"
                    } else if line.contains("WARN") || line.contains("⚠️") {
                        "warn"
                    } else if line.contains("✅") || line.contains("OK") {
                        "success"
                    } else {
                        "info"
                    };
                    window_clone.emit("server-log", LogPayload {
                        message: line.clone(),
                        level: level.to_string(),
                    }).ok();
                }
            });
        }

        if let Some(stderr) = stderr {
            let window_clone = Arc::clone(&window_arc);
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines().map_while(Result::ok) {
                    window_clone.emit("server-log", LogPayload {
                        message: format!("[stderr] {}", line),
                        level: "error".to_string(),
                    }).ok();
                }
            });
        }

        let status = child.wait().map_err(|e| format!("Error esperando PowerShell: {}", e))?;
        let exit_code = status.code().unwrap_or(-1);
        if exit_code != 0 {
            let mut stderr_full = String::new();
            if let Some(mut stderr) = child.stderr {
                use std::io::Read;
                let _ = stderr.read_to_string(&mut stderr_full);
            }
            let tail = if stderr_full.len() > 2000 {
                &stderr_full[stderr_full.len()-2000..]
            } else {
                &stderr_full
            };
            window_arc.emit("server-log", LogPayload {
                message: format!("LAUNCHER_FAILED exit={}", exit_code),
                level: "error".to_string(),
            }).ok();
            window_arc.emit("server-log", LogPayload {
                message: format!("[stderr tail]\n{}", tail),
                level: "error".to_string(),
            }).ok();
        }

        server.project_root = None;
        server.status = "stopped".to_string();

        window.emit(
            "server-log",
            LogPayload {
                message: "✅ Servidor detenido correctamente".to_string(),
                level: "success".to_string(),
            },
        ).ok();
    } else {
        // Caso sin proceso
        window.emit(
            "server-log",
            LogPayload {
                message: "No hay servidor corriendo".to_string(),
                level: "warn".to_string(),
            },
        ).ok();
    }

    // Lógica que no depende de `process`
    let result = Command::new("docker")
        .args(["compose", "down"])
        .current_dir(docker_path)
        .output();

    match result {
        Ok(output) => {
            if output.status.success() {
                window.emit(
                    "server-log",
                    LogPayload {
                        message: "✅ Docker compose down ejecutado correctamente".to_string(),
                        level: "success".to_string(),
                    },
                ).ok();
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                window.emit(
                    "server-log",
                    LogPayload {
                        message: format!("⚠️  docker compose down warning: {}", stderr),
                        level: "warn".to_string(),
                    },
                ).ok();
            }
        }
        Err(e) => {
            window.emit(
                "server-log",
                LogPayload {
                    message: format!("⚠️  No se pudo ejecutar docker compose: {}", e),
                    level: "warn".to_string(),
                },
            ).ok();
        }
    }

    Ok(())
}

#[tauri::command]
fn copy_to_clipboard(text: String) -> Result<(), String> {
    use clipboard_win::{formats, set_clipboard};
    set_clipboard(formats::Unicode, text)
        .map_err(|e| format!("Error copiando al portapapeles: {}", e))
}

#[tauri::command]
async fn export_logs(logs: String) -> Result<(), String> {
    use tauri::api::dialog::blocking::FileDialogBuilder;

    if let Some(path) = FileDialogBuilder::new()
        .add_filter("Text", &["txt"])
        .set_file_name("chavalos-logs.txt")
        .save_file()
    {
        fs::write(path, logs).map_err(|e| format!("Error guardando logs: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
async fn open_file(path: String) -> Result<(), String> {
    Command::new("cmd")
        .args(["/C", "start", "", &path])
        .spawn()
        .map_err(|e| format!("Error abriendo archivo: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn select_folder() -> Result<String, String> {
    use tauri::api::dialog::blocking::FileDialogBuilder;

    if let Some(path) = FileDialogBuilder::new()
        .set_title("Seleccionar carpeta del proyecto")
        .pick_folder()
    {
        return Ok(path.to_string_lossy().to_string());
    }

    Err("No se seleccionó carpeta".to_string())
}

// Payload structures
#[derive(Clone, Serialize)]
struct LogPayload {
    message: String,
    level: String,
}

#[derive(Clone, Serialize)]
struct ServerInfo {
    local_url: String,
    lan_url: String,
    lan_ip: String,
    qr_path: Option<String>,
}

fn main() {
    // Load settings
    let settings = load_settings();

    // Create system tray
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("show".to_string(), "Mostrar"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("start".to_string(), "Iniciar Servidor"))
        .add_item(CustomMenuItem::new("stop".to_string(), "Detener Servidor"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("quit".to_string(), "Salir"));

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .manage(AppState {
            server: Mutex::new(ServerState::default()),
            settings: Mutex::new(settings),
        })
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                let window = app.get_window("main").unwrap();
                window.show().unwrap();
                window.set_focus().unwrap();
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "show" => {
                    let window = app.get_window("main").unwrap();
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
                "start" => {
                    let window = app.get_window("main").unwrap();
                    let state = app.state::<AppState>();
                    tauri::async_runtime::block_on(async {
                        start_server(window, state).await.ok();
                    });
                }
                "stop" => {
                    let window = app.get_window("main").unwrap();
                    let state = app.state::<AppState>();
                    tauri::async_runtime::block_on(async {
                        stop_server(window, state).await.ok();
                    });
                }
                "quit" => {
                    std::process::exit(0);
                }
                _ => {}
            },
            _ => {}
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                // Instead of closing, hide to tray
                event.window().hide().unwrap();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            start_server,
            stop_server,
            copy_to_clipboard,
            export_logs,
            open_file,
            select_folder,
            diag_terminal::diag_check_enabled,
            diag_terminal::diag_unlock,
            diag_terminal::diag_lock,
            diag_terminal::diag_run_powershell,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
