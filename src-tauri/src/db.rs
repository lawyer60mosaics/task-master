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
    // 涵盖了 便笺 (memo), 任务 (task), Bug, 想法 (idea), 知识 (knowledge)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT,
            category TEXT DEFAULT 'personal', -- personal, work
            type TEXT DEFAULT 'task',        -- memo, task, bug, idea, knowledge
            status TEXT DEFAULT 'inbox',    -- inbox, todo, doing, done, fixed
            priority TEXT DEFAULT 'medium',
            project_name TEXT,
            start_date TEXT,
            end_date TEXT,
            progress INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 迁移：如果 category 字段不存在（针对旧版本升级），则手动添加
    let column_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('tasks') WHERE name='category'",
        [],
        |row| row.get(0),
    ).unwrap_or(false);

    if !column_exists {
        let _ = conn.execute("ALTER TABLE tasks ADD COLUMN category TEXT DEFAULT 'personal'", []);
    }

    // 2. 项目模型 (Projects)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            status TEXT DEFAULT 'active', -- active, archived
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 3. 账号管理 (Accounts) - 保持独立
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

    // 4. 活动日志 (Activity Log)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action_type TEXT NOT NULL,      -- create, update, delete, status_change, export
            entity_type TEXT NOT NULL,      -- task, project, account
            entity_id INTEGER,
            details TEXT,                   -- JSON 或 描述文本
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 迁移：为 tasks 增加新字段
    let tags_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('tasks') WHERE name='tags'",
        [],
        |row| row.get(0),
    ).unwrap_or(false);
    if !tags_exists {
        let _ = conn.execute("ALTER TABLE tasks ADD COLUMN tags TEXT", []);
        let _ = conn.execute("ALTER TABLE tasks ADD COLUMN is_pinned INTEGER DEFAULT 0", []);
    }

    Ok(conn)
}
