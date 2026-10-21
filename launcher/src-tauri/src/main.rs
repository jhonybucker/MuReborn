// Launcher do MU Reborn: abre o jogo, ajusta as opções do cliente, mostra status/notícias
// e atualiza os arquivos do cliente a partir de um manifesto publicado no servidor.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Emitter};
use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
use winreg::RegKey;

const REGISTRY_PATH: &str = r"Software\Webzen\Mu\Config";

/// Configuração do launcher. Valores padrão aqui; dá para sobrescrever com um
/// `launcher.json` na pasta do cliente, sem recompilar.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct LauncherConfig {
    api_base: String,
    site_url: String,
    manifest_url: String,
    discord_url: String,
    close_on_play: bool,
}

impl Default for LauncherConfig {
    fn default() -> Self {
        Self {
            api_base: "https://mu-reborn.duckdns.org/api".into(),
            site_url: "https://mu-reborn.vercel.app".into(),
            manifest_url: "https://raw.githubusercontent.com/jhonybucker/MuReborn-client/main/manifest.json".into(),
            discord_url: String::new(),
            close_on_play: true,
        }
    }
}

/// Pasta do cliente: a do próprio launcher (ou MU_CLIENT_DIR, para testar fora dela).
fn client_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("MU_CLIENT_DIR") {
        return PathBuf::from(dir);
    }
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| PathBuf::from("."))
}

fn load_config() -> LauncherConfig {
    fs::read_to_string(client_dir().join("launcher.json"))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LauncherInfo {
    client_dir: String,
    main_found: bool,
    version: String,
    config: LauncherConfig,
}

#[tauri::command]
fn launcher_info(app: AppHandle) -> LauncherInfo {
    let dir = client_dir();
    LauncherInfo {
        main_found: dir.join("main.exe").is_file(),
        client_dir: dir.display().to_string(),
        version: app.package_info().version.to_string(),
        config: load_config(),
    }
}

#[tauri::command]
fn play(app: AppHandle) -> Result<(), String> {
    let dir = client_dir();
    let exe = dir.join("main.exe");
    if !exe.is_file() {
        return Err(format!("main.exe não encontrado em {}. Coloque o launcher na pasta do jogo.", dir.display()));
    }
    Command::new(&exe).current_dir(&dir).spawn().map_err(|e| format!("Não foi possível abrir o jogo: {e}"))?;
    if load_config().close_on_play {
        app.exit(0);
    }
    Ok(())
}

/// Opções que o main.exe do 99b lê do registro (as mesmas da tela de opções do jogo).
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameSettings {
    resolution: u32, // 0 = 640x480, 1 = 800x600, 2 = 1024x768, 3 = 1280x1024
    window_mode: bool,
    music: bool,
    sound: bool,
    volume: u32, // 0 a 9
}

#[tauri::command]
fn get_settings() -> GameSettings {
    let key = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(REGISTRY_PATH, KEY_READ).ok();
    let read = |name: &str, default: u32| -> u32 {
        key.as_ref().and_then(|k| k.get_value::<u32, _>(name).ok()).unwrap_or(default)
    };
    GameSettings {
        resolution: read("Resolution", 1).min(3),
        window_mode: read("WindowMode", 1) != 0,
        music: read("MusicOnOff", 1) != 0,
        sound: read("SoundOnOff", 1) != 0,
        volume: read("VolumeLevel", 5).min(9),
    }
}

#[tauri::command]
fn save_settings(settings: GameSettings) -> Result<(), String> {
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey_with_flags(REGISTRY_PATH, KEY_WRITE)
        .map_err(|e| format!("Não foi possível salvar as opções: {e}"))?;
    let values: [(&str, u32); 5] = [
        ("Resolution", settings.resolution.min(3)),
        ("WindowMode", settings.window_mode as u32),
        ("MusicOnOff", settings.music as u32),
        ("SoundOnOff", settings.sound as u32),
        ("VolumeLevel", settings.volume.min(9)),
    ];
    for (name, value) in values {
        key.set_value(name, &value).map_err(|e| format!("Não foi possível salvar {name}: {e}"))?;
    }
    Ok(())
}

fn http_json(url: &str) -> Result<Value, String> {
    ureq::get(url)
        .timeout(std::time::Duration::from_secs(10))
        .call()
        .map_err(|e| e.to_string())?
        .into_json::<Value>()
        .map_err(|e| e.to_string())
}

/// GET na API do servidor. Só rotas públicas de leitura.
#[tauri::command]
async fn api_get(path: String) -> Result<Value, String> {
    const ALLOWED: [&str; 4] = ["/status", "/events", "/rankings", "/online"];
    if !ALLOWED.iter().any(|prefix| path.starts_with(prefix)) {
        return Err("rota não permitida".into());
    }
    let url = format!("{}{}", load_config().api_base.trim_end_matches('/'), path);
    tauri::async_runtime::spawn_blocking(move || http_json(&url)).await.map_err(|e| e.to_string())?
}

/// Notícias publicadas pelo site em /news.json (vazio se o site não estiver configurado).
#[tauri::command]
async fn fetch_news() -> Result<Value, String> {
    let site = load_config().site_url;
    if site.is_empty() {
        return Ok(Value::Null);
    }
    let url = format!("{}/news.json", site.trim_end_matches('/'));
    tauri::async_runtime::spawn_blocking(move || http_json(&url)).await.map_err(|e| e.to_string())?
}

// ---------- Atualização do cliente ----------

#[derive(Deserialize)]
struct Manifest {
    version: String,
    #[serde(rename = "baseUrl")]
    base_url: String,
    files: Vec<ManifestFile>,
}

#[derive(Deserialize, Clone)]
struct ManifestFile {
    path: String,
    size: u64,
    sha256: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateCheck {
    configured: bool,
    version: String,
    pending: usize,
    bytes: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateProgress {
    done: usize,
    total: usize,
    bytes_done: u64,
    bytes_total: u64,
    file: String,
}

/// Caminho do manifesto dentro da pasta do cliente. Recusa "..", caminhos absolutos e
/// unidades: o manifesto vem da internet e nunca pode gravar fora da pasta do jogo.
fn safe_path(root: &Path, relative: &str) -> Option<PathBuf> {
    let candidate = Path::new(relative);
    if candidate.components().any(|c| !matches!(c, Component::Normal(_))) {
        return None;
    }
    Some(root.join(candidate))
}

fn sha256_file(path: &Path) -> Option<String> {
    let mut file = fs::File::open(path).ok()?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).ok()?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Some(hex::encode(hasher.finalize()))
}

fn load_manifest() -> Result<Option<Manifest>, String> {
    let url = load_config().manifest_url;
    if url.is_empty() {
        return Ok(None);
    }
    if !url.starts_with("https://") {
        return Err("o manifesto precisa ser https".into());
    }
    let value = http_json(&url)?;
    serde_json::from_value(value).map(Some).map_err(|e| format!("manifesto inválido: {e}"))
}

/// Arquivos do manifesto que faltam ou estão diferentes na pasta do cliente.
fn outdated(manifest: &Manifest, root: &Path) -> Result<Vec<ManifestFile>, String> {
    let mut list = Vec::new();
    for file in &manifest.files {
        let path = safe_path(root, &file.path).ok_or_else(|| format!("caminho inválido no manifesto: {}", file.path))?;
        let same = fs::metadata(&path).map(|m| m.len() == file.size).unwrap_or(false)
            && sha256_file(&path).map(|h| h.eq_ignore_ascii_case(&file.sha256)).unwrap_or(false);
        if !same {
            list.push(file.clone());
        }
    }
    Ok(list)
}

#[tauri::command]
async fn check_update() -> Result<UpdateCheck, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let Some(manifest) = load_manifest()? else {
            return Ok(UpdateCheck { configured: false, version: String::new(), pending: 0, bytes: 0 });
        };
        let pending = outdated(&manifest, &client_dir())?;
        Ok(UpdateCheck {
            configured: true,
            version: manifest.version.clone(),
            bytes: pending.iter().map(|f| f.size).sum(),
            pending: pending.len(),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Baixa um arquivo do manifesto, confere tamanho e SHA-256 e só então grava na pasta do cliente.
/// Tenta até 3 vezes: a conexão até o servidor de arquivos pode oscilar.
fn download_file(agent: &ureq::Agent, base_url: &str, root: &Path, file: &ManifestFile) -> Result<(), String> {
    let target = safe_path(root, &file.path).ok_or_else(|| format!("caminho inválido: {}", file.path))?;
    let url = format!(
        "{}/{}",
        base_url.trim_end_matches('/'),
        file.path.split('/').map(encode_segment).collect::<Vec<_>>().join("/")
    );
    let mut last_error = String::new();
    for attempt in 1..=3 {
        let result = (|| -> Result<Vec<u8>, String> {
            let response = agent.get(&url).call().map_err(|e| e.to_string())?;
            let mut body = Vec::with_capacity(file.size as usize);
            response.into_reader().take(file.size + 1).read_to_end(&mut body).map_err(|e| e.to_string())?;
            // Arquivo corrompido ou trocado no caminho não entra no cliente.
            if body.len() as u64 != file.size || hex::encode(Sha256::digest(&body)) != file.sha256.to_lowercase() {
                return Err("arquivo baixado não confere".into());
            }
            Ok(body)
        })();
        match result {
            Ok(body) => {
                if let Some(parent) = target.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                let temp = target.with_extension("download");
                fs::File::create(&temp).and_then(|mut f| f.write_all(&body)).map_err(|e| e.to_string())?;
                fs::rename(&temp, &target).map_err(|e| e.to_string())?;
                return Ok(());
            }
            Err(e) => {
                last_error = e;
                std::thread::sleep(std::time::Duration::from_millis(800 * attempt));
            }
        }
    }
    Err(format!("{}: {last_error}", file.path))
}

#[tauri::command]
async fn run_update(app: AppHandle) -> Result<(), String> {
    use std::collections::VecDeque;
    use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
    use std::sync::Mutex;

    tauri::async_runtime::spawn_blocking(move || {
        let Some(manifest) = load_manifest()? else { return Ok(()) };
        if !manifest.base_url.starts_with("https://") {
            return Err("os arquivos precisam vir de https".into());
        }
        let root = client_dir();
        let pending = outdated(&manifest, &root)?;
        let total = pending.len();
        let bytes_total: u64 = pending.iter().map(|f| f.size).sum();
        let queue = Mutex::new(pending.into_iter().collect::<VecDeque<_>>());
        let done = AtomicUsize::new(0);
        let bytes_done = AtomicU64::new(0);
        let failure: Mutex<Option<String>> = Mutex::new(None);
        let agent = ureq::AgentBuilder::new()
            .timeout_connect(std::time::Duration::from_secs(15))
            .timeout_read(std::time::Duration::from_secs(60))
            .build();

        // 6 downloads ao mesmo tempo: o cliente tem milhares de arquivos pequenos.
        std::thread::scope(|scope| {
            for _ in 0..6 {
                scope.spawn(|| loop {
                    if failure.lock().unwrap().is_some() {
                        break;
                    }
                    let Some(file) = queue.lock().unwrap().pop_front() else { break };
                    match download_file(&agent, &manifest.base_url, &root, &file) {
                        Ok(()) => {
                            let finished = done.fetch_add(1, Ordering::SeqCst) + 1;
                            let bytes = bytes_done.fetch_add(file.size, Ordering::SeqCst) + file.size;
                            let _ = app.emit(
                                "update-progress",
                                UpdateProgress { done: finished, total, bytes_done: bytes, bytes_total, file: file.path.clone() },
                            );
                        }
                        Err(error) => {
                            *failure.lock().unwrap() = Some(error);
                            break;
                        }
                    }
                });
            }
        });

        if let Some(error) = failure.into_inner().unwrap() {
            return Err(error);
        }
        // O jogo grava os prints aqui; a pasta não vai no manifesto.
        let _ = fs::create_dir_all(root.join("ScreenShots"));
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

fn encode_segment(segment: &str) -> String {
    segment
        .bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            launcher_info,
            play,
            get_settings,
            save_settings,
            api_get,
            fetch_news,
            check_update,
            run_update
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o launcher");
}
