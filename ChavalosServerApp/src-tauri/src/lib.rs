// ============================================================
// Chavalos Server - Tauri v2
// Orquestación: Docker → PostgreSQL → Node.js (Next.js standalone)
// ============================================================

use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use tauri::{Emitter, Manager};

type Window = tauri::WebviewWindow;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// ====================================================================
// PAYLOADS
// ====================================================================

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
}

#[derive(Clone, Serialize)]
struct BootStage {
    stage: String,
    message: String,
}

// ====================================================================
// STATE
// ====================================================================

#[derive(Default, Serialize, Deserialize, Clone)]
struct AppSettings {
    project_path: String,
    port: u16,
    auto_start: bool,
}

#[derive(Default)]
struct ServerState {
    process: Option<Child>,
    status: String,
    project_root: Option<PathBuf>,
}

struct AppState {
    server: Mutex<ServerState>,
    settings: Mutex<AppSettings>,
}

// ====================================================================
// SETTINGS PERSISTENCE
// ====================================================================

fn get_settings_path() -> PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    let mut path = PathBuf::from(appdata);
    path.push("com.chavalos.admin");
    fs::create_dir_all(&path).ok();
    path.push("settings.json");
    path
}

fn load_settings() -> AppSettings {
    let path = get_settings_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(s) = serde_json::from_str(&content) {
                return s;
            }
        }
    }
    AppSettings {
        project_path: std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default(),
        port: 3000,
        auto_start: false,
    }
}

fn save_settings_to_file(settings: &AppSettings) -> Result<(), String> {
    let path = get_settings_path();
    let json = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Error serializando settings: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("Error escribiendo settings: {}", e))?;
    Ok(())
}

// ====================================================================
// HELPERS
// ====================================================================

/// Emit log to the frontend
fn emit_log(window: &Window, message: &str, level: &str) {
    window
        .emit("server-log", LogPayload { message: message.to_string(), level: level.to_string() })
        .ok();
}

/// Emit boot stage to frontend
fn emit_stage(window: &Window, stage: &str, message: &str) {
    window
        .emit("boot-stage", BootStage { stage: stage.to_string(), message: message.to_string() })
        .ok();
    emit_log(window, &format!("🔧 [{}] {}", stage.to_uppercase(), message), "info");
}

/// Strip Windows \\?\ prefix
fn normalize_path(p: &str) -> Cow<'_, str> {
    if p.starts_with(r"\\?\UNC\") {
        Cow::Owned(format!(r"\\{}", &p[8..]))
    } else if p.starts_with(r"\\?\") {
        Cow::Borrowed(&p[4..])
    } else {
        Cow::Borrowed(p)
    }
}

/// Find node.exe in PATH
fn which_node() -> Option<PathBuf> {
    Command::new("where")
        .arg("node.exe")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| {
            String::from_utf8_lossy(&o.stdout)
                .lines()
                .next()
                .map(|l| PathBuf::from(l.trim()))
                .filter(|p| p.exists())
        })
}

/// Try multiple candidate paths under resource_dir, return first that exists
fn find_resource(resource_dir: &std::path::Path, candidates: &[&str]) -> Option<PathBuf> {
    for candidate in candidates {
        let full = resource_dir.join(candidate);
        if full.exists() {
            return Some(full);
        }
    }
    None
}

// ====================================================================
// DOCKER + POSTGRESQL ORCHESTRATION
// ====================================================================

fn is_docker_running() -> bool {
    let mut cmd = Command::new("docker");
    cmd.args(["info"]).stdout(Stdio::null()).stderr(Stdio::null());
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    cmd.status().map(|s| s.success()).unwrap_or(false)
}

fn start_docker_desktop(window: &Window) -> Result<(), String> {
    emit_stage(window, "docker", "Iniciando Docker Desktop...");

    let candidates = [
        r"C:\Program Files\Docker\Docker\Docker Desktop.exe",
        r"C:\Program Files (x86)\Docker\Docker\Docker Desktop.exe",
    ];

    if let Some(path) = candidates.iter().find(|p| std::path::Path::new(p).exists()) {
        let mut cmd = Command::new(path);
        #[cfg(windows)]
        cmd.creation_flags(0x08000000);
        cmd.spawn().map_err(|e| format!("Error lanzando Docker Desktop: {}", e))?;
        Ok(())
    } else {
        // Fallback: start menu
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "start", "", "Docker Desktop"]);
        #[cfg(windows)]
        cmd.creation_flags(0x08000000);
        cmd.spawn().map_err(|e| format!("Docker Desktop no encontrado: {}", e))?;
        Ok(())
    }
}

fn wait_for_docker(window: &Window, timeout_secs: u64) -> Result<(), String> {
    let start = Instant::now();
    let timeout = Duration::from_secs(timeout_secs);
    while start.elapsed() < timeout {
        if is_docker_running() {
            emit_stage(window, "docker", "Docker está listo ✅");
            return Ok(());
        }
        emit_stage(window, "docker", &format!("Esperando Docker... ({:.0}s)", start.elapsed().as_secs_f64()));
        thread::sleep(Duration::from_secs(3));
    }
    Err(format!("Docker no respondió después de {}s", timeout_secs))
}

fn ensure_docker_volume(window: &Window, volume_name: &str) -> Result<(), String> {
    emit_stage(window, "docker", &format!("Verificando volumen '{}'...", volume_name));
    let mut cmd = Command::new("docker");
    cmd.args(["volume", "create", volume_name]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    let output = cmd.output().map_err(|e| format!("Error creando volumen: {}", e))?;
    if output.status.success() {
        emit_stage(window, "docker", &format!("Volumen '{}' listo ✅", volume_name));
        Ok(())
    } else {
        Err(format!("Error volumen: {}", String::from_utf8_lossy(&output.stderr)))
    }
}

fn docker_compose_up(window: &Window, compose_dir: &std::path::Path) -> Result<(), String> {
    emit_stage(window, "database", "Levantando PostgreSQL con Docker Compose...");
    let mut cmd = Command::new("docker");
    cmd.args(["compose", "up", "-d"]).current_dir(compose_dir);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    let output = cmd.output().map_err(|e| format!("Error docker compose up: {}", e))?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    if output.status.success() || stderr.contains("already") || stderr.contains("Running") {
        emit_stage(window, "database", "Contenedor PostgreSQL activo ✅");
        Ok(())
    } else {
        Err(format!("docker compose up falló: {}", stderr))
    }
}

fn wait_for_postgres(window: &Window, container: &str, timeout_secs: u64) -> Result<(), String> {
    emit_stage(window, "database", "Esperando PostgreSQL...");
    let start = Instant::now();
    let timeout = Duration::from_secs(timeout_secs);
    while start.elapsed() < timeout {
        let mut cmd = Command::new("docker");
        cmd.args(["exec", container, "pg_isready", "-U", "ferre", "-d", "ferreteria"]);
        #[cfg(windows)]
        cmd.creation_flags(0x08000000);
        if let Ok(out) = cmd.output() {
            if out.status.success() {
                emit_stage(window, "database", "PostgreSQL listo ✅");
                return Ok(());
            }
        }
        emit_stage(window, "database", &format!("PostgreSQL iniciando... ({:.0}s)", start.elapsed().as_secs_f64()));
        thread::sleep(Duration::from_secs(2));
    }
    Err(format!("PostgreSQL no respondió después de {}s", timeout_secs))
}

fn db_has_tables(container: &str) -> bool {
    let mut cmd = Command::new("docker");
    cmd.args(["exec", container, "psql", "-U", "ferre", "-d", "ferreteria", "-tAc",
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    cmd.output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<i32>().unwrap_or(0) > 0)
        .unwrap_or(false)
}

fn db_has_seed_data(container: &str) -> bool {
    let mut cmd = Command::new("docker");
    cmd.args(["exec", container, "psql", "-U", "ferre", "-d", "ferreteria", "-tAc",
        "SELECT count(*) FROM products;"]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    cmd.output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<i32>().unwrap_or(0) > 0)
        .unwrap_or(false)
}

fn docker_exec_sql_file(window: &Window, container: &str, host_path: &std::path::Path, label: &str) -> Result<(), String> {
    emit_stage(window, "database", &format!("Ejecutando {}...", label));
    let container_tmp = format!("/tmp/{}", label);
    let src = host_path.to_string_lossy();

    // docker cp file into container
    let mut cmd = Command::new("docker");
    cmd.args(["cp", &src, &format!("{}:{}", container, container_tmp)]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    let out = cmd.output().map_err(|e| format!("docker cp {}: {}", label, e))?;
    if !out.status.success() {
        return Err(format!("docker cp {} falló: {}", label, String::from_utf8_lossy(&out.stderr)));
    }

    // psql -f
    let mut cmd2 = Command::new("docker");
    cmd2.args(["exec", container, "psql", "-U", "ferre", "-d", "ferreteria", "-f", &container_tmp]);
    #[cfg(windows)]
    cmd2.creation_flags(0x08000000);
    let out2 = cmd2.output().map_err(|e| format!("psql -f {}: {}", label, e))?;
    if out2.status.success() {
        emit_stage(window, "database", &format!("{} ejecutado ✅", label));
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&out2.stderr);
        emit_log(window, &format!("⚠️ {}: {}", label, stderr), "warn");
        Ok(()) // warn but don't fail
    }
}

fn import_seed_dump(window: &Window, container: &str, dump_path: &std::path::Path) -> Result<(), String> {
    emit_stage(window, "seed", "Importando datos de producción...");
    let container_tmp = "/tmp/seed-data.dump";
    let src = dump_path.to_string_lossy();

    let mut cmd = Command::new("docker");
    cmd.args(["cp", &src, &format!("{}:{}", container, container_tmp)]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    let out = cmd.output().map_err(|e| format!("docker cp dump: {}", e))?;
    if !out.status.success() {
        return Err(format!("docker cp dump falló: {}", String::from_utf8_lossy(&out.stderr)));
    }

    let mut cmd2 = Command::new("docker");
    cmd2.args(["exec", container, "pg_restore", "--data-only", "--disable-triggers",
        "-U", "ferre", "-d", "ferreteria", container_tmp]);
    #[cfg(windows)]
    cmd2.creation_flags(0x08000000);
    let out2 = cmd2.output().map_err(|e| format!("pg_restore: {}", e))?;
    let stderr = String::from_utf8_lossy(&out2.stderr);
    if out2.status.success() || stderr.is_empty() || stderr.contains("WARNING") {
        emit_stage(window, "seed", "Datos importados ✅");
    } else {
        emit_log(window, &format!("⚠️ pg_restore: {}", &stderr[..stderr.len().min(400)]), "warn");
        emit_stage(window, "seed", "Datos importados con advertencias ⚠️");
    }
    Ok(())
}

/// Full Docker + PostgreSQL + DB orchestration
fn orchestrate_infrastructure(window: &Window, resource_dir: &std::path::Path) -> Result<(), String> {
    // 1. Docker
    emit_stage(window, "docker", "Verificando Docker...");
    if !is_docker_running() {
        emit_stage(window, "docker", "Docker no está corriendo, intentando iniciar...");
        start_docker_desktop(window)?;
        wait_for_docker(window, 90)?;
    } else {
        emit_stage(window, "docker", "Docker ya está corriendo ✅");
    }

    // 2. Volume
    ensure_docker_volume(window, "postgres-local_ferreteria_pgdata")?;

    // 3. Docker Compose Up
    let compose = find_resource(resource_dir, &[
        "docker-compose.yml",
        "resources/docker-compose.yml",
    ]).ok_or("❌ docker-compose.yml no encontrado en resources")?;
    docker_compose_up(window, compose.parent().unwrap())?;

    // 4. Wait for PostgreSQL
    let container = "ferreteria_chavalos_db";
    wait_for_postgres(window, container, 45)?;

    // 5. Init schema if fresh DB
    if !db_has_tables(container) {
        emit_stage(window, "database", "BD vacía, inicializando esquema...");
        let init_sql = find_resource(resource_dir, &[
            "init-db.sql",
            "resources/init-db.sql",
        ]).ok_or("❌ init-db.sql no encontrado")?;
        docker_exec_sql_file(window, container, &init_sql, "init-db.sql")?;

        // 6. Seed data
        if !db_has_seed_data(container) {
            if let Some(dump) = find_resource(resource_dir, &[
                "seed-data.dump",
                "resources/seed-data.dump",
            ]) {
                import_seed_dump(window, container, &dump)?;
            } else {
                emit_stage(window, "seed", "Sin seed-data.dump, BD vacía");
            }
        }
    } else {
        emit_stage(window, "database", "BD ya inicializada ✅");
    }

    emit_stage(window, "ready", "Infraestructura lista, iniciando servidor web...");
    Ok(())
}

// ====================================================================
// TAURI COMMANDS
// ====================================================================

#[tauri::command]
fn get_settings(state: tauri::State<AppState>) -> Result<AppSettings, String> {
    Ok(state.settings.lock().unwrap().clone())
}

#[tauri::command]
fn save_settings(settings: AppSettings, state: tauri::State<AppState>) -> Result<(), String> {
    save_settings_to_file(&settings)?;
    *state.settings.lock().unwrap() = settings;
    Ok(())
}

#[tauri::command]
async fn start_server(window: Window, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let settings = state.settings.lock().unwrap().clone();

    // Already running?
    {
        let server = state.server.lock().unwrap();
        if server.process.is_some() {
            return Err("Servidor ya está corriendo".into());
        }
    }

    window.emit("server-status", "starting").ok();
    emit_log(&window, "Iniciando servidor...", "info");

    let app_handle = window.app_handle().clone();
    let is_release = !cfg!(debug_assertions);

    // Diagnostic info
    let resource_dir_path = app_handle.path().resource_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    emit_log(&window, &format!("resource_dir: {:?}", resource_dir_path), "info");

    // List resource_dir top-level for debugging
    if resource_dir_path.exists() {
        if let Ok(entries) = fs::read_dir(&resource_dir_path) {
            for entry in entries.flatten() {
                let name = entry.file_name();
                let marker = if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) { "📁" } else { "📄" };
                emit_log(&window, &format!("  {} {}", marker, name.to_string_lossy()), "info");
            }
        }
    }

    // ===== DOCKER ORCHESTRATION =====
    match orchestrate_infrastructure(&window, &resource_dir_path) {
        Ok(()) => emit_log(&window, "✅ Docker + PostgreSQL + BD listos", "success"),
        Err(e) => {
            emit_log(&window, &format!("⚠️ Error infraestructura: {}", e), "error");
            emit_log(&window, "⚠️ Continuando sin garantía de BD...", "warn");
        }
    }

    // ===== FIND NODE.EXE =====
    let node_exe = if is_release {
        let exe_dir = std::env::current_exe()
            .map_err(|e| format!("No se pudo obtener exe dir: {}", e))?
            .parent().ok_or("No se pudo obtener directorio del exe")?
            .to_path_buf();

        // Sidecar names
        let node_candidates = [
            exe_dir.join("node-x86_64-pc-windows-msvc.exe"),
            exe_dir.join("node.exe"),
        ];
        node_candidates.iter().find(|p| p.exists()).cloned()
            .ok_or_else(|| format!("❌ node.exe sidecar no encontrado en {:?}", exe_dir))?
    } else {
        which_node().unwrap_or_else(|| PathBuf::from("node"))
    };

    // ===== FIND SERVER.JS =====
    let server_js = find_resource(&resource_dir_path, &[
        "backend/server.js",
        "resources/backend/server.js",
    ]).ok_or("❌ server.js no encontrado en resources")?;

    let project_root = server_js.parent()
        .ok_or("No se pudo derivar project_root")?
        .to_path_buf();

    // Normalize paths (strip \\?\ prefix)
    let node_str = node_exe.to_string_lossy().to_string();
    let server_str = server_js.to_string_lossy().to_string();
    let cwd_str = project_root.to_string_lossy().to_string();
    let n_node = normalize_path(&node_str);
    let n_server = normalize_path(&server_str);
    let n_cwd = normalize_path(&cwd_str);

    emit_log(&window, &format!("CMD: {} {} (cwd: {})", n_node, n_server, n_cwd), "info");

    // ===== LAUNCH NODE.JS =====
    let mut cmd = Command::new(n_node.as_ref());
    cmd.arg(n_server.as_ref())
        .current_dir(n_cwd.as_ref())
        .env("PORT", settings.port.to_string())
        .env("NODE_ENV", "production")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let mut child = cmd.spawn().map_err(|e| format!("Error iniciando Node.js: {}", e))?;

    // Capture stdout
    if let Some(stdout) = child.stdout.take() {
        let w = window.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
                let level = if line.contains("ERROR") || line.contains("❌") { "error" }
                    else if line.contains("WARN") || line.contains("⚠") { "warn" }
                    else if line.contains("✅") || line.contains("OK") { "success" }
                    else { "info" };
                w.emit("server-log", LogPayload { message: line.clone(), level: level.into() }).ok();

                // Parse server URL from output
                if line.contains("http://") {
                    if let Some(url_start) = line.find("http://") {
                        let url_end = line[url_start..].find(char::is_whitespace).unwrap_or(line.len() - url_start);
                        let url = &line[url_start..url_start + url_end];
                        if let Some(ip_start) = url.find("://").map(|i| i + 3) {
                            if let Some(ip_end) = url[ip_start..].find(':') {
                                let ip = &url[ip_start..ip_start + ip_end];
                                let port = url[ip_start + ip_end + 1..].parse::<u16>().unwrap_or(3000);
                                w.emit("server-info", ServerInfo {
                                    local_url: format!("http://localhost:{}", port),
                                    lan_url: url.to_string(),
                                    lan_ip: ip.to_string(),
                                }).ok();
                            }
                        }
                    }
                }
            }
        });
    }

    // Capture stderr
    if let Some(stderr) = child.stderr.take() {
        let w = window.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                w.emit("server-log", LogPayload { message: line, level: "error".into() }).ok();
            }
        });
    }

    // Store state
    {
        let mut server = state.server.lock().unwrap();
        server.process = Some(child);
        server.status = "running".into();
        server.project_root = Some(project_root);
    }

    window.emit("server-status", "running").ok();
    emit_log(&window, "Servidor iniciado correctamente", "success");
    Ok(())
}

#[tauri::command]
async fn stop_server(window: Window, state: tauri::State<'_, AppState>) -> Result<(), String> {
    emit_log(&window, "Deteniendo servidor...", "info");

    let project_root;
    {
        let mut server = state.server.lock().unwrap();
        project_root = server.project_root.take();

        if let Some(mut process) = server.process.take() {
            let _ = process.kill();
            let _ = process.wait();
            emit_log(&window, "✅ Proceso Node.js terminado", "success");
        } else {
            emit_log(&window, "No hay servidor corriendo", "warn");
        }
        server.status = "stopped".into();
    }

    // Stop docker compose
    if let Some(root) = &project_root {
        let mut docker_candidates: Vec<PathBuf> = vec![root.join("docker-compose.yml")];
        if let Some(parent) = root.parent() {
            docker_candidates.push(parent.join("docker-compose.yml"));
        }

        for docker_path in &docker_candidates {
            if docker_path.exists() {
                let dir = docker_path.parent().unwrap();
                let mut cmd = Command::new("docker");
                cmd.args(["compose", "down"]).current_dir(dir);
                #[cfg(windows)]
                cmd.creation_flags(0x08000000);
                match cmd.output() {
                    Ok(out) if out.status.success() => {
                        emit_log(&window, "✅ Docker compose down OK", "success");
                        break;
                    }
                    Ok(out) => {
                        emit_log(&window, &format!("⚠️ docker compose down: {}", String::from_utf8_lossy(&out.stderr)), "warn");
                    }
                    Err(e) => {
                        emit_log(&window, &format!("⚠️ docker compose: {}", e), "warn");
                    }
                }
            }
        }
    }

    // Also try resource_dir
    let app_handle = window.app_handle();
    if let Ok(res_dir) = app_handle.path().resource_dir() {
        let candidates = [
            res_dir.join("docker-compose.yml"),
            res_dir.join("resources").join("docker-compose.yml"),
        ];
        for dc in &candidates {
            if dc.exists() {
                let dir = dc.parent().unwrap();
                let mut cmd = Command::new("docker");
                cmd.args(["compose", "down"]).current_dir(dir);
                #[cfg(windows)]
                cmd.creation_flags(0x08000000);
                if let Ok(out) = cmd.output() {
                    if out.status.success() {
                        emit_log(&window, "✅ Docker compose down (resources) OK", "success");
                        break;
                    }
                }
            }
        }
    }

    window.emit("server-status", "stopped").ok();
    emit_log(&window, "✅ Servidor detenido", "success");
    Ok(())
}

#[tauri::command]
fn copy_to_clipboard(app: tauri::AppHandle, text: String) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard().write_text(text).map_err(|e| format!("Error clipboard: {}", e))
}

#[tauri::command]
async fn export_logs(app: tauri::AppHandle, logs: String) -> Result<(), String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app.dialog().file()
        .add_filter("Text", &["txt"])
        .set_file_name("chavalos-logs.txt")
        .blocking_save_file();
    if let Some(p) = path {
        let pb: PathBuf = p.as_path().ok_or("Ruta inválida")?.to_path_buf();
        fs::write(&pb, logs).map_err(|e| format!("Error guardando: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn select_folder(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app.dialog().file()
        .set_title("Seleccionar carpeta del proyecto")
        .blocking_pick_folder();
    match folder {
        Some(p) => {
            let pb: PathBuf = p.as_path().ok_or("Ruta inválida")?.to_path_buf();
            Ok(pb.to_string_lossy().to_string())
        }
        None => Err("No se seleccionó carpeta".into()),
    }
}

// ====================================================================
// TAURI APP ENTRY
// ====================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let settings = load_settings();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState {
            server: Mutex::new(ServerState::default()),
            settings: Mutex::new(settings),
        })
        .setup(|app| {
            use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
            use tauri::tray::TrayIconBuilder;

            let show_i = MenuItem::with_id(app, "show", "Mostrar", true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let start_i = MenuItem::with_id(app, "start", "Iniciar Servidor", true, None::<&str>)?;
            let stop_i = MenuItem::with_id(app, "stop", "Detener Servidor", true, None::<&str>)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_i, &sep1, &start_i, &stop_i, &sep2, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "start" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let state = app.state::<AppState>();
                                tauri::async_runtime::block_on(async {
                                    let _ = start_server(w, state).await;
                                });
                            }
                        }
                        "stop" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let state = app.state::<AppState>();
                                tauri::async_runtime::block_on(async {
                                    let _ = stop_server(w, state).await;
                                });
                            }
                        }
                        "quit" => std::process::exit(0),
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
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
            select_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
