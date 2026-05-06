const { invoke } = window.__TAURI__.core;

let currentView = 'memo';
let currentProject = null;

// DOM Elements
const navMemos = document.getElementById('nav-memos');
const projectList = document.getElementById('project-list');
const btnAddProject = document.getElementById('btn-add-project');
const memoView = document.getElementById('memo-view');
const projectView = document.getElementById('project-view');
const memoTextarea = document.getElementById('memo-textarea');
const btnSaveMemo = document.getElementById('btn-save-memo');
const memoListContainer = document.getElementById('memo-list');
const modalProject = document.getElementById('modal-project');
const btnModalCancel = document.getElementById('btn-modal-cancel');
const btnModalConfirm = document.getElementById('btn-modal-confirm');
const inputProjectName = document.getElementById('input-project-name');

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    loadMemos();
    loadProjects();
});

// Navigation
navMemos.addEventListener('click', () => {
    showView('memo');
    navMemos.classList.add('active');
    document.querySelectorAll('#project-list li').forEach(li => li.classList.remove('active'));
});

function showView(view) {
    currentView = view;
    if (view === 'memo') {
        memoView.style.display = 'block';
        projectView.style.display = 'none';
    } else {
        memoView.style.display = 'none';
        projectView.style.display = 'block';
    }
}

// Memos Logic
const accountFields = document.getElementById('account-fields');
const memoTypeRadios = document.querySelectorAll('input[name="memo-type"]');

memoTypeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'memo') {
            accountFields.style.display = 'none';
        } else {
            accountFields.style.display = 'flex';
        }
    });
});

async function loadMemos() {
    try {
        const memos = await invoke('get_memos');
        memoListContainer.innerHTML = '';
        memos.forEach(memo => {
            const card = document.createElement('div');
            card.className = 'memo-card';
            
            let accountHtml = '';
            if (memo.memo_type !== 'memo') {
                accountHtml = `
                    <div class="account-info">
                        <div class="account-row">
                            <span>UID: ${memo.username || '-'}</span>
                            <button class="btn-copy" onclick="copyToClipboard('${memo.username}')">复制</button>
                        </div>
                        <div class="account-row">
                            <span>PWD: ******</span>
                            <button class="btn-copy" onclick="copyToClipboard('${memo.password}')">复制密码</button>
                        </div>
                    </div>
                `;
            }

            card.innerHTML = `
                <span class="memo-type-badge">${memo.memo_type}</span>
                <p>${memo.content}</p>
                ${accountHtml}
                <div class="memo-date">${memo.created_at}</div>
            `;
            memoListContainer.appendChild(card);
        });
    } catch (err) {
        console.error('Failed to load memos:', err);
    }
}

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        // Optional: show a toast or feedback
    });
};

btnSaveMemo.addEventListener('click', async () => {
    const content = memoTextarea.value.trim();
    const memo_type = document.querySelector('input[name="memo-type"]:checked').value;
    const username = document.getElementById('memo-username').value.trim();
    const password = document.getElementById('memo-password').value.trim();
    
    if (!content && memo_type === 'memo') return;
    
    try {
        await invoke('add_memo', { 
            memoType: memo_type, 
            content, 
            username: username || null, 
            password: password || null 
        });
        memoTextarea.value = '';
        document.getElementById('memo-username').value = '';
        document.getElementById('memo-password').value = '';
        loadMemos();
    } catch (err) {
        console.error('Failed to save memo:', err);
    }
});

// Projects Logic
async function loadProjects() {
    try {
        const projects = await invoke('get_projects');
        projectList.innerHTML = '';
        projects.forEach(project => {
            const li = document.createElement('li');
            li.textContent = project.name;
            li.addEventListener('click', () => {
                selectProject(project);
            });
            projectList.appendChild(li);
        });
    } catch (err) {
        console.error('Failed to load projects:', err);
    }
}

function selectProject(project) {
    currentProject = project;
    showView('project');
    navMemos.classList.remove('active');
    document.querySelectorAll('#project-list li').forEach(li => {
        if (li.textContent === project.name) li.classList.add('active');
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
                <div class="kanban-tasks" id="tasks-col-${col.id}"></div>
                <div class="add-task-inline">
                    <input type="text" placeholder="新任务..." id="input-new-task-${col.id}">
                    <button onclick="addNewTask(${col.id})">+</button>
                </div>
            `;
            board.appendChild(colDiv);
            
            const tasksContainer = colDiv.querySelector('.kanban-tasks');
            col.tasks.forEach(task => {
                const taskCard = document.createElement('div');
                taskCard.className = 'task-card';
                taskCard.innerHTML = `
                    <div class="task-title">${task.title}</div>
                    ${task.description ? `<div class="task-desc">${task.description}</div>` : ''}
                `;
                tasksContainer.appendChild(taskCard);
            });
        });
    } catch (err) {
        console.error('Failed to load board:', err);
    }
}

window.addNewTask = async function(columnId) {
    const input = document.getElementById(`input-new-task-${columnId}`);
    const title = input.value.trim();
    if (!title) return;
    
    try {
        await invoke('add_task', { columnId, title });
        input.value = '';
        loadKanban(currentProject.id);
    } catch (err) {
        console.error('Failed to add task:', err);
    }
};

// Modal Logic
btnAddProject.addEventListener('click', () => {
    modalProject.style.display = 'flex';
});

btnModalCancel.addEventListener('click', () => {
    modalProject.style.display = 'none';
    inputProjectName.value = '';
});

btnModalConfirm.addEventListener('click', async () => {
    const name = inputProjectName.value.trim();
    if (!name) return;
    
    try {
        await invoke('add_project', { name });
        modalProject.style.display = 'none';
        inputProjectName.value = '';
        loadProjects();
    } catch (err) {
        console.error('Failed to add project:', err);
    }
});
