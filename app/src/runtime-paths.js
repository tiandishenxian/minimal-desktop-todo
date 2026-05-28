export function getAppRoot() {
  const appPath = String(window.NL_PATH || '').replaceAll('\\', '/');
  if (appPath) {
    const lastSlash = appPath.lastIndexOf('/');
    if (lastSlash > 0 && /\.[a-z0-9]+$/i.test(appPath.slice(lastSlash + 1))) {
      return appPath.slice(0, lastSlash);
    }
    return appPath;
  }

  return String(window.NL_CWD || '.').replaceAll('\\', '/');
}
