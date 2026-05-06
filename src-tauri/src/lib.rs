use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Manager, State};
use rust_xlsxwriter::*;
mod db;

struct DbState(Mutex<rusqlite::Connection>);

// --- Data Models ---

#[derive(Serialize, Deserialize, Clone)]
struct Task {
    id: i64,
    title: String,
    content: Option<String>,
    category: String,
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

#[derive(Serialize, Deserialize, Clone)]
struct Project {
    id: i64,
    name: String,
    description: Option<String>,
    status: String,
    created_at: String,
    updated_at: String,
}

// ... 保持 Account 结构不变 ...

// --- Project Commands ---

#[tauri::command]
fn get_projects(state: State<DbState>) -> Result<Vec<Project>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, name, description, status, created_at, updated_at FROM projects ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    
    let proj_iter = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            status: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut projects = Vec::new();
    for proj in proj_iter {
        projects.push(proj.map_err(|e| e.to_string())?);
    }
    Ok(projects)
}

#[tauri::command]
fn add_project(state: State<DbState>, name: String, description: Option<String>) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT INTO projects (name, description) VALUES (?, ?)",
        rusqlite::params![name, description],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_project(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM projects WHERE id = ?", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

// --- Task Commands ---

#[tauri::command]
fn get_tasks(
    state: State<DbState>, 
    category_filter: Option<String>, 
    status_filter: Option<String>,
    type_filter: Option<String>,
    project_filter: Option<String>
) -> Result<Vec<Task>, String> {
    let conn = state.0.lock().unwrap();
    let mut query = "SELECT id, title, content, category, type, status, priority, project_name, start_date, end_date, progress, created_at, updated_at FROM tasks WHERE 1=1".to_string();
    
    if category_filter.is_some() { query.push_str(" AND category = ?"); }
    if status_filter.is_some() { query.push_str(" AND status = ?"); }
    if type_filter.is_some() { query.push_str(" AND type = ?"); }
    if project_filter.is_some() { query.push_str(" AND project_name = ?"); }
    
    query.push_str(" ORDER BY created_at DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let mut params: Vec<String> = Vec::new();
    if let Some(c) = category_filter { params.push(c); }
    if let Some(s) = status_filter { params.push(s); }
    if let Some(t) = type_filter { params.push(t); }
    if let Some(p) = project_filter { params.push(p); }

    let task_iter = stmt.query_map(rusqlite::params_from_iter(params), |row| {
        Ok(Task {
            id: row.get(0)?,
            title: row.get(1)?,
            content: row.get(2)?,
            category: row.get(3)?,
            task_type: row.get(4)?,
            status: row.get(5)?,
            priority: row.get(6)?,
            project_name: row.get(7)?,
            start_date: row.get(8)?,
            end_date: row.get(9)?,
            progress: row.get(10)?,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
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
    content: Option<String>,
    category: String,
    task_type: String, 
    status: String, 
    priority: String, 
    project_name: Option<String>
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT INTO tasks (title, content, category, type, status, priority, project_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![title, content, category, task_type, status, priority, project_name],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_task(
    state: State<DbState>,
    id: i64,
    title: String,
    content: Option<String>,
    category: String,
    task_type: String,
    status: String,
    priority: String,
    project_name: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE tasks SET title = ?, content = ?, category = ?, type = ?, status = ?, priority = ?, project_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        rusqlite::params![title, content, category, task_type, status, priority, project_name, id],
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

#[tauri::command]
fn export_tasks_to_excel(
    state: State<DbState>, 
    path: String,
    category: Option<String>,
    status: Option<String>,
    task_type: Option<String>,
    project_name: Option<String>
) -> Result<(), String> {
    let tasks = get_tasks(state, category, status, task_type, project_name)?;
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    let header_format = Format::new().set_bold().set_background_color(Color::Silver);

    let headers = ["ID", "标题", "内容", "模块", "类型", "状态", "项目", "创建时间"];
    for (col, header) in headers.iter().enumerate() {
        worksheet.write_with_format(0, col as u16, *header, &header_format).map_err(|e| e.to_string())?;
    }

    for (row, task) in tasks.iter().enumerate() {
        let r = (row + 1) as u32;
        worksheet.write(r, 0, task.id).map_err(|e| e.to_string())?;
        worksheet.write(r, 1, &task.title).map_err(|e| e.to_string())?;
        worksheet.write(r, 2, task.content.as_deref().unwrap_or("")).map_err(|e| e.to_string())?;
        worksheet.write(r, 3, &task.category).map_err(|e| e.to_string())?;
        worksheet.write(r, 4, &task.task_type).map_err(|e| e.to_string())?;
        worksheet.write(r, 5, &task.status).map_err(|e| e.to_string())?;
        worksheet.write(r, 6, task.project_name.as_deref().unwrap_or("")).map_err(|e| e.to_string())?;
        worksheet.write(r, 7, &task.created_at).map_err(|e| e.to_string())?;
    }

    workbook.save(&path).map_err(|e| e.to_string())?;
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

#[tauri::command]
fn export_accounts_to_excel(state: State<DbState>, path: String) -> Result<(), String> {
    let accounts = get_accounts(state)?;
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();

    let header_format = Format::new().set_bold().set_background_color(Color::Silver);

    let headers = ["ID", "平台", "用户名", "密码", "备注", "创建时间"];
    for (col, header) in headers.iter().enumerate() {
        worksheet.write_with_format(0, col as u16, *header, &header_format).map_err(|e| e.to_string())?;
    }

    for (row, acc) in accounts.iter().enumerate() {
        let r = (row + 1) as u32;
        worksheet.write(r, 0, acc.id).map_err(|e| e.to_string())?;
        worksheet.write(r, 1, &acc.platform).map_err(|e| e.to_string())?;
        worksheet.write(r, 2, &acc.username).map_err(|e| e.to_string())?;
        worksheet.write(r, 3, &acc.password).map_err(|e| e.to_string())?;
        worksheet.write(r, 4, acc.note.as_deref().unwrap_or("")).map_err(|e| e.to_string())?;
        worksheet.write(r, 5, &acc.created_at).map_err(|e| e.to_string())?;
    }

    workbook.save(&path).map_err(|e| e.to_string())?;
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
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_projects,
            add_project,
            delete_project,
            get_tasks,
            add_task,
            update_task,
            update_task_status,
            delete_task,
            get_accounts,
            add_account,
            delete_account,
            export_tasks_to_excel,
            export_accounts_to_excel
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

