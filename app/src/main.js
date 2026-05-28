import { initHotkeyManager } from './hotkey-manager.js';
import { initSettingsStore } from './settings-store.js';
import { addTask, getTasks, initTaskStore } from './task-store.js';
import { initTrayManager } from './tray-manager.js';
import { createHistoryPanel } from './ui/history-panel.js';
import { createSettingsPanel } from './ui/settings-panel.js';
import { createTaskList } from './ui/task-list.js';
import { initTextContextMenu } from './ui/text-context-menu.js';
import { fitWindowToContent, initWindowManager, showWindow } from './window-manager.js';

const elements = {
  taskListWrap: document.querySelector('#taskListWrap'),
  taskForm: document.querySelector('#taskForm'),
  taskInput: document.querySelector('#taskInput'),
  taskList: document.querySelector('#taskList'),
  taskTemplate: document.querySelector('#taskTemplate'),
  historyPanel: document.querySelector('#historyPanel'),
  historyList: document.querySelector('#historyList'),
  historyEmpty: document.querySelector('#historyEmpty'),
  closeHistoryButton: document.querySelector('#closeHistoryButton'),
  settingsPanel: document.querySelector('#settingsPanel'),
  closeSettingsButton: document.querySelector('#closeSettingsButton'),
  alwaysOnTopToggle: document.querySelector('#alwaysOnTopToggle'),
  startAtLoginToggle: document.querySelector('#startAtLoginToggle'),
  opacitySlider: document.querySelector('#opacitySlider'),
  hotkeyLabel: document.querySelector('#hotkeyLabel'),
  exportButton: document.querySelector('#exportButton'),
  clearButton: document.querySelector('#clearButton'),
};

let taskListView = null;
let settingsView = null;
let historyView = null;
let lastDate = new Date().toDateString();

async function render() {
  taskListView.render(getTasks());
  historyView?.render();
  settingsView?.render();
  await fitWindowToContent();
}

function bindTaskForm() {
  elements.taskForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const task = await addTask(elements.taskInput.value);
    if (!task) {
      return;
    }

    elements.taskInput.value = '';
    await render();
  });
}

function bindDateRefresh() {
  window.addEventListener('focus', async () => {
    const currentDate = new Date().toDateString();
    if (currentDate !== lastDate) {
      lastDate = currentDate;
      await render();
    }
  });
}

async function boot() {
  Neutralino.init();

  await initSettingsStore();
  await initTaskStore();
  await initWindowManager();

  taskListView = createTaskList({
    listEl: elements.taskList,
    templateEl: elements.taskTemplate,
    onChange: render,
  });

  historyView = createHistoryPanel({
    panel: elements.historyPanel,
    listEl: elements.historyList,
    emptyEl: elements.historyEmpty,
    closeButton: elements.closeHistoryButton,
    taskListWrap: elements.taskListWrap,
  }, {
    getTasks,
    onChange: render,
  });

  settingsView = createSettingsPanel({
    panel: elements.settingsPanel,
    openButton: null,
    closeButton: elements.closeSettingsButton,
    alwaysOnTopToggle: elements.alwaysOnTopToggle,
    startAtLoginToggle: elements.startAtLoginToggle,
    opacitySlider: elements.opacitySlider,
    hotkeyLabel: elements.hotkeyLabel,
    exportButton: elements.exportButton,
    clearButton: elements.clearButton,
  }, { onChange: render });

  bindTaskForm();
  bindDateRefresh();
  initTextContextMenu();
  await initTrayManager(() => settingsView.render(), () => historyView.open());
  await initHotkeyManager();
  await render();
  await showWindow();
}

boot().catch((error) => {
  console.error(error);
});
