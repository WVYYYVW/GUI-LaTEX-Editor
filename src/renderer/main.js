import 'katex/dist/katex.min.css';
import './styles.css';
import { MathfieldElement } from 'mathlive';
import katex from 'katex';
import { createEditor } from './lib/editor.js';
import { renderLatex, renderSheet, renderSheetParts, renderInline, renderMath, collectMacros, contentStyle } from './lib/preview.js';
import { buildTex, locateLine } from './lib/texExport.js';
import { PALETTE } from './lib/palette.js';
import { newDocument, newProblem, normalizeDoc } from './lib/model.js';
import { findMathRanges, rangeAt, normalizeMathText } from './lib/mathRanges.js';
import { clipboardToLatex, aiTextToLatex, htmlHasTex } from './lib/smartPaste.js';
import { latexToNatural } from './lib/natural.js';
import { buildAiPrompt, splitAiProblems, parseMathprobText } from './lib/aiPrompt.js';
import { latexToMathML } from './lib/wordExport.js';
import { initLayoutPanel, fitPages, enableSpaceDrag } from './layoutPanel.js';
import { paperSize, normalizeLayout, SUBJECTS } from './lib/layout.js';
import { initFigureDialog } from './figureDialog.js';
import { figureBlock, findFigures } from './lib/figure.js';
import { setImageResolver, clearRenderCache } from './lib/preview.js';
import { docxToProblems, docxToLatex } from './lib/docxImport.js';

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
  macros: collectMacros(''),
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
    scheduleWriteBar();
  },
  getAutoHalfwidth: () => state.settings.autoHalfwidth !== false,
  keys: [
    { key: 'Mod-e', run: () => (openMathEditor(), true) },
    { key: 'Mod-Shift-v', run: () => (openPasteDialog(), true) },
    { key: 'Mod-b', run: () => (applyFormat('bold'), true) },
    { key: 'Mod-i', run: () => (applyFormat('italic'), true) },
    { key: 'Mod-u', run: () => (applyFormat('underline'), true) },
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

let writeBarTimer;
const scheduleWriteBar = () => {
  clearTimeout(writeBarTimer);
  writeBarTimer = setTimeout(updateWriteBar, 300);
};

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
  updateWriteBar();
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
  if (document.activeElement !== $('#pl-points')) $('#pl-points').value = p.points ?? '';
}
$('#pl-points').addEventListener('input', (e) => {
  const p = currentProblem();
  if (!p) return;
  const v = e.target.value.trim();
  p.points = v === '' ? null : Math.max(0, Number(v) || 0);
  setDirty(true);
  renderPreview();
});
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

// いま画面に出ているプリント全体の部品（変わった問題だけを差し替えるため）
let shownSheet = null;

/** 変わった .sh-item だけを差し替える */
function patchItems(container, before, after, cls) {
  const nodes = container.children;
  for (let i = 0; i < after.length; i++) {
    if (after[i] === before[i]) continue;
    if (nodes[i].classList.contains('sh-lazy')) continue; // まだ描いていない問題は、見えたときに最新の内容で描く
    const t = document.createElement('template');
    t.innerHTML = `<div class="${cls}" data-item="${i}">${after[i]}</div>`;
    nodes[i].replaceWith(t.content.firstChild);
  }
}

// 問題が多いと全部を一度に描くと数秒かかるので、先頭のいくつかだけ描き、残りは見えそうになったら描く
const EAGER_ITEMS = 4;
let lazyObserver = null;
/** 描く前の問題の高さの見当（px）。スクロールバーの長さを大きく変えないため */
function estimateHeight(html) {
  const n = (re) => (html.match(re) || []).length;
  return Math.min(6000, 60 + 28 * n(/class="pv-par/g) + 64 * n(/katex-display/g) + 28 * n(/<li/g) + 200 * n(/class="pv-fig/g));
}
function lazyItem(html, i, cls) {
  return `<div class="${cls} sh-lazy" data-item="${i}" style="height:${estimateHeight(html)}px"></div>`;
}
function fillLazy(node) {
  if (!node.classList.contains('sh-lazy') || !shownSheet) return;
  const i = Number(node.dataset.item);
  const html = node.classList.contains('sh-ans-item') ? shownSheet.answers[i] : shownSheet.items[i];
  node.classList.remove('sh-lazy');
  node.style.height = '';
  node.innerHTML = html ?? '';
}

/**
 * プリント全体を描く。問題が数十題あると HTML が数 MB になり、作り直すたびに数秒止まるので、
 * 前回から変わった問題・解答だけを差し替える（全体の設定や問題の数が変わったときだけ作り直す）。
 * 作り直すときも、見えていない問題は見えそうになってから描く。
 */
function renderSheetPreview(el) {
  const parts = renderSheetParts(state.doc, state.macros, { interactive: true });
  const prev = shownSheet;
  shownSheet = parts;
  const probs = el.querySelector('.sh-problems');
  const ans = el.querySelector('.sh-ans-list');
  if (
    prev &&
    probs &&
    prev.head === parts.head &&
    prev.mid === parts.mid &&
    prev.tail === parts.tail &&
    prev.items.length === parts.items.length &&
    prev.answers.length === parts.answers.length &&
    probs.children.length === parts.items.length &&
    (ans?.children.length ?? 0) === parts.answers.length
  ) {
    patchItems(probs, prev.items, parts.items, 'sh-item');
    if (ans) patchItems(ans, prev.answers, parts.answers, 'sh-item sh-ans-item');
    return;
  }
  // 2 段組は段の高さを揃えるのに全部の高さが要るので、後回しにしない
  const lazy = !parts.head.includes('cols-2');
  const html =
    parts.head +
    parts.items.map((h, i) => (lazy && i >= EAGER_ITEMS ? lazyItem(h, i, 'sh-item') : `<div class="sh-item" data-item="${i}">${h}</div>`)).join('') +
    parts.mid +
    parts.answers.map((h, i) => (lazy ? lazyItem(h, i, 'sh-item sh-ans-item') : `<div class="sh-item sh-ans-item" data-item="${i}">${h}</div>`)).join('') +
    parts.tail;
  lazyObserver?.disconnect();
  el.innerHTML = html;
  fitPages(el);
  if (lazy) {
    lazyObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          lazyObserver.unobserve(e.target);
          fillLazy(e.target);
        }
      },
      { root: el, rootMargin: '1500px 0px' }
    );
    el.querySelectorAll('.sh-lazy').forEach((n) => lazyObserver.observe(n));
  }
}

function renderPreview() {
  if ($('.workspace').classList.contains('hide-preview')) return; // 隠している間は描かない（表示したときに描く）
  const el = $('#preview');
  const scroll = el.scrollTop;
  if (state.previewMode === 'sheet') {
    renderSheetPreview(el);
  } else {
    shownSheet = null;
    const p = currentProblem();
    if (!p) {
      el.innerHTML = '';
      return;
    }
    const n = currentIndex() + 1;
    const cs = contentStyle(state.doc.meta.layout);
    el.innerHTML =
      `<div class="paper ${cs.classes.join(' ')}" style="${cs.vars}">` +
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
/** 文書の科目（物理・化学）に合わせて、記号パレットの欄を切り替える */
function selectPaletteForSubject() {
  const subj = state.doc?.meta?.subject || 'math';
  const i = PALETTE.findIndex((c) => c.subject === subj);
  paletteCat = i >= 0 ? i : 0;
  renderPalette();
}
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
    if (item.kind === 'text' || item.kind === 'action') {
      b.textContent = item.text;
      b.classList.add('text-item');
    } else {
      b.innerHTML = renderMath(item.label, false, state.macros);
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
  if (item.kind === 'action') return actions[item.action]?.();
  const text = editor.getText();
  const sel = editor.getSelection();
  const selected = text.slice(sel.from, sel.to);
  let snippet = item.insert.includes('‸') ? item.insert : item.insert + ' ‸';
  if (item.kind === 'math' && !rangeAt(text, sel.from)) snippet = `$${snippet}$`;
  const caret = snippet.indexOf('‸');
  const insert = snippet.replace('‸', selected);
  editor.replace(sel.from, sel.to, insert, sel.from + caret + selected.length);
}

// 書式ボタン：選択範囲を命令で囲む（選択がなければカーソル位置に空の命令を入れる）
function wrapSelection(before, after) {
  if (!currentProblem()) return;
  const sel = editor.getSelection();
  const text = editor.getText().slice(sel.from, sel.to);
  const start = sel.from + before.length;
  editor.replaceSelect(sel.from, sel.to, before + text + after, start, start + text.length);
}
// 「小問 (1)」「数式」「(1) の書き方に直す」
$('#write-bar').addEventListener('mousedown', (e) => {
  if (e.target.closest('button')) e.preventDefault(); // エディタのカーソルを保つ
});
$('#write-bar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-write]');
  if (!b || !currentProblem()) return;
  if (b.dataset.write === 'sub') editor.insertSubQuestion();
  else if (b.dataset.write === 'math') openMathEditor();
  else if (b.dataset.write === 'natural') {
    const t = editor.getText();
    const n = latexToNatural(t);
    if (n !== t) {
      editor.replace(0, t.length, n, 0);
      toast('小問を「(1) 」で始まる行の書き方に直しました（見た目は変わりません。元に戻すときは Ctrl/⌘+Z）', 'info', 5000);
    }
    updateWriteBar();
  }
});
/** \begin{enumerate} で書かれた、直せる小問があるときだけ「(1) の書き方に直す」を出す */
function updateWriteBar() {
  const t = currentProblem() ? editor.getText() : '';
  $('[data-write="natural"]').classList.toggle('hidden', !t.includes('\\begin{enumerate}') || latexToNatural(t) === t);
}
$('#fmt-bar').addEventListener('mousedown', (e) => {
  if (e.target.closest('button')) e.preventDefault(); // エディタの選択を保つ
});
/** 書式を付ける。選択が数式の中なら数式用の命令を使う（太字 → \bm、斜体 → \mathit） */
function applyFormat(kind, arg) {
  if (!currentProblem()) return;
  const text = editor.getText();
  const sel = editor.getSelection();
  const r = rangeAt(text, sel.from);
  const inMath = !!r && sel.to <= r.innerTo && sel.from >= r.innerFrom;
  if (kind === 'bold') wrapSelection(inMath ? '\\bm{' : '\\textbf{', '}');
  else if (kind === 'italic') wrapSelection(inMath ? '\\mathit{' : '\\textit{', '}');
  else if (kind === 'underline') wrapSelection('\\underline{', '}');
  else if (kind === 'color') wrapSelection(`\\lpecolor{${$('#fmt-color').value.slice(1).toUpperCase()}}{`, '}');
  else if (kind === 'size') {
    if (inMath) return toast('数式の中では文字サイズを変えられません（数式の外を選んでください）', 'error');
    wrapSelection(`{\\${arg} `, '}');
  }
}
$('#fmt-bar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-fmt]');
  if (b) applyFormat(b.dataset.fmt);
});
$('#fmt-size').addEventListener('change', (e) => {
  const v = e.target.value;
  e.target.value = '';
  if (v) applyFormat('size', v);
  editor.focus();
});

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
/** 貼り付けから検出した問題（【問題1】【解答1】の区切り、または .mathprob の JSON）。無ければ null */
let pdDetected = null;
function convertPasteInput() {
  const text = $('#pd-input').value;
  const json = parseMathprobText(text);
  if (json) {
    // .mathprob（JSON）: 中身はすでに LaTeX なので変換しない
    const doc = normalizeDoc(json);
    pdDetected = { source: 'json', problems: doc.problems.map((p) => ({ title: p.title, body: p.body, solution: p.solution, tags: p.tags, difficulty: p.difficulty })) };
    $('#pd-output').value = pdDetected.problems.map((p, i) => `【問題${i + 1}】${p.title ? `（${p.title}）` : ''}\n${p.body}${p.solution.trim() ? `【解答${i + 1}】\n${p.solution}` : ''}`).join('\n');
    $('#pd-source').textContent = '問題集ファイル（JSON）';
    updatePasteTargets();
    renderPastePreview();
    return;
  }
  const out = aiTextToLatex(text, { unicodeMath: $('#pd-unicode').checked });
  $('#pd-output').value = out;
  detectPasteProblems();
  renderPastePreview();
}
/** 変換後の LaTeX に【問題1】の区切りがあれば、問題ごとに分ける */
function detectPasteProblems() {
  const list = splitAiProblems($('#pd-output').value);
  pdDetected = list ? { source: 'marks', problems: list } : null;
  updatePasteTargets();
}
function updatePasteTargets() {
  const sel = $('#pd-target');
  const multi = !!pdDetected;
  for (const o of sel.options) o.hidden = o.hasAttribute('data-multi') ? !multi : multi && o.value !== 'new';
  const n = pdDetected?.problems.length || 0;
  const withSol = pdDetected?.problems.filter((p) => p.solution.trim()).length || 0;
  $('#pd-detect').textContent = multi ? `${n} 問を検出（解答つき ${withSol} 問）` : '';
  if (multi) {
    if (sel.selectedOptions[0]?.hidden || !['overwrite', 'append', 'new'].includes(sel.value)) {
      // 今の問題が空なら上書き、そうでなければ追加を既定にする
      const cur = currentProblem();
      sel.value = cur && !cur.body.trim() && !cur.solution.trim() ? 'overwrite' : n === 1 && cur ? 'overwrite' : 'append';
    }
    sel.querySelector('option[value="new"]').hidden = true;
  } else if (sel.selectedOptions[0]?.hidden) {
    sel.value = currentProblem() ? 'cursor' : 'new';
  }
}
function renderPastePreview() {
  // 小問番号・部・空欄の形は今のレイアウト / テーマに合わせて表示する
  const cs = contentStyle(state.doc.meta.layout);
  $('#pd-preview').className = `preview pd-preview ${cs.classes.join(' ')}`;
  $('#pd-preview').style.cssText = cs.vars;
  if (pdDetected) {
    $('#pd-preview').innerHTML = pdDetected.problems
      .map(
        (p, i) =>
          `<div class="pd-pv-head">問題 ${i + 1}${p.title ? `　${escapeHtml(p.title)}` : ''}</div>${renderLatex(p.body, state.macros)}` +
          (p.solution.trim() ? `<div class="pd-pv-head sol">解答 ${i + 1}</div>${renderLatex(p.solution, state.macros)}` : '')
      )
      .join('');
    return;
  }
  $('#pd-preview').innerHTML = renderLatex($('#pd-output').value, state.macros);
}
const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- AI に渡すプロンプト ----
function promptOptions() {
  const saved = state.settings?.aiPrompt || {};
  return {
    withSolution: saved.withSolution !== false,
    subject: saved.subject || state.doc.meta.subject || 'math',
    format: saved.format || 'paste',
    request: saved.request || '',
    fileName: saved.fileName || '',
  };
}
let pdPrompt = null;
function renderPromptPanel() {
  const o = pdPrompt;
  const segOn = (id, v) => $$(`#${id} button`).forEach((b) => b.classList.toggle('on', b.dataset.v === String(v)));
  segOn('pd-p-solution', o.withSolution);
  segOn('pd-p-subject', o.subject);
  segOn('pd-p-format', o.format);
  $('#pd-p-format-hint').textContent =
    o.format === 'mathprob'
      ? 'ファイルを作れる AI 向け。できた .mpb ファイルを「開く」で開くか、中身（JSON）をここに貼り付けます。'
      : 'AI の回答のコードブロックをコピーして、下の欄に貼り付けます。';
  if (document.activeElement !== $('#pd-p-request')) $('#pd-p-request').value = o.request;
  // ファイル名はファイル用の形式のときだけ
  $('#pd-p-filename-row').classList.toggle('hidden', o.format !== 'mathprob');
  if (document.activeElement !== $('#pd-p-filename')) $('#pd-p-filename').value = o.fileName || '';
  $('#pd-p-text').value = buildAiPrompt(o);
  $('#pd-p-copied').textContent = '';
}
function savePromptOptions() {
  state.settings.aiPrompt = { ...pdPrompt };
  api.setSettings({ aiPrompt: state.settings.aiPrompt }).catch(() => {});
}
function togglePromptPanel(open) {
  const panel = $('#pd-prompt');
  const show = open ?? panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !show);
  $('#pd-prompt-toggle').setAttribute('aria-expanded', String(show));
  $('#pd-prompt-toggle').textContent = show ? 'AI に渡すプロンプトを閉じる ▴' : 'AI に渡すプロンプトを作る ▾';
  if (show) {
    pdPrompt = promptOptions();
    renderPromptPanel();
  }
}
$('#pd-prompt-toggle').addEventListener('click', () => togglePromptPanel());
for (const [id, key] of [['pd-p-solution', 'withSolution'], ['pd-p-subject', 'subject'], ['pd-p-format', 'format']]) {
  $(`#${id}`).addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    pdPrompt[key] = key === 'withSolution' ? b.dataset.v === 'true' : b.dataset.v;
    savePromptOptions();
    renderPromptPanel();
  });
}
$('#pd-p-filename').addEventListener('input', () => {
  pdPrompt.fileName = $('#pd-p-filename').value;
  $('#pd-p-text').value = buildAiPrompt(pdPrompt);
  clearTimeout(pdTimer);
  pdTimer = setTimeout(savePromptOptions, 400);
});
$('#pd-p-request').addEventListener('input', () => {
  pdPrompt.request = $('#pd-p-request').value;
  $('#pd-p-text').value = buildAiPrompt(pdPrompt);
  clearTimeout(pdTimer);
  pdTimer = setTimeout(savePromptOptions, 400);
});
$('#pd-p-copy').addEventListener('click', async () => {
  await api.writeClipboard({ text: $('#pd-p-text').value });
  $('#pd-p-copied').textContent = 'コピーしました。AI に貼り付けて送ってください';
});

async function openPasteDialog(opts = {}) {
  $('#pd-input').value = '';
  $('#pd-output').value = '';
  $('#pd-preview').innerHTML = '';
  $('#pd-source').textContent = '';
  pdDetected = null;
  updatePasteTargets();
  $('#pd-target').value = currentProblem() ? 'cursor' : 'new';
  togglePromptPanel(!!opts.prompt);
  $('#paste-dialog').classList.remove('hidden');
  if (opts.prompt) return;
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
  if (parseMathprobText(clip.text || '')) return convertPasteInput();
  $('#pd-output').value = latex;
  $('#pd-source').textContent = source === 'html' ? '表示された回答（数式つき HTML）' : 'テキスト / Markdown';
  detectPasteProblems();
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
  pdTimer = setTimeout(() => {
    // 手で直した内容から区切りを読み直す（JSON から読んだときも、表示している区切りの形で読み直せる）
    detectPasteProblems();
    renderPastePreview();
  }, 200);
});
$('#pd-cancel').addEventListener('click', () => $('#paste-dialog').classList.add('hidden'));
$('#pd-ok').addEventListener('click', () => {
  const latex = $('#pd-output').value;
  const target = $('#pd-target').value;
  if (pdDetected && (target === 'overwrite' || target === 'append')) {
    const list = pdDetected.problems;
    const extra = (p) => (pdDetected.source === 'json' ? { tags: p.tags || [], difficulty: p.difficulty || 0 } : {});
    let at = currentIndex();
    let first = 0;
    const cur = currentProblem();
    if (target === 'overwrite' && cur) {
      // 1 問目で今の問題の問題文・解答（と題名）を上書きする
      const p = list[0];
      cur.body = p.body;
      cur.solution = p.solution;
      if (p.title) cur.title = p.title;
      Object.assign(cur, extra(p));
      first = 1;
    }
    let lastId = cur?.id ?? null;
    for (const p of list.slice(first)) {
      const np = newProblem({ title: p.title, body: p.body, solution: p.solution, ...extra(p) });
      state.doc.problems.splice(++at, 0, np);
      lastId = np.id;
    }
    $('#paste-dialog').classList.add('hidden');
    setDirty(true);
    editor.reset();
    renderList();
    selectProblem(target === 'overwrite' && cur ? cur.id : lastId, 'body');
    renderPreview();
    toast(`${list.length} 問を取り込みました（問題文と解答）`);
    return;
  }
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
  selectPaletteForSubject();
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
  showErrors(source, res.errors || [], res.missing);
}

/** TeX に足りないファイルがあるときの説明（コマンドはコピーできる） */
function missingItem(missing) {
  const li = document.createElement('li');
  li.className = 'ep-missing';
  const msg = document.createElement('p');
  msg.textContent = missing.message;
  li.append(msg);
  const ol = document.createElement('ol');
  for (const step of missing.steps) {
    const item = document.createElement('li');
    item.append(step.text);
    if (step.command) {
      const row = document.createElement('div');
      row.className = 'ep-cmd';
      const code = document.createElement('code');
      code.textContent = step.command;
      const copy = document.createElement('button');
      copy.className = 'ghost';
      copy.textContent = 'コピー';
      copy.addEventListener('click', async () => {
        await api.writeClipboard({ text: step.command });
        toast('コマンドをコピーしました', 'info', 2000);
      });
      row.append(code, copy);
      item.append(row);
    }
    ol.append(item);
  }
  li.append(ol);
  if (missing.note) {
    const note = document.createElement('p');
    note.className = 'ep-note';
    note.textContent = missing.note;
    li.append(note);
  }
  return li;
}

function showErrors(source, errors, missing) {
  const ul = $('#error-list');
  ul.innerHTML = '';
  $('#error-panel').classList.toggle('tall', !!missing);
  if (missing) {
    ul.append(missingItem(missing));
    $('#error-panel').classList.remove('hidden');
    toast('TeX に必要なパッケージが入っていません。下の説明に従って入れてください', 'error', 7000);
    return;
  }
  if (!errors.length) errors = [{ line: null, message: 'PDF を作成できませんでした（詳細不明）' }];
  for (const e of errors) {
    const li = document.createElement('li');
    let where = '';
    let loc = null;
    if (e.line) {
      loc = locateLine(source, e.line);
      if (loc.where === 'problem') where = `問題 ${loc.index + 1}（${loc.field === 'body' ? '問題文' : '解答'}）${loc.line} 行目: `;
      else if (loc.where === 'preamble') where = `プリアンブル ${loc.line} 行目: `;
      else if (loc.where === 'layout') where = `レイアウトの「LaTeX で調整」${loc.line} 行目: `;
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
    } else if (loc && loc.where === 'layout') {
      li.addEventListener('click', () => layoutPanel.open('latex'));
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
  // 表紙
  for (const [k, v] of Object.entries(m.cover || {})) {
    const el = form.elements.namedItem(`cover.${k}`);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = v ?? '';
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
  const prevSubject = m.subject || 'math';
  m.subject = form.elements.namedItem('subject').value;
  m.cover = { ...(m.cover || {}) };
  for (const k of ['enabled', 'header', 'subject', 'target', 'time', 'notes', 'idField', 'footer']) {
    const el = form.elements.namedItem(`cover.${k}`);
    if (el) m.cover[k] = el.type === 'checkbox' ? el.checked : el.value;
  }
  if (m.subject !== prevSubject) {
    // 表紙の科目名が前の科目の既定のままなら、新しい科目に合わせる
    const name = (id) => SUBJECTS.find((s) => s.id === id)?.cover;
    if (!m.cover.subject || m.cover.subject === name(prevSubject)) m.cover.subject = name(m.subject);
    // 題名が既定（「数学 演習プリント」など）のままなら、科目名も合わせる
    const short = (id) => SUBJECTS.find((s) => s.id === id)?.name;
    if (m.title === `${short(prevSubject)} 演習プリント`) m.title = `${short(m.subject)} 演習プリント`;
    selectPaletteForSubject();
  }
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

// ---------------- 図・グラフ ----------------
const imageCache = new Map(); // file → dataURL | null（読み込み中は 'loading'）
function resolveImage(file) {
  if (!file) return null;
  const key = `${state.filePath || ''}|${file}`;
  const v = imageCache.get(key);
  if (v === undefined) {
    imageCache.set(key, 'loading');
    api
      .readImage({ file, projectPath: state.filePath })
      .then((url) => imageCache.set(key, url || null))
      .catch(() => imageCache.set(key, null))
      .finally(() => {
        clearRenderCache();
        renderPreview();
        figureDialog.refresh();
      });
    return null;
  }
  return v === 'loading' ? null : v;
}
setImageResolver(resolveImage);

const figureDialog = initFigureDialog({
  chooseImage: () => api.chooseImage({ projectPath: state.filePath }),
  resolveImage,
  toast,
});

/** 図を挿入、またはカーソル位置／指定位置の図を編集 */
function openFigure(target, newType) {
  if (!currentProblem()) return;
  const text = editor.getText();
  const pos = editor.getSelection().from;
  const fig = target || findFigures(text).find((f) => pos >= f.from && pos <= f.to);
  figureDialog.open(fig?.spec, (spec) => {
    const block = figureBlock(spec);
    if (fig) editor.replace(fig.from, fig.to, block);
    else {
      const sel = editor.getSelection();
      const before = text.slice(0, sel.from);
      const lead = before && !before.endsWith('\n') ? '\n' : '';
      editor.replace(sel.from, sel.to, `${lead}${block}\n`);
    }
    toast(fig ? '図を更新しました' : '図を挿入しました');
  }, { newType });
}
$('#preview').addEventListener('dblclick', (e) => {
  const el = e.target.closest('.pv-fig[data-field]');
  if (!el) return;
  const field = el.dataset.field;
  if (state.field !== field) selectProblem(state.selectedId, field);
  const fig = findFigures(currentProblem()[field]).find((f) => f.from === Number(el.dataset.from));
  if (fig) openFigure(fig);
});

// ---------------- Word（.docx）取り込み ----------------
async function importDocx() {
  if (!(await confirmDiscard())) return;
  try {
    const r = await api.openDocx();
    if (!r) return;
    const { title, problems } = docxToProblems(r.xml);
    if (!problems.length) {
      toast('大問の区切り（①や□2 などの囲み番号）が見つからなかったため、全体を 1 問として取り込みました', 'info', 6000);
      problems.push(newProblem({ body: docxToLatex(r.xml) }));
    }
    const doc = newDocument(false);
    doc.meta.title = title || r.name;
    doc.problems = problems;
    loadDocument(doc, null);
    setDirty(true);
    toast(`Word から ${problems.length} 問を取り込みました（数式は LaTeX に変換済み）`, 'info', 5000);
  } catch (err) {
    toast(`取り込めませんでした: ${err.message}`, 'error', 7000);
  }
}
async function importDocxSolution() {
  const p = currentProblem();
  if (!p) return;
  try {
    const r = await api.openDocx();
    if (!r) return;
    const latex = docxToLatex(r.xml);
    if (p.solution.trim() && !window.confirm('今の解答を Word の内容で置き換えますか？')) return;
    p.solution = latex;
    editor.reset();
    selectProblem(p.id, 'solution');
    setDirty(true);
    toast('Word の内容を解答として取り込みました');
  } catch (err) {
    toast(`取り込めませんでした: ${err.message}`, 'error', 7000);
  }
}

// ---------------- レイアウト / テーマ ----------------
const layoutPanel = initLayoutPanel({
  getDoc: () => state.doc,
  getMacros: () => state.macros,
  onChange: () => {
    setDirty(true);
    renderPreview();
    syncProblemLayout();
    // 物理・化学のテーマを選んだら記号パレットも合わせる
    if (PALETTE[paletteCat]?.subject !== state.doc.meta.subject && PALETTE.some((c) => c.subject === state.doc.meta.subject)) selectPaletteForSubject();
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
  figure: () => openFigure(),
  // 物理パレットから：作図（ばね・回路・力の矢印）で開く
  'figure-geo': () => openFigure(null, 'geo'),
  'import-docx': importDocx,
  'import-docx-solution': importDocxSolution,
  'add-problem': addProblem,
  'duplicate-problem': duplicateProblem,
  'delete-problem': deleteProblem,
  'move-up': () => currentProblem() && moveProblem(state.selectedId, currentIndex() - 1),
  'move-down': () => currentProblem() && currentIndex() < state.doc.problems.length - 1 && moveProblem(state.selectedId, currentIndex() + 1),
  'math-editor': () => openMathEditor(),
  'toggle-list': () => setPaneVisible('list', $('.workspace').classList.contains('hide-list')),
  'toggle-preview': () => setPaneVisible('preview', $('.workspace').classList.contains('hide-preview')),
  'smart-paste': () => openPasteDialog(),
  'ai-prompt': () => openPasteDialog({ prompt: true }),
  'copy-word': copyWordAtCursor,
  undo: () => (editor.hasFocus() ? editor.undo() : document.execCommand('undo')),
  redo: () => (editor.hasFocus() ? editor.redo() : document.execCommand('redo')),
};

api.onMenu((action, payload) => actions[action]?.(payload));

// ---------------- 一覧・プレビューの表示 ----------------
// 隠すとエディタを広く使える。次に起動したときも同じにする（この PC の中だけに覚える）
function setPaneVisible(which, show, remember = true) {
  $('.workspace').classList.toggle(`hide-${which}`, !show);
  $(`[data-action="toggle-${which}"]`).setAttribute('aria-pressed', String(show));
  if (remember) {
    try {
      localStorage.setItem(`pane-${which}`, show ? '1' : '0');
    } catch {
      /* 覚えられなくても表示は切り替わる */
    }
  }
  if (show && which === 'preview') renderPreview();
  window.dispatchEvent(new Event('resize')); // 用紙の拡大率を合わせ直す
}
for (const which of ['list', 'preview']) {
  let v = null;
  try {
    v = localStorage.getItem(`pane-${which}`);
  } catch {
    /* 既定のまま */
  }
  if (v === '0') setPaneVisible(which, false, false);
}
$$('[data-action]').forEach((b) => b.addEventListener('click', () => actions[b.dataset.action]?.()));

// ---------------- 起動 ----------------
(async function init() {
  renderPalette();
  state.settings = await api.getSettings();
  state.engine = await api.getEngine();
  updateEngineStatus();
  loadDocument(state.doc, null);
})();
