import { getSettings, updateSettings } from './settings-store.js';

const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const APP_VALUE = 'MinimalDesktopTodo';

function isWindows() {
  return String(window.NL_OS || '').toLowerCase().includes('windows');
}

function quote(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

async function getStartupTarget() {
  try {
    const launcherPath = await Neutralino.os.getEnv('MINIMAL_DESKTOP_TODO_LAUNCHER');
    if (launcherPath) {
      return launcherPath;
    }
  } catch {
    // Normal bundled Neutralino runs don't set this value.
  }

  return window.NL_PATH;
}

export async function applyStartAtLogin(enabled) {
  if (!isWindows()) {
    return;
  }

  const startupTarget = await getStartupTarget();
  const command = enabled
    ? `reg add "${RUN_KEY}" /v "${APP_VALUE}" /t REG_SZ /d ${quote(startupTarget)} /f`
    : `reg delete "${RUN_KEY}" /v "${APP_VALUE}" /f`;

  try {
    await Neutralino.os.execCommand(command);
  } catch (error) {
    await Neutralino.debug.log(`startAtLogin command failed: ${error.message || error}`);
  }
}

export async function setStartAtLogin(enabled) {
  await updateSettings({ app: { startAtLogin: enabled } });
  await applyStartAtLogin(enabled);
  return getSettings();
}
