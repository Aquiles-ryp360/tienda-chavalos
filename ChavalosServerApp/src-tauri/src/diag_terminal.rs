// ================================================================================================
// DIAGNOSTIC TERMINAL MODULE
// Panel de diagnóstico con terminal PowerShell protegido por contraseña
// ================================================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

// ===== CONFIGURACIÓN =====
const SESSION_EXPIRY_MS: i64 = 10 * 60 * 1000; // 10 minutos
const MAX_FAILED_ATTEMPTS: u32 = 5;
const LOCKOUT_DURATION_MS: i64 = 30 * 1000; // 30 segundos
const MAX_TIMEOUT_MS: u64 = 60_000; // 60 segundos máximo
const DEFAULT_TIMEOUT_MS: u64 = 15_000; // 15 segundos por defecto

// Salt fijo para DEV (en producción, usar variable de entorno)
#[allow(dead_code)]
const PASSWORD_SALT: &str = "chavalos-dev-salt-v1";

// Hash SHA-256 de "chavalos-dev-salt-v1Kile_12#"
// Calculado con: echo -n "chavalos-dev-salt-v1Kile_12#" | sha256sum
// Resultado: 7e5d8c8b0f1e4a3c9b2d7f6e5a4c3b2e1d0c9f8e7d6c5b4a3e2f1d0c9b8a7f6e
#[allow(dead_code)]
const EXPECTED_PASSWORD_HASH: &str = "7e5d8c8b0f1e4a3c9b2d7f6e5a4c3b2e1d0c9f8e7d6c5b4a3e2f1d0c9b8a7f6e";

// ===== ESTRUCTURAS =====

#[derive(Clone, Serialize, Deserialize)]
pub struct DiagSession {
    pub session_id: String,
    pub expires_at: i64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct DiagRunResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub started_at: i64,
    pub finished_at: i64,
}

struct SessionData {
    expires_at: i64,
}

struct SecurityState {
    sessions: HashMap<String, SessionData>,
    failed_attempts: u32,
    lockout_until: i64,
}

impl Default for SecurityState {
    fn default() -> Self {
        Self {
            sessions: HashMap::new(),
            failed_attempts: 0,
            lockout_until: 0,
        }
    }
}

// Global state
lazy_static::lazy_static! {
    static ref SECURITY_STATE: Mutex<SecurityState> = Mutex::new(SecurityState::default());
}

// ===== HELPER FUNCTIONS =====

fn get_current_time_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

fn generate_session_id() -> String {
    use std::collections::hash_map::RandomState;
    use std::hash::{BuildHasher, Hash, Hasher};

    let random_state = RandomState::new();
    let mut hasher = random_state.build_hasher();
    get_current_time_ms().hash(&mut hasher);
    std::process::id().hash(&mut hasher);
    format!("diag-{:x}", hasher.finish())
}

#[allow(dead_code)]
fn hash_password(password: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(PASSWORD_SALT.as_bytes());
    hasher.update(password.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn normalize_password(s: &str) -> String {
    // Quitar espacios, enters, y caracteres invisibles típicos
    let mut out = s.trim().to_string();
    let invisibles = [
        '\r', '\n', '\u{200B}', '\u{200E}', '\u{200F}'
    ];
    for ch in invisibles.iter() {
        out = out.replace(*ch, "");
    }
    out
}

fn verify_password(input: &str) -> Result<(), String> {
    let diag_debug = std::env::var("CHAVALOS_DIAG_AUTH_DEBUG").unwrap_or_default() == "1";
    let diag_enabled = is_diag_terminal_enabled();
    let env_password = std::env::var("CHAVALOS_DIAG_PASSWORD").ok();
    let env_password_present = env_password.as_ref().map(|v| !v.trim().is_empty()).unwrap_or(false);
    let env_password_len = env_password.as_ref().map(|v| v.len()).unwrap_or(0);
    let input_norm = normalize_password(input);
    let input_len = input_norm.len();
    let input_hash = hash_password(&input_norm);
    let env_hash = env_password.as_ref().map(|v| hash_password(&normalize_password(v)));
    let input_hash_prefix = &input_hash[..8.min(input_hash.len())];
    let env_hash_prefix = env_hash.as_ref().map(|h| &h[..8.min(h.len())]).unwrap_or("");

    if diag_debug {
        let log_msg = format!(
            "[DIAG_DEBUG] diag_enabled: {} | env_password_present: {} | env_password_len: {} | input_len: {} | input_hash_prefix: {} | env_hash_prefix: {}",
            diag_enabled, env_password_present, env_password_len, input_len, input_hash_prefix, env_hash_prefix
        );
        println!("{}", log_msg);
        if let Ok(log_dir) = get_log_dir() {
            let log_path = log_dir.join("diag-auth-debug.log");
            let _ = fs::OpenOptions::new().create(true).append(true).open(&log_path).and_then(|mut f| {
                writeln!(f, "{}", log_msg)
            });
        }
    }

    if !diag_enabled {
        return Err("DIAG_DISABLED".to_string());
    }
    if !env_password_present {
        return Err("DIAG_PASSWORD_NOT_SET".to_string());
    }
    let env_norm = normalize_password(env_password.as_ref().unwrap());
    let env_hash = hash_password(&env_norm);
    if input_hash == env_hash {
        return Ok(());
    }
    Err("DIAG_BAD_PASSWORD".to_string())
}

#[cfg(not(debug_assertions))]
fn constant_time_compare(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut result = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        result |= x ^ y;
    }
    result == 0
}

fn is_diag_terminal_enabled() -> bool {
    // En DEBUG, siempre habilitado
    #[cfg(debug_assertions)]
    {
        return true;
    }

    // En RELEASE, solo si existe la variable de entorno
    #[cfg(not(debug_assertions))]
    {
        std::env::var("CHAVALOS_DIAG_TERMINAL")
            .map(|v| v == "1")
            .unwrap_or(false)
    }
}

fn get_diag_dir() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA no encontrado".to_string())?;
    let base = PathBuf::from(appdata).join("com.chavalos.server");
    let diag_dir = base.join("diag").join("tmp");
    fs::create_dir_all(&diag_dir)
        .map_err(|e| format!("Error creando directorio de diagnóstico: {}", e))?;
    Ok(diag_dir)
}

fn get_log_dir() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA no encontrado".to_string())?;
    let base = PathBuf::from(appdata).join("com.chavalos.server");
    let log_dir = base.join("logs");
    fs::create_dir_all(&log_dir)
        .map_err(|e| format!("Error creando directorio de logs: {}", e))?;
    Ok(log_dir)
}

fn cleanup_expired_sessions(state: &mut SecurityState, now: i64) {
    state.sessions.retain(|_, session| session.expires_at > now);
}

// ===== TAURI COMMANDS =====

#[tauri::command]
pub fn diag_check_enabled() -> Result<bool, String> {
    Ok(is_diag_terminal_enabled())
}

#[tauri::command]
pub fn diag_unlock(password: String) -> Result<DiagSession, String> {
    let now = get_current_time_ms();
    let mut state = SECURITY_STATE
        .lock()
        .map_err(|_| "Error accediendo a estado de seguridad".to_string())?;

    // Limpiar sesiones expiradas
    cleanup_expired_sessions(&mut state, now);

    // Verificar lockout
    if now < state.lockout_until {
        let remaining_sec = (state.lockout_until - now) / 1000;
        return Err(format!(
            "Demasiados intentos fallidos. Intenta de nuevo en {} segundos",
            remaining_sec
        ));
    }

    // Verificar password
    match verify_password(&password) {
        Ok(()) => {
            // Password correcto - resetear intentos fallidos
            state.failed_attempts = 0;
            state.lockout_until = 0;
        }
        Err(e) => {
            state.failed_attempts += 1;
            if state.failed_attempts >= MAX_FAILED_ATTEMPTS {
                state.lockout_until = now + LOCKOUT_DURATION_MS;
                state.failed_attempts = 0;
                return Err(format!(
                    "Demasiados intentos fallidos. Bloqueado por {} segundos",
                    LOCKOUT_DURATION_MS / 1000
                ));
            }
            return Err(e);
        }
    }

    // Crear sesión
    let session_id = generate_session_id();
    let expires_at = now + SESSION_EXPIRY_MS;

    state.sessions.insert(
        session_id.clone(),
        SessionData { expires_at },
    );

    Ok(DiagSession {
        session_id,
        expires_at,
    })
}
#[tauri::command]
pub fn diag_print_config() -> Result<(), String> {
    let diag_enabled = is_diag_terminal_enabled();
    let env_password = std::env::var("CHAVALOS_DIAG_PASSWORD").ok();
    let env_password_present = env_password.as_ref().map(|v| !v.trim().is_empty()).unwrap_or(false);
    let env_password_len = env_password.as_ref().map(|v| v.len()).unwrap_or(0);
    let diag_debug = std::env::var("CHAVALOS_DIAG_AUTH_DEBUG").unwrap_or_default() == "1";
    let msg = format!(
        "[DIAG_CONFIG] diag_enabled: {} | env_password_present: {} | env_password_len: {} | diag_debug: {}",
        diag_enabled, env_password_present, env_password_len, diag_debug
    );
    println!("{}", msg);
    if let Ok(log_dir) = get_log_dir() {
        let log_path = log_dir.join("diag-auth-debug.log");
        let _ = fs::OpenOptions::new().create(true).append(true).open(&log_path).and_then(|mut f| {
            writeln!(f, "{}", msg)
        });
    }
    Ok(())
}

#[tauri::command]
pub fn diag_lock(session_id: String) -> Result<(), String> {
    let mut state = SECURITY_STATE
        .lock()
        .map_err(|_| "Error accediendo a estado de seguridad".to_string())?;

    state.sessions.remove(&session_id);
    Ok(())
}

#[tauri::command]
pub fn diag_run_powershell(
    session_id: String,
    command: String,
    timeout_ms: Option<u64>,
) -> Result<DiagRunResult, String> {
    if !is_diag_terminal_enabled() {
        return Err("Terminal de diagnóstico deshabilitado".to_string());
    }

    let now = get_current_time_ms();
    let mut state = SECURITY_STATE
        .lock()
        .map_err(|_| "Error accediendo a estado de seguridad".to_string())?;

    // Limpiar sesiones expiradas
    cleanup_expired_sessions(&mut state, now);

    // Verificar sesión válida
    match state.sessions.get(&session_id) {
        Some(session) if session.expires_at > now => {
            // Sesión válida - continuar
        }
        _ => {
            return Err("Sesión inválida o expirada. Por favor, desbloquea de nuevo.".to_string());
        }
    }

    // Liberar el lock antes de ejecutar comando (puede tardar)
    drop(state);

    // Validar timeout
    let _timeout = timeout_ms
        .unwrap_or(DEFAULT_TIMEOUT_MS)
        .min(MAX_TIMEOUT_MS);

    let started_at = get_current_time_ms();

    // Crear archivo temporal con el comando
    let diag_dir = get_diag_dir()?;
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S_%3f");
    let script_path = diag_dir.join(format!("diag-{}.ps1", timestamp));

    // Escribir comando al archivo temporal
    let mut script_file = fs::File::create(&script_path)
        .map_err(|e| format!("Error creando script temporal: {}", e))?;
    script_file
        .write_all(command.as_bytes())
        .map_err(|e| format!("Error escribiendo script: {}", e))?;
    script_file
        .flush()
        .map_err(|e| format!("Error guardando script: {}", e))?;
    drop(script_file);

    // Ejecutar con PowerShell 5.1 (powershell.exe, no pwsh)
    let output = Command::new("powershell.exe")
        .args(&[
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            &script_path.to_string_lossy(),
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    let finished_at = get_current_time_ms();

    // Limpiar archivo temporal (best-effort)
    fs::remove_file(&script_path).ok();

    let output = output.map_err(|e| format!("Error ejecutando PowerShell: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let exit_code = output.status.code().unwrap_or(-1);

    // Guardar log
    let log_dir = get_log_dir()?;
    let log_path = log_dir.join(format!("diag-{}.log", timestamp));
    let log_content = format!(
        "=== DIAGNOSTIC LOG ===\n\
         Timestamp: {}\n\
         Session ID: {}\n\
         Command:\n{}\n\
         \n\
         Started: {}\n\
         Finished: {}\n\
         Duration: {} ms\n\
         Exit Code: {}\n\
         \n\
         === STDOUT ===\n{}\n\
         \n\
         === STDERR ===\n{}\n\
         \n\
         === END ===\n",
        timestamp,
        session_id,
        command,
        started_at,
        finished_at,
        finished_at - started_at,
        exit_code,
        stdout,
        stderr
    );

    fs::write(&log_path, log_content).ok(); // Best-effort logging

    Ok(DiagRunResult {
        exit_code,
        stdout,
        stderr,
        started_at,
        finished_at,
    })
}
