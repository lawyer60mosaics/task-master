use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Manager, State};
use rust_xlsxwriter::*;
use magic_crypt::{new_magic_crypt, MagicCryptTrait};
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
    tags: Option<String>,
    is_pinned: i32,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize, Deserialize)]
struct ActivityLog {
    id: i64,
    action_type: String,
    entity_type: String,
    entity_id: Option<i64>,
    details: Option<String>,
    created_at: String,
}

// ... 保持 Account, Project 结构不变 ...

// --- Helper for Logging ---
fn log_activity(conn: &rusqlite::Connection, action: &str, entity_type: &str, entity_id: Option<i64>, details: Option<&str>) -> Result<(), String> {
    conn.execute(
        "INSERT INTO activity_log (action_type, entity_type, entity_id, details) VALUES (?, ?, ?, ?)",
        rusqlite::params![action, entity_type, entity_id, details],
    ).map_err(|e| e.to_string())?;
    Ok(())
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
    
    let id = conn.last_insert_rowid();
    log_activity(&conn, "create", "project", Some(id), Some(&format!("创建了项目: {}", name)))?;
    Ok(())
}

#[tauri::command]
fn update_project(state: State<DbState>, id: i64, name: String, description: Option<String>, status: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE projects SET name = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        rusqlite::params![name, description, status, id],
    ).map_err(|e| e.to_string())?;
    
    log_activity(&conn, "update", "project", Some(id), Some(&format!("更新了项目: {}", name)))?;
    Ok(())
}

#[tauri::command]
fn delete_project(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    // 删除项目时，将任务中的项目关联取消（保持任务）
    conn.execute("UPDATE tasks SET project_name = NULL WHERE project_name = (SELECT name FROM projects WHERE id = ?)", [id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM projects WHERE id = ?", [id]).map_err(|e| e.to_string())?;
    
    log_activity(&conn, "delete", "project", Some(id), Some("删除了项目并解绑关联任务"))?;
    Ok(())
}

// --- Task Commands ---

#[tauri::command]
fn get_tasks(
    state: State<DbState>, 
    category_filter: Option<String>, 
    status_filter: Option<String>,
    type_filter: Option<String>,
    project_filter: Option<String>,
    include_archived: Option<bool>
) -> Result<Vec<Task>, String> {
    let conn = state.0.lock().unwrap();
    let mut query = "SELECT id, title, content, category, type, status, priority, project_name, start_date, end_date, progress, tags, is_pinned, created_at, updated_at FROM tasks WHERE 1=1".to_string();
    
    if category_filter.is_some() { query.push_str(" AND category = ?"); }
    if status_filter.is_some() { 
        query.push_str(" AND status = ?"); 
    } else if !include_archived.unwrap_or(false) {
        query.push_str(" AND status != 'archived'");
    }

    if type_filter.is_some() { query.push_str(" AND type = ?"); }
    if project_filter.is_some() { query.push_str(" AND project_name = ?"); }
    
    query.push_str(" ORDER BY is_pinned DESC, created_at DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let mut params: Vec<rusqlite::types::Value> = Vec::new();
    if let Some(c) = category_filter { params.push(rusqlite::types::Value::Text(c)); }
    if let Some(s) = status_filter { params.push(rusqlite::types::Value::Text(s)); }
    if let Some(t) = type_filter { params.push(rusqlite::types::Value::Text(t)); }
    if let Some(p) = project_filter { params.push(rusqlite::types::Value::Text(p)); }

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
            tags: row.get(11)?,
            is_pinned: row.get(12)?,
            created_at: row.get(13)?,
            updated_at: row.get(14)?,
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
    project_name: Option<String>,
    tags: Option<String>
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT INTO tasks (title, content, category, type, status, priority, project_name, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![title, content, category, task_type, status, priority, project_name, tags],
    ).map_err(|e| e.to_string())?;
    
    let id = conn.last_insert_rowid();
    log_activity(&conn, "create", "task", Some(id), Some(&format!("创建了新条目: {}", title)))?;
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
    tags: Option<String>,
    is_pinned: i32
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE tasks SET title = ?, content = ?, category = ?, type = ?, status = ?, priority = ?, project_name = ?, tags = ?, is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        rusqlite::params![title, content, category, task_type, status, priority, project_name, tags, is_pinned, id],
    ).map_err(|e| e.to_string())?;
    
    log_activity(&conn, "update", "task", Some(id), Some(&format!("更新了条目: {}", title)))?;
    Ok(())
}

#[tauri::command]
fn update_task_status(state: State<DbState>, id: i64, status: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", rusqlite::params![status, id])
        .map_err(|e| e.to_string())?;
    
    log_activity(&conn, "status_change", "task", Some(id), Some(&format!("状态变更为: {}", status)))?;
    Ok(())
}

#[tauri::command]
fn delete_task(state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    log_activity(&conn, "delete", "task", Some(id), Some("删除了任务"))?;
    conn.execute("DELETE FROM tasks WHERE id = ?", [id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_activity_logs(state: State<DbState>, limit: i32) -> Result<Vec<ActivityLog>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, action_type, entity_type, entity_id, details, created_at FROM activity_log ORDER BY created_at DESC LIMIT ?")
        .map_err(|e| e.to_string())?;
    
    let log_iter = stmt.query_map([limit], |row| {
        Ok(ActivityLog {
            id: row.get(0)?,
            action_type: row.get(1)?,
            entity_type: row.get(2)?,
            entity_id: row.get(3)?,
            details: row.get(4)?,
            created_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut logs = Vec::new();
    for log in log_iter {
        logs.push(log.map_err(|e| e.to_string())?);
    }
    Ok(logs)
}

#[tauri::command]
fn export_tasks_to_excel(
    state: State<DbState>, 
    path: String,
    category: Option<String>,
    status: Option<String>,
    task_type: Option<String>,
    project_name: Option<String>,
    include_archived: Option<bool>
) -> Result<(), String> {
    let tasks = get_tasks(state, category, status, task_type, project_name, include_archived)?;
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
fn get_accounts(state: State<DbState>, master_key: Option<String>) -> Result<Vec<Account>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, platform, username, password, note, created_at FROM accounts ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    
    let acc_iter = stmt.query_map([], |row| {
        let encrypted_pwd: String = row.get(3)?;
        // 如果提供了 master_key，则尝试解密，否则显示为掩码
        let display_pwd = if let Some(ref key) = master_key {
            let mc = new_magic_crypt!(key, 256);
            mc.decrypt_base64_to_string(&encrypted_pwd).unwrap_or_else(|_| "INVALID_KEY".to_string())
        } else {
            "********".to_string()
        };

        Ok(Account {
            id: row.get(0)?,
            platform: row.get(1)?,
            username: row.get(2)?,
            password: display_pwd,
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
fn add_account(state: State<DbState>, platform: String, username: String, password: String, note: Option<String>, master_key: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    let mc = new_magic_crypt!(master_key, 256);
    let encrypted_pwd = mc.encrypt_str_to_base64(&password);

    conn.execute(
        "INSERT INTO accounts (platform, username, password, note) VALUES (?, ?, ?, ?)",
        rusqlite::params![platform, username, encrypted_pwd, note],
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
fn export_accounts_to_excel(state: State<DbState>, path: String, master_key: String) -> Result<(), String> {
    let accounts = get_accounts(state, Some(master_key))?;
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
            update_project,
            delete_project,
            get_tasks,
            add_task,
            update_task,
            update_task_status,
            delete_task,
            get_activity_logs,
            get_accounts,
            add_account,
            delete_account,
            export_tasks_to_excel,
            export_accounts_to_excel
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

