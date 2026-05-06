use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Manager, State};
mod db;

struct DbState(Mutex<rusqlite::Connection>);

// --- Data Models ---

#[derive(Serialize, Deserialize)]
struct Note {
    id: i64,
    content: String,
    created_at: String,
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

#[derive(Serialize, Deserialize)]
struct Project {
    id: i64,
    name: String,
    description: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct Column {
    id: i64,
    name: String,
    tasks: Vec<Task>,
}

#[derive(Serialize, Deserialize)]
struct Task {
    id: i64,
    title: String,
    description: Option<String>,
    priority: String,
}

// --- Note Commands ---

#[tauri::command]
fn get_notes(state: State<DbState>) -> Result<Vec<Note>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, content, created_at FROM notes ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let note_iter = stmt
        .query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                content: row.get(1)?,
                created_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut notes = Vec::new();
    for note in note_iter {
        notes.push(note.map_err(|e| e.to_string())?);
    }
    Ok(notes)
}

#[tauri::command]
fn add_note(state: State<DbState>, content: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("INSERT INTO notes (content) VALUES (?)", [content])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_note(state: State<DbState>, id: i64, content: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("UPDATE notes SET content = ? WHERE id = ?", rusqlite::params![content, id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_note(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM notes WHERE id = ?", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// --- Account Commands ---

#[tauri::command]
fn get_accounts(state: State<DbState>) -> Result<Vec<Account>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, platform, username, password, note, created_at FROM accounts ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let acc_iter = stmt
        .query_map([], |row| {
            Ok(Account {
                id: row.get(0)?,
                platform: row.get(1)?,
                username: row.get(2)?,
                password: row.get(3)?,
                note: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

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
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_account(state: State<DbState>, id: i64, platform: String, username: String, password: String, note: Option<String>) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE accounts SET platform = ?, username = ?, password = ?, note = ? WHERE id = ?",
        rusqlite::params![platform, username, password, note, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_account(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM accounts WHERE id = ?", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// --- Project Commands ---

#[tauri::command]
fn get_projects(state: State<DbState>) -> Result<Vec<Project>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, description FROM projects")
        .map_err(|e| e.to_string())?;
    let project_iter = stmt
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut projects = Vec::new();
    for project in project_iter {
        projects.push(project.map_err(|e| e.to_string())?);
    }
    Ok(projects)
}

#[tauri::command]
fn add_project(state: State<DbState>, name: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("INSERT INTO projects (name) VALUES (?)", [name.clone()])
        .map_err(|e| e.to_string())?;
    
    let project_id = conn.last_insert_rowid();
    
    let default_cols = vec!["需求", "进度", "完成"];
    for (i, col_name) in default_cols.iter().enumerate() {
        conn.execute(
            "INSERT INTO columns (project_id, name, sort_order) VALUES (?, ?, ?)",
            rusqlite::params![project_id, col_name, i as i32],
        )
        .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
fn get_project_board(state: State<DbState>, project_id: i64) -> Result<Vec<Column>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name FROM columns WHERE project_id = ? ORDER BY sort_order")
        .map_err(|e| e.to_string())?;
    
    let columns_iter = stmt.query_map([project_id], |row| {
        let id: i64 = row.get(0)?;
        Ok((id, row.get(1)?))
    }).map_err(|e| e.to_string())?;

    let mut columns = Vec::new();
    for col_res in columns_iter {
        let (id, name) = col_res.map_err(|e| e.to_string())?;
        
        let mut task_stmt = conn.prepare("SELECT id, title, description, priority FROM tasks WHERE column_id = ? ORDER BY sort_order")
            .map_err(|e| e.to_string())?;
        
        let tasks_iter = task_stmt.query_map([id], |row| {
            Ok(Task {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                priority: row.get(3)?,
            })
        }).map_err(|e| e.to_string())?;
        
        let mut tasks = Vec::new();
        for task in tasks_iter {
            tasks.push(task.map_err(|e| e.to_string())?);
        }
        
        columns.push(Column { id, name, tasks });
    }
    
    Ok(columns)
}

#[tauri::command]
fn add_task(state: State<DbState>, column_id: i64, title: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT INTO tasks (column_id, title, sort_order) VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tasks WHERE column_id = ?))",
        rusqlite::params![column_id, title, column_id],
    ).map_err(|e| e.to_string())?;
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
            get_notes,
            add_note,
            update_note,
            delete_note,
            get_accounts,
            add_account,
            update_account,
            delete_account,
            get_projects,
            add_project,
            get_project_board,
            add_task
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
