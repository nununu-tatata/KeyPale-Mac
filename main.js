const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let currentFilePath = null;

// 設定ファイルのパス (ユーザーデータフォルダ内)
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'window-state.json');
const layoutStatePath = path.join(userDataPath, 'layout-state.json');

// レイアウト設定の読み書きは先に登録（renderer の invoke 競合を防ぐ）
ipcMain.handle('get-layout-config', () => {
  try {
    if (fs.existsSync(layoutStatePath)) {
      return fs.readFileSync(layoutStatePath, 'utf-8');
    }
  } catch (e) {
    console.error('Layout load error:', e);
  }
  return null;
});

ipcMain.handle('clear-layout-config', () => {
  try {
    if (fs.existsSync(layoutStatePath)) fs.unlinkSync(layoutStatePath);
  } catch (e) {
    console.error('Layout clear error:', e);
  }
});

ipcMain.on('save-layout-cache', (_e, configJson) => {
  try {
    if (configJson != null && typeof configJson === 'string') {
      fs.writeFileSync(layoutStatePath, configJson);
    }
  } catch (err) {
    console.error('Layout cache save error:', err);
  }
});


function createWindow() {
  // 保存されたウィンドウ状態を読み込む
  let windowState = { width: 1000, height: 700, x: undefined, y: undefined, isMaximized: false };
  try {
    if (fs.existsSync(configPath)) {
      windowState = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {
    console.error("Config load error:", e);
  }

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    frame: false,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  const htmlFile = 'index.html';
  mainWindow.loadFile(htmlFile);

  let layoutCloseReady = false;
  let layoutSaveTimeout = null;

  mainWindow.on('close', (e) => {
    if (!mainWindow) return;
    // レイアウトを保存してから閉じる（renderer に依頼し、完了後に閉じ直す）
    if (!layoutCloseReady) {
      e.preventDefault();
      mainWindow.webContents.send('save-layout-request');
      layoutCloseReady = true;
      layoutSaveTimeout = setTimeout(() => {
        layoutSaveTimeout = null;
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
      }, 2000);
      return;
    }
    if (layoutSaveTimeout) {
      clearTimeout(layoutSaveTimeout);
      layoutSaveTimeout = null;
    }
    const isMaximized = mainWindow.isMaximized();
    const bounds = isMaximized ? mainWindow.getNormalBounds() : mainWindow.getBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: isMaximized
    };
    try {
      fs.writeFileSync(configPath, JSON.stringify(state));
    } catch (err) {
      console.error("Config save error:", err);
    }
  });

  ipcMain.once('save-layout-done', (_e, configJson) => {
    if (layoutSaveTimeout) {
      clearTimeout(layoutSaveTimeout);
      layoutSaveTimeout = null;
    }
    try {
      if (configJson != null && typeof configJson === 'string') {
        fs.writeFileSync(layoutStatePath, configJson);
      }
    } catch (err) {
      console.error('Layout save error:', err);
    }
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// --- アプリケーションのライフサイクル ---

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  
  if (process.platform === 'darwin') {
    const template = [
      {
        label: app.name,
        submenu: [ { role: 'about' }, { type: 'separator' }, { role: 'quit' } ]
      },
      {
        label: 'File',
        submenu: [
          { label: 'Open...', accelerator: 'CmdOrCtrl+O', click: async () => { if(mainWindow) mainWindow.webContents.send('menu-open-file-request'); } },
          { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => { if(mainWindow) mainWindow.webContents.send('menu-save-request'); } }
        ]
      },
      {
        label: 'Edit',
        submenu: [ { role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' } ]
      },
      {
        label: 'View',
        submenu: [ { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' } ]
      }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } else {
    Menu.setApplicationMenu(null);
  }
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC通信 ---

ipcMain.handle('save-file', async (event, content, saveAs, type = 'txt', defaultFileName = '') => {
  let filters = [
    { name: 'Text Files', extensions: ['txt', 'md'] },
    { name: 'All Files', extensions: ['*'] }
  ];

  if (type === 'json') {
    filters = [
      { name: 'Tekey JSON', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ];
  }

  let targetPath = currentFilePath;

  if (saveAs || !targetPath) {
    let defaultPath = currentFilePath || path.join(app.getPath('documents'), 'untitled');
    if (defaultFileName) {
      if (type === 'json' && !defaultFileName.endsWith('.json')) defaultFileName = defaultFileName + '.json';
      defaultPath = path.join(app.getPath('documents'), defaultFileName);
    }
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      filters: filters,
      defaultPath: defaultPath
    });
    if (canceled) return { status: 'canceled' };
    targetPath = filePath;
  }

  try {
    fs.writeFileSync(targetPath, content, 'utf-8');
    currentFilePath = targetPath;
    return { status: 'success', path: targetPath };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
});

ipcMain.handle('open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'All Supported', extensions: ['txt', 'md', 'json'] },
      { name: 'Text Files', extensions: ['txt', 'md'] },
      { name: 'Tekey JSON', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (canceled) return { status: 'canceled' };

  const filePath = filePaths[0];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    currentFilePath = filePath;
    mainWindow.webContents.send('menu-open-file', content, filePath);
    return { status: 'success', content, path: filePath };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
});

ipcMain.handle('open-json-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Tekey JSON', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (canceled) return { status: 'canceled' };

  const filePath = filePaths[0];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { status: 'success', content, path: filePath };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
});

ipcMain.on('minimize-window', () => { if(mainWindow) mainWindow.minimize(); });
ipcMain.on('maximize-window', () => { 
  if(mainWindow) { 
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize(); 
    } else {
      mainWindow.maximize(); 
    }
  } 
});

// 最大化状態をrendererに通知（CSS調整用）
ipcMain.handle('is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.on('close-window', () => { if(mainWindow) mainWindow.close(); });

// 開発者ツール（メニューを消しているWindowsでも開けるようにする）
ipcMain.on('open-devtools', () => {
  if (!mainWindow) return;
  mainWindow.webContents.openDevTools({ mode: 'detach' });
});

ipcMain.on('toggle-devtools', () => {
  if (!mainWindow) return;
  if (mainWindow.webContents.isDevToolsOpened()) {
    mainWindow.webContents.closeDevTools();
  } else {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
});

ipcMain.on('open-external', (event, url) => {
  if (url && typeof url === 'string') shell.openExternal(url);
});

// ヘルプページ（help.html）を既定ブラウザで開く
// shell.openPath でローカルファイルを開く（openExternal の file:// はブロックされることがある）
// パッケージ時は app.asar 内をブラウザが開けないため、一時ファイルに書き出してから開く
ipcMain.on('open-help', () => {
  const helpPath = path.join(__dirname, 'help.html');
  let pathToOpen;
  if (app.isPackaged) {
    try {
      const content = fs.readFileSync(helpPath, 'utf-8');
      const tempDir = app.getPath('temp');
      pathToOpen = path.join(tempDir, 'KeyPale-help.html');
      fs.writeFileSync(pathToOpen, content, 'utf-8');
    } catch (e) {
      console.error('Help file error:', e);
      return;
    }
  } else {
    if (!fs.existsSync(helpPath)) {
      console.error('Help file not found:', helpPath);
      return;
    }
    pathToOpen = helpPath;
  }
  shell.openPath(pathToOpen).then(({ error }) => {
    if (error) console.error('Help open error:', error);
  });
});