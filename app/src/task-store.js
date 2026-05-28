import { emit } from './event-bus.js';
import { getDataDir, readJsonFile, writeJsonFile } from './storage-paths.js';
import { nextDueFor, REPEAT_TYPES, todayLocal } from './repeat-engine.js';

const DEFAULT_TASKS = { version: 1, tasks: [] };
const MAX_TITLE = 80;

let filePath = null;
let state = structuredClone(DEFAULT_TASKS);

function nowIso() {
  return new Date().toISOString();
}

function normalizeTitle(title) {
  return String(title || '').trim().slice(0, MAX_TITLE);
}

function makeId() {
  return `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function persist() {
  await writeJsonFile(filePath, state);
}

export async function initTaskStore() {
  const dir = await getDataDir();
  filePath = `${dir}/tasks.json`;
  state = await readJsonFile(filePath, DEFAULT_TASKS);
  if (!Array.isArray(state.tasks)) {
    state = structuredClone(DEFAULT_TASKS);
    await persist();
  }
  return getTasks();
}

export function getTasks() {
  return state.tasks || [];
}

export async function addTask(title, options = {}) {
  const cleanTitle = normalizeTitle(title);
  if (!cleanTitle) {
    return null;
  }

  const createdAt = nowIso();
  const repeat = options.repeat || { enabled: false, type: REPEAT_TYPES.NONE, interval: 1 };
  const task = {
    id: makeId(),
    title: cleanTitle,
    completed: false,
    createdAt,
    updatedAt: createdAt,
    dueDate: options.dueDate || null,
    repeat,
    nextDue: repeat.enabled ? options.nextDue || options.dueDate || new Date().toISOString().slice(0, 10) : null,
    order: getTasks().length + 1,
  };

  state.tasks.push(task);
  await persist();
  emit('task.created', { task });
  return task;
}

export async function updateTaskTitle(id, title) {
  const cleanTitle = normalizeTitle(title);
  if (!cleanTitle) {
    return null;
  }

  const task = getTasks().find((item) => item.id === id);
  if (!task) {
    return null;
  }

  task.title = cleanTitle;
  task.updatedAt = nowIso();
  await persist();
  emit('task.updated', { task });
  return task;
}

export async function deleteTask(id) {
  const index = getTasks().findIndex((task) => task.id === id);
  if (index === -1) {
    return null;
  }

  const [task] = state.tasks.splice(index, 1);
  await persist();
  emit('task.deleted', { task });
  return task;
}

export async function completeTask(id) {
  const task = getTasks().find((item) => item.id === id);
  if (!task) {
    return null;
  }

  if (task.repeat?.enabled) {
    task.nextDue = nextDueFor(task);
    task.completed = false;
    task.updatedAt = nowIso();
    await persist();
    emit('task.rescheduled', { task });
    return task;
  }

  task.completed = true;
  task.updatedAt = nowIso();
  await persist();
  emit('task.completed', { task });
  return task;
}

export async function setTaskRepeat(id, repeatConfig) {
  const task = getTasks().find((item) => item.id === id);
  if (!task) {
    return null;
  }

  const allowedTypes = new Set(Object.values(REPEAT_TYPES));
  const type = allowedTypes.has(repeatConfig?.type) ? repeatConfig.type : REPEAT_TYPES.NONE;
  const interval = Math.min(999, Math.max(1, Number.parseInt(repeatConfig?.interval, 10) || 1));
  const enabled = Boolean(repeatConfig?.enabled && type !== REPEAT_TYPES.NONE);

  task.repeat = {
    enabled,
    type: enabled ? type : REPEAT_TYPES.NONE,
    interval: enabled ? interval : 1,
  };
  task.nextDue = enabled ? task.nextDue || task.dueDate || todayLocal() : null;
  task.updatedAt = nowIso();
  await persist();
  emit('task.updated', { task });
  return task;
}

export async function reorderTasks(orderedVisibleIds) {
  const visibleIdSet = new Set(orderedVisibleIds);
  const tasksById = new Map(getTasks().map((task) => [task.id, task]));
  let changed = false;

  orderedVisibleIds.forEach((id, index) => {
    const task = tasksById.get(id);
    if (!task) {
      return;
    }

    const nextOrder = index + 1;
    if (task.order !== nextOrder) {
      task.order = nextOrder;
      task.updatedAt = nowIso();
      changed = true;
    }
  });

  for (const task of getTasks()) {
    if (!visibleIdSet.has(task.id) || task.order != null) {
      continue;
    }

    task.order = getTasks().length + 1;
    task.updatedAt = nowIso();
    changed = true;
  }

  if (!changed) {
    return getTasks();
  }

  await persist();
  emit('task.reordered', { ids: orderedVisibleIds });
  return getTasks();
}

export async function clearTasks() {
  state.tasks = [];
  await persist();
}

export async function exportTasks() {
  const folder = await Neutralino.os.showFolderDialog('Choose export folder');
  if (!folder) {
    return null;
  }

  const target = `${folder}/tasks-export.json`;
  await writeJsonFile(target, state);
  return target;
}
