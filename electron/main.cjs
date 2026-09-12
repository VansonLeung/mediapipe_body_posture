const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  session,
  systemPreferences,
} = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  APP_URL,
  isAppURL,
  assetPath,
  allowsPermission,
} = require('./security.cjs');

app.setName('Forma');
const devArgument =
  !app.isPackaged && process.argv.find((arg) => arg.startsWith('--dev-url='));
const devURL = devArgument ? devArgument.slice('--dev-url='.length) : undefined;
if (devURL) {
  const url = new URL(devURL);
  if (
    url.protocol !== 'http:' ||
    url.hostname !== '127.0.0.1' ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'Electron development requires a local Vite server on 127.0.0.1.',
    );
  }
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'forma',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const csp = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
].join('; ');

function trustedSender(event) {
  return (
    event.senderFrame === event.sender.mainFrame &&
    isAppURL(event.senderFrame.url, devURL)
  );
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 390,
    minHeight: 600,
    show: false,
    title: 'Forma',
    backgroundColor: '#f4f7f5',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.once('ready-to-show', () => window.show());
  const sendFullscreen = () => {
    window.webContents.send('window:fullscreen-changed', window.isFullScreen());
  };
  window.on('enter-full-screen', sendFullscreen);
  window.on('leave-full-screen', sendFullscreen);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAppURL(url, devURL)) event.preventDefault();
  });
  window.webContents.on('will-redirect', (event, url) => {
    if (!isAppURL(url, devURL)) event.preventDefault();
  });
  void window.loadURL(devURL || APP_URL).catch((error) => {
    dialog.showErrorBox('Could not load Forma', error.message);
    window.close();
  });
}

app.whenReady().then(() => {
  protocol.handle('forma', async (request) => {
    const file = assetPath(request.url, path.join(app.getAppPath(), 'dist'));
    if (!file || request.method !== 'GET')
      return new Response('Not found', { status: 404 });
    try {
      const response = await net.fetch(pathToFileURL(file).toString());
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', csp);
      return new Response(response.body, { status: response.status, headers });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
  session.defaultSession.setPermissionCheckHandler(
    (contents, permission, origin, details) =>
      !!contents &&
      isAppURL(contents.getURL(), devURL) &&
      isAppURL(origin, devURL) &&
      allowsPermission(permission, details),
  );
  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback, details) => {
      if (
        !isAppURL(contents.getURL(), devURL) ||
        !isAppURL(details.requestingUrl, devURL) ||
        !details.isMainFrame ||
        !allowsPermission(permission, details)
      ) {
        callback(false);
        return;
      }
      if (permission === 'media' && process.platform === 'darwin') {
        void systemPreferences
          .askForMediaAccess('camera')
          .then(callback)
          .catch(() => callback(false));
      } else {
        callback(true);
      }
    },
  );

  ipcMain.handle('window:fullscreen-state', (event) => {
    if (!trustedSender(event)) return false;
    return BrowserWindow.fromWebContents(event.sender)?.isFullScreen() ?? false;
  });
  ipcMain.handle('window:toggle-fullscreen', (event) => {
    if (!trustedSender(event)) return;
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.setFullScreen(!window.isFullScreen());
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { role: 'fileMenu' },
      { role: 'editMenu' },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : []),
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      { role: 'windowMenu' },
    ]),
  );
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
