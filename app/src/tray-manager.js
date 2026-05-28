import { getSettings, updateSettings } from './settings-store.js';
import { exitApp, hideWindow, setAlwaysOnTop, showWindow } from './window-manager.js';
import { applyStartAtLogin, setStartAtLogin } from './startup-manager.js';

const TRAY_ICON = '/app/assets/tray.png';

export async function initTrayManager(renderSettings, openHistory) {
  await updateTray();

  Neutralino.events.on('trayMenuItemClicked', async (event) => {
    const id = event.detail.id;
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
    } else if (id === 'exit') {
      await exitApp();
    }
  });
}

export async function updateTray() {
  const settings = getSettings();
  await Neutralino.os.setTray({
    icon: TRAY_ICON,
    menuItems: [
      { id: 'show', text: '显示窗口' },
      { id: 'hide', text: '隐藏窗口' },
      { id: 'alwaysOnTop', text: settings.window.alwaysOnTop ? '取消置顶' : '保持置顶' },
      { id: 'startAtLogin', text: settings.app.startAtLogin ? '关闭开机启动' : '开启开机启动' },
      { id: 'history', text: '查看历史任务' },
      { id: 'SEP', text: '-' },
      { id: 'exit', text: '退出' },
    ],
  });
  await applyStartAtLogin(settings.app.startAtLogin);
}
