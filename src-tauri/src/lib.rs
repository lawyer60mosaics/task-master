use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Manager, State};
mod db;

struct DbState(Mutex<rusqlite::Connection>);

// --- Data Models ---

#[derive(Serialize, Deserialize, Clone)]
struct Task {
    id: i64,
    title: String,
    task_type: String,
    status: String,
    priority: String,
    project_name: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    progress: i32,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize, Deserialize)]
struct Account {
    id: i64,
    platform: String,
    username: String,
    password: String,
    note: Option<String>,
    created_at: String,
}

// --- Task Commands ---

#[tauri::command]
fn get_tasks(state: State<DbState>, status_filter: Option<String>, project_filter: Option<String>) -> Result<Vec<Task>, String> {
    let conn = state.0.lock().unwrap();
    let mut query = "SELECT id, title, type, status, priority, project_name, start_date, end_date, progress, created_at, updated_at FROM tasks WHERE 1=1".to_string();
    
    if status_filter.is_some() { query.push_str(" AND status = ?"); }
    if project_filter.is_some() { query.push_str(" AND project_name = ?"); }
    query.push_str(" ORDER BY created_at DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let mut params: Vec<String> = Vec::new();
    if let Some(s) = status_filter { params.push(s); }
    if let Some(p) = project_filter { params.push(p); }

    let task_iter = stmt.query_map(rusqlite::params_from_iter(params), |row| {
        Ok(Task {
            id: row.get(0)?,
            title: row.get(1)?,
            task_type: row.get(2)?,
            status: row.get(3)?,
            priority: row.get(4)?,
            project_name: row.get(5)?,
            start_date: row.get(6)?,
            end_date: row.get(7)?,
            progress: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    for task in task_iter {
        tasks.push(task.map_err(|e| e.to_string())?);
    }
    Ok(tasks)
}

#[tauri::command]
fn add_task(
    state: State<DbState>, 
    title: String, 
    task_type: String, 
    status: String, 
    priority: String, 
    project_name: Option<String>
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT INTO tasks (title, type, status, priority, project_name) VALUES (?, ?, ?, ?, ?)",
        rusqlite::params![title, task_type, status, priority, project_name],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_task_status(state: State<DbState>, id: i64, status: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", rusqlite::params![status, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_task(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM tasks WHERE id = ?", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

// --- Account Commands ---

#[tauri::command]
fn get_accounts(state: State<DbState>) -> Result<Vec<Account>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, platform, username, password, note, created_at FROM accounts ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let acc_iter = stmt.query_map([], |row| {
        Ok(Account {
            id: row.get(0)?,
            platform: row.get(1)?,
            username: row.get(2)?,
            password: row.get(3)?,
            note: row.get(4)?,
            created_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut accounts = Vec::new();
    for acc in acc_iter {
        accounts.push(acc.map_err(|e| e.to_string())?);
    }
    Ok(accounts)
}

#[tauri::command]
fn add_account(state: State<DbState>, platform: String, username: String, password: String, note: Option<String>) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT INTO accounts (platform, username, password, note) VALUES (?, ?, ?, ?)",
        rusqlite::params![platform, username, password, note],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_account(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM accounts WHERE id = ?", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("failed to get app dir");
            let conn = db::init_db(app_dir).expect("failed to init db");
            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_tasks,
            add_task,
            update_task_status,
            delete_task,
            get_accounts,
            add_account,
            delete_account
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
