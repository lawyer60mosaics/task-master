use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Manager, State};
mod db;

struct DbState(Mutex<rusqlite::Connection>);

#[derive(Serialize, Deserialize)]
struct Memo {
    id: i64,
    memo_type: String,
    content: String,
    username: Option<String>,
    password: Option<String>,
    tags: Option<String>,
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

#[tauri::command]
fn get_memos(state: State<DbState>) -> Result<Vec<Memo>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, type, content, username, password, tags, created_at FROM memos ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let memo_iter = stmt
        .query_map([], |row| {
            Ok(Memo {
                id: row.get(0)?,
                memo_type: row.get(1)?,
                content: row.get(2)?,
                username: row.get(3)?,
                password: row.get(4)?,
                tags: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut memos = Vec::new();
    for memo in memo_iter {
        memos.push(memo.map_err(|e| e.to_string())?);
    }
    Ok(memos)
}

#[tauri::command]
fn add_memo(
    state: State<DbState>,
    memo_type: String,
    content: String,
    username: Option<String>,
    password: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT INTO memos (type, content, username, password) VALUES (?, ?, ?, ?)",
        rusqlite::params![memo_type, content, username, password],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

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
            get_memos,
            add_memo,
            get_projects,
            add_project,
            get_project_board,
            add_task
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
