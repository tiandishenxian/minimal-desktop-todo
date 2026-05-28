import { getDataDir } from './storage-paths.js';
import { toggleWindow } from './window-manager.js';
import { getAppRoot } from './runtime-paths.js';

let hotkeyPoll = null;
let lastSignal = '';

function isWindows() {
  return String(window.NL_OS || '').toLowerCase().includes('windows');
}

function psQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export async function initHotkeyManager() {
  if (!isWindows()) {
    return;
  }

  const dataDir = await getDataDir();
  const signalPath = `${dataDir}/hotkey.signal`;
  const scriptPath = `${getAppRoot()}/extensions/hotkey-win/hotkey-listener.ps1`;
  const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -WindowStyle Hidden powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ${psQuote(scriptPath)} -SignalPath ${psQuote(signalPath)}'"`;

  try {
    await Neutralino.os.execCommand(command);
  } catch (error) {
    await Neutralino.debug.log(`hotkey helper launch failed: ${error.message || error}`);
  }

  hotkeyPoll = setInterval(async () => {
    try {
      const signal = await Neutralino.filesystem.readFile(signalPath);
      if (signal && signal !== lastSignal) {
        lastSignal = signal;
        await toggleWindow();
      }
    } catch {
      // The helper creates the signal file after the first hotkey press.
    }
  }, 400);
}

export function stopHotkeyManager() {
  if (hotkeyPoll) {
    clearInterval(hotkeyPoll);
  }
}
