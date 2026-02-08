// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('myApi', {
  // ファイル操作
  saveFile: (content, saveAs = false, type = 'txt', defaultFileName = '') => ipcRenderer.invoke('save-file', content, saveAs, type, defaultFileName),
  openFile: () => ipcRenderer.invoke('open-file'),
  openJsonFile: () => ipcRenderer.invoke('open-json-file'),
  
  // ▼▼▼ ウィンドウ操作 (ここが重要！) ▼▼▼
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),

  // 開発者ツール
  openDevTools: () => ipcRenderer.send('open-devtools'),
  toggleDevTools: () => ipcRenderer.send('toggle-devtools'),

  // 最大化状態の取得
  isMaximized: () => ipcRenderer.invoke('is-maximized'),
  
  // 外部リンクを既定ブラウザで開く
  openExternal: (url) => ipcRenderer.send('open-external', url),
  // ヘルプページ（help.html）を既定ブラウザで開く
  openHelp: () => ipcRenderer.send('open-help'),

  // レイアウト保存（閉じる前に main から要求。configJson を main がファイルに保存）
  getLayoutConfig: () => ipcRenderer.invoke('get-layout-config'),
  clearLayoutConfig: () => ipcRenderer.invoke('clear-layout-config'),
  onSaveLayoutRequest: (callback) => ipcRenderer.on('save-layout-request', () => callback()),
  sendSaveLayoutDone: (configJson) => ipcRenderer.send('save-layout-done', configJson),
  saveLayoutCache: (configJson) => ipcRenderer.send('save-layout-cache', configJson),

  // メニュー連携
  onMenuSaveRequest: (callback) => ipcRenderer.on('menu-save-request', () => callback()),
  onMenuOpenFile: (callback) => ipcRenderer.on('menu-open-file', (e, content, path) => callback(content, path))
});