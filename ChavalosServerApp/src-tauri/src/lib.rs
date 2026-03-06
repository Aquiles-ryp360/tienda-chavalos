// ============================================================
// Chavalos Server - Tauri v2
// Orquestación: Docker → PostgreSQL → Node.js (Next.js standalone)
// ============================================================

use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader};
use std::net::UdpSocket;
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

#[derive(Clone, Serialize)]
struct NetworkInfo {
    ip: String,
    ssid: String,
    adapter: String,
}

#[derive(Clone, Serialize)]
struct DiagnosticBundle {
    timestamp: String,
    network: NetworkInfo,
    docker_status: String,
    docker_containers: Vec<String>,
    cpu_usage: f64,
    memory_mb: f64,
    logs: Vec<String>,
    app_version: String,
    os_info: String,
}

#[derive(Clone, Serialize)]
#[allow(dead_code)]
struct ConnectedDevice {
    remote_addr: String,
    method: String,
    path: String,
    timestamp: String,
}

#[derive(Clone, Serialize)]
struct PortConflictInfo {
    port: u16,
    pid: u32,
    process_name: String,
    memory_kb: u64,
}

// ====================================================================
// STATE
// ====================================================================

#[derive(Default, Serialize, Deserialize, Clone)]
struct AppSettings {
    project_path: String,
    port: u16,
    auto_start: bool,
    #[serde(default = "default_theme")]
    theme: String,
}

fn default_theme() -> String {
    "system".to_string()
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
    log_buffer: Mutex<Vec<String>>,
    last_ip: Mutex<String>,
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
        theme: "system".to_string(),
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
    // Buffer logs for diagnostic export
    if let Some(state) = window.try_state::<AppState>() {
        if let Ok(mut buf) = state.log_buffer.lock() {
            let ts = chrono_now();
            buf.push(format!("[{}] [{}] {}", ts, level.to_uppercase(), message));
            if buf.len() > 2000 {
                let drain = buf.len() - 1500;
                buf.drain(..drain);
            }
        }
    }
}

/// Simple timestamp (no chrono crate needed)
fn chrono_now() -> String {
    let output = Command::new("cmd")
        .args(["/C", "echo %TIME% %DATE%"])
        .creation_flags(0x08000000)
        .output();
    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim().to_string(),
        Err(_) => "unknown".to_string(),
    }
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

/// Detect if a port is in use – returns conflict info with process details
fn detect_port_conflict(port: u16) -> Option<PortConflictInfo> {
    let check = Command::new("cmd")
        .args(["/C", &format!("netstat -ano | findstr \":{} \" | findstr LISTENING", port)])
        .creation_flags(0x08000000)
        .output()
        .ok()?;

    let stdout_str = String::from_utf8_lossy(&check.stdout);
    for line in stdout_str.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if let Some(pid_str) = parts.last() {
            if let Ok(pid) = pid_str.parse::<u32>() {
                if pid > 0 {
                    // Get process name and memory via tasklist
                    let (process_name, memory_kb) = get_process_info(pid);
                    return Some(PortConflictInfo {
                        port,
                        pid,
                        process_name,
                        memory_kb,
                    });
                }
            }
        }
    }
    None
}

/// Get process name and memory from PID
fn get_process_info(pid: u32) -> (String, u64) {
    let output = Command::new("tasklist")
        .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
        .creation_flags(0x08000000)
        .output();

    if let Ok(out) = output {
        let line = String::from_utf8_lossy(&out.stdout);
        // CSV format: "process.exe","12345","Console","1","118,696 K"
        let fields: Vec<&str> = line.trim().split(',').collect();
        if fields.len() >= 5 {
            let name = fields[0].trim_matches('"').to_string();
            let mem_str = fields[4].trim_matches('"').trim()
                .replace(" K", "").replace(".", "").replace(",", "");
            let mem = mem_str.trim().parse::<u64>().unwrap_or(0);
            return (name, mem);
        }
    }
    ("desconocido".into(), 0)
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

/// Check if a port has a conflict — returns info or null
#[tauri::command]
fn check_port(port: u16) -> Option<PortConflictInfo> {
    detect_port_conflict(port)
}

/// Kill the process using a specific port, returns success message
#[tauri::command]
fn kill_port_process(window: Window, port: u16) -> Result<String, String> {
    let conflict = detect_port_conflict(port)
        .ok_or_else(|| format!("No hay conflicto en el puerto {}", port))?;

    emit_log(
        &window,
        &format!("🔪 Matando '{}' (PID {}) en puerto {}...", conflict.process_name, conflict.pid, port),
        "warn",
    );

    let kill = Command::new("taskkill")
        .args(["/F", "/PID", &conflict.pid.to_string()])
        .creation_flags(0x08000000)
        .output()
        .map_err(|e| format!("Error ejecutando taskkill: {}", e))?;

    if kill.status.success() {
        thread::sleep(Duration::from_millis(500));
        // Double-check it's actually free
        if detect_port_conflict(port).is_some() {
            emit_log(&window, "⚠️ El proceso persiste. Probá reiniciar la PC.", "error");
            return Err("El proceso no pudo ser terminado completamente".into());
        }
        emit_log(
            &window,
            &format!("✅ Proceso '{}' (PID {}) terminado. Puerto {} libre.", conflict.process_name, conflict.pid, port),
            "success",
        );
        Ok(format!("Proceso '{}' terminado exitosamente", conflict.process_name))
    } else {
        let stderr = String::from_utf8_lossy(&kill.stderr);
        emit_log(
            &window,
            &format!("❌ No se pudo matar PID {}: {}", conflict.pid, stderr.trim()),
            "error",
        );
        Err(format!("No se pudo matar el proceso: {}", stderr.trim()))
    }
}

/// Suggest an available port near the desired one  
#[tauri::command]
fn suggest_available_port(desired: u16) -> u16 {
    // Try from desired+1 up to desired+100
    for p in (desired + 1)..=(desired + 100) {
        if detect_port_conflict(p).is_none() {
            return p;
        }
    }
    // Fallback: try common alternatives
    for p in [3001, 3002, 4000, 5000, 8000, 8080] {
        if detect_port_conflict(p).is_none() {
            return p;
        }
    }
    desired + 1 // last resort
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

    // ===== CHECK PORT CONFLICT (interactive) =====
    {
        let port = settings.port;
        emit_log(&window, &format!("🔍 Verificando si el puerto {} está en uso...", port), "info");
        if let Some(conflict) = detect_port_conflict(port) {
            emit_log(
                &window,
                &format!(
                    "⚠️ ¡CONFLICTO DE PUERTO! El puerto {} está ocupado por '{}' (PID: {}, Memoria: {} KB)",
                    conflict.port, conflict.process_name, conflict.pid, conflict.memory_kb
                ),
                "error",
            );
            emit_log(
                &window,
                "💡 Sugerencias: Matá el proceso ocupante, cambiá el puerto en Configuración, o reiniciá la PC.",
                "warn",
            );
            window.emit("port-conflict", conflict.clone()).ok();
            window.emit("server-status", "stopped").ok();
            return Err(format!(
                "Puerto {} ocupado por '{}' (PID {}). Elegí una acción en el diálogo.",
                conflict.port, conflict.process_name, conflict.pid
            ));
        }
        emit_log(&window, &format!("✅ Puerto {} disponible", port), "success");
    }

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

    let port;
    let project_root;
    {
        let settings = state.settings.lock().unwrap();
        port = settings.port;
    }
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

    // Fallback: also kill any process still holding the port
    {
        let check = Command::new("cmd")
            .args(["/C", &format!("netstat -ano | findstr \":{} \" | findstr LISTENING", port)])
            .creation_flags(0x08000000)
            .output();
        if let Ok(out) = check {
            let stdout_str = String::from_utf8_lossy(&out.stdout);
            for line in stdout_str.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if let Some(pid_str) = parts.last() {
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        if pid > 0 {
                            emit_log(&window, &format!("🔪 Matando proceso zombie en puerto {} (PID {})", port, pid), "warn");
                            let _ = Command::new("taskkill")
                                .args(["/F", "/PID", &pid.to_string()])
                                .creation_flags(0x08000000)
                                .output();
                        }
                    }
                }
            }
        }
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
// NETWORK & DIAGNOSTICS COMMANDS
// ====================================================================

/// Get local Wi-Fi IP address using UDP socket trick (no actual connection)
#[tauri::command]
fn get_local_ip() -> Result<String, String> {
    let socket = UdpSocket::bind("0.0.0.0:0")
        .map_err(|e| format!("Error binding socket: {}", e))?;
    socket
        .connect("8.8.8.8:80")
        .map_err(|e| format!("Error connecting: {}", e))?;
    let addr = socket
        .local_addr()
        .map_err(|e| format!("Error getting local addr: {}", e))?;
    Ok(addr.ip().to_string())
}

/// Get current Wi-Fi SSID on Windows
#[tauri::command]
fn get_wifi_ssid() -> Result<String, String> {
    let mut cmd = Command::new("netsh");
    cmd.args(["wlan", "show", "interfaces"]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    let output = cmd.output().map_err(|e| format!("Error netsh: {}", e))?;
    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("SSID") && !trimmed.starts_with("SSID BSSID") && !trimmed.contains("BSSID") {
            if let Some(val) = trimmed.split(':').nth(1) {
                let ssid = val.trim().to_string();
                if !ssid.is_empty() {
                    return Ok(ssid);
                }
            }
        }
    }
    Ok("No Wi-Fi".to_string())
}

/// Get full network info: IP + SSID + adapter
#[tauri::command]
fn get_network_info() -> Result<NetworkInfo, String> {
    let ip = get_local_ip().unwrap_or_else(|_| "desconocida".into());
    let ssid = get_wifi_ssid().unwrap_or_else(|_| "desconocido".into());

    // Get adapter name
    let mut cmd = Command::new("netsh");
    cmd.args(["wlan", "show", "interfaces"]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    let adapter = match cmd.output() {
        Ok(o) => {
            let text = String::from_utf8_lossy(&o.stdout);
            text.lines()
                .find(|l| l.trim().starts_with("Nombre") || l.trim().starts_with("Name"))
                .and_then(|l| l.split(':').nth(1))
                .map(|v| v.trim().to_string())
                .unwrap_or_else(|| "Desconocido".to_string())
        }
        Err(_) => "Desconocido".to_string(),
    };

    Ok(NetworkInfo { ip, ssid, adapter })
}

/// Poll network changes - returns new IP if changed
#[tauri::command]
fn check_network_change(state: tauri::State<AppState>) -> Result<Option<NetworkInfo>, String> {
    let current_ip = get_local_ip().unwrap_or_default();
    let mut last = state.last_ip.lock().unwrap();
    if *last != current_ip && !current_ip.is_empty() {
        *last = current_ip.clone();
        let info = get_network_info()?;
        Ok(Some(info))
    } else {
        if last.is_empty() {
            *last = current_ip;
        }
        Ok(None)
    }
}

/// Get Docker status info
#[tauri::command]
fn get_docker_status() -> Result<String, String> {
    let mut cmd = Command::new("docker");
    cmd.args(["info", "--format", "{{.ServerVersion}}"]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    match cmd.output() {
        Ok(o) if o.status.success() => {
            Ok(format!("Docker v{}", String::from_utf8_lossy(&o.stdout).trim()))
        }
        _ => Ok("Docker no disponible".to_string()),
    }
}

/// Get Docker containers list
#[tauri::command]
fn get_docker_containers() -> Result<Vec<String>, String> {
    let mut cmd = Command::new("docker");
    cmd.args(["ps", "--format", "{{.Names}} | {{.Status}} | {{.Image}}"]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    match cmd.output() {
        Ok(o) if o.status.success() => {
            let text = String::from_utf8_lossy(&o.stdout);
            Ok(text.lines().map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect())
        }
        _ => Ok(vec![]),
    }
}

/// Get CPU and Memory usage of current process
#[tauri::command]
fn get_system_stats() -> Result<HashMap<String, f64>, String> {
    let pid = std::process::id();
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-Command",
        &format!(
            "Get-Process -Id {} | Select-Object CPU, WorkingSet64 | ConvertTo-Json",
            pid
        )]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    let mut stats = HashMap::new();
    match cmd.output() {
        Ok(o) if o.status.success() => {
            let text = String::from_utf8_lossy(&o.stdout);
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                stats.insert("cpu".to_string(), val["CPU"].as_f64().unwrap_or(0.0));
                stats.insert(
                    "memory_mb".to_string(),
                    val["WorkingSet64"].as_f64().unwrap_or(0.0) / 1_048_576.0,
                );
            }
        }
        _ => {
            stats.insert("cpu".to_string(), 0.0);
            stats.insert("memory_mb".to_string(), 0.0);
        }
    }
    Ok(stats)
}

/// Export full diagnostic bundle
#[tauri::command]
fn get_diagnostic_bundle(state: tauri::State<AppState>) -> Result<DiagnosticBundle, String> {
    let network = get_network_info().unwrap_or(NetworkInfo {
        ip: "desconocida".into(),
        ssid: "desconocido".into(),
        adapter: "desconocido".into(),
    });
    let docker_status = get_docker_status().unwrap_or_else(|_| "no disponible".into());
    let docker_containers = get_docker_containers().unwrap_or_default();
    let sys_stats = get_system_stats().unwrap_or_default();

    let logs = state.log_buffer.lock().unwrap().clone();

    // OS info
    let mut cmd = Command::new("cmd");
    cmd.args(["/C", "ver"]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);
    let os_info = cmd.output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|_| "Windows".to_string());

    Ok(DiagnosticBundle {
        timestamp: chrono_now(),
        network,
        docker_status,
        docker_containers,
        cpu_usage: *sys_stats.get("cpu").unwrap_or(&0.0),
        memory_mb: *sys_stats.get("memory_mb").unwrap_or(&0.0),
        logs,
        app_version: "1.1.0".to_string(),
        os_info,
    })
}

/// Save diagnostic bundle to file
#[tauri::command]
async fn export_diagnostic_bundle(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    use tauri_plugin_dialog::DialogExt;
    let bundle = get_diagnostic_bundle(state)?;
    let json = serde_json::to_string_pretty(&bundle)
        .map_err(|e| format!("Error serializando diagnóstico: {}", e))?;

    let path = app.dialog().file()
        .add_filter("JSON", &["json"])
        .set_file_name("chavalos-diagnostic.json")
        .blocking_save_file();

    if let Some(p) = path {
        let pb: PathBuf = p.as_path().ok_or("Ruta inválida")?.to_path_buf();
        fs::write(&pb, json).map_err(|e| format!("Error guardando: {}", e))?;
    }
    Ok(())
}

/// Save latest.log file to app data directory
#[tauri::command]
fn save_latest_log(state: tauri::State<AppState>) -> Result<String, String> {
    let logs = state.log_buffer.lock().unwrap();
    let log_dir = get_settings_path().parent().unwrap().to_path_buf();
    let log_path = log_dir.join("latest.log");
    let content = logs.join("\n");
    fs::write(&log_path, &content)
        .map_err(|e| format!("Error guardando log: {}", e))?;
    Ok(log_path.to_string_lossy().to_string())
}

/// Open default email client for sending diagnostic report
#[tauri::command]
async fn send_report_email(app: tauri::AppHandle) -> Result<(), String> {
    #[allow(deprecated)]
    use tauri_plugin_shell::ShellExt;
    let subject = "Reporte%20Chavalos%20Server";
    let body = "Adjuntar%20el%20archivo%20chavalos-diagnostic.json%20generado%20desde%20la%20app.";
    let mailto = format!("mailto:soporte@chavalos.com?subject={}&body={}", subject, body);
    #[allow(deprecated)]
    app.shell().open(&mailto, None)
        .map_err(|e| format!("Error abriendo email: {}", e))?;
    Ok(())
}

/// Get active connections to the Next.js server (via netstat)
#[tauri::command]
fn get_connected_devices(state: tauri::State<AppState>) -> Result<Vec<HashMap<String, String>>, String> {
    let port = state.settings.lock().unwrap().port;
    let mut cmd = Command::new("netstat");
    cmd.args(["-an"]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000);

    let output = cmd.output().map_err(|e| format!("Error netstat: {}", e))?;
    let text = String::from_utf8_lossy(&output.stdout);

    let local_ip = get_local_ip().unwrap_or_default();
    let port_str = port.to_string();
    let mut devices: Vec<HashMap<String, String>> = Vec::new();
    let mut seen_ips: std::collections::HashSet<String> = std::collections::HashSet::new();

    for line in text.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 4 && parts[0] == "TCP" {
            let local_addr = parts[1];
            let remote_addr = parts[2];
            let state_str = parts[3];

            // Match connections to our port
            if local_addr.ends_with(&format!(":{}", port_str)) && state_str == "ESTABLISHED" {
                // Extract remote IP
                if let Some(colon_pos) = remote_addr.rfind(':') {
                    let remote_ip = &remote_addr[..colon_pos];
                    // Skip localhost connections and already seen IPs
                    if remote_ip != "127.0.0.1" && remote_ip != local_ip && remote_ip != "[::1]" {
                        if seen_ips.insert(remote_ip.to_string()) {
                            let mut device = HashMap::new();
                            device.insert("ip".to_string(), remote_ip.to_string());
                            device.insert("address".to_string(), remote_addr.to_string());
                            device.insert("state".to_string(), state_str.to_string());
                            devices.push(device);
                        }
                    }
                }
            }
        }
    }

    Ok(devices)
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
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("Chavalos Server")
                .build(),
        )
        .manage(AppState {
            server: Mutex::new(ServerState::default()),
            settings: Mutex::new(settings),
            log_buffer: Mutex::new(Vec::new()),
            last_ip: Mutex::new(String::new()),
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
                        "quit" => {
                            // Matar proceso Node.js antes de salir
                            let state = app.state::<AppState>();
                            if let Ok(mut server) = state.server.lock() {
                                if let Some(mut process) = server.process.take() {
                                    let _ = process.kill();
                                    let _ = process.wait();
                                }
                                server.status = "stopped".into();
                            }
                            // Matar sidecar node por si quedó huérfano
                            let mut cmd = Command::new("taskkill");
                            cmd.args(["/F", "/IM", "node-x86_64-pc-windows-msvc.exe", "/T"]);
                            #[cfg(windows)]
                            cmd.creation_flags(0x08000000);
                            let _ = cmd.output();

                            std::process::exit(0);
                        }
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
            check_port,
            kill_port_process,
            suggest_available_port,
            start_server,
            stop_server,
            copy_to_clipboard,
            export_logs,
            select_folder,
            get_local_ip,
            get_wifi_ssid,
            get_network_info,
            check_network_change,
            get_docker_status,
            get_docker_containers,
            get_system_stats,
            get_diagnostic_bundle,
            export_diagnostic_bundle,
            save_latest_log,
            send_report_email,
            get_connected_devices,
        ])
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
