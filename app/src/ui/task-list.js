import { completeTask, deleteTask, reorderTasks, setTaskRepeat, updateTaskTitle } from '../task-store.js';
import { describeRepeat, getVisibleTasks, REPEAT_TYPES } from '../repeat-engine.js';
import { expandWindowForFloatingMenu, fitWindowToContent } from '../window-manager.js';

let activeMenu = null;
const DRAG_THRESHOLD = 4;
const DRAG_BLOCK_SELECTOR = 'button, input, .task-edit';
const AUTOSCROLL_EDGE = 42;
const AUTOSCROLL_MAX_SPEED = 9;

export function createTaskList({ listEl, templateEl, onChange }) {
  let dragState = null;

  function render(tasks) {
    const visibleTasks = getVisibleTasks(tasks);
    listEl.replaceChildren();

    for (const task of visibleTasks) {
      listEl.appendChild(renderTask(task));
    }

    return visibleTasks.length;
  }

  function renderTask(task) {
    const node = templateEl.content.firstElementChild.cloneNode(true);
    const titleEl = node.querySelector('.task-title');
    const editEl = node.querySelector('.task-edit');
    const metaEl = node.querySelector('.task-meta');
    const checkButton = node.querySelector('.check-button');
    const repeatButton = node.querySelector('.repeat-button');
    const deleteButton = node.querySelector('.delete-button');

    node.dataset.taskId = task.id;
    titleEl.textContent = task.title;
    editEl.value = task.title;
    metaEl.textContent = describeRepeat(task);
    metaEl.hidden = !metaEl.textContent;
    const isRepeating = Boolean(task.repeat?.enabled);
    repeatButton.textContent = isRepeating ? repeatShortLabel(task) : '';
    repeatButton.hidden = !isRepeating;

    checkButton.addEventListener('click', async () => {
      await completeTask(task.id);
      await onChange();
    });

    node.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openRepeatMenu({ task, x: event.clientX, y: event.clientY, onChange });
    });

    node.addEventListener('pointerdown', (event) => prepareDrag(event, node));

    repeatButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = repeatButton.getBoundingClientRect();
      openRepeatMenu({ task, x: rect.left, y: rect.bottom + 4, onChange });
    });

    deleteButton.addEventListener('click', async () => {
      await deleteTask(task.id);
      await onChange();
    });

    titleEl.addEventListener('dblclick', () => startEdit(node, editEl));

    editEl.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        await saveEdit(task, node, editEl, onChange);
      } else if (event.key === 'Escape') {
        editEl.value = task.title;
        stopEdit(node);
      }
    });

    editEl.addEventListener('blur', async () => {
      if (node.classList.contains('is-editing')) {
        await saveEdit(task, node, editEl, onChange);
      }
    });

    return node;
  }

  function prepareDrag(event, node) {
    if (event.button !== 0 || node.classList.contains('is-editing') || event.target.closest(DRAG_BLOCK_SELECTOR)) {
      return;
    }

    dragState = {
      node,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: 0,
      offsetY: 0,
      placeholder: null,
      dragging: false,
      originalNextSibling: node.nextElementSibling,
      lastClientY: event.clientY,
      autoScrollFrame: null,
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', cancelDrag);
    window.addEventListener('blur', cancelDragOnBlur);
  }

  function handlePointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const movedX = Math.abs(event.clientX - dragState.startX);
    const movedY = Math.abs(event.clientY - dragState.startY);
    if (!dragState.dragging && Math.max(movedX, movedY) < DRAG_THRESHOLD) {
      return;
    }

    event.preventDefault();
    dragState.lastClientY = event.clientY;
    if (!dragState.dragging) {
      startDrag(event);
    }

    moveDraggedItem(event);
    movePlaceholder(event.clientY);
    updateAutoScroll(event.clientY);
  }

  function startDrag(event) {
    const { node } = dragState;
    const rect = node.getBoundingClientRect();
    const placeholder = document.createElement('li');
    placeholder.className = 'task-placeholder';
    placeholder.style.height = `${rect.height}px`;

    dragState.dragging = true;
    dragState.offsetX = event.clientX - rect.left;
    dragState.offsetY = event.clientY - rect.top;
    dragState.placeholder = placeholder;
    listEl.insertBefore(placeholder, node.nextSibling);
    closeRepeatMenu();

    node.classList.add('is-dragging');
    node.style.left = `${rect.left}px`;
    node.style.top = `${rect.top}px`;
    node.style.width = `${rect.width}px`;
    node.style.height = `${rect.height}px`;
    document.body.appendChild(node);
    document.body.classList.add('is-task-dragging');
    updateAutoScroll(event.clientY);
  }

  function moveDraggedItem(event) {
    const { node } = dragState;
    const bounds = getDragBounds(node);
    node.style.left = `${clamp(event.clientX - dragState.offsetX, bounds.minX, bounds.maxX)}px`;
    node.style.top = `${clamp(event.clientY - dragState.offsetY, bounds.minY, bounds.maxY)}px`;
  }

  function movePlaceholder(pointerY) {
    const items = [...listEl.querySelectorAll('.task-item:not(.is-dragging)')];
    const beforeItem = items.find((item) => {
      const rect = item.getBoundingClientRect();
      return pointerY < rect.top + rect.height / 2;
    });

    if (beforeItem) {
      listEl.insertBefore(dragState.placeholder, beforeItem);
    } else {
      listEl.appendChild(dragState.placeholder);
    }
  }

  function getDragBounds(node) {
    const wrap = listEl.closest('.task-list-wrap') || listEl;
    const rect = wrap.getBoundingClientRect();
    const height = node.getBoundingClientRect().height || node.offsetHeight || 36;
    const width = node.getBoundingClientRect().width || node.offsetWidth || rect.width;
    return {
      minX: rect.left + 4,
      maxX: Math.max(rect.left + 4, rect.right - width - 4),
      minY: rect.top + 4,
      maxY: Math.max(rect.top + 4, rect.bottom - height - 4),
    };
  }

  function updateAutoScroll(pointerY) {
    dragState.lastClientY = pointerY;
    if (!dragState.autoScrollFrame) {
      dragState.autoScrollFrame = requestAnimationFrame(runAutoScroll);
    }
  }

  function runAutoScroll() {
    if (!dragState?.dragging) {
      return;
    }

    dragState.autoScrollFrame = null;
    const speed = getAutoScrollSpeed(dragState.lastClientY);
    if (speed !== 0) {
      listEl.scrollTop += speed;
      movePlaceholder(dragState.lastClientY);
    }

    if (getAutoScrollSpeed(dragState.lastClientY) !== 0) {
      dragState.autoScrollFrame = requestAnimationFrame(runAutoScroll);
    }
  }

  function getAutoScrollSpeed(pointerY) {
    if (listEl.scrollHeight <= listEl.clientHeight) {
      return 0;
    }

    const rect = listEl.getBoundingClientRect();
    if (pointerY < rect.top + AUTOSCROLL_EDGE) {
      const intensity = 1 - Math.max(0, pointerY - rect.top) / AUTOSCROLL_EDGE;
      return -Math.ceil(intensity * AUTOSCROLL_MAX_SPEED);
    }

    if (pointerY > rect.bottom - AUTOSCROLL_EDGE) {
      const intensity = 1 - Math.max(0, rect.bottom - pointerY) / AUTOSCROLL_EDGE;
      return Math.ceil(intensity * AUTOSCROLL_MAX_SPEED);
    }

    return 0;
  }

  async function finishDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    const didDrag = dragState.dragging;
    cleanupDrag();

    if (!didDrag) {
      return;
    }

    const orderedIds = [...listEl.querySelectorAll('.task-item')]
      .map((item) => item.dataset.taskId)
      .filter(Boolean);
    await reorderTasks(orderedIds);
    await onChange();
  }

  function cancelDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    cleanupDrag(true);
  }

  function cancelDragOnBlur() {
    cleanupDrag(true);
  }

  function cleanupDrag(restoreOriginalPosition = false) {
    if (!dragState) {
      return;
    }

    const { node, placeholder, originalNextSibling } = dragState;
    if (dragState.autoScrollFrame) {
      cancelAnimationFrame(dragState.autoScrollFrame);
    }

    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', finishDrag);
    window.removeEventListener('pointercancel', cancelDrag);
    window.removeEventListener('blur', cancelDragOnBlur);

    if (placeholder) {
      if (restoreOriginalPosition) {
        if (originalNextSibling?.parentElement === listEl) {
          listEl.insertBefore(node, originalNextSibling);
        } else {
          listEl.appendChild(node);
        }
      } else {
        listEl.insertBefore(node, placeholder);
      }
      placeholder.remove();
    }

    node.classList.remove('is-dragging');
    node.style.left = '';
    node.style.top = '';
    node.style.width = '';
    node.style.height = '';
    document.body.classList.remove('is-task-dragging');
    dragState = null;
  }

  return { render };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function openRepeatMenu({ task, x, y, onChange }) {
  closeRepeatMenu();

  const menu = document.createElement('div');
  menu.className = 'repeat-menu';
  menu.setAttribute('role', 'menu');
  menu.replaceChildren(...createRepeatMenuContent());

  const currentType = task.repeat?.enabled ? task.repeat.type : REPEAT_TYPES.NONE;
  for (const button of menu.querySelectorAll('[data-repeat-type]')) {
    button.classList.toggle('is-selected', button.dataset.repeatType === currentType);
    button.addEventListener('click', async () => {
      await applyRepeat(task.id, button.dataset.repeatType, 1, onChange);
    });
  }

  const intervalInput = menu.querySelector('input');
  intervalInput.value = String(task.repeat?.type === REPEAT_TYPES.INTERVAL_DAYS ? task.repeat.interval || 3 : 3);
  const customButton = menu.querySelector('[data-repeat-custom]');
  if (currentType === REPEAT_TYPES.INTERVAL_DAYS) {
    customButton.classList.add('is-selected');
  }

  customButton.addEventListener('click', async () => {
    await applyCustomRepeat(task.id, intervalInput, onChange);
  });
  intervalInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await applyCustomRepeat(task.id, intervalInput, onChange);
    }
    event.stopPropagation();
  });
  menu.addEventListener('click', (event) => event.stopPropagation());

  document.body.appendChild(menu);
  await expandWindowForFloatingMenu(menu.getBoundingClientRect().height);
  placeMenu(menu, x, y);

  const abortController = new AbortController();
  const options = { signal: abortController.signal };
  window.addEventListener('click', closeRepeatMenu, options);
  window.addEventListener('blur', closeRepeatMenu, options);
  window.addEventListener('scroll', closeRepeatMenu, true);
  window.addEventListener('keydown', handleMenuKeydown, options);
  activeMenu = { element: menu, abortController };
}

function createRepeatMenuContent() {
  const fragment = document.createDocumentFragment();
  const menuItems = [
    [REPEAT_TYPES.NONE, '\u4e0d\u91cd\u590d'],
    [REPEAT_TYPES.DAILY, '\u6bcf\u5929'],
    [REPEAT_TYPES.WEEKLY, '\u6bcf\u5468'],
    [REPEAT_TYPES.MONTHLY, '\u6bcf\u6708'],
  ];

  for (const [type, label] of menuItems) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.repeatType = type;
    button.textContent = label;
    fragment.appendChild(button);
  }

  const customRow = document.createElement('div');
  customRow.className = 'repeat-menu-custom';
  customRow.innerHTML = `
    <span>\u6bcf</span>
    <input type="number" min="1" max="999" inputmode="numeric" aria-label="Repeat interval days" />
    <span>\u5929</span>
    <button type="button" data-repeat-custom>\u786e\u5b9a</button>
  `;
  fragment.appendChild(customRow);

  return [fragment];
}

function placeMenu(menu, x, y) {
  const margin = 8;
  const rect = menu.getBoundingClientRect();
  const maxHeight = Math.max(80, window.innerHeight - margin * 2);
  menu.style.maxHeight = `${maxHeight}px`;
  menu.style.overflowY = rect.height > maxHeight ? 'auto' : 'visible';
  const left = Math.min(Math.max(margin, x), window.innerWidth - rect.width - margin);
  const top = Math.min(Math.max(margin, y), window.innerHeight - Math.min(rect.height, maxHeight) - margin);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function handleMenuKeydown(event) {
  if (event.key === 'Escape') {
    closeRepeatMenu();
  }
}

function closeRepeatMenu() {
  if (!activeMenu) {
    return;
  }

  window.removeEventListener('scroll', closeRepeatMenu, true);
  activeMenu.abortController.abort();
  activeMenu.element.remove();
  activeMenu = null;
  void fitWindowToContent();
}

async function applyRepeat(taskId, type, interval, onChange) {
  await setTaskRepeat(taskId, {
    enabled: type !== REPEAT_TYPES.NONE,
    type,
    interval,
  });
  closeRepeatMenu();
  await onChange();
}

async function applyCustomRepeat(taskId, intervalInput, onChange) {
  const interval = Number.parseInt(intervalInput.value, 10);
  if (!Number.isInteger(interval) || interval < 1 || interval > 999) {
    intervalInput.focus();
    intervalInput.select();
    return;
  }

  await applyRepeat(taskId, REPEAT_TYPES.INTERVAL_DAYS, interval, onChange);
}

function repeatShortLabel(task) {
  const interval = Number.parseInt(task.repeat.interval, 10) || 1;
  if (task.repeat.type === 'interval-days') {
    return `${interval}\u5929`;
  }
  return {
    daily: '\u6bcf\u5929',
    weekly: '\u6bcf\u5468',
    monthly: '\u6bcf\u6708',
  }[task.repeat.type] || '';
}

function startEdit(node, editEl) {
  node.classList.add('is-editing');
  editEl.focus();
  editEl.select();
}

function stopEdit(node) {
  node.classList.remove('is-editing');
}

async function saveEdit(task, node, editEl, onChange) {
  const nextTitle = editEl.value.trim();
  if (!nextTitle) {
    editEl.value = task.title;
    stopEdit(node);
    return;
  }

  await updateTaskTitle(task.id, nextTitle);
  stopEdit(node);
  await onChange();
}
