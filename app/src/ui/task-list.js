import { completeTask, deleteTask, reorderTasks, setTaskRepeat, updateTaskTitle } from '../task-store.js';
import { describeRepeat, getVisibleTasks, REPEAT_TYPES } from '../repeat-engine.js';

const DRAG_THRESHOLD = 4;
const DRAG_BLOCK_SELECTOR = 'button, input, .task-edit';
const AUTOSCROLL_EDGE = 42;
const AUTOSCROLL_MAX_SPEED = 9;

export function createTaskList({ listEl, templateEl, onChange }) {
  let dragState = null;
  let expandedRepeatTaskId = null;
  let expandedCustomRepeatTaskId = null;

  function render(tasks) {
    const visibleTasks = getVisibleTasks(tasks);
    if (expandedRepeatTaskId && !visibleTasks.some((task) => task.id === expandedRepeatTaskId)) {
      expandedRepeatTaskId = null;
      expandedCustomRepeatTaskId = null;
    }
    if (expandedCustomRepeatTaskId && expandedCustomRepeatTaskId !== expandedRepeatTaskId) {
      expandedCustomRepeatTaskId = null;
    }

    listEl.replaceChildren();

    for (const task of visibleTasks) {
      listEl.appendChild(renderTask(task));
      if (expandedRepeatTaskId === task.id) {
        listEl.appendChild(renderRepeatInlinePanel(task));
      }
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
      closeRepeatInline({ rerender: false });
      await completeTask(task.id);
      await onChange();
    });

    node.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleRepeatInline(task.id);
    });

    node.addEventListener('pointerdown', (event) => prepareDrag(event, node));

    node.addEventListener('click', (event) => {
      if (
        expandedRepeatTaskId &&
        expandedRepeatTaskId !== task.id &&
        !event.target.closest(DRAG_BLOCK_SELECTOR)
      ) {
        closeRepeatInline();
      }
    });

    repeatButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleRepeatInline(task.id);
    });

    deleteButton.addEventListener('click', async () => {
      closeRepeatInline({ rerender: false });
      await deleteTask(task.id);
      await onChange();
    });

    titleEl.addEventListener('dblclick', () => {
      closeRepeatInline({ rerender: false });
      startEdit(node, editEl);
    });

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

  function renderRepeatInlinePanel(task) {
    const panel = document.createElement('li');
    panel.className = 'repeat-inline-panel';
    panel.dataset.repeatFor = task.id;

    const currentType = task.repeat?.enabled ? task.repeat.type : REPEAT_TYPES.NONE;
    const options = [
      [REPEAT_TYPES.NONE, '\u4e0d\u91cd\u590d'],
      [REPEAT_TYPES.DAILY, '\u6bcf\u5929'],
      [REPEAT_TYPES.WEEKLY, '\u6bcf\u5468'],
    ];

    for (const [type, label] of options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'repeat-inline-option';
      button.classList.toggle('is-selected', currentType === type);
      button.textContent = label;
      button.addEventListener('click', async (event) => {
        event.stopPropagation();
        await saveRepeat(task.id, type, 1);
      });
      panel.appendChild(button);
    }

    const customWrap = document.createElement('div');
    customWrap.className = 'repeat-inline-custom';
    const isCustomOpen =
      expandedCustomRepeatTaskId === task.id ||
      (currentType === REPEAT_TYPES.INTERVAL_DAYS && expandedRepeatTaskId === task.id);
    customWrap.classList.toggle('is-selected', currentType === REPEAT_TYPES.INTERVAL_DAYS || isCustomOpen);

    const customToggle = document.createElement('button');
    customToggle.type = 'button';
    customToggle.className = 'repeat-inline-option repeat-inline-custom-toggle';
    customToggle.classList.toggle('is-selected', currentType === REPEAT_TYPES.INTERVAL_DAYS || isCustomOpen);
    customToggle.textContent = 'N\u5929';

    const customControls = document.createElement('span');
    customControls.className = 'repeat-inline-custom-controls';
    customControls.hidden = !isCustomOpen;

    const intervalInput = document.createElement('input');
    intervalInput.type = 'number';
    intervalInput.min = '1';
    intervalInput.max = '999';
    intervalInput.inputMode = 'numeric';
    intervalInput.setAttribute('aria-label', '\u91cd\u590d\u95f4\u9694\u5929\u6570');
    intervalInput.value = String(currentType === REPEAT_TYPES.INTERVAL_DAYS ? task.repeat.interval || 3 : 3);

    const confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'repeat-inline-confirm';
    confirmButton.textContent = '\u786e\u5b9a';

    customToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      expandedCustomRepeatTaskId = task.id;
      void onChange();
    });

    confirmButton.addEventListener('click', async (event) => {
      event.stopPropagation();
      await saveCustomRepeat(task.id, intervalInput);
    });

    intervalInput.addEventListener('keydown', async (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        await saveCustomRepeat(task.id, intervalInput);
      } else if (event.key === 'Escape') {
        closeRepeatInline();
      }
    });

    customControls.append(intervalInput, confirmButton);
    customWrap.append(customToggle, customControls);
    panel.appendChild(customWrap);

    panel.addEventListener('click', (event) => event.stopPropagation());
    if (isCustomOpen) {
      requestAnimationFrame(() => {
        intervalInput.focus();
        intervalInput.select();
      });
    }
    return panel;
  }

  function toggleRepeatInline(taskId) {
    const isClosing = expandedRepeatTaskId === taskId;
    expandedRepeatTaskId = isClosing ? null : taskId;
    expandedCustomRepeatTaskId = null;
    void onChange();
  }

  function closeRepeatInline(options = {}) {
    const { rerender = true } = options;
    if (!expandedRepeatTaskId) {
      return;
    }

    expandedRepeatTaskId = null;
    expandedCustomRepeatTaskId = null;
    if (rerender) {
      void onChange();
    } else {
      listEl.querySelector('.repeat-inline-panel')?.remove();
    }
  }

  async function saveRepeat(taskId, type, interval) {
    await setTaskRepeat(taskId, {
      enabled: type !== REPEAT_TYPES.NONE,
      type,
      interval,
    });
    expandedRepeatTaskId = null;
    expandedCustomRepeatTaskId = null;
    await onChange();
  }

  async function saveCustomRepeat(taskId, intervalInput) {
    const interval = Number.parseInt(intervalInput.value, 10);
    if (!Number.isInteger(interval) || interval < 1 || interval > 999) {
      intervalInput.focus();
      intervalInput.select();
      return;
    }

    await saveRepeat(taskId, REPEAT_TYPES.INTERVAL_DAYS, interval);
  }

  function prepareDrag(event, node) {
    if (event.button !== 0 || node.classList.contains('is-editing') || event.target.closest(DRAG_BLOCK_SELECTOR)) {
      return;
    }

    closeRepeatInline({ rerender: false });

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

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeRepeatInline();
    }
  });

  return { render };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
