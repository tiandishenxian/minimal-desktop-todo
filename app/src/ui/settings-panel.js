import { clearTasks, exportTasks } from '../task-store.js';
import { getSettings } from '../settings-store.js';
import { setStartAtLogin } from '../startup-manager.js';
import { setAlwaysOnTop, setOpacity } from '../window-manager.js';
import { updateTray } from '../tray-manager.js';

export function createSettingsPanel(elements, { onChange, setStatus }) {
  const {
    panel,
    openButton,
    closeButton,
    alwaysOnTopToggle,
    startAtLoginToggle,
    opacitySlider,
    hotkeyLabel,
    exportButton,
    clearButton,
  } = elements;

  function render() {
    const settings = getSettings();
    alwaysOnTopToggle.checked = Boolean(settings.window.alwaysOnTop);
    startAtLoginToggle.checked = Boolean(settings.app.startAtLogin);
    opacitySlider.value = String(Math.round((settings.window.opacity || 1) * 100));
    hotkeyLabel.textContent = settings.app.hotkey;
  }

  function open() {
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    render();
    closeButton.focus();
  }

  function close() {
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    openButton?.focus();
  }

  openButton?.addEventListener('click', open);
  closeButton.addEventListener('click', close);

  alwaysOnTopToggle.addEventListener('change', async () => {
    await setAlwaysOnTop(alwaysOnTopToggle.checked);
    await updateTray();
    setStatus?.(alwaysOnTopToggle.checked ? 'Always on top enabled.' : 'Always on top disabled.');
    render();
  });

  startAtLoginToggle.addEventListener('change', async () => {
    await setStartAtLogin(startAtLoginToggle.checked);
    await updateTray();
    setStatus?.(startAtLoginToggle.checked ? 'Start at login enabled.' : 'Start at login disabled.');
    render();
  });

  opacitySlider.addEventListener('input', async () => {
    await setOpacity(Number(opacitySlider.value) / 100);
  });

  exportButton.addEventListener('click', async () => {
    try {
      const exported = await exportTasks();
      setStatus?.(exported ? `Exported to ${exported}` : 'Export canceled.');
    } catch {
      setStatus?.('Export canceled.');
    }
  });

  clearButton.addEventListener('click', async () => {
    const confirmed = await Neutralino.os.showMessageBox('Clear tasks', 'Clear all current tasks?', 'YES_NO', 'WARNING');
    if (confirmed === 'YES') {
      await clearTasks();
      await onChange();
      setStatus?.('All current tasks cleared.');
    }
  });

  return { render, open, close };
}
