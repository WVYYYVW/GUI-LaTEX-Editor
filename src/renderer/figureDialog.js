// 「図・グラフ」ダイアログ：関数グラフ / 図形（作図）/ 画像
import { defaultGraph, defaultGeo, defaultImage, figureToSvg, figureErrors, geoBounds, PARTS, autoYRange, graphKeyPoints, autoRange } from './lib/figure.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const POS = [
  ['auto', '自動'], ['above', '上'], ['below', '下'], ['left', '左'], ['right', '右'],
  ['above left', '左上'], ['above right', '右上'], ['below left', '左下'], ['below right', '右下'],
];
const posOptions = (v, withAuto = true) =>
  POS.filter(([k]) => withAuto || k !== 'auto').map(([k, n]) => `<option value="${k}"${(v || (withAuto ? 'auto' : 'above right')) === k ? ' selected' : ''}>${n}</option>`).join('');
const QUICK = [
  ['x^2', '放物線'], ['2x+1', '直線'], ['x^3-3x', '3次関数'], ['sin(x)', 'sin'], ['cos(x)', 'cos'],
  ['1/x', '反比例'], ['e^x', '指数'], ['log(x)', '対数'], ['sqrt(x)', '√x'], ['|x-1|', '絶対値'],
];

/**
 * @param {{chooseImage:()=>Promise<{file:string,warn?:boolean}|null>, resolveImage:(f:string)=>string|null, toast:(m:string,t?:string)=>void}} deps
 */
export function initFigureDialog(deps) {
  const dlg = $('#fig-dialog');
  const controls = $('#fig-controls');
  const canvas = $('#fig-canvas');
  let spec = null;
  let onDone = null;
  let geoTool = 'point';
  let geoPart = 'line'; // 「線・部品」で引く部品の種類
  let pending = null; // 線分・円の 1 点目

  // ---------------- 描画 ----------------
  function render() {
    renderControls();
    renderCanvas();
  }

  function workBounds() {
    if (spec.type !== 'geo') return undefined;
    const b = geoBounds(spec);
    return { xmin: Math.min(b.xmin, -0.5), xmax: Math.max(b.xmax, 10.5), ymin: Math.min(b.ymin, -0.5), ymax: Math.max(b.ymax, 7.5) };
  }

  function renderCanvas() {
    canvas.innerHTML = figureToSvg(spec, {
      interactive: true,
      bounds: workBounds(),
      showGrid: spec.type === 'geo',
      imageUrl: spec.type === 'image' ? deps.resolveImage(spec.file) : undefined,
    });
    const errs = figureErrors(spec);
    $('#fig-error').textContent = errs.join(' / ');
    if (pending) {
      const svg = $('svg', canvas);
      const p = spec.points.find((q) => q.id === pending);
      const c = p && svg?.querySelector(`[data-pid="${CSS.escape(p.id)}"]`);
      c?.setAttribute('fill', '#2f6fdf');
    }
    $('#fig-hint').textContent = {
      graph: 'グラフ上をクリックすると点を追加、点はドラッグで動かせます（0.5 刻み。Shift で刻みなし）。',
      geo: {
        point: 'クリックした所に点を置きます（0.5 刻み。Shift で刻みなし）。',
        segment: '2 点を順にクリックすると、選んだ部品（線分・ばね・抵抗・矢印など）を置きます。既存の点の近くをクリックするとその点につなぎます。床・壁の斜線や部品の名前の位置は「反対側」で入れ替えられます。',
        circle: '中心 → 円周上の 1 点の順にクリックすると円を描きます。',
        move: '点をドラッグして動かします。線分・円も一緒に動きます。',
        delete: '点・線分・円をクリックすると削除します。',
      }[geoTool],
      image: '画像は問題集ファイルと同じフォルダの figures に複製して挿入します。',
    }[spec.type];
  }

  function rowsGraph() {
    const g = spec;
    return `
      <section><h3>関数</h3>
        ${g.functions
          .map(
            (f, i) => `<div class="fig-fn">
              <span class="fig-y">y =</span><input data-fn="${i}" data-k="expr" value="${esc(f.expr)}" placeholder="例: x^2-2x+1, sin(x), 1/x（縦の直線は x=2）" spellcheck="false">
              <button data-del-fn="${i}" class="ghost" title="削除">×</button>
              <div class="fig-sub">
                <label>範囲 <input data-fn="${i}" data-k="from" value="${esc(f.from)}" placeholder="左端" class="num"> 〜 <input data-fn="${i}" data-k="to" value="${esc(f.to)}" placeholder="右端" class="num"></label>
                <label><input type="checkbox" data-fn="${i}" data-k="dashed"${f.dashed ? ' checked' : ''}> 破線</label>
                <label>名前 <input data-fn="${i}" data-k="label" value="${esc(f.label)}" placeholder="$y=f(x)$" class="mid"></label>
              </div>
            </div>`
          )
          .join('')}
        <div class="fig-quick">${QUICK.map(([e, n]) => `<button data-quick="${esc(e)}" title="${esc(e)}">${n}</button>`).join('')}</div>
        <button data-add-fn class="ghost">＋ 関数を追加</button>
        <p class="hint">書き方: <code>x^2</code>（累乗）, <code>2x</code>（掛け算は省略可）, <code>sqrt(x)</code>, <code>sin(x)</code>, <code>log(x)</code>（自然対数）, <code>e^x</code>, <code>|x|</code>, <code>pi</code>。縦の直線は <code>x=2</code>（範囲は y の範囲になります）</p>
      </section>
      <section><h3>おまかせ</h3>
        <div class="ld-row">
          <button data-auto-range type="button" title="切片・極値・交点が収まり、グラフの形が見えるように表示範囲を合わせます">範囲を自動で合わせる</button>
          <button data-key-points type="button" title="y 切片・x 切片・極大・極小・2 つのグラフの交点に、座標の付いた点を打ちます">要点を打つ（切片・極値・交点）</button>
        </div>
        <p class="hint">要点の名前（座標）は下の「点」で書き換えられます。小数になる値は小数第 2 位まで出すので、√ などで書きたいときは書き換えてください。</p>
      </section>
      <section><h3>表示範囲と目盛り</h3>
        <div class="fig-range">
          <label>x <input type="number" data-g="xmin" value="${g.xmin}" step="1"> 〜 <input type="number" data-g="xmax" value="${g.xmax}" step="1"></label>
          <label>y <input type="number" data-g="ymin" value="${g.ymin}" step="1"> 〜 <input type="number" data-g="ymax" value="${g.ymax}" step="1"></label>
        </div>
        <div class="ld-slider"><span class="ld-k">大きさ</span><input type="range" data-g="scale" min="0.3" max="2" step="0.05" value="${g.scale}"><output>${Number(g.scale).toFixed(2)}</output><span class="unit">cm</span></div>
        <div class="ld-row">
          <label class="ld-check"><input type="checkbox" data-g="ticks"${g.ticks ? ' checked' : ''}> 目盛りの数字</label>
          <label class="ld-check"><input type="checkbox" data-g="origin"${g.origin ? ' checked' : ''}> 原点 O</label>
          <label class="ld-check"><input type="checkbox" data-g="grid"${g.grid ? ' checked' : ''}> 方眼</label>
        </div>
        <div class="ld-row"><label>横軸の名前 <input data-g="axisX" value="${esc(g.axisX)}" class="mid"></label><label>縦軸の名前 <input data-g="axisY" value="${esc(g.axisY)}" class="mid"></label></div>
      </section>
      <section><h3>点</h3>
        ${g.points
          .map(
            (p, i) => `<div class="fig-pt">
              (<input type="number" data-pt="${i}" data-k="x" value="${p.x}" step="0.5" class="num">, <input type="number" data-pt="${i}" data-k="y" value="${p.y}" step="0.5" class="num">)
              <input data-pt="${i}" data-k="label" value="${esc(p.label)}" placeholder="名前 例: P, $(1,2)$" class="mid">
              <select data-pt="${i}" data-k="pos">${posOptions(p.pos, false)}</select>
              <label><input type="checkbox" data-pt="${i}" data-k="drop"${p.drop ? ' checked' : ''}> 軸へ点線</label>
              <button data-del-pt="${i}" class="ghost" title="削除">×</button>
            </div>`
          )
          .join('') || '<p class="hint">グラフをクリックして点を追加できます。</p>'}
      </section>
      <section><h3>面積の塗りつぶし</h3>
        <div class="ld-row">
          <label class="ld-check"><input type="checkbox" data-area-on${g.area ? ' checked' : ''}> x 軸との間を塗る</label>
          ${
            g.area
              ? `<select data-area="fn">${g.functions.map((f, i) => `<option value="${i}"${g.area.fn === i ? ' selected' : ''}>関数 ${i + 1}</option>`).join('')}</select>
                 <label>x = <input type="number" data-area="from" value="${g.area.from}" step="0.5" class="num"> 〜 <input type="number" data-area="to" value="${g.area.to}" step="0.5" class="num"></label>`
              : ''
          }
        </div>
      </section>`;
  }

  function rowsGeo() {
    const g = spec;
    // 点の名前。名前の無い点（部品の端など）は座標で表す
    const name = (id) => {
      const p = g.points.find((q) => q.id === id);
      return p?.label || (p ? `(${p.x}, ${p.y})` : id);
    };
    const ends = (s) => {
      const a = name(s.a);
      const b = name(s.b);
      return a.startsWith('(') || b.startsWith('(') ? `${a}–${b}` : `${a}${b}`;
    };
    const tools = [['point', '点'], ['segment', '線・部品'], ['circle', '円'], ['move', '移動'], ['delete', '削除']];
    const partName = (k) => PARTS.find((p) => p.id === (k || 'line'))?.name || '線分';
    return `
      <section><h3>道具</h3>
        <div class="seg">${tools.map(([k, n]) => `<button data-tool="${k}" class="${geoTool === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        ${geoTool === 'segment' ? `<div class="seg seg-wrap fig-parts">${PARTS.map((p) => `<button data-part="${p.id}" class="${geoPart === p.id ? 'on' : ''}">${p.name}</button>`).join('')}</div>` : ''}
        <div class="ld-slider"><span class="ld-k">大きさ</span><input type="range" data-g="scale" min="0.3" max="2" step="0.05" value="${g.scale}"><output>${Number(g.scale).toFixed(2)}</output><span class="unit">cm</span></div>
        <label class="ld-check"><input type="checkbox" data-g="grid"${g.grid ? ' checked' : ''}> 方眼も出力する</label>
      </section>
      <section><h3>点</h3>
        ${g.points
          .map(
            (p, i) => `<div class="fig-pt">
              <input data-pt="${i}" data-k="label" value="${esc(p.label)}" placeholder="名前" class="mid">
              (<input type="number" data-pt="${i}" data-k="x" value="${p.x}" step="0.5" class="num">, <input type="number" data-pt="${i}" data-k="y" value="${p.y}" step="0.5" class="num">)
              <select data-pt="${i}" data-k="pos">${posOptions(p.pos)}</select>
              <label><input type="checkbox" data-pt="${i}" data-k="dot"${p.dot !== false ? ' checked' : ''}> 点を打つ</label>
              <button data-del-pt="${i}" class="ghost" title="削除">×</button>
            </div>`
          )
          .join('') || '<p class="hint">右の方眼をクリックして点を置いてください。</p>'}
      </section>
      <section><h3>線分・円</h3>
        ${g.segments
          .map(
            (s, i) => `<div class="fig-pt"><span class="fig-seg-name">${esc(partName(s.kind))} ${esc(ends(s))}</span>
              <input data-seg="${i}" data-k="label" value="${esc(s.label)}" placeholder="名前（例 $k$）" title="部品の名前。例: $k$, $R$, $F$" class="mid">
              <label><input type="checkbox" data-seg="${i}" data-k="flip"${s.flip ? ' checked' : ''}> 反対側</label>
              <label><input type="checkbox" data-seg="${i}" data-k="dashed"${s.dashed ? ' checked' : ''}> 破線</label>
              <button data-del-seg="${i}" class="ghost" title="削除">×</button></div>`
          )
          .join('')}
        ${g.circles.map((c, i) => `<div class="fig-pt">円（中心 ${esc(name(c.c))}） <label><input type="checkbox" data-circ="${i}" data-k="dashed"${c.dashed ? ' checked' : ''}> 破線</label><button data-del-circ="${i}" class="ghost">×</button></div>`).join('') || (g.segments.length ? '' : '<p class="hint">まだありません。</p>')}
      </section>`;
  }

  function rowsImage() {
    const s = spec;
    return `
      <section><h3>画像</h3>
        <div class="ld-row"><button data-choose-image class="primary">画像を選ぶ…</button><span class="fig-file">${esc(s.file || '未選択')}</span></div>
        <div class="ld-slider"><span class="ld-k">幅</span><input type="range" data-g="width" min="10" max="100" step="5" value="${s.width}"><output>${s.width}</output><span class="unit">%</span></div>
        <div class="ld-row"><span class="ld-k">配置</span>
          <div class="seg">${[['left', '左'], ['center', '中央'], ['right', '右']].map(([k, n]) => `<button data-align="${k}" class="${s.align === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        </div>
        <p class="hint">PNG / JPEG / PDF が使えます（PDF は PDF 出力でのみ表示）。</p>
      </section>`;
  }

  function renderControls() {
    $$('#fig-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === spec.type));
    const focusKey = document.activeElement?.closest('#fig-controls') ? keyOf(document.activeElement) : null;
    const caret = focusKey && document.activeElement.selectionStart;
    controls.innerHTML = spec.type === 'graph' ? rowsGraph() : spec.type === 'geo' ? rowsGeo() : rowsImage();
    if (focusKey) {
      const el = [...controls.querySelectorAll('input,select')].find((e) => keyOf(e) === focusKey);
      if (el) {
        el.focus();
        try { if (caret != null) el.setSelectionRange(caret, caret); } catch { /* number input */ }
      }
    }
  }
  const keyOf = (el) => ['fn', 'pt', 'g', 'area', 'seg', 'circ'].map((k) => el.dataset?.[k] ?? '').join('|') + '|' + (el.dataset?.k ?? '');
  const $$ = (s) => [...document.querySelectorAll(s)];

  // ---------------- 入力 ----------------
  const num = (v) => (v === '' ? '' : Number(v));
  controls.addEventListener('input', (e) => {
    const el = e.target;
    const val = el.type === 'checkbox' ? el.checked : el.value;
    const d = el.dataset;
    if (d.fn !== undefined) spec.functions[d.fn][d.k] = val;
    else if (d.pt !== undefined) spec.points[d.pt][d.k] = d.k === 'x' || d.k === 'y' ? Number(val) : val;
    else if (d.seg !== undefined) spec.segments[d.seg][d.k] = val;
    else if (d.circ !== undefined) spec.circles[d.circ][d.k] = val;
    else if (d.area !== undefined) spec.area[d.area] = d.area === 'fn' ? Number(val) : num(val);
    else if (d.g !== undefined) {
      spec[d.g] = el.type === 'checkbox' ? val : el.type === 'number' || el.type === 'range' ? Number(val) : val;
      if (el.type === 'range') el.parentElement.querySelector('output').textContent = Number(val).toFixed((el.step.split('.')[1] || '').length);
      if (spec.type === 'graph' && (spec.xmin >= spec.xmax || spec.ymin >= spec.ymax)) return;
    } else if (el.hasAttribute('data-area-on')) {
      spec.area = val ? { fn: 0, from: 0, to: 1 } : null;
      renderControls();
    }
    // テキスト入力中は欄を作り直さず図だけ更新する（カーソルが飛ばないように）
    if (el.type === 'checkbox' || el.tagName === 'SELECT') renderControls();
    renderCanvas();
  });
  controls.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.delFn !== undefined) spec.functions.splice(Number(d.delFn), 1);
    else if ('addFn' in d) spec.functions.push({ expr: '', from: '', to: '', dashed: false, label: '' });
    else if ('autoRange' in d) Object.assign(spec, autoRange(spec));
    else if ('keyPoints' in d) {
      const pts = graphKeyPoints(spec);
      spec.points.push(...pts.map(({ x, y, label, pos, drop }) => ({ x, y, label, pos, drop })));
      deps.toast(pts.length ? `${pts.length} 個の点を打ちました（名前は「点」で書き換えられます）` : '新しく打つ要点はありませんでした', 'info', 3500);
    }
    else if (d.quick !== undefined) {
      const empty = spec.functions.find((f) => !f.expr.trim());
      if (empty) empty.expr = d.quick;
      else spec.functions.push({ expr: d.quick, from: '', to: '', dashed: false, label: '' });
    } else if (d.delPt !== undefined) removePoint(Number(d.delPt));
    else if (d.delSeg !== undefined) spec.segments.splice(Number(d.delSeg), 1);
    else if (d.delCirc !== undefined) spec.circles.splice(Number(d.delCirc), 1);
    else if (d.tool) {
      geoTool = d.tool;
      pending = null;
    } else if (d.part) {
      geoPart = d.part;
      pending = null;
    } else if (d.align) spec.align = d.align;
    else if ('chooseImage' in d) {
      const r = await deps.chooseImage();
      if (!r) return;
      spec.file = r.file;
      if (r.warn) deps.toast('問題集がまだ保存されていないため、画像は元の場所を参照します。保存後に挿入し直すと figures フォルダに複製されます。', 'error');
    } else return;
    render();
  });

  function removePoint(i) {
    const id = spec.points[i]?.id;
    spec.points.splice(i, 1);
    if (spec.type === 'geo') {
      spec.segments = spec.segments.filter((s) => s.a !== id && s.b !== id);
      spec.circles = spec.circles.filter((c) => c.c !== id && c.p !== id);
    }
  }

  // ---------------- キャンバス操作 ----------------
  function toMath(e) {
    const svg = $('svg', canvas);
    const rect = svg.getBoundingClientRect();
    const k = Number(svg.getAttribute('width')) / rect.width;
    const px = (e.clientX - rect.left) * k;
    const py = (e.clientY - rect.top) * k;
    const u = Number(svg.dataset.u);
    const pad = Number(svg.dataset.pad);
    let x = Number(svg.dataset.xmin) + (px - pad) / u;
    let y = Number(svg.dataset.ymax) - (py - pad) / u;
    if (!e.shiftKey) {
      x = Math.round(x * 2) / 2;
      y = Math.round(y * 2) / 2;
    } else {
      x = Math.round(x * 100) / 100;
      y = Math.round(y * 100) / 100;
    }
    return { x, y, px, py, u };
  }
  const nextLabel = () => {
    const used = new Set(spec.points.map((p) => p.label));
    for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.has(c)) return c;
    return '';
  };
  const nextId = () => {
    let n = spec.points.length + 1;
    while (spec.points.some((p) => p.id === `P${n}`)) n++;
    return `P${n}`;
  };
  function nearPoint(m) {
    let best = null;
    let bd = 12 / m.u; // 12px 以内
    for (const p of spec.points) {
      const d = Math.hypot(p.x - (Number($('svg', canvas).dataset.xmin) + (m.px - Number($('svg', canvas).dataset.pad)) / m.u), p.y - (Number($('svg', canvas).dataset.ymax) - (m.py - Number($('svg', canvas).dataset.pad)) / m.u));
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }
  function pointAt(m, opts = {}) {
    const hit = nearPoint(m);
    if (hit) return hit;
    const p = { id: nextId(), x: m.x, y: m.y, label: opts.noLabel ? '' : nextLabel(), pos: 'auto', dot: opts.noLabel ? false : true };
    spec.points.push(p);
    return p;
  }

  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (!spec || spec.type === 'image' || !$('svg', canvas)) return;
    const m = toMath(e);
    const handle = e.target.closest('.fig-handle');
    if (spec.type === 'graph') {
      if (handle) drag = { idx: Number(handle.dataset.pt) };
      else {
        spec.points.push({ x: m.x, y: m.y, label: '', pos: 'above right', drop: false });
        drag = { idx: spec.points.length - 1 };
        render();
      }
    } else {
      if (geoTool === 'move') {
        const p = nearPoint(m);
        if (p) drag = { id: p.id };
      } else if (geoTool === 'point') {
        if (!nearPoint(m)) spec.points.push({ id: nextId(), x: m.x, y: m.y, label: nextLabel(), pos: 'auto', dot: true });
        render();
      } else if (geoTool === 'segment' || geoTool === 'circle') {
        // 部品（ばね・抵抗など）の端は名前・黒丸なしの点にする（つなぎ目は「点を打つ」で黒丸にできる）
        const p = pointAt(m, { noLabel: (geoTool === 'circle' && !!pending) || (geoTool === 'segment' && geoPart !== 'line') });
        if (!pending) pending = p.id;
        else if (pending !== p.id) {
          if (geoTool === 'segment') spec.segments.push({ a: pending, b: p.id, dashed: false, ...(geoPart !== 'line' ? { kind: geoPart } : {}) });
          else spec.circles.push({ c: pending, p: p.id, dashed: false });
          pending = null;
        }
        render();
      } else if (geoTool === 'delete') {
        const p = nearPoint(m);
        if (p) removePoint(spec.points.indexOf(p));
        else if (e.target.closest('[data-seg]')) spec.segments.splice(Number(e.target.closest('[data-seg]').dataset.seg), 1);
        else if (e.target.dataset.circle !== undefined) spec.circles = spec.circles.filter((c) => c.c !== e.target.dataset.circle);
        render();
      }
    }
    if (drag) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const m = toMath(e);
    const p = drag.id ? spec.points.find((q) => q.id === drag.id) : spec.points[drag.idx];
    if (!p) return;
    p.x = m.x;
    p.y = m.y;
    renderCanvas();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag) renderControls();
    drag = null;
  });

  $('#fig-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-t]');
    if (!b || b.dataset.t === spec.type) return;
    spec = { graph: defaultGraph, geo: defaultGeo, image: defaultImage }[b.dataset.t]();
    pending = null;
    render();
  });

  // ---------------- 開閉 ----------------
  function open(initial, done, opts = {}) {
    spec = structuredClone(initial || (opts.newType === 'geo' ? defaultGeo() : defaultGraph()));
    onDone = done;
    pending = null;
    geoTool = 'point';
    $('#fig-ok').textContent = initial ? '更新' : '挿入';
    dlg.classList.remove('hidden');
    render();
  }
  function close() {
    dlg.classList.add('hidden');
  }
  $('#fig-cancel').addEventListener('click', close);
  $('#fig-ok').addEventListener('click', () => {
    if (spec.type === 'image' && !spec.file) {
      deps.toast('画像を選んでください', 'error');
      return;
    }
    const errs = figureErrors(spec);
    if (errs.length) {
      deps.toast(`式を確認してください: ${errs[0]}`, 'error');
      return;
    }
    close();
    onDone?.(spec);
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return { open, refresh: () => !dlg.classList.contains('hidden') && renderCanvas() };
}
