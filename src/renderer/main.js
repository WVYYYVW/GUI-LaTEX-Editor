import 'katex/dist/katex.min.css';
import './styles.css';
import { MathfieldElement } from 'mathlive';
import katex from 'katex';
import { createEditor } from './lib/editor.js';
import { renderLatex, renderSheet, renderInline, collectMacros } from './lib/preview.js';
import { buildTex, locateLine } from './lib/texExport.js';
import { PALETTE } from './lib/palette.js';
import { newDocument, newProblem, normalizeDoc } from './lib/model.js';
import { findMathRanges, rangeAt, normalizeMathText } from './lib/mathRanges.js';
import { clipboardToLatex, aiTextToLatex, htmlHasTex } from './lib/smartPaste.js';
import { latexToMathML } from './lib/wordExport.js';
import { initLayoutPanel, fitPages, enableSpaceDrag } from './layoutPanel.js';
import { paperSize, normalizeLayout } from './lib/layout.js';

const api = window.api;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const isMac = api.platform === 'darwin';

// MathLive の設定（フォントは同梱、効果音なし）
MathfieldElement.fontsDirectory = new URL('./mathlive-fonts/', document.baseURI).href;
MathfieldElement.soundsDirectory = null;

// ---------------- 状態 ----------------
const state = {
  doc: newDocument(true),
  filePath: null,
  selectedId: null,
  field: 'body',
  dirty: false,
  previewMode: 'problem',
  macros: {},
  filter: '',
  settings: {},
  engine: null,
};

const currentProblem = () => state.doc.problems.find((p) => p.id === state.selectedId) || null;
const currentIndex = () => state.doc.problems.findIndex((p) => p.id === state.selectedId);
const basename = (p) => (p ? p.split(/[\\/]/).pop() : '');

// ---------------- 共通 UI ----------------
let toastTimer;
function toast(msg, type = 'info', ms = 2800) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast ${type === 'error' ? 'error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}
function busy(text) {
  $('#busy-text').textContent = text;
  $('#busy').classList.remove('hidden');
}
const unbusy = () => $('#busy').classList.add('hidden');

function setDirty(v) {
  if (state.dirty === v) return;
  state.dirty = v;
  api.setDirty(v);
  updateTitle();
}
function updateTitle() {
  const name = state.filePath ? basename(state.filePath) : '無題';
  api.setTitle(`${state.dirty && !isMac ? '● ' : ''}${name} — LaTeX 問題エディタ`);
  api.setRepresentedFile(state.filePath || '');
  $('#status-file').textContent = (state.filePath || '未保存の新規ファイル') + (state.dirty ? '（未保存の変更あり）' : '');
}
function updateEngineStatus() {
  const el = $('#status-engine');
  if (state.engine) {
    el.textContent = `LuaLaTeX: ${state.engine}`;
    el.className = 'ok';
  } else {
    el.textContent = 'LuaLaTeX が見つかりません（「簡易PDF」は使えます）';
    el.className = 'warn';
  }
}

// ---------------- エディタ ----------------
const editor = createEditor($('#cm-host'), {
  onChange: (text) => {
    const p = currentProblem();
    if (!p) return;
    p[state.field] = text;
    setDirty(true);
    schedulePreview();
    scheduleListRefresh();
  },
  getAutoHalfwidth: () => state.settings.autoHalfwidth !== false,
  keys: [
    { key: 'Mod-e', run: () => (openMathEditor(), true) },
    { key: 'Mod-Shift-v', run: () => (openPasteDialog(), true) },
  ],
});

// 表示された回答（KaTeX 付き HTML）をそのまま貼り付けた場合は自動で LaTeX に変換
editor.view.dom.addEventListener(
  'paste',
  (e) => {
    const html = e.clipboardData?.getData('text/html');
    if (!htmlHasTex(html)) return;
    e.preventDefault();
    e.stopPropagation();
    const { latex } = clipboardToLatex({ html, text: e.clipboardData.getData('text/plain') });
    insertText(latex.trimEnd());
    toast('数式付きの回答を LaTeX に変換して貼り付けました');
  },
  true
);

function editorKey() {
  return `${state.selectedId}:${state.field}`;
}

// ---------------- 一覧 ----------------
let listTimer;
const scheduleListRefresh = () => {
  clearTimeout(listTimer);
  listTimer = setTimeout(renderList, 400);
};

function summary(p) {
  if (p.title) return p.title;
  const s = p.body.replace(/\\[a-zA-Z]+\*?/g, ' ').replace(/[{}$\\\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.slice(0, 40) || '（未入力）';
}

function matchesFilter(p) {
  const f = state.filter.trim().toLowerCase();
  if (!f) return true;
  return [p.title, p.body, p.solution, ...p.tags].some((x) => x.toLowerCase().includes(f));
}

let dragId = null;
function renderList() {
  const ul = $('#problem-list');
  ul.innerHTML = '';
  state.doc.problems.forEach((p, i) => {
    if (!matchesFilter(p)) return;
    const li = document.createElement('li');
    li.dataset.id = p.id;
    li.draggable = !state.filter;
    if (p.id === state.selectedId) li.classList.add('selected');
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = i + 1;
    const info = document.createElement('div');
    info.className = 'info';
    const ttl = document.createElement('div');
    ttl.className = 'ttl';
    ttl.textContent = summary(p);
    const meta = document.createElement('div');
    meta.className = 'meta';
    if (p.difficulty) meta.append(Object.assign(document.createElement('span'), { textContent: '★'.repeat(p.difficulty) }));
    for (const t of p.tags) meta.append(Object.assign(document.createElement('span'), { className: 'chip', textContent: t }));
    if (p.solution.trim()) meta.append(Object.assign(document.createElement('span'), { textContent: '解答あり' }));
    info.append(ttl, meta);
    li.append(num, info);
    li.addEventListener('click', () => selectProblem(p.id));
    li.addEventListener('dragstart', () => (dragId = p.id));
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      li.classList.add('drop-target');
    });
    li.addEventListener('dragleave', () => li.classList.remove('drop-target'));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      li.classList.remove('drop-target');
      moveProblem(dragId, state.doc.problems.findIndex((q) => q.id === p.id));
    });
    ul.append(li);
  });
}

function moveProblem(id, toIndex) {
  const ps = state.doc.problems;
  const from = ps.findIndex((q) => q.id === id);
  if (from < 0 || toIndex < 0 || from === toIndex) return;
  const [p] = ps.splice(from, 1);
  ps.splice(toIndex, 0, p);
  setDirty(true);
  renderList();
  renderPreview();
}

// ---------------- 問題の選択・メタ情報 ----------------
function renderStars(n) {
  const host = $('#p-diff');
  host.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = '★';
    b.title = `難易度 ${i}`;
    b.setAttribute('aria-label', `難易度 ${i}`);
    if (i <= n) b.classList.add('on');
    b.addEventListener('click', () => {
      const p = currentProblem();
      if (!p) return;
      p.difficulty = p.difficulty === i ? 0 : i;
      renderStars(p.difficulty);
      setDirty(true);
      renderList();
      renderPreview();
    });
    host.append(b);
  }
}

function selectProblem(id, field = state.field) {
  state.selectedId = id;
  state.field = field;
  const p = currentProblem();
  $('#empty-state').classList.toggle('hidden', !!p);
  $('#editor-area').classList.toggle('hidden', !p);
  if (p) {
    $('#p-title').value = p.title;
    $('#p-tags').value = p.tags.join(', ');
    renderStars(p.difficulty);
    syncProblemLayout();
    $$('.field-tabs [data-field]').forEach((b) => b.classList.toggle('active', b.dataset.field === state.field));
    editor.load(editorKey(), p[state.field]);
  }
  $$('#problem-list li').forEach((li) => li.classList.toggle('selected', li.dataset.id === id));
  renderPreview();
}

// 問題ごとの配置（改ページ・枠・解答スペース）
function syncProblemLayout() {
  const p = currentProblem();
  if (!p) return;
  const pl = p.layout || {};
  $('#pl-break').checked = !!pl.pageBreakBefore;
  $('#pl-frame').value = pl.frame === true ? 'on' : pl.frame === false ? 'off' : 'inherit';
  if (document.activeElement !== $('#pl-space')) $('#pl-space').value = pl.answerSpace ?? '';
  $('#pl-space').placeholder = `全体 ${state.doc.meta.spaceAfter}`;
}
function updateProblemLayout(patch) {
  const p = currentProblem();
  if (!p) return;
  p.layout = { ...(p.layout || {}), ...patch };
  setDirty(true);
  renderPreview();
}
$('#pl-break').addEventListener('change', (e) => updateProblemLayout({ pageBreakBefore: e.target.checked }));
$('#pl-frame').addEventListener('change', (e) => updateProblemLayout({ frame: { on: true, off: false }[e.target.value] ?? null }));
$('#pl-space').addEventListener('input', (e) => {
  const v = e.target.value.trim();
  updateProblemLayout({ answerSpace: v === '' ? null : Math.max(0, Number(v) || 0) });
});

$('#p-title').addEventListener('input', (e) => {
  const p = currentProblem();
  if (!p) return;
  p.title = e.target.value;
  setDirty(true);
  scheduleListRefresh();
  schedulePreview();
});
$('#p-tags').addEventListener('input', (e) => {
  const p = currentProblem();
  if (!p) return;
  p.tags = e.target.value.split(/[,、，]/).map((s) => s.trim()).filter(Boolean);
  setDirty(true);
  scheduleListRefresh();
});
$$('.field-tabs [data-field]').forEach((b) =>
  b.addEventListener('click', () => {
    selectProblem(state.selectedId, b.dataset.field);
    editor.focus();
  })
);
$('#filter').addEventListener('input', (e) => {
  state.filter = e.target.value;
  renderList();
});

// ---------------- プレビュー ----------------
let previewTimer;
const schedulePreview = () => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 150);
};

function renderPreview() {
  const el = $('#preview');
  const scroll = el.scrollTop;
  if (state.previewMode === 'sheet') {
    el.innerHTML = renderSheet(state.doc, state.macros, { interactive: true });
    fitPages(el);
  } else {
    const p = currentProblem();
    if (!p) {
      el.innerHTML = '';
      return;
    }
    const n = currentIndex() + 1;
    el.innerHTML =
      `<div class="paper">` +
      `<h3 class="pv-section">問題 ${n}${p.title ? `　${renderInline(p.title, state.macros)}` : ''}</h3>` +
      renderLatex(p.body, state.macros, { field: 'body' }) +
      `<h3 class="pv-section">解答・解説</h3>` +
      renderLatex(p.solution, state.macros, { field: 'solution' }) +
      `</div>`;
  }
  el.scrollTop = scroll;
}

$$('.preview-tabs [data-preview]').forEach((b) =>
  b.addEventListener('click', () => {
    state.previewMode = b.dataset.preview;
    $$('.preview-tabs [data-preview]').forEach((x) => x.classList.toggle('active', x === b));
    renderPreview();
  })
);

// プレビューの数式：ダブルクリックで数式エディタ、右クリックでコピーメニュー
function mathFromPreview(target) {
  const span = target.closest('.pv-math');
  if (!span) return null;
  const p = currentProblem();
  const field = span.dataset.field;
  const from = Number(span.dataset.from);
  const range = findMathRanges(p[field]).find((r) => r.from === from);
  return range ? { field, range } : null;
}
$('#preview').addEventListener('dblclick', (e) => {
  const hit = mathFromPreview(e.target);
  if (!hit) return;
  if (state.field !== hit.field) selectProblem(state.selectedId, hit.field);
  openMathEditor(hit.range);
});
$('#preview').addEventListener('contextmenu', (e) => {
  const hit = mathFromPreview(e.target);
  if (!hit) return;
  e.preventDefault();
  showContextMenu(e.clientX, e.clientY, [
    ['Word 用にコピー（MathML）', () => copyForWord(hit.range.latex, hit.range.display)],
    ['LaTeX をコピー', () => copyPlain(hit.range.latex)],
    ['数式エディタで編集', () => {
      if (state.field !== hit.field) selectProblem(state.selectedId, hit.field);
      openMathEditor(hit.range);
    }],
  ]);
});

// プリント全体プレビューでの直接操作：解答スペースのドラッグ、大問番号クリックでレイアウト設定
enableSpaceDrag($('#preview'), {
  getDoc: () => state.doc,
  onCommit: () => {
    setDirty(true);
    renderPreview();
    syncProblemLayout();
  },
});
$('#preview').addEventListener('click', (e) => {
  const num = e.target.closest('.sh-num');
  if (!num || num.dataset.index === undefined) return;
  const p = state.doc.problems[Number(num.dataset.index)];
  if (p && p.id !== state.selectedId) selectProblem(p.id);
  layoutPanel.open('head');
});
window.addEventListener('resize', () => state.previewMode === 'sheet' && fitPages($('#preview')));

function showContextMenu(x, y, items) {
  const menu = $('#ctx-menu');
  menu.innerHTML = '';
  for (const [label, fn] of items) {
    const b = document.createElement('button');
    b.textContent = label;
    b.addEventListener('click', () => {
      menu.classList.add('hidden');
      fn();
    });
    menu.append(b);
  }
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove('hidden');
}
document.addEventListener('click', () => $('#ctx-menu').classList.add('hidden'));

// ---------------- 記号パレット ----------------
let paletteCat = 0;
function renderPalette() {
  const tabs = $('#palette-tabs');
  tabs.innerHTML = '';
  PALETTE.forEach((cat, i) => {
    const b = document.createElement('button');
    b.textContent = cat.name;
    b.classList.toggle('active', i === paletteCat);
    b.addEventListener('click', () => {
      paletteCat = i;
      renderPalette();
    });
    tabs.append(b);
  });
  const grid = $('#palette-grid');
  grid.innerHTML = '';
  for (const item of PALETTE[paletteCat].items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.title = item.title ? `${item.title}\n${item.insert.replace(/‸/g, '')}` : item.insert.replace(/‸/g, '');
    if (item.kind === 'text') {
      b.textContent = item.text;
      b.classList.add('text-item');
    } else {
      b.innerHTML = katex.renderToString(item.label, { throwOnError: false, strict: 'ignore' });
      if (/matrix|cases|aligned/.test(item.label)) b.classList.add('big');
    }
    b.addEventListener('mousedown', (e) => e.preventDefault()); // エディタのフォーカスを保つ
    b.addEventListener('click', () => insertSnippet(item));
    grid.append(b);
  }
}
$('#toggle-palette').addEventListener('click', () => {
  const pal = $('#palette');
  pal.classList.toggle('collapsed');
  $('#toggle-palette').textContent = pal.classList.contains('collapsed') ? '記号パレット ▸' : '記号パレット ▾';
});

function insertSnippet(item) {
  if (!currentProblem()) return;
  const text = editor.getText();
  const sel = editor.getSelection();
  const selected = text.slice(sel.from, sel.to);
  let snippet = item.insert.includes('‸') ? item.insert : item.insert + ' ‸';
  if (item.kind === 'math' && !rangeAt(text, sel.from)) snippet = `$${snippet}$`;
  const caret = snippet.indexOf('‸');
  const insert = snippet.replace('‸', selected);
  editor.replace(sel.from, sel.to, insert, sel.from + caret + selected.length);
}

function insertText(s) {
  const sel = editor.getSelection();
  editor.replace(sel.from, sel.to, s);
}

// ---------------- 数式エディタ（MathLive） ----------------
const mf = /** @type {any} */ ($('#mf'));
const mfLatex = $('#mf-latex');
let mathEditTarget = null; // 既存の数式を編集中ならその範囲
let mfSyncing = false;

mf.mathVirtualKeyboardPolicy = 'manual';
mf.smartFence = true;
mf.addEventListener('input', () => {
  if (mfSyncing) return;
  const v = mf.value;
  const fixed = state.settings.autoHalfwidth !== false ? normalizeMathText(v) : v;
  if (fixed !== v) {
    mfSyncing = true;
    mf.setValue(fixed, { silenceNotifications: true });
    mfSyncing = false;
  }
  mfLatex.value = fixed;
});
mfLatex.addEventListener('input', () => {
  mfSyncing = true;
  mf.setValue(mfLatex.value, { silenceNotifications: true });
  mfSyncing = false;
});

function openMathEditor(range) {
  if (!currentProblem()) return;
  const text = editor.getText();
  const r = range || rangeAt(text, editor.getSelection().from);
  mathEditTarget = r;
  const latex = r ? (r.kind === 'env' ? r.latex : r.latex.trim()) : text.slice(editor.getSelection().from, editor.getSelection().to);
  mf.setValue(latex, { silenceNotifications: true });
  mfLatex.value = latex;
  $('#mf-mode').classList.toggle('hidden', !!r);
  $('#mf-ok').textContent = r ? '更新' : '挿入';
  $('#md-title').textContent = r ? '数式エディタ（編集）' : '数式エディタ';
  $('#math-dialog').classList.remove('hidden');
  setTimeout(() => mf.focus(), 30);
}

function closeMathEditor() {
  window.mathVirtualKeyboard?.hide();
  $('#math-dialog').classList.add('hidden');
  editor.focus();
}

function commitMathEditor() {
  const latex = (mfLatex.value || '').trim();
  const r = mathEditTarget;
  if (r) {
    if (r.kind === 'env') editor.replace(r.from, r.to, latex);
    else {
      const pad = r.display ? '\n  ' : '';
      editor.replace(r.innerFrom, r.innerTo, r.display ? `${pad}${latex}\n` : latex);
    }
  } else if (latex) {
    const mode = $('input[name="mf-mode"]:checked').value;
    insertText(mode === 'display' ? `\n\\[\n  ${latex}\n\\]\n` : `$${latex}$`);
  }
  closeMathEditor();
}

$('#mf-ok').addEventListener('click', commitMathEditor);
$('#mf-cancel').addEventListener('click', closeMathEditor);
$('#mf-kbd').addEventListener('click', () => {
  const kb = window.mathVirtualKeyboard;
  if (!kb) return;
  kb.visible ? kb.hide() : kb.show();
  mf.focus();
});
$('#mf-word').addEventListener('click', () => copyForWord(mfLatex.value, !mathEditTarget ? $('input[name="mf-mode"]:checked').value === 'display' : mathEditTarget.display));
$('#math-dialog').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMathEditor();
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commitMathEditor();
});

// ---------------- Word 連携 ----------------
async function copyForWord(latex, display) {
  try {
    const mathml = latexToMathML(latex, display, state.macros);
    // Word は XML 宣言付きの MathML テキスト、または HTML 中の <math> を数式オブジェクトとして貼り付ける
    await api.writeClipboard({ text: `<?xml version="1.0"?>${mathml}`, html: mathml });
    toast('Word 用にコピーしました。Word で貼り付けると数式になります（うまくいかない場合は「テキストのみ保持」で貼り付け）', 'info', 5000);
  } catch (err) {
    toast(`この数式は変換できませんでした: ${err.message}`, 'error', 5000);
  }
}
async function copyPlain(text) {
  await api.writeClipboard({ text });
  toast('コピーしました');
}
function copyWordAtCursor() {
  if (!currentProblem()) return;
  const r = rangeAt(editor.getText(), editor.getSelection().from);
  if (!r) {
    toast('カーソルを数式（$…$ など）の中に置いてください', 'error');
    return;
  }
  copyForWord(r.kind === 'env' ? r.latex : r.latex.trim(), r.display);
}

// ---------------- AI の回答を貼り付け ----------------
let pdTimer;
function convertPasteInput() {
  const text = $('#pd-input').value;
  const out = aiTextToLatex(text, { unicodeMath: $('#pd-unicode').checked });
  $('#pd-output').value = out;
  renderPastePreview();
}
function renderPastePreview() {
  $('#pd-preview').innerHTML = renderLatex($('#pd-output').value, state.macros);
}
async function openPasteDialog() {
  $('#pd-input').value = '';
  $('#pd-output').value = '';
  $('#pd-preview').innerHTML = '';
  $('#pd-source').textContent = '';
  $('#pd-target').value = currentProblem() ? 'cursor' : 'new';
  $('#paste-dialog').classList.remove('hidden');
  // クリップボードに内容があれば最初から読み込む
  try {
    const clip = await api.readClipboard();
    if ((clip.text || '').trim() || htmlHasTex(clip.html)) loadPasteClipboard(clip);
  } catch {
    /* 手動で貼ってもらう */
  }
  $('#pd-input').focus();
}
function loadPasteClipboard(clip) {
  const { latex, source } = clipboardToLatex(clip, { unicodeMath: $('#pd-unicode').checked });
  $('#pd-input').value = clip.text || '';
  $('#pd-output').value = latex;
  $('#pd-source').textContent = source === 'html' ? '表示された回答（数式つき HTML）' : 'テキスト / Markdown';
  renderPastePreview();
}
$('#pd-input').addEventListener('paste', (e) => {
  const html = e.clipboardData.getData('text/html');
  const text = e.clipboardData.getData('text/plain');
  if (htmlHasTex(html)) {
    e.preventDefault();
    loadPasteClipboard({ html, text });
  } else {
    setTimeout(() => {
      $('#pd-source').textContent = 'テキスト / Markdown';
      convertPasteInput();
    });
  }
});
$('#pd-input').addEventListener('input', () => {
  clearTimeout(pdTimer);
  pdTimer = setTimeout(convertPasteInput, 250);
});
$('#pd-unicode').addEventListener('change', convertPasteInput);
$('#pd-output').addEventListener('input', () => {
  clearTimeout(pdTimer);
  pdTimer = setTimeout(renderPastePreview, 200);
});
$('#pd-cancel').addEventListener('click', () => $('#paste-dialog').classList.add('hidden'));
$('#pd-ok').addEventListener('click', () => {
  const latex = $('#pd-output').value;
  const target = $('#pd-target').value;
  $('#paste-dialog').classList.add('hidden');
  if (!latex.trim()) return;
  if (target === 'new' || !currentProblem()) {
    const p = newProblem({ body: latex });
    state.doc.problems.splice(currentIndex() + 1, 0, p);
    setDirty(true);
    renderList();
    selectProblem(p.id, 'body');
  } else if (target === 'cursor') {
    insertText(latex);
  } else {
    selectProblem(state.selectedId, target);
    const len = editor.getText().length;
    editor.replace(0, len, latex);
  }
  toast('取り込みました');
});
$('#paste-dialog').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') $('#paste-dialog').classList.add('hidden');
});

// ---------------- 文書の操作 ----------------
function loadDocument(data, filePath) {
  state.doc = normalizeDoc(data);
  state.filePath = filePath;
  state.macros = collectMacros(state.doc.meta.preamble);
  state.filter = '';
  $('#filter').value = '';
  editor.reset();
  state.dirty = true; // setDirty(false) を確実に送る
  setDirty(false);
  renderList();
  selectProblem(state.doc.problems[0]?.id ?? null, 'body');
}

async function confirmDiscard() {
  if (!state.dirty) return true;
  const r = await api.confirmDiscard();
  if (r === 'cancel') return false;
  if (r === 'save') return save(false);
  return true;
}

async function save(saveAs) {
  try {
    const p = await api.saveFile({ path: state.filePath, data: state.doc, saveAs });
    if (!p) return false;
    state.filePath = p;
    state.dirty = true;
    setDirty(false);
    toast('保存しました');
    return true;
  } catch (err) {
    toast(`保存できませんでした: ${err.message}`, 'error', 6000);
    return false;
  }
}

async function openPath(p) {
  if (!(await confirmDiscard())) return;
  try {
    const r = await api.readFile(p);
    loadDocument(r.data, r.path);
  } catch (err) {
    toast(`開けませんでした: ${err.message}`, 'error', 6000);
  }
}

function addProblem() {
  const p = newProblem();
  state.doc.problems.splice(currentIndex() + 1, 0, p);
  setDirty(true);
  renderList();
  selectProblem(p.id, 'body');
  $('#p-title').focus();
}

function duplicateProblem() {
  const p = currentProblem();
  if (!p) return;
  const q = newProblem({ ...structuredClone(p), id: undefined, title: p.title ? `${p.title}（コピー）` : '' });
  q.id = newProblem().id;
  state.doc.problems.splice(currentIndex() + 1, 0, q);
  setDirty(true);
  renderList();
  selectProblem(q.id);
}

function deleteProblem() {
  const p = currentProblem();
  if (!p) return;
  if ((p.body.trim() || p.solution.trim()) && !window.confirm(`問題 ${currentIndex() + 1} を削除しますか？`)) return;
  const i = currentIndex();
  state.doc.problems.splice(i, 1);
  setDirty(true);
  const next = state.doc.problems[Math.min(i, state.doc.problems.length - 1)];
  renderList();
  selectProblem(next ? next.id : null);
}

// ---------------- 出力 ----------------
const docTitle = () => state.doc.meta.title || '無題';

async function exportTex() {
  const p = await api.exportTex({ source: buildTex(state.doc), projectPath: state.filePath, title: docTitle() });
  if (p) toast(`書き出しました: ${p}`);
}

async function compilePdf() {
  $('#error-panel').classList.add('hidden');
  const source = buildTex(state.doc);
  busy('PDF を作成しています…（初回はフォントの準備に数分かかることがあります）');
  let res;
  try {
    res = await api.compilePdf({ source, projectPath: state.filePath, title: docTitle() });
  } catch (err) {
    res = { ok: false, errors: [{ line: null, message: String(err.message || err) }] };
  } finally {
    unbusy();
  }
  if (res.noEngine) {
    toast('LuaLaTeX が見つかりません。設定で場所を指定するか、「簡易PDF」を使ってください', 'error', 7000);
    openSettings();
    return;
  }
  if (res.ok) {
    if (!res.canceled) toast(`PDF を作成しました: ${res.savedPath}`, 'info', 4000);
    return;
  }
  showErrors(source, res.errors || []);
}

function showErrors(source, errors) {
  const ul = $('#error-list');
  ul.innerHTML = '';
  if (!errors.length) errors = [{ line: null, message: 'PDF を作成できませんでした（詳細不明）' }];
  for (const e of errors) {
    const li = document.createElement('li');
    let where = '';
    let loc = null;
    if (e.line) {
      loc = locateLine(source, e.line);
      if (loc.where === 'problem') where = `問題 ${loc.index + 1}（${loc.field === 'body' ? '問題文' : '解答'}）${loc.line} 行目: `;
      else if (loc.where === 'preamble') where = `プリアンブル ${loc.line} 行目: `;
    }
    li.textContent = where + e.message;
    if (e.context) {
      const pre = document.createElement('pre');
      pre.textContent = e.context;
      li.append(pre);
    }
    if (loc && loc.where === 'problem') {
      li.addEventListener('click', () => {
        const p = state.doc.problems[loc.index];
        if (!p) return;
        selectProblem(p.id, loc.field);
        renderList();
        editor.gotoLine(loc.line);
      });
    } else if (loc && loc.where === 'preamble') {
      li.addEventListener('click', openSettings);
    }
    ul.append(li);
  }
  $('#error-panel').classList.remove('hidden');
  toast('LaTeX のエラーで PDF を作成できませんでした。下の一覧をクリックすると該当箇所へ移動します', 'error', 6000);
}
$('#ep-close').addEventListener('click', () => $('#error-panel').classList.add('hidden'));

async function printPdf() {
  const root = $('#print-root');
  root.innerHTML = renderSheet(state.doc, state.macros);
  const lay = normalizeLayout(state.doc.meta.layout);
  const ps = paperSize(lay);
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  try {
    const p = await api.printPdf({
      projectPath: state.filePath,
      title: docTitle(),
      paper: { widthMm: ps.w, heightMm: ps.h, marginMm: Number(lay.margin) },
    });
    if (p) toast(`PDF を保存しました: ${p}`);
  } finally {
    root.innerHTML = '';
  }
}

// ---------------- 設定 ----------------
const form = /** @type {HTMLFormElement} */ ($('#settings-form'));
async function openSettings() {
  const m = state.doc.meta;
  for (const [k, v] of Object.entries(m)) {
    const el = form.elements.namedItem(k);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v;
  }
  const s = await api.getSettings();
  form.elements.namedItem('enginePath').value = s.enginePath || '';
  form.elements.namedItem('autoHalfwidth').checked = s.autoHalfwidth !== false;
  $('#sd-engine-hint').textContent = s.detectedEngine
    ? `自動検出: ${s.detectedEngine}（空欄なら自動検出を使います）`
    : 'LuaLaTeX が見つかりません。TeX Live（Windows）または MacTeX（macOS）をインストールしてください。';
  $('#settings-dialog').classList.remove('hidden');
}
$('#sd-browse').addEventListener('click', async () => {
  const p = await api.chooseEngine();
  if (p) form.elements.namedItem('enginePath').value = p;
});
$('#sd-cancel').addEventListener('click', () => $('#settings-dialog').classList.add('hidden'));
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const m = state.doc.meta;
  const before = JSON.stringify(m);
  m.title = form.elements.namedItem('title').value;
  m.subtitle = form.elements.namedItem('subtitle').value;
  m.author = form.elements.namedItem('author').value;
  m.date = form.elements.namedItem('date').value;
  m.answerMode = form.elements.namedItem('answerMode').value;
  m.fontSize = form.elements.namedItem('fontSize').value;
  m.showDifficulty = form.elements.namedItem('showDifficulty').checked;
  m.nameField = form.elements.namedItem('nameField').checked;
  m.preamble = form.elements.namedItem('preamble').value;
  if (JSON.stringify(m) !== before) setDirty(true);
  state.macros = collectMacros(m.preamble);

  const appSettings = {
    enginePath: form.elements.namedItem('enginePath').value.trim(),
    autoHalfwidth: form.elements.namedItem('autoHalfwidth').checked,
  };
  const r = await api.setSettings(appSettings);
  state.settings = { ...state.settings, ...appSettings };
  state.engine = r.engine;
  updateEngineStatus();
  $('#settings-dialog').classList.add('hidden');
  renderPreview();
});
$('#settings-dialog').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') $('#settings-dialog').classList.add('hidden');
});

// ---------------- レイアウト / テーマ ----------------
const layoutPanel = initLayoutPanel({
  getDoc: () => state.doc,
  getMacros: () => state.macros,
  onChange: () => {
    setDirty(true);
    renderPreview();
    syncProblemLayout();
  },
  getUserThemes: () => state.settings.userThemes || [],
  saveUserThemes: async (list) => {
    state.settings.userThemes = list;
    await api.setSettings({ userThemes: list });
  },
  toast,
});

// ---------------- アクション ----------------
const actions = {
  new: async () => {
    if (await confirmDiscard()) loadDocument(newDocument(false), null);
  },
  open: async () => {
    if (!(await confirmDiscard())) return;
    try {
      const r = await api.openFile();
      if (r) loadDocument(r.data, r.path);
    } catch (err) {
      toast(`開けませんでした: ${err.message}`, 'error', 6000);
    }
  },
  'open-path': (p) => openPath(p),
  save: () => save(false),
  'save-as': () => save(true),
  'save-and-close': async () => {
    if (await save(false)) api.closeConfirmed();
  },
  'export-tex': exportTex,
  'compile-pdf': compilePdf,
  'print-pdf': printPdf,
  settings: openSettings,
  layout: () => layoutPanel.open(),
  'add-problem': addProblem,
  'duplicate-problem': duplicateProblem,
  'delete-problem': deleteProblem,
  'move-up': () => currentProblem() && moveProblem(state.selectedId, currentIndex() - 1),
  'move-down': () => currentProblem() && currentIndex() < state.doc.problems.length - 1 && moveProblem(state.selectedId, currentIndex() + 1),
  'math-editor': () => openMathEditor(),
  'smart-paste': openPasteDialog,
  'copy-word': copyWordAtCursor,
  undo: () => (editor.hasFocus() ? editor.undo() : document.execCommand('undo')),
  redo: () => (editor.hasFocus() ? editor.redo() : document.execCommand('redo')),
};

api.onMenu((action, payload) => actions[action]?.(payload));
$$('[data-action]').forEach((b) => b.addEventListener('click', () => actions[b.dataset.action]?.()));

// ---------------- 起動 ----------------
(async function init() {
  renderPalette();
  state.settings = await api.getSettings();
  state.engine = await api.getEngine();
  updateEngineStatus();
  loadDocument(state.doc, null);
})();
