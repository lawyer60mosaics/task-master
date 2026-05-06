const { invoke } = window.__TAURI__.core;

let currentView = 'inbox';
let currentProjectFilter = null;
let allTasks = [];

// DOM Elements
const navInbox = document.getElementById('nav-inbox');
const navTasks = document.getElementById('nav-tasks');
const navTimeline = document.getElementById('nav-timeline');
const navAccounts = document.getElementById('nav-accounts');

const inboxView = document.getElementById('inbox-view');
const tasksView = document.getElementById('tasks-view');
const timelineView = document.getElementById('timeline-view');
const accountView = document.getElementById('account-view');

const projectTagsList = document.getElementById('project-tags-list');
const inboxProjectSelect = document.getElementById('inbox-project-select');

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    await refreshData();
    switchView('inbox');
});

async function refreshData() {
    try {
        allTasks = await invoke('get_tasks');
        renderProjectTags();
        renderCurrentView();
    } catch (err) { console.error(err); }
}

// Navigation
navInbox.addEventListener('click', () => switchView('inbox'));
navTasks.addEventListener('click', () => switchView('tasks'));
navTimeline.addEventListener('click', () => switchView('timeline'));
navAccounts.addEventListener('click', () => switchView('accounts'));

function switchView(view) {
    currentView = view;
    [inboxView, tasksView, timelineView, accountView].forEach(v => v.style.display = 'none');
    [navInbox, navTasks, navTimeline, navAccounts].forEach(b => b.classList.remove('active'));

    if (view === 'inbox') {
        inboxView.style.display = 'block';
        navInbox.classList.add('active');
    } else if (view === 'tasks') {
        tasksView.style.display = 'block';
        navTasks.classList.add('active');
    } else if (view === 'timeline') {
        timelineView.style.display = 'block';
        navTimeline.classList.add('active');
    } else if (view === 'accounts') {
        accountView.style.display = 'block';
        navAccounts.classList.add('active');
        loadAccounts();
    }
    renderCurrentView();
}

function renderCurrentView() {
    if (currentView === 'inbox') renderInbox();
    else if (currentView === 'tasks') renderKanban();
    else if (currentView === 'timeline') renderTimeline();
}

// --- Project Tags ---
function renderProjectTags() {
    const projects = [...new Set(allTasks.map(t => t.project_name).filter(p => p))];
    projectTagsList.innerHTML = `<li class="${!currentProjectFilter ? 'active' : ''}" onclick="filterByProject(null)">全部任务</li>`;
    inboxProjectSelect.innerHTML = '<option value="">无项目标记</option>';
    
    projects.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `# ${p}`;
        if (currentProjectFilter === p) li.className = 'active';
        li.onclick = () => filterByProject(p);
        projectTagsList.appendChild(li);

        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        inboxProjectSelect.appendChild(opt);
    });
}

window.filterByProject = (p) => {
    currentProjectFilter = p;
    document.getElementById('current-project-filter').textContent = p || '所有项目';
    renderProjectTags();
    renderCurrentView();
};

// --- Inbox Logic ---
async function renderInbox() {
    const list = document.getElementById('inbox-list');
    const inboxTasks = allTasks.filter(t => t.status === 'inbox');
    list.innerHTML = '';
    inboxTasks.forEach(t => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="title">${t.title}</div>
            <div class="meta">
                <span>${t.project_name ? '#' + t.project_name : ''}</span>
                <div class="ops">
                    <button class="btn-copy-small" onclick="promoteToTodo(${t.id})">转为任务</button>
                    <button class="btn-icon" onclick="deleteTask(${t.id})">🗑️</button>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}

document.getElementById('btn-save-inbox').addEventListener('click', async () => {
    const textarea = document.getElementById('inbox-textarea');
    const title = textarea.value.trim();
    const projectName = inboxProjectSelect.value;
    if (!title) return;
    try {
        await invoke('add_task', { 
            title, 
            taskType: 'memo', 
            status: 'inbox', 
            priority: 'medium', 
            projectName: projectName || null 
        });
        textarea.value = '';
        await refreshData();
    } catch (err) { console.error(err); }
});

window.promoteToTodo = async (id) => {
    await invoke('update_task_status', { id, status: 'todo' });
    await refreshData();
};

// --- Kanban Logic ---
function renderKanban() {
    const cols = {
        todo: document.getElementById('col-todo'),
        doing: document.getElementById('col-doing'),
        done: document.getElementById('col-done')
    };
    Object.values(cols).forEach(c => c.innerHTML = '');

    const filtered = currentProjectFilter 
        ? allTasks.filter(t => t.project_name === currentProjectFilter)
        : allTasks;

    filtered.forEach(t => {
        if (t.status === 'inbox') return;
        const col = cols[t.status];
        if (!col) return;

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="title">${t.title}</div>
            <div class="meta">
                <select onchange="changeStatus(${t.id}, this.value)">
                    <option value="todo" ${t.status==='todo'?'selected':''}>待办</option>
                    <option value="doing" ${t.status==='doing'?'selected':''}>进行</option>
                    <option value="done" ${t.status==='done'?'selected':''}>完成</option>
                </select>
                <button class="btn-icon" onclick="deleteTask(${t.id})">🗑️</button>
            </div>
        `;
        col.appendChild(card);
    });
}

window.changeStatus = async (id, status) => {
    await invoke('update_task_status', { id, status });
    await refreshData();
};

// --- Timeline Logic ---
function renderTimeline() {
    const container = document.getElementById('timeline-list');
    container.innerHTML = '';
    // 按修改时间排序
    const sorted = [...allTasks].sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));
    sorted.forEach(t => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="time">${t.updated_at}</div>
            <div class="content">[${t.status.toUpperCase()}] ${t.title}</div>
        `;
        container.appendChild(item);
    });
}

// --- Accounts ---
async function loadAccounts() {
    const list = document.getElementById('account-list');
    try {
        const accounts = await invoke('get_accounts');
        list.innerHTML = '';
        accounts.forEach(acc => {
            const card = document.createElement('div');
            card.className = 'card account-card';
            card.innerHTML = `
                <div class="acc-info">
                    <span class="badge-todo" style="padding:2px 8px; border-radius:4px;">${acc.platform}</span>
                    <span style="margin-left:10px;">${acc.username}</span>
                </div>
                <div class="acc-ops">
                    <button class="btn-copy-small" onclick="copyToClipboard('${acc.username}', event)">UID</button>
                    <button class="btn-copy-small" onclick="copyToClipboard('${acc.password}', event)">PWD</button>
                    <button class="btn-icon" onclick="deleteAccount(${acc.id})">🗑️</button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (err) { console.error(err); }
}

document.getElementById('btn-save-account').addEventListener('click', async () => {
    const platform = document.getElementById('acc-platform').value;
    const username = document.getElementById('acc-username').value;
    const password = document.getElementById('acc-password').value;
    if (!platform || !username || !password) return;
    try {
        await invoke('add_account', { platform, username, password, note: null });
        closeModal('modal-account');
        loadAccounts();
    } catch (err) { console.error(err); }
});

window.deleteAccount = async (id) => {
    if (confirm('删除账号？')) {
        await invoke('delete_account', { id });
        loadAccounts();
    }
};

window.copyToClipboard = (text, event) => {
    navigator.clipboard.writeText(text);
    const btn = event.currentTarget;
    const old = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = old, 1000);
};

// Global Helpers
window.deleteTask = async (id) => {
    if (confirm('确定删除此任务/记录？')) {
        await invoke('delete_task', { id });
        await refreshData();
    }
};

window.closeModal = (id) => document.getElementById(id).style.display = 'none';
document.getElementById('btn-open-add-account').onclick = () => document.getElementById('modal-account').style.display = 'flex';
