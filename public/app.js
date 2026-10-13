const taskList = document.querySelector('#task-list');
const taskForm = document.querySelector('#task-form');
const taskTitle = document.querySelector('#task-title');
const taskDescription = document.querySelector('#task-description');
const taskPriority = document.querySelector('#task-priority');
const taskDueDate = document.querySelector('#task-due-date');
const formError = document.querySelector('#form-error');
const pageError = document.querySelector('#page-error');
const searchInput = document.querySelector('#task-search');
const filterSelect = document.querySelector('#task-filter');

let tasks = [];
let editingTaskId = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function apiRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error('Could not reach the server. Check that it is running and try again.');
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('The server returned an unreadable response.');
  }

  if (!response.ok || !result.success) {
    const details = result.error?.details;
    throw new Error(details ? details.join(' ') : result.error?.message || 'The request failed.');
  }
  return result.data;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(`${dateString}T00:00:00`));
}

function updateSummary() {
  const completed = tasks.filter((task) => task.completed).length;
  document.querySelector('#total-count').textContent = tasks.length;
  document.querySelector('#active-count').textContent = tasks.length - completed;
  document.querySelector('#completed-count').textContent = completed;
  document.querySelector('#sidebar-count').textContent = tasks.length;
}

function getVisibleTasks() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    const matchesSearch = `${task.title} ${task.description}`.toLocaleLowerCase().includes(query);
    const matchesFilter = filterSelect.value === 'all'
      || (filterSelect.value === 'active' && !task.completed)
      || (filterSelect.value === 'completed' && task.completed);
    return matchesSearch && matchesFilter;
  });
}

function renderTasks() {
  const visibleTasks = getVisibleTasks();
  document.querySelector('#visible-count').textContent = visibleTasks.length;
  updateSummary();

  if (visibleTasks.length === 0) {
    const hasTasks = tasks.length > 0;
    taskList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true">${hasTasks ? '⌕' : '✳'}</span>
        <h3>${hasTasks ? 'No matching tasks' : 'A fresh start'}</h3>
        <p>${hasTasks
          ? 'Try a different search or filter to find what you are looking for.'
          : 'Your task list is clear. Add your first task and take that first step.'}</p>
      </div>`;
    return;
  }

  taskList.innerHTML = visibleTasks.map((task) => {
    if (editingTaskId === task.id) {
      return renderEditForm(task);
    }

    const priority = task.priority || 'medium';
    const dueDate = task.dueDate
      ? `<span class="task-badge ${!task.completed && task.dueDate < new Date().toISOString().slice(0, 10) ? 'due-overdue' : ''}">Due ${escapeHtml(formatDate(task.dueDate))}</span>`
      : '';

    return `
      <article class="task-card ${task.completed ? 'is-completed' : ''}" data-task-id="${escapeHtml(task.id)}">
        <button class="task-check" type="button" data-action="toggle" aria-pressed="${task.completed}" aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}">${task.completed ? '✓' : ''}</button>
        <div class="task-main">
          <h3 class="task-title">${escapeHtml(task.title)}</h3>
          ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
          <div class="task-meta">
            <span class="task-badge priority-${escapeHtml(priority)}">${escapeHtml(priority[0].toUpperCase() + priority.slice(1))} priority</span>
            ${dueDate}
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-button" type="button" data-action="edit" aria-label="Edit ${escapeHtml(task.title)}">✎</button>
          <button class="icon-button delete" type="button" data-action="delete" aria-label="Delete ${escapeHtml(task.title)}">⌫</button>
        </div>
      </article>`;
  }).join('');
}

function renderEditForm(task) {
  return `
    <article class="task-card" data-task-id="${escapeHtml(task.id)}">
      <form class="task-edit-form" data-action="save-edit">
        <label class="visually-hidden" for="edit-title-${escapeHtml(task.id)}">Task name</label>
        <input id="edit-title-${escapeHtml(task.id)}" name="title" maxlength="120" value="${escapeHtml(task.title)}" required>
        <label class="visually-hidden" for="edit-description-${escapeHtml(task.id)}">Description</label>
        <textarea id="edit-description-${escapeHtml(task.id)}" name="description" rows="2" maxlength="1000">${escapeHtml(task.description)}</textarea>
        <div class="task-edit-fields">
          <label class="visually-hidden" for="edit-priority-${escapeHtml(task.id)}">Priority</label>
          <select id="edit-priority-${escapeHtml(task.id)}" name="priority">
            ${['low', 'medium', 'high'].map((priority) => `<option value="${priority}" ${task.priority === priority ? 'selected' : ''}>${priority[0].toUpperCase() + priority.slice(1)} priority</option>`).join('')}
          </select>
          <label class="visually-hidden" for="edit-date-${escapeHtml(task.id)}">Due date</label>
          <input id="edit-date-${escapeHtml(task.id)}" name="dueDate" type="date" value="${escapeHtml(task.dueDate || '')}">
        </div>
        <p class="form-error" data-edit-error role="alert"></p>
        <div class="task-edit-actions">
          <button class="button button-quiet" type="button" data-action="cancel-edit">Cancel</button>
          <button class="button button-primary" type="submit">Save changes</button>
        </div>
      </form>
    </article>`;
}

function showPageError(message = '') {
  pageError.textContent = message;
  pageError.hidden = !message;
}

async function loadTasks() {
  taskList.setAttribute('aria-busy', 'true');
  showPageError();
  try {
    tasks = await apiRequest('/api/tasks');
    renderTasks();
  } catch (error) {
    tasks = [];
    updateSummary();
    taskList.innerHTML = '';
    showPageError(error.message);
  } finally {
    taskList.setAttribute('aria-busy', 'false');
  }
}

function openForm(task = null) {
  editingTaskId = null;
  taskForm.hidden = false;
  taskForm.dataset.editingId = task?.id || '';
  document.querySelector('#form-title').textContent = task ? 'Edit task' : 'Create a task';
  document.querySelector('#save-task-button').textContent = task ? 'Save changes' : 'Add task';
  taskTitle.value = task?.title || '';
  taskDescription.value = task?.description || '';
  taskPriority.value = task?.priority || 'medium';
  taskDueDate.value = task?.dueDate || '';
  formError.textContent = '';
  taskTitle.focus();
}

function closeForm() {
  taskForm.hidden = true;
  taskForm.reset();
  taskForm.dataset.editingId = '';
  formError.textContent = '';
}

document.querySelector('#new-task-button').addEventListener('click', () => openForm());
document.querySelector('#close-form-button').addEventListener('click', closeForm);
document.querySelector('#cancel-form-button').addEventListener('click', closeForm);
searchInput.addEventListener('input', renderTasks);
filterSelect.addEventListener('change', renderTasks);

document.querySelector('#task-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const editingId = taskForm.dataset.editingId;
  const body = {
    title: taskTitle.value.trim(),
    description: taskDescription.value.trim(),
    priority: taskPriority.value,
    dueDate: taskDueDate.value,
  };

  try {
    await apiRequest(editingId ? `/api/tasks/${encodeURIComponent(editingId)}` : '/api/tasks', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    });
    closeForm();
    await loadTasks();
  } catch (error) {
    formError.textContent = error.message;
  }
});

taskList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const card = button.closest('[data-task-id]');
  const task = tasks.find((item) => item.id === card?.dataset.taskId);
  if (!task) return;

  if (button.dataset.action === 'edit') {
    editingTaskId = task.id;
    closeForm();
    renderTasks();
    taskList.querySelector('[data-action="save-edit"] input[name="title"]')?.focus();
    return;
  }

  if (button.dataset.action === 'cancel-edit') {
    editingTaskId = null;
    renderTasks();
    return;
  }

  if (button.dataset.action === 'toggle') {
    try {
      await apiRequest(`/api/tasks/${encodeURIComponent(task.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ completed: !task.completed }),
      });
      await loadTasks();
    } catch (error) {
      showPageError(error.message);
    }
    return;
  }

  if (button.dataset.action === 'delete') {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    try {
      await apiRequest(`/api/tasks/${encodeURIComponent(task.id)}`, { method: 'DELETE' });
      await loadTasks();
    } catch (error) {
      showPageError(error.message);
    }
  }
});

taskList.addEventListener('submit', async (event) => {
  if (event.target.dataset.action !== 'save-edit') return;
  event.preventDefault();

  const form = event.target;
  const taskId = form.closest('[data-task-id]').dataset.taskId;
  const formData = new FormData(form);
  const body = Object.fromEntries(formData.entries());
  const errorElement = form.querySelector('[data-edit-error]');

  try {
    await apiRequest(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    editingTaskId = null;
    await loadTasks();
  } catch (error) {
    errorElement.textContent = error.message;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
  if (event.key === 'Escape' && !taskForm.hidden) closeForm();
});

document.querySelector('#today-label').textContent = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
}).format(new Date());

loadTasks();
