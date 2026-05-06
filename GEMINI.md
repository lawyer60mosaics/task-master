# 项目概述：备忘录Auto (Task Master)

备忘录Auto (MemoAuto) 是一款本地优先的个人生产力工具，旨在帮助个人开发者和独立工作者快速捕捉信息、整理任务并沉淀知识。

## 核心技术栈
- **后端 (Backend):** Rust, Tauri v2
- **前端 (Frontend):** React 18, Vite, Ant Design 5
- **数据库 (Database):** SQLite (通过 `rusqlite` 管理)
- **Excel 引擎:** `rust_xlsxwriter`

## 产品迭代记录 (Feature Log)

### v1.0.5 - 产品路径优化 (P0/P1)
- **搜索功能**: 全局支持按标题、内容和项目名称搜索。
- **编辑功能**: 完善了条目编辑闭环，支持修改所有元数据。
- **实体项目管理**: 引入了真正的 `projects` 数据库模型，支持新建和管理项目。
- **项目中心强化**: 新增“待整理任务”提醒，确保新记录的工作任务不会被遗漏。
- **UI 打磨**: 引入 8pt 网格系统，优化视觉层级，增加空状态引导。

### v1.0.4 - 模块化与导出
- **模块分离**: 明确划分为“个人”与“工作”两大核心模块。
- **Excel 导出**: 支持通过系统对话框导出全量任务报表。
- **知识库**: 优化了代码块展示，支持一键复制技术路径。

---

## 项目架构
应用遵循标准的 Tauri + React 架构：
- **工作模块 (Work)**: 项目中心、任务看板、工作流动态。
- **个人模块 (Personal)**: 知识库、账号管理（原型阶段）。

### 数据模型规范
- **Task**: `category` (personal/work), `task_type` (memo/task/knowledge), `status` (inbox/todo/doing/done/fixed)。
- **Project**: `name`, `description`, `status` (active/archived)。

---

## 构建与运行

### 常用命令
- **开发**: `npm run tauri dev`
- **构建**: `npm run tauri build`
- **依赖安装**: `npm install` (包含 `@tauri-apps/plugin-dialog` 等插件)

---

## 路线图 (Roadmap)
- [ ] **P1: 账号加密**: 处理账号管理模块的密码明文存储风险。
- [ ] **P1: 任务归档**: 支持将已完成的项目和任务批量归档。
- [ ] **P2: 知识库标签**: 增加标签过滤和分类能力。
- [ ] **P2: 深度动态**: 增加真实的 `activity_log` 审计轨迹。
