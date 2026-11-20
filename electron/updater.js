// 自動更新（GitHub の Release から新しい版を取ってくる）
// - Windows: 裏でダウンロードし、終わったら「再起動して更新」を聞く。「後で」ならアプリを閉じたときに入れ替わる
// - macOS: 自動の入れ替えには Developer ID の署名が要る（Squirrel.Mac の決まり）。署名して作った版
//   （package.json の macAutoUpdate が true）だけ Windows と同じにし、それ以外は新しい版があることを知らせて
//   ダウンロードのページを開く
const { app, dialog, shell } = require('electron');

const RELEASES_URL = 'https://github.com/WVYYYVW/GUI-LaTEX-Editor/releases/latest';

let autoUpdater = null;
let getWindow = () => null;
let manual = false; // メニューから確かめたとき（結果を必ず知らせる）
let busy = false;
let notifiedVersion = null;

function macCanInstall() {
  if (process.platform !== 'darwin') return true;
  try {
    return !!require('../package.json').macAutoUpdate;
  } catch {
    return false;
  }
}

function show(opts) {
  const w = getWindow();
  return w ? dialog.showMessageBox(w, opts) : dialog.showMessageBox(opts);
}

function setup() {
  if (autoUpdater) return autoUpdater;
  ({ autoUpdater } = require('electron-updater'));
  autoUpdater.autoDownload = macCanInstall();
  autoUpdater.autoInstallOnAppQuit = true;
  // LPE_UPDATE_LOG=1 で起動すると、更新の確認の様子を標準出力に出す（動作確認用）
  autoUpdater.logger = process.env.LPE_UPDATE_LOG ? console : null;
  if (process.env.LPE_UPDATE_LOG) {
    for (const ev of ['checking-for-update', 'update-available', 'update-not-available', 'update-downloaded', 'error']) {
      autoUpdater.on(ev, (x) => console.log(`[updater] ${ev}`, x?.version || x?.message || ''));
    }
  }

  autoUpdater.on('update-available', async (info) => {
    if (autoUpdater.autoDownload) {
      if (manual) show({ type: 'info', message: `新しい版 ${info.version} をダウンロードしています。`, detail: '終わったらお知らせします。', buttons: ['OK'] });
      return;
    }
    // macOS（署名なし）: ダウンロードのページを開くか聞く
    if (!manual && notifiedVersion === info.version) return;
    notifiedVersion = info.version;
    const r = await show({
      type: 'info',
      message: `新しい版 ${info.version} があります（今は ${app.getVersion()}）。`,
      detail: 'ダウンロードのページを開き、dmg から入れ直してください。作った問題集はそのまま使えます。',
      buttons: ['ダウンロードのページを開く', '後で'],
      defaultId: 0,
      cancelId: 1,
    });
    if (r.response === 0) shell.openExternal(RELEASES_URL);
  });

  autoUpdater.on('update-not-available', () => {
    if (manual) show({ type: 'info', message: `お使いの版（${app.getVersion()}）が最新です。`, buttons: ['OK'] });
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const r = await show({
      type: 'info',
      message: `新しい版 ${info.version} の準備ができました。`,
      detail: '再起動すると新しい版になります（保存していない変更があれば、閉じる前に確認します）。「後で」を選ぶと、アプリを閉じたときに入れ替わります。',
      buttons: ['再起動して更新', '後で'],
      defaultId: 0,
      cancelId: 1,
    });
    if (r.response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on('error', (err) => {
    if (manual) {
      show({
        type: 'warning',
        message: '更新を確かめられませんでした。',
        detail: `インターネットにつながっているか確かめてください。\n\n${String(err?.message || err).slice(0, 300)}`,
        buttons: ['OK'],
      });
    }
  });
  return autoUpdater;
}

/**
 * 更新を確かめる
 * @param {{manual?:boolean}} opts manual のときは「最新です」やエラーも知らせる
 */
async function checkForUpdates({ manual: m = false } = {}) {
  if (!app.isPackaged) {
    if (m) show({ type: 'info', message: '開発中の版では更新を確かめません。', buttons: ['OK'] });
    return;
  }
  if (busy) return;
  busy = true;
  manual = m;
  try {
    await setup().checkForUpdates();
  } catch {
    /* error イベントで知らせる */
  } finally {
    busy = false;
  }
}

/** 起動して少したってから 1 回、その後は 6 時間ごとに確かめる */
function initAutoUpdate(windowGetter, { enabled = () => true } = {}) {
  getWindow = windowGetter;
  if (!app.isPackaged) return;
  const tick = () => enabled() && checkForUpdates({ manual: false });
  setTimeout(tick, 8000);
  setInterval(tick, 6 * 60 * 60 * 1000);
}

module.exports = { initAutoUpdate, checkForUpdates, RELEASES_URL };
