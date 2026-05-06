use rusqlite::{Connection, Result};
use std::fs;
use std::path::PathBuf;

pub fn init_db(app_dir: PathBuf) -> Result<Connection> {
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir).expect("failed to create app dir");
    }
    let db_path = app_dir.join("tasks.db");
    let conn = Connection::open(db_path)?;

    // 1. 统一任务模型 (Tasks)
    // 涵盖了 便笺 (memo), 任务 (task), Bug, 想法 (idea)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            type TEXT DEFAULT 'task',        -- memo, task, bug, idea
            status TEXT DEFAULT 'inbox',    -- inbox, todo, doing, done
            priority TEXT DEFAULT 'medium', -- low, medium, high
            project_name TEXT,              -- 所属项目标记
            start_date TEXT,
            end_date TEXT,
            progress INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 2. 账号管理 (Accounts) - 保持独立
    conn.execute(
        "CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    Ok(conn)
}
