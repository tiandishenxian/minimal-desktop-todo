import { getSettings } from './settings-store.js';
import { exitApp, hideWindow, setAlwaysOnTop, setOpacity, showWindow } from './window-manager.js';
import { applyStartAtLogin, setStartAtLogin } from './startup-manager.js';

const TRAY_ICON = '/app/assets/tray.png';
const OPACITY_PRESETS = [0.3, 0.5, 0.8, 1];

export async function initTrayManager(renderSettings, openHistory) {
  await updateTray();

  Neutralino.events.on('trayMenuItemClicked', async (event) => {
    const id = event.detail.id;
    if (!id) {
      return;
    }

    if (id === 'show') {
      await showWindow();
    } else if (id === 'hide') {
      await hideWindow();
    } else if (id === 'alwaysOnTop') {
      const next = !getSettings().window.alwaysOnTop;
      await setAlwaysOnTop(next);
      await updateTray();
      renderSettings?.();
    } else if (id === 'startAtLogin') {
      const next = !getSettings().app.startAtLogin;
      await setStartAtLogin(next);
      await updateTray();
      renderSettings?.();
    } else if (id === 'history') {
      await showWindow();
      await openHistory?.();
    } else if (id.startsWith('opacity-')) {
      await applyOpacity(Number(id.replace('opacity-', '')), renderSettings);
    } else if (id === 'exit') {
      await exitApp();
    }
  });
}

async function applyOpacity(percent, renderSettings) {
  if (!Number.isFinite(percent)) {
    return;
  }

  await setOpacity(percent / 100);
  await updateTray();
  renderSettings?.();
}

function opacityText(percent, currentOpacity) {
  const currentPercent = Math.round((currentOpacity || 1) * 100);
  return Math.abs(currentPercent - percent) <= 1 ? `\u25cf ${percent}%` : `  ${percent}%`;
}

function buildMainMenuItems(settings) {
  const currentPercent = Math.round((settings.window.opacity || 1) * 100);
  return [
    { id: 'show', text: '\u663e\u793a\u7a97\u53e3' },
    { id: 'hide', text: '\u9690\u85cf\u7a97\u53e3' },
    { id: 'alwaysOnTop', text: settings.window.alwaysOnTop ? '\u53d6\u6d88\u7f6e\u9876' : '\u4fdd\u6301\u7f6e\u9876' },
    { id: 'startAtLogin', text: settings.app.startAtLogin ? '\u5173\u95ed\u5f00\u673a\u542f\u52a8' : '\u5f00\u542f\u5f00\u673a\u542f\u52a8' },
    { id: 'history', text: '\u67e5\u770b\u5386\u53f2\u4efb\u52a1' },
    { id: 'SEP_OPACITY', text: '-' },
    { id: 'opacityHeader', text: `\u900f\u660e\u5ea6\uff1a${currentPercent}%`, isDisabled: true },
    ...OPACITY_PRESETS.map((opacity) => {
      const percent = Math.round(opacity * 100);
      return {
        id: `opacity-${percent}`,
        text: opacityText(percent, settings.window.opacity),
        isChecked: Math.abs(currentPercent - percent) <= 1,
      };
    }),
    { id: 'SEP', text: '-' },
    { id: 'exit', text: '\u9000\u51fa' },
  ];
}

export async function updateTray() {
  const settings = getSettings();
  await Neutralino.os.setTray({
    icon: TRAY_ICON,
    menuItems: buildMainMenuItems(settings),
  });
  await applyStartAtLogin(settings.app.startAtLogin);
}
