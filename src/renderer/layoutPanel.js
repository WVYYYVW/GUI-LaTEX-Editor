// 「レイアウト / テーマ」ダイアログと、プレビュー上での直接操作（解答スペースのドラッグ）
import { HEAD_STYLES, SUB_LABELS, PART_STYLES, BLANK_STYLES, SUBJECTS, BASE_THEMES, applyTheme, headNumberHtml, normalizeLayout } from './lib/layout.js';
import { UNIVERSITY_THEMES, UNVERIFIED_UNIVERSITIES } from './lib/universityThemes.js';
import { renderSheet } from './lib/preview.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const PX_PER_MM = 96 / 25.4;

const getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
function setPath(obj, path, v) {
  const ks = path.split('.');
  const last = ks.pop();
  ks.reduce((o, k) => o[k], obj)[last] = v;
}

/** 用紙プレビューをコンテナの幅に合わせて縮小表示する */
export function fitPages(container) {
  const avail = container.clientWidth - 36;
  for (const page of $$('.page', container)) {
    page.style.zoom = '1';
    const z = Math.min(1.25, avail / page.offsetWidth);
    page.style.zoom = String(Math.max(0.3, z));
  }
}

/**
 * プレビューの「⇕ 解答スペース」をドラッグで調整できるようにする
 * @param {HTMLElement} container
 * @param {{getDoc:()=>any, onCommit:()=>void}} deps
 */
export function enableSpaceDrag(container, { getDoc, onCommit }) {
  container.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.sh-handle');
    if (!handle) return;
    e.preventDefault();
    const doc = getDoc();
    const i = Number(handle.dataset.index);
    const p = doc.problems[i];
    const space = handle.parentElement;
    const page = handle.closest('.page');
    const zoom = Number(page?.style.zoom || 1);
    const start = Number(p.layout?.answerSpace ?? doc.meta.spaceAfter) || 0;
    const y0 = e.clientY;
    handle.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const mm = Math.max(0, Math.round((start + (ev.clientY - y0) / zoom / PX_PER_MM) / 5) * 5);
      p.layout = { ...(p.layout || {}), answerSpace: mm };
      space.style.height = `${mm}mm`;
      handle.textContent = `⇕ 解答スペース ${mm}mm`;
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.classList.remove('dragging');
      onCommit();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
  // ダブルクリックで全体設定に戻す
  container.addEventListener('dblclick', (e) => {
    const handle = e.target.closest('.sh-handle');
    if (!handle) return;
    const p = getDoc().problems[Number(handle.dataset.index)];
    p.layout = { ...(p.layout || {}), answerSpace: null };
    onCommit();
  });
}

/**
 * @param {{getDoc:()=>any, getMacros:()=>object, onChange:()=>void, getUserThemes:()=>any[], saveUserThemes:(t:any[])=>Promise<void>, toast:(m:string,t?:string)=>void}} deps
 */
export function initLayoutPanel(deps) {
  const dlg = $('#layout-dialog');
  const preview = $('#ld-preview');
  let snapshot = null;
  let previewTimer;
  let themeSubject = 'math';

  const doc = () => deps.getDoc();
  const lay = () => doc().meta.layout;

  // 見出しスタイルのボタン（見本付き）
  const headHost = $('#ld-head-styles');
  for (const s of HEAD_STYLES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.v = s.id;
    b.innerHTML = `<span class="hs-sample"></span><span class="hs-name">${s.name}</span>`;
    b.addEventListener('click', () => update('head.style', s.id));
    headHost.append(b);
  }
  // 小問番号
  const subHost = $('[data-seg="subLabel"]');
  for (const s of SUB_LABELS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.v = s.id;
    b.textContent = s.name;
    subHost.append(b);
  }

  // 部の番号・空欄の形
  for (const [host, list] of [[$('#ld-part-styles'), PART_STYLES], [$('#ld-blank-styles'), BLANK_STYLES]]) {
    for (const s of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.v = s.id;
      b.textContent = s.name;
      host.append(b);
    }
  }

  function update(path, value, isMeta = false) {
    if (isMeta) doc().meta[path] = value;
    else setPath(lay(), path, value);
    if (!isMeta) lay().themeId = 'custom';
    deps.onChange();
    sync();
    schedulePreview();
  }

  // 入力欄とレイアウトの対応付け
  for (const el of $$('[data-l], [data-m]', dlg)) {
    const isMeta = !!el.dataset.m;
    const path = el.dataset.l || el.dataset.m;
    el.addEventListener('input', () => {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'range') v = Number(v);
      else if (el.type === 'number') v = v === '' ? null : Number(v);
      update(path, v, isMeta);
    });
  }
  for (const seg of $$('[data-seg], [data-segm]', dlg)) {
    const isMeta = !!seg.dataset.segm;
    const path = seg.dataset.seg || seg.dataset.segm;
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      let v = b.dataset.v;
      if (v === 'true' || v === 'false') v = v === 'true';
      else if (/^\d+$/.test(v)) v = Number(v);
      update(path, v, isMeta);
    });
  }

  function sync() {
    const l = lay();
    const m = doc().meta;
    for (const el of $$('[data-l], [data-m]', dlg)) {
      const v = el.dataset.l ? getPath(l, el.dataset.l) : m[el.dataset.m];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (document.activeElement !== el) el.value = v ?? '';
      const out = el.parentElement.querySelector('output');
      if (out) out.textContent = el.type === 'range' ? Number(v).toFixed((el.step.split('.')[1] || '').length) : v;
    }
    for (const seg of $$('[data-seg], [data-segm]', dlg)) {
      const v = seg.dataset.seg ? getPath(l, seg.dataset.seg) : m[seg.dataset.segm];
      $$('button[data-v]', seg).forEach((b) => b.classList.toggle('on', String(v) === b.dataset.v));
    }
    $$('button', headHost).forEach((b) => {
      b.classList.toggle('on', b.dataset.v === l.head.style);
      const sample = $('.hs-sample', b);
      sample.innerHTML = headNumberHtml({ ...l.head, style: b.dataset.v }, 1);
      sample.style.cssText = `font-family:${l.head.font === 'mincho' ? 'var(--serif)' : 'var(--sans)'};font-weight:${l.head.bold ? 700 : 400};color:${l.head.color};font-size:15px`;
    });
    $('#ld-label-row').classList.toggle('hidden', l.head.style !== 'plain');
    renderThemes();
  }

  // ---------------- テーマ ----------------
  function themeCard(t, { deletable } = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-card';
    b.classList.toggle('on', lay().themeId === t.id);
    b.innerHTML = `<span class="tc-name"></span><span class="tc-desc"></span>`;
    $('.tc-name', b).textContent = t.name;
    $('.tc-desc', b).textContent = t.desc || '';
    if (t.source) b.title = `参考: ${t.source}`;
    b.addEventListener('click', () => {
      applyTheme(doc().meta, t);
      deps.onChange();
      sync();
      schedulePreview();
      deps.toast(`テーマ「${t.name}」を適用しました`);
    });
    if (deletable) {
      const del = document.createElement('span');
      del.className = 'tc-del';
      del.textContent = '×';
      del.title = 'このテーマを削除';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deps.saveUserThemes(deps.getUserThemes().filter((x) => x.id !== t.id));
        renderThemes();
      });
      b.append(del);
    }
    return b;
  }
  function renderThemes() {
    const fill = (host, list, opts, emptyText) => {
      host.innerHTML = '';
      if (!list.length) host.innerHTML = `<div class="empty">${emptyText}</div>`;
      for (const t of list) host.append(themeCard(t, opts));
    };
    fill($('#ld-themes-base'), BASE_THEMES, {}, '');
    // 大学テーマは科目ごとに分けて表示する（最初は文書の科目）
    const subjOf = (t) => t.meta?.subject || 'math';
    const sh = $('#ld-theme-subject');
    sh.innerHTML = '';
    for (const s of SUBJECTS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = `${s.name}（${UNIVERSITY_THEMES.filter((t) => subjOf(t) === s.id).length}）`;
      b.classList.toggle('on', s.id === themeSubject);
      b.addEventListener('click', () => {
        themeSubject = s.id;
        renderThemes();
      });
      sh.append(b);
    }
    fill($('#ld-themes-univ'), UNIVERSITY_THEMES.filter((t) => subjOf(t) === themeSubject), {}, 'この科目のテーマは準備中です。');
    const note = document.createElement('div');
    note.className = 'empty';
    note.textContent = `未対応: ${UNVERIFIED_UNIVERSITIES.map((u) => `${u.name}（${u.reason}）`).join(' ')}`;
    $('#ld-themes-univ').append(note);
    fill($('#ld-themes-user'), deps.getUserThemes(), { deletable: true }, 'まだありません。下で今の設定を保存できます。');
  }
  $('#ld-theme-save').addEventListener('click', async () => {
    const name = $('#ld-theme-name').value.trim();
    if (!name) {
      deps.toast('テーマ名を入力してください', 'error');
      $('#ld-theme-name').focus();
      return;
    }
    const id = `user-${Date.now().toString(36)}`;
    const l = structuredClone(lay());
    delete l.themeId;
    const m = doc().meta;
    const theme = { id, name, desc: '自分で保存したテーマ', layout: l, meta: { spaceAfter: m.spaceAfter, columns: m.columns } };
    await deps.saveUserThemes([...deps.getUserThemes(), theme]);
    lay().themeId = id;
    $('#ld-theme-name').value = '';
    sync();
    deps.toast(`テーマ「${name}」を保存しました`);
  });

  // ---------------- プレビュー ----------------
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 60);
  }
  function renderPreview() {
    if (dlg.classList.contains('hidden')) return;
    const scroll = preview.scrollTop;
    preview.innerHTML = renderSheet(doc(), deps.getMacros(), { interactive: true });
    fitPages(preview);
    preview.scrollTop = scroll;
  }
  enableSpaceDrag(preview, { getDoc: doc, onCommit: () => (deps.onChange(), renderPreview()) });
  window.addEventListener('resize', () => !dlg.classList.contains('hidden') && fitPages(preview));

  // ---------------- 開閉 ----------------
  function open(focus) {
    doc().meta.layout = normalizeLayout(doc().meta.layout);
    themeSubject = doc().meta.subject || 'math';
    snapshot = structuredClone({ meta: doc().meta, layouts: doc().problems.map((p) => p.layout) });
    dlg.classList.remove('hidden');
    sync();
    renderPreview();
    if (focus === 'head') headHost.scrollIntoView({ block: 'center' });
  }
  function close() {
    dlg.classList.add('hidden');
    deps.onChange();
  }
  $('#ld-close').addEventListener('click', close);
  $('#ld-revert').addEventListener('click', () => {
    if (!snapshot) return;
    Object.assign(doc().meta, structuredClone(snapshot.meta));
    doc().problems.forEach((p, i) => (p.layout = structuredClone(snapshot.layouts[i] ?? p.layout)));
    deps.onChange();
    sync();
    renderPreview();
    deps.toast('開く前の状態に戻しました');
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return { open };
}
