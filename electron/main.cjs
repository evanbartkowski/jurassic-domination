const { app, BrowserWindow, ipcMain, screen, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

app.setName('Jurassic Domination');
// An explicit local environment override lets source and packaged QA use disposable profiles.
if (process.env.JD_TEST_USER_DATA && path.isAbsolute(process.env.JD_TEST_USER_DATA)) {
  app.setPath('userData', process.env.JD_TEST_USER_DATA);
}
let window;
const entry = path.join(__dirname, '..', 'dist', 'index.html');
const entryURL = pathToFileURL(entry).href;
const trusted = (event) => event.sender === window?.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url.split('#')[0] === entryURL;

function createWindow() {
  const area = screen.getPrimaryDisplay().workAreaSize;
  window = new BrowserWindow({
    title: 'Jurassic Domination',
    icon: path.join(__dirname, '..', 'dist', 'assets', 'icon.png'),
    width: Math.min(1440, area.width),
    height: Math.min(900, area.height),
    minWidth: Math.min(800, area.width),
    minHeight: Math.min(600, area.height),
    backgroundColor: '#0b1714',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });
  window.setMenu(null);
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url.split('#')[0] !== entryURL) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown' && !input.isAutoRepeat) {
      window.setFullScreen(!window.isFullScreen());
      event.preventDefault();
    }
  });
  window.on('closed', () => { window = null; });
  window.loadFile(entry);
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; media-src 'self' blob:; connect-src 'none'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'"],
    } });
  });
  ipcMain.handle('window:fullscreen', (event) => {
    if (!trusted(event)) return false;
    window.setFullScreen(!window.isFullScreen());
    return window.isFullScreen();
  });
  ipcMain.on('window:quit', (event) => { if (trusted(event)) app.quit(); });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
