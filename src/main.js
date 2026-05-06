const { invoke } = window.__TAURI__.core;

let currentView = 'note';
let currentProject = null;

// DOM Elements
const navNotes = document.getElementById('nav-notes');
const navAccounts = document.getElementById('nav-accounts');
const projectList = document.getElementById('project-list');

const noteView = document.getElementById('note-view');
const accountView = document.getElementById('account-view');
const projectView = document.getElementById('project-view');

const noteTextarea = document.getElementById('note-textarea');
const noteListContainer = document.getElementById('note-list');
const accountListContainer = document.getElementById('account-list');

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    loadNotes();
    loadAccounts();
    loadProjects();
});

// Navigation
navNotes.addEventListener('click', () => switchView('note'));
navAccounts.addEventListener('click', () => switchView('account'));

function switchView(view) {
    currentView = view;
    [noteView, accountView, projectView].forEach(v => v.style.display = 'none');
    [navNotes, navAccounts].forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#project-list li').forEach(li => li.classList.remove('active'));

    if (view === 'note') {
        noteView.style.display = 'block';
        navNotes.classList.add('active');
        loadNotes();
    } else if (view === 'account') {
        accountView.style.display = 'block';
        navAccounts.classList.add('active');
        loadAccounts();
    } else if (view === 'project') {
        projectView.style.display = 'block';
    }
}

// --- Notes Logic ---
async function loadNotes() {
    try {
        const notes = await invoke('get_notes');
        noteListContainer.innerHTML = '';
        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';
            card.innerHTML = `
                <p>${note.content}</p>
                <div class="note-actions">
                    <button class="btn-icon" onclick="deleteNote(${note.id})">🗑️</button>
                </div>
            `;
            noteListContainer.appendChild(card);
        });
    } catch (err) { console.error(err); }
}

document.getElementById('btn-save-note').addEventListener('click', async () => {
    const content = noteTextarea.value.trim();
    if (!content) return;
    try {
        await invoke('add_note', { content });
        noteTextarea.value = '';
        loadNotes();
    } catch (err) { console.error(err); }
});

window.deleteNote = async (id) => {
    if (!confirm('确认删除便笺？')) return;
    try {
        await invoke('delete_note', { id });
        loadNotes();
    } catch (err) { console.error(err); }
};

// --- Accounts Logic ---
async function loadAccounts() {
    try {
        const accounts = await invoke('get_accounts');
        accountListContainer.innerHTML = '';
        accounts.forEach(acc => {
            const card = document.createElement('div');
            card.className = 'account-card';
            card.innerHTML = `
                <div class="acc-info">
                    <h4>${acc.platform}</h4>
                    <p>UID: ${acc.username}</p>
                    <p>PWD: ******</p>
                </div>
                <div class="acc-ops">
                    <button class="btn-copy-small" onclick="copyToClipboard('${acc.username}')">复制UID</button>
                    <button class="btn-copy-small" onclick="copyToClipboard('${acc.password}')">复制PWD</button>
                    <button class="btn-icon" onclick="deleteAccount(${acc.id})">🗑️</button>
                </div>
            `;
            accountListContainer.appendChild(card);
        });
    } catch (err) { console.error(err); }
}

document.getElementById('btn-open-add-account').addEventListener('click', () => {
    document.getElementById('account-modal-title').textContent = '添加账号';
    document.getElementById('edit-account-id').value = '';
    document.getElementById('acc-username').value = '';
    document.getElementById('acc-password').value = '';
    document.getElementById('acc-note').value = '';
    document.getElementById('modal-account').style.display = 'flex';
});

document.getElementById('btn-save-account').addEventListener('click', async () => {
    const platform = document.getElementById('acc-platform').value;
    const username = document.getElementById('acc-username').value.trim();
    const password = document.getElementById('acc-password').value.trim();
    const note = document.getElementById('acc-note').value.trim();

    if (!username || !password) return;

    try {
        await invoke('add_account', { platform, username, password, note: note || null });
        closeModal('modal-account');
        loadAccounts();
    } catch (err) { console.error(err); }
});

window.deleteAccount = async (id) => {
    if (!confirm('确认删除此账号记录？')) return;
    try {
        await invoke('delete_account', { id });
        loadAccounts();
    } catch (err) { console.error(err); }
};

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
};

// --- Projects Logic ---
async function loadProjects() {
    try {
        const projects = await invoke('get_projects');
        projectList.innerHTML = '';
        projects.forEach(project => {
            const li = document.createElement('li');
            li.textContent = `📊 ${project.name}`;
            li.addEventListener('click', () => selectProject(project));
            projectList.appendChild(li);
        });
    } catch (err) { console.error(err); }
}

function selectProject(project) {
    currentProject = project;
    switchView('project');
    document.querySelectorAll('#project-list li').forEach(li => {
        if (li.textContent.includes(project.name)) li.classList.add('active');
        else li.classList.remove('active');
    });
    document.getElementById('current-project-name').textContent = project.name;
    loadKanban(project.id);
}

async function loadKanban(projectId) {
    try {
        const columns = await invoke('get_project_board', { projectId });
        const board = document.getElementById('kanban-board');
        board.innerHTML = '';
        columns.forEach(col => {
            const colDiv = document.createElement('div');
            colDiv.className = 'kanban-column';
            colDiv.innerHTML = `
                <h4>${col.name}</h4>
                <div class="kanban-tasks"></div>
                <div class="add-task-inline">
                    <input type="text" placeholder="新任务..." id="task-in-${col.id}">
                    <button onclick="addTask(${col.id})">+</button>
                </div>
            `;
            const tasksDiv = colDiv.querySelector('.kanban-tasks');
            col.tasks.forEach(task => {
                const card = document.createElement('div');
                card.className = 'task-card';
                card.textContent = task.title;
                tasksDiv.appendChild(card);
            });
            board.appendChild(colDiv);
        });
    } catch (err) { console.error(err); }
}

window.addTask = async (columnId) => {
    const input = document.getElementById(`task-in-${columnId}`);
    const title = input.value.trim();
    if (!title) return;
    try {
        await invoke('add_task', { columnId, title });
        loadKanban(currentProject.id);
    } catch (err) { console.error(err); }
};

document.getElementById('btn-add-project').addEventListener('click', () => {
    document.getElementById('modal-project').style.display = 'flex';
});

document.getElementById('btn-modal-confirm-project').addEventListener('click', async () => {
    const name = document.getElementById('input-project-name').value.trim();
    if (!name) return;
    try {
        await invoke('add_project', { name });
        closeModal('modal-project');
        loadProjects();
    } catch (err) { console.error(err); }
});

// Helpers
window.closeModal = (id) => {
    document.getElementById(id).style.display = 'none';
};
