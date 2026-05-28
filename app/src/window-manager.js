import { getSettings, saveWindowState, updateSettings } from './settings-store.js';

let saveTimer = null;
let visible = true;
const MIN_HEIGHT = 62;
const MAX_HEIGHT = 420;
const WINDOW_SAFE_INSET = 4;

async function logError(scope, error) {
  try {
    await Neutralino.debug.log(`${scope}: ${error.message || error}`);
  } catch {
    console.warn(scope, error);
  }
}

export async function initWindowManager() {
  const settings = getSettings();
  await applyWindowSettings(settings.window);

  try {
    await Neutralino.window.setDraggableRegion('dragHandle');
  } catch (error) {
    await logError('setDraggableRegion failed', error);
  }

  Neutralino.events.on('windowClose', async () => {
    await saveCurrentWindowState();
    await hideWindow();
  });

  Neutralino.events.on('windowBlur', scheduleWindowStateSave);
  window.addEventListener('resize', scheduleWindowStateSave);
  setInterval(scheduleWindowStateSave, 15000);
}

export async function applyWindowSettings(windowSettings) {
  try {
    if (Number.isFinite(windowSettings.width) && Number.isFinite(windowSettings.height)) {
      await Neutralino.window.setSize({ width: windowSettings.width, height: windowSettings.height });
    }

    if (Number.isFinite(windowSettings.x) && Number.isFinite(windowSettings.y)) {
      await Neutralino.window.move(windowSettings.x, windowSettings.y);
    } else {
      await moveToDefaultTopRight(windowSettings.width || 300);
    }

    await Neutralino.window.setAlwaysOnTop(Boolean(windowSettings.alwaysOnTop));
    await setOpacity(windowSettings.opacity ?? 1);
  } catch (error) {
    await logError('applyWindowSettings failed', error);
  }
}

async function moveToDefaultTopRight(width) {
  try {
    const availableWidth = window.screen?.availWidth || window.screen?.width;
    if (!availableWidth) {
      return;
    }

    const x = Math.max(0, availableWidth - width - 24);
    await Neutralino.window.move(x, 80);
  } catch (error) {
    await logError('moveToDefaultTopRight failed', error);
  }
}

export function scheduleWindowStateSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrentWindowState, 400);
}

export async function saveCurrentWindowState() {
  try {
    const [position, size] = await Promise.all([
      Neutralino.window.getPosition(),
      Neutralino.window.getSize(),
    ]);
    const current = getSettings().window;
    await saveWindowState({
      ...current,
      x: Math.round(position.x),
      y: Math.round(position.y),
      width: Math.round(size.width),
      height: Math.round(size.height),
    });
  } catch (error) {
    await logError('saveCurrentWindowState failed', error);
  }
}

export async function setAlwaysOnTop(enabled) {
  await Neutralino.window.setAlwaysOnTop(enabled);
  await updateSettings({ window: { alwaysOnTop: enabled } });
}

export async function setOpacity(opacity) {
  const safeOpacity = Math.min(1, Math.max(0.7, Number(opacity) || 1));
  document.documentElement.style.setProperty('--app-opacity', String(safeOpacity));
  await updateSettings({ window: { opacity: safeOpacity } });
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function px(value) {
  return Number.parseFloat(value) || 0;
}

function panelOuterHeight(panel) {
  const styles = window.getComputedStyle(panel);
  return panel.scrollHeight + px(styles.marginTop) + px(styles.marginBottom) + WINDOW_SAFE_INSET;
}

export async function fitWindowToContent() {
  try {
    await nextFrame();
    const historyPanel = document.querySelector('#historyPanel');
    const historyList = document.querySelector('#historyList');
    if (historyPanel && !historyPanel.hidden) {
      historyList.style.maxHeight = 'none';
      historyList.style.overflowY = 'visible';
      await nextFrame();

      const contentHeight = panelOuterHeight(historyPanel);
      const targetHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.ceil(contentHeight)));
      const isCapped = contentHeight > MAX_HEIGHT;
      const size = await Neutralino.window.getSize();

      if (Math.abs(size.height - targetHeight) > 2) {
        await Neutralino.window.setSize({
          width: Math.round(size.width),
          height: targetHeight,
        });
        scheduleWindowStateSave();
      }

      if (isCapped) {
        const panelStyles = window.getComputedStyle(historyPanel);
        const header = historyPanel.querySelector('.history-header');
        const empty = historyPanel.querySelector('.history-empty');
        const reservedHeight =
          px(panelStyles.paddingTop) +
          px(panelStyles.paddingBottom) +
          (header?.offsetHeight || 0) +
          (empty && !empty.hidden ? empty.offsetHeight : 0) +
          18;
        historyList.style.maxHeight = `${Math.max(0, targetHeight - reservedHeight - WINDOW_SAFE_INSET)}px`;
        historyList.style.overflowY = 'auto';
      } else {
        historyList.style.maxHeight = 'none';
        historyList.style.overflowY = 'visible';
      }
      return;
    }

    const wrap = document.querySelector('#taskListWrap');
    const list = document.querySelector('#taskList');
    const form = document.querySelector('#taskForm');
    if (!wrap || !list || !form) {
      return;
    }

    list.style.maxHeight = 'none';
    list.style.overflowY = 'visible';
    await nextFrame();

    const wrapStyles = window.getComputedStyle(wrap);
    const formStyles = window.getComputedStyle(form);
    const verticalPadding = px(wrapStyles.paddingTop) + px(wrapStyles.paddingBottom);
    const formOuterHeight = form.offsetHeight + px(formStyles.marginTop) + px(formStyles.marginBottom);
    const contentHeight = list.scrollHeight + formOuterHeight + verticalPadding + 10 + WINDOW_SAFE_INSET;
    const targetHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.ceil(contentHeight)));
    const isCapped = contentHeight > MAX_HEIGHT;

    const size = await Neutralino.window.getSize();

    if (Math.abs(size.height - targetHeight) > 2) {
      await Neutralino.window.setSize({
        width: Math.round(size.width),
        height: targetHeight,
      });
      scheduleWindowStateSave();
    }

    if (isCapped) {
      list.style.maxHeight = `${Math.max(0, targetHeight - formOuterHeight - verticalPadding - 8)}px`;
      list.style.overflowY = 'auto';
    } else {
      list.style.maxHeight = 'none';
      list.style.overflowY = 'visible';
    }
  } catch (error) {
    await logError('fitWindowToContent failed', error);
  }
}

export async function showWindow() {
  visible = true;
  await Neutralino.window.show();
  await Neutralino.window.focus();
}

export async function hideWindow() {
  visible = false;
  await Neutralino.window.hide();
}

export async function toggleWindow() {
  if (visible) {
    await hideWindow();
  } else {
    await showWindow();
  }
}

export async function exitApp() {
  await saveCurrentWindowState();
  await Neutralino.app.exit();
}
