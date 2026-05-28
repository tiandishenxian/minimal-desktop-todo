const APP_FOLDER = 'MinimalDesktopTodo';
const isNeutralinoReady = () => window.NL_PATH && window.Neutralino?.filesystem && window.Neutralino?.os;

async function ensureDir(path) {
  try {
    await Neutralino.filesystem.getStats(path);
    return;
  } catch {
    // Missing directories are created below.
  }

  try {
    await Neutralino.filesystem.createDirectory(path);
  } catch (error) {
    const message = String(error?.message || error);
    if (!message.includes('already exists') && !message.includes('exists')) {
      throw error;
    }
  }
}

export async function getDataDir() {
  if (!isNeutralinoReady()) {
    return '../data';
  }

  try {
    const dataRoot = await Neutralino.os.getPath('data');
    const dir = `${dataRoot.replaceAll('\\', '/')}/${APP_FOLDER}`;
    await ensureDir(dir);
    return dir;
  } catch (error) {
    await Neutralino.debug.log(`Falling back to local data dir: ${error.message || error}`);
    await ensureDir('./data');
    return './data';
  }
}

export async function readJsonFile(filePath, fallback) {
  try {
    const raw = await Neutralino.filesystem.readFile(filePath);
    return JSON.parse(raw);
  } catch (error) {
    if (String(error?.message || error).includes('not found')) {
      await writeJsonFile(filePath, fallback);
    }
    return structuredClone(fallback);
  }
}

export async function writeJsonFile(filePath, data) {
  await Neutralino.filesystem.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}
