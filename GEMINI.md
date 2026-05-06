# 项目概述：备忘录Auto (Task Master)

备忘录Auto (MemoAuto) 是一款基于 **Tauri v2** 和 **React** 框架开发的个人生产力与管理应用。前端采用了 **Ant Design (AntD)** 组件库，提供美观且功能丰富的桌面端界面。

## 核心技术栈
- **后端 (Backend):** Rust, Tauri v2
- **前端 (Frontend):** React 18, Vite, Ant Design 5
- **数据库 (Database):** SQLite (通过 `rusqlite` 管理)
- **开发工具:** Vite (用于前端构建和热更新)

## 项目架构
应用遵循标准的 Tauri + React 架构：
- **前端:** 一个使用 React 和 Ant Design 构建的单页面应用 (SPA)。通过 `@tauri-apps/api` 与 Rust 后端进行 IPC 通信。
- **后端:** 一个 Rust 库 (`task_master_lib`)，负责系统集成、窗口管理和核心业务逻辑。
- **数据库层:** `db.rs` 负责初始化 SQLite 数据库并定义表结构。

### 关键模块
- `src/main.jsx`: React 应用入口。
- `src/App.jsx`: 应用核心逻辑与布局，集成了 AntD 的各种组件。
- `src-tauri/src/lib.rs`: 处理来自前端的命令调用。
- `vite.config.js`: Vite 构建配置，优化了 Tauri 开发体验。

---

## 构建与运行

### 环境准备
- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/)
- [Tauri CLI](https://tauri.app/v2/guides/slow-start/command-line-interface/) (`npm install -g @tauri-apps/cli`)

### 常用命令
- **安装依赖:**
  ```bash
  npm install
  ```
- **开发模式运行:**
  ```bash
  npm run tauri dev
  ```
- **构建前端:**
  ```bash
  npm run build
  ```
- **构建生产版本 (App):**
  ```bash
  npm run tauri build
  ```

---

## 开发规范

### 前端组件化
- 使用 Ant Design 5 的函数式组件和 Hooks。
- 逻辑封装在 `App.jsx` 中，未来可拆分为 `components/` 目录下的独立模块。
- 样式主要依赖 AntD 的 Design Token 和全局 CSS。

### 后端命令 (Tauri Commands)
- 任务管理: `get_tasks`, `add_task`, `update_task_status`, `delete_task`
- 账号管理: `get_accounts`, `add_account`, `delete_account`

### 数据同步
- 前端通过 `refreshData()` 和 `loadAccounts()` 钩子定期或在操作后拉取最新数据。
- 数据库路径默认位于系统的 AppData/Local 目录（跨平台兼容）。
