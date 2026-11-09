// Electron メインプロセス
const { app, BrowserWindow, ipcMain, dialog, Menu, shell, clipboard, ClipboardItem } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fssync = require('node:fs');
const tex = require('./tex');
const { readDocxXml } = require('./zip');

const isMac = process.platform === 'darwin';
const FILE_EXT = 'mathprob';

let mainWindow = null;
let isDirty = false;
let forceClose = false;
let pendingOpenPath = findFileArg(process.argv);

// ---------- 設定 ----------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function loadSettings() {
  try {
    return JSON.parse(fssync.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}
function saveSettings(s) {
  fssync.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fssync.writeFileSync(settingsFile(), JSON.stringify(s, null, 2));
}
function enginePath() {
  const s = loadSettings();
  if (s.enginePath && fssync.existsSync(s.enginePath)) return s.enginePath;
  return tex.detectEngine('lualatex');
}

function findFileArg(argv) {
  return argv.slice(1).find((a) => a.toLowerCase().endsWith(`.${FILE_EXT}`) && fssync.existsSync(a)) || null;
}

function send(action, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('menu', action, payload);
}

// ---------- メニュー ----------
function buildMenu() {
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: `${app.name} について` },
              { type: 'separator' },
              { label: '設定…', accelerator: 'Cmd+,', click: () => send('settings') },
              { type: 'separator' },
              { role: 'services', label: 'サービス' },
              { type: 'separator' },
              { role: 'hide', label: `${app.name} を隠す` },
              { role: 'hideOthers', label: 'ほかを隠す' },
              { role: 'unhide', label: 'すべてを表示' },
              { type: 'separator' },
              { role: 'quit', label: `${app.name} を終了` },
            ],
          },
        ]
      : []),
    {
      label: 'ファイル',
      submenu: [
        { label: '新規', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: '開く…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
        { label: '名前を付けて保存…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('save-as') },
        { type: 'separator' },
        { label: 'PDF を作成（LaTeX）', accelerator: 'CmdOrCtrl+Shift+B', click: () => send('compile-pdf') },
        { label: 'プレビューを PDF 保存（TeX 不要）…', click: () => send('print-pdf') },
        { label: 'LaTeX ファイル (.tex) を書き出す…', accelerator: 'CmdOrCtrl+Shift+E', click: () => send('export-tex') },
        { type: 'separator' },
        { label: 'Word（.docx）から問題集を取り込む…', click: () => send('import-docx') },
        { label: 'Word（.docx）を今の問題の解答として取り込む…', click: () => send('import-docx-solution') },
        ...(isMac
          ? []
          : [
              { type: 'separator' },
              { label: '設定…', accelerator: 'Ctrl+,', click: () => send('settings') },
              { type: 'separator' },
              { role: 'quit', label: '終了' },
            ]),
      ],
    },
    {
      label: '編集',
      submenu: [
        // 取り消し/やり直しは CodeMirror に任せる（registerAccelerator:false でキーは画面側に届く）
        { label: '元に戻す', accelerator: 'CmdOrCtrl+Z', registerAccelerator: false, click: () => send('undo') },
        { label: 'やり直し', accelerator: 'CmdOrCtrl+Shift+Z', registerAccelerator: false, click: () => send('redo') },
        { type: 'separator' },
        { role: 'cut', label: '切り取り' },
        { role: 'copy', label: 'コピー' },
        { role: 'paste', label: '貼り付け' },
        { role: 'selectAll', label: 'すべて選択' },
        { type: 'separator' },
        { label: 'AI の回答を変換して貼り付け', accelerator: 'CmdOrCtrl+Shift+V', click: () => send('smart-paste') },
        { label: 'AI に渡すプロンプトを作る…', click: () => send('ai-prompt') },
      ],
    },
    {
      label: '問題',
      submenu: [
        { label: '問題を追加', accelerator: 'CmdOrCtrl+Shift+N', click: () => send('add-problem') },
        { label: '問題を複製', click: () => send('duplicate-problem') },
        { label: '問題を削除', click: () => send('delete-problem') },
        { type: 'separator' },
        { label: '数式エディタ（ビジュアル入力）', accelerator: 'CmdOrCtrl+E', click: () => send('math-editor') },
        { label: 'カーソル位置の数式を Word 用にコピー', accelerator: 'CmdOrCtrl+Shift+C', click: () => send('copy-word') },
      ],
    },
    {
      label: '表示',
      submenu: [
        { role: 'resetZoom', label: '実際のサイズ' },
        { role: 'zoomIn', label: '拡大' },
        { role: 'zoomOut', label: '縮小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'フルスクリーン' },
        { type: 'separator' },
        { role: 'reload', label: '再読み込み' },
        { role: 'toggleDevTools', label: '開発者ツール' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- ウィンドウ ----------
function createWindow() {
  isDirty = false;
  forceClose = false;
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 600,
    title: 'LaTeX 問題エディタ',
    backgroundColor: '#f7f7f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'));

  // 外部リンクは既定のブラウザで開く
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url !== mainWindow.webContents.getURL()) e.preventDefault();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingOpenPath) {
      send('open-path', pendingOpenPath);
      pendingOpenPath = null;
    }
  });

  mainWindow.on('close', (e) => {
    if (forceClose || !isDirty) return;
    e.preventDefault();
    const r = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      buttons: ['保存', '保存しない', 'キャンセル'],
      defaultId: 0,
      cancelId: 2,
      message: '変更が保存されていません。',
      detail: '閉じる前に保存しますか？',
    });
    if (r === 0) send('save-and-close');
    else if (r === 1) {
      forceClose = true;
      mainWindow.close();
    }
  });
  mainWindow.on('closed', () => (mainWindow = null));
}

// ---------- IPC ----------
async function readDoc(p) {
  const text = await fs.readFile(p, 'utf8');
  return { path: p, data: JSON.parse(text) };
}

async function writeAtomic(p, content) {
  const tmp = `${p}.tmp-${process.pid}`;
  await fs.writeFile(tmp, content, 'utf8');
  await fs.rename(tmp, p);
}

const safeName = (s) => (s || '無題').replace(/[\\/:*?"<>|]/g, '_').trim() || '無題';

function defaultOutPath(projectPath, docTitle, ext) {
  if (projectPath) {
    const base = path.basename(projectPath, path.extname(projectPath));
    return path.join(path.dirname(projectPath), `${base}.${ext}`);
  }
  return path.join(app.getPath('documents'), `${safeName(docTitle)}.${ext}`);
}

function registerIpc() {
  ipcMain.handle('file:open', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: '問題集ファイル', extensions: [FILE_EXT, 'json'] }],
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    return readDoc(r.filePaths[0]);
  });

  ipcMain.handle('file:read', (_e, p) => readDoc(p));

  ipcMain.handle('file:save', async (_e, { path: p, data, saveAs }) => {
    let target = p;
    if (!target || saveAs) {
      const r = await dialog.showSaveDialog(mainWindow, {
        defaultPath: p || path.join(app.getPath('documents'), `${safeName(data?.meta?.title)}.${FILE_EXT}`),
        filters: [{ name: '問題集ファイル', extensions: [FILE_EXT] }],
      });
      if (r.canceled || !r.filePath) return null;
      target = r.filePath;
    }
    await writeAtomic(target, JSON.stringify(data, null, 2));
    return target;
  });

  ipcMain.handle('export:tex', async (_e, { source, projectPath, title }) => {
    const r = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultOutPath(projectPath, title, 'tex'),
      filters: [{ name: 'LaTeX', extensions: ['tex'] }],
    });
    if (r.canceled || !r.filePath) return null;
    await fs.writeFile(r.filePath, source, 'utf8');
    return r.filePath;
  });

  ipcMain.handle('pdf:compile', async (_e, { source, projectPath, title }) => {
    const engine = enginePath();
    if (!engine) return { ok: false, noEngine: true, errors: [] };
    const res = await tex.compile({
      source,
      enginePath: engine,
      projectDir: projectPath ? path.dirname(projectPath) : undefined,
    });
    try {
      if (!res.ok) return { ok: false, errors: res.errors, log: res.log.slice(-6000) };
      let out = defaultOutPath(projectPath, title, 'pdf');
      if (!projectPath) {
        const r = await dialog.showSaveDialog(mainWindow, {
          defaultPath: out,
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });
        if (r.canceled || !r.filePath) return { ok: true, canceled: true };
        out = r.filePath;
      }
      try {
        await fs.copyFile(res.pdfPath, out);
      } catch (err) {
        return {
          ok: false,
          errors: [{ line: null, message: `PDF を書き込めませんでした（他のアプリで開いていませんか？）: ${err.message}` }],
        };
      }
      shell.openPath(out);
      return { ok: true, savedPath: out };
    } finally {
      fs.rm(res.workDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  ipcMain.handle('pdf:print', async (_e, { projectPath, title, paper }) => {
    const inch = (mm) => mm / 25.4;
    const pw = paper?.widthMm ?? 210;
    const ph = paper?.heightMm ?? 297;
    const mg = inch(paper?.marginMm ?? 18);
    const r = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultOutPath(projectPath, title, 'pdf').replace(/\.pdf$/, '_preview.pdf'),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (r.canceled || !r.filePath) return null;
    const data = await mainWindow.webContents.printToPDF({
      pageSize: { width: inch(pw), height: inch(ph) },
      printBackground: true,
      margins: { marginType: 'custom', top: mg, bottom: mg, left: mg, right: mg },
    });
    await fs.writeFile(r.filePath, data);
    shell.openPath(r.filePath);
    return r.filePath;
  });

  ipcMain.handle('settings:get', () => ({ ...loadSettings(), detectedEngine: tex.detectEngine('lualatex') }));
  ipcMain.handle('settings:set', (_e, s) => {
    const cur = loadSettings();
    saveSettings({ ...cur, ...s });
    return { engine: enginePath() };
  });
  ipcMain.handle('tex:engine', () => enginePath());
  ipcMain.handle('tex:choose', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: 'lualatex の実行ファイルを選択',
      properties: ['openFile'],
      filters: process.platform === 'win32' ? [{ name: 'lualatex', extensions: ['exe'] }] : [],
    });
    return r.canceled ? null : r.filePaths[0];
  });

  // Word 文書（.docx）の本文 XML を読む（変換は画面側の docxImport.js）
  ipcMain.handle('docx:open', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: '取り込む Word 文書を選択',
      properties: ['openFile'],
      filters: [{ name: 'Word 文書', extensions: ['docx'] }],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const p = r.filePaths[0];
    return { name: path.basename(p, path.extname(p)), xml: readDocxXml(await fs.readFile(p)) };
  });

  // 図：画像を選び、問題集と同じフォルダの figures に複製する
  ipcMain.handle('fig:choose-image', async (_e, { projectPath }) => {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: '挿入する画像を選択',
      properties: ['openFile'],
      filters: [{ name: '画像', extensions: ['png', 'jpg', 'jpeg', 'pdf'] }],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    const src = r.filePaths[0];
    if (!projectPath) return { file: src.replace(/\\/g, '/'), warn: true };
    const dir = path.join(path.dirname(projectPath), 'figures');
    await fs.mkdir(dir, { recursive: true });
    const ext = path.extname(src);
    const base = path.basename(src, ext).replace(/[^\w\-]+/g, '_') || 'figure';
    let name = `${base}${ext.toLowerCase()}`;
    for (let i = 2; fssync.existsSync(path.join(dir, name)); i++) {
      // 同じ名前の別ファイルがあれば番号を付ける（同一内容ならそのまま使う）
      const existing = await fs.readFile(path.join(dir, name));
      const incoming = await fs.readFile(src);
      if (existing.equals(incoming)) break;
      name = `${base}_${i}${ext.toLowerCase()}`;
    }
    if (!fssync.existsSync(path.join(dir, name))) await fs.copyFile(src, path.join(dir, name));
    return { file: `figures/${name}` };
  });
  ipcMain.handle('fig:read-image', async (_e, { file, projectPath }) => {
    if (!file) return null;
    const abs = path.isAbsolute(file) ? file : projectPath ? path.join(path.dirname(projectPath), file) : null;
    if (!abs) return null;
    const ext = path.extname(abs).toLowerCase();
    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[ext];
    if (!mime) return null; // PDF などはプレビューしない
    const buf = await fs.readFile(abs);
    return `data:${mime};base64,${buf.toString('base64')}`;
  });

  // Electron 45 以降のクリップボード API（非同期・ClipboardItem）
  ipcMain.handle('clipboard:read', async () => {
    let text = '';
    let html = '';
    try {
      text = await clipboard.readText();
    } catch {
      /* 空として扱う */
    }
    try {
      for (const item of await clipboard.read()) {
        if (!item.types.includes('text/html')) continue;
        const blob = await item.getType('text/html');
        html = typeof blob === 'string' ? blob : await blob.text();
        break;
      }
    } catch {
      /* HTML なし */
    }
    return { html, text };
  });
  ipcMain.handle('clipboard:write', async (_e, { text, html }) => {
    const data = { 'text/plain': text };
    if (html) data['text/html'] = html;
    await clipboard.write([new ClipboardItem(data)]);
    return true;
  });

  ipcMain.handle('app:confirm-discard', async () => {
    const r = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['保存', '保存しない', 'キャンセル'],
      defaultId: 0,
      cancelId: 2,
      message: '変更が保存されていません。',
      detail: '続ける前に保存しますか？',
    });
    return ['save', 'discard', 'cancel'][r.response];
  });

  ipcMain.on('app:dirty', (_e, d) => {
    isDirty = !!d;
    if (mainWindow) mainWindow.setDocumentEdited(isDirty);
  });
  ipcMain.on('app:title', (_e, t) => mainWindow && mainWindow.setTitle(t));
  ipcMain.on('app:represented-file', (_e, p) => {
    if (mainWindow && isMac) mainWindow.setRepresentedFilename(p || '');
  });
  ipcMain.on('app:close-confirmed', () => {
    forceClose = true;
    mainWindow && mainWindow.close();
  });
}

// ---------- 起動 ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const f = findFileArg(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (f) send('open-path', f);
    }
  });

  app.on('open-file', (e, p) => {
    e.preventDefault();
    if (mainWindow && !mainWindow.webContents.isLoading()) send('open-path', p);
    else pendingOpenPath = p;
  });

  app.whenReady().then(() => {
    buildMenu();
    registerIpc();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
}
