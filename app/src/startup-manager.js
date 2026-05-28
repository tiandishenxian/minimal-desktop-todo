import { getSettings, updateSettings } from './settings-store.js';

const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const APP_VALUE = 'MinimalDesktopTodo';

function isWindows() {
  return String(window.NL_OS || '').toLowerCase().includes('windows');
}

function quote(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

export async function applyStartAtLogin(enabled) {
  if (!isWindows()) {
    return;
  }

  const command = enabled
    ? `reg add "${RUN_KEY}" /v "${APP_VALUE}" /t REG_SZ /d ${quote(window.NL_PATH)} /f`
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
