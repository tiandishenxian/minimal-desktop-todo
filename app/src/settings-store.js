import { emit } from './event-bus.js';
import { getDataDir, readJsonFile, writeJsonFile } from './storage-paths.js';

const DEFAULT_SETTINGS = {
  version: 1,
  window: {
    x: null,
    y: null,
    width: 300,
    height: 420,
    alwaysOnTop: true,
    collapsed: false,
    opacity: 1,
  },
  app: {
    startAtLogin: false,
    hotkey: 'Ctrl+Alt+T',
    theme: 'system',
  },
};

let filePath = null;
let settings = structuredClone(DEFAULT_SETTINGS);

async function persist() {
  await writeJsonFile(filePath, settings);
  emit('settings.changed', { settings: getSettings() });
}

export async function initSettingsStore() {
  const dir = await getDataDir();
  filePath = `${dir}/settings.json`;
  settings = await readJsonFile(filePath, DEFAULT_SETTINGS);
  settings.window = { ...DEFAULT_SETTINGS.window, ...(settings.window || {}) };
  settings.app = { ...DEFAULT_SETTINGS.app, ...(settings.app || {}) };
  return getSettings();
}

export function getSettings() {
  return structuredClone(settings);
}

export async function updateSettings(patch) {
  settings = {
    ...settings,
    ...patch,
    window: { ...settings.window, ...(patch.window || {}) },
    app: { ...settings.app, ...(patch.app || {}) },
  };
  await persist();
  return getSettings();
}

export async function saveWindowState(windowState) {
  return updateSettings({ window: windowState });
}
