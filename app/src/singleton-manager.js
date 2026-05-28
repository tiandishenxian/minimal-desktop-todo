import { getAppRoot } from './runtime-paths.js';
import { getDataDir } from './storage-paths.js';
import { showWindow } from './window-manager.js';

const SECONDARY_EXIT_CODE = 10;

let singletonPoll = null;
let lastSignal = '';

function isWindows() {
  return String(window.NL_OS || '').toLowerCase().includes('windows');
}

function commandQuote(value) {
  return `"${String(value).replaceAll('"', '\\"')}"`;
}

export async function initSingletonManager() {
  if (!isWindows()) {
    return true;
  }

  const dataDir = await getDataDir();
  const signalPath = `${dataDir}/singleton.signal`;
  const processId = Number.parseInt(String(window.NL_PID || '0'), 10);
  const safeProcessId = Number.isInteger(processId) && processId > 0 ? processId : 0;
  const helperPath = `${getAppRoot()}/extensions/window-win/single-instance-helper.exe`;
  const command = [
    commandQuote(helperPath),
    '--pid',
    String(safeProcessId),
    '--signal',
    commandQuote(signalPath),
    '--terminate-current',
  ].join(' ');

  try {
    const result = await Neutralino.os.execCommand(command);
    if (result.exitCode === SECONDARY_EXIT_CODE) {
      await Neutralino.app.exit();
      return false;
    }
  } catch (error) {
    await Neutralino.debug.log(`single instance helper failed: ${error.message || error}`);
  }

  startSingletonSignalPoll(signalPath);
  return true;
}

function startSingletonSignalPoll(signalPath) {
  if (singletonPoll) {
    clearInterval(singletonPoll);
  }

  singletonPoll = setInterval(async () => {
    try {
      const signal = await Neutralino.filesystem.readFile(signalPath);
      if (signal && signal !== lastSignal) {
        lastSignal = signal;
        await showWindow();
      }
    } catch {
      // The file appears only after a second instance asks the app to show.
    }
  }, 400);
}
