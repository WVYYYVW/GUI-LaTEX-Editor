// 図・グラフ：式の解析、標本化、TikZ 生成、SVG（プレビュー）生成。
// ソース中では次の形で保存し、ダブルクリックで再編集できるようにする。
//   % @fig {"type":"graph",...}
//   \begin{center} ... \end{center}
//   % @endfig
import katex from 'katex';

// ---------------- 式の解析 ----------------
const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp,
  log: Math.log, ln: Math.log, log10: Math.log10, log2: Math.log2,
  floor: Math.floor,
};
const CONSTS = { pi: Math.PI, e: Math.E };

function tokenize(src) {
  const s = src
    .replace(/[×＊]/g, '*')
    .replace(/[÷／]/g, '/')
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)) // 全角英数 → 半角.replace(/[÷／]/g, '/').replace(/[−ー－]/g, '-').replace(/＋/g, '+')
    .replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/[（]/g, '(').replace(/[）]/g, ')')
    .replace(/²/g, '^2').replace(/³/g, '^3').replace(/\*\*/g, '^');
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = s.slice(i).match(/^(\d+\.?\d*|\.\d+)/);
    if (num) { toks.push({ t: 'num', v: Number(num[1]) }); i += num[1].length; continue; }
    const id = s.slice(i).match(/^[a-zA-Z][a-zA-Z0-9]*/);
    if (id) {
      // "xsin" のような連結にも対応するため、既知の関数名・定数・x で分割する
      let w = id[0];
      while (w) {
        const f = Object.keys(FUNCS).sort((a, b) => b.length - a.length).find((k) => w.startsWith(k));
        const k = f || (w.startsWith('pi') ? 'pi' : w[0]);
        toks.push(FUNCS[k] ? { t: 'fn', v: k } : { t: 'id', v: k });
        w = w.slice(k.length);
      }
      i += id[0].length;
      continue;
    }
    if ('+-*/^()|,'.includes(c)) { toks.push({ t: c }); i++; continue; }
    throw new Error(`使えない文字です: 「${c}」`);
  }
  return toks;
}

/** 式を構文木に。x の 1 変数。暗黙の掛け算（2x, 3(x+1), x sin x）に対応 */
export function parseExpr(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const eat = (t) => {
    if (peek()?.t !== t) throw new Error(`「${t}」が必要です`);
    p++;
  };
  const startsPrimary = (tk) => tk && (tk.t === 'num' || tk.t === 'id' || tk.t === 'fn' || tk.t === '(' || tk.t === '|');
  function expr() {
    let a = term();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = toks[p++].t;
      a = { op, a, b: term() };
    }
    return a;
  }
  function term() {
    let a = unary();
    for (;;) {
      const tk = peek();
      if (tk && (tk.t === '*' || tk.t === '/')) {
        p++;
        a = { op: tk.t, a, b: unary() };
      } else if (startsPrimary(tk) && !(tk.t === '|' && inAbs > 0)) {
        a = { op: '*', a, b: power() };
      } else return a;
    }
  }
  function unary() {
    if (peek()?.t === '-') { p++; return { op: 'neg', a: unary() }; }
    if (peek()?.t === '+') { p++; return unary(); }
    return power();
  }
  function power() {
    const base = primary();
    if (peek()?.t === '^') { p++; return { op: '^', a: base, b: unary() }; }
    return base;
  }
  let inAbs = 0;
  function primary() {
    const tk = toks[p++];
    if (!tk) throw new Error('式が途中で終わっています');
    if (tk.t === 'num') return { num: tk.v };
    if (tk.t === 'id') {
      if (tk.v === 'x') return { x: true };
      if (CONSTS[tk.v] !== undefined) return { num: CONSTS[tk.v], name: tk.v };
      throw new Error(`「${tk.v}」は使えません（変数は x のみ）`);
    }
    if (tk.t === 'fn') {
      let arg;
      if (peek()?.t === '(') { p++; arg = expr(); eat(')'); }
      else arg = power(); // sin x
      // sin^2 x のような書き方は未対応（(sin x)^2 と書く）
      return { fn: tk.v, a: arg };
    }
    if (tk.t === '(') { const e = expr(); eat(')'); return e; }
    if (tk.t === '|') { inAbs++; const e = expr(); inAbs--; eat('|'); return { fn: 'abs', a: e }; }
    throw new Error(`「${tk.t}」の位置が正しくありません`);
  }
  const tree = expr();
  if (p < toks.length) throw new Error(`「${toks[p].t === 'num' ? toks[p].v : toks[p].v || toks[p].t}」の付近が読めません`);
  return tree;
}

export function evalExpr(n, x) {
  if (n.num !== undefined) return n.num;
  if (n.x) return x;
  if (n.fn) return FUNCS[n.fn](evalExpr(n.a, x));
  const a = evalExpr(n.a, x);
  switch (n.op) {
    case 'neg': return -a;
    case '+': return a + evalExpr(n.b, x);
    case '-': return a - evalExpr(n.b, x);
    case '*': return a * evalExpr(n.b, x);
    case '/': return a / evalExpr(n.b, x);
    case '^': {
      const b = evalExpr(n.b, x);
      // 負の数の分数乗（x^(1/3) など）は実数の範囲で
      if (a < 0 && !Number.isInteger(b)) {
        const inv = 1 / b;
        if (Number.isInteger(inv) && inv % 2 !== 0) return -Math.pow(-a, b);
      }
      return Math.pow(a, b);
    }
  }
  return NaN;
}

export function compileExpr(src) {
  const tree = parseExpr(src);
  return (x) => evalExpr(tree, x);
}

// ---------------- 既定値 ----------------
export function defaultGraph() {
  return {
    type: 'graph',
    xmin: -3, xmax: 4, ymin: -2, ymax: 5,
    scale: 0.8, // 1 目盛り = 0.8 cm
    grid: false, ticks: true, origin: true, axisX: 'x', axisY: 'y',
    functions: [{ expr: 'x^2-2x', from: '', to: '', dashed: false, label: '' }],
    points: [],
    area: null, // { fn: 0, from: 0, to: 2 }
  };
}
export function defaultGeo() {
  return { type: 'geo', scale: 0.8, grid: false, points: [], segments: [], circles: [] };
}
export function defaultImage() {
  return { type: 'image', file: '', width: 50, align: 'center' };
}

// ---------------- 標本化 ----------------
const r3 = (v) => Math.round(v * 1000) / 1000;

/** 関数を標本化し、定義されない所・漸近線で区切った線分列を返す */
export function sampleFunction(fn, a, b, ymin, ymax, n = 360) {
  const span = ymax - ymin;
  const lo = ymin - span * 2;
  const hi = ymax + span * 2;
  const segs = [];
  let cur = [];
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    let y;
    try { y = fn(x); } catch { y = NaN; }
    const ok = Number.isFinite(y) && y > lo && y < hi;
    if (ok && prev !== null && Math.abs(y - prev) > span * 1.5) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
    }
    if (ok) cur.push([r3(x), r3(y)]);
    else if (cur.length) {
      if (cur.length > 1) segs.push(cur);
      cur = [];
    }
    prev = ok ? y : null;
  }
  if (cur.length > 1) segs.push(cur);
  return segs;
}

function graphCurves(g) {
  return g.functions.map((f) => {
    if (!f.expr.trim()) return { segs: [], f };
    try {
      const fn = compileExpr(f.expr);
      const a = f.from !== '' && f.from != null ? Number(f.from) : g.xmin;
      const b = f.to !== '' && f.to != null ? Number(f.to) : g.xmax;
      return { segs: sampleFunction(fn, a, b, g.ymin, g.ymax), f, fn };
    } catch (err) {
      return { segs: [], f, error: err.message };
    }
  });
}

/** 曲線の名前を置く位置：表示範囲内に見えている最後の点（右端寄り）。上端に近ければ右、そうでなければ右上 */
function labelPoint(g, segs) {
  let best = null;
  for (const s of segs) {
    for (const [x, y] of s) {
      if (x >= g.xmin && x <= g.xmax && y >= g.ymin && y <= g.ymax) best = { x, y };
    }
  }
  if (!best) return null;
  const nearTop = best.y > g.ymax - (g.ymax - g.ymin) * 0.12;
  return { x: best.x, y: best.y, pos: nearTop ? 'right' : 'above right' };
}

export function figureErrors(spec) {
  if (spec.type !== 'graph') return [];
  return graphCurves(spec).map((c, i) => (c.error ? `関数 ${i + 1}: ${c.error}` : null)).filter(Boolean);
}

// ---------------- 図形（作図） ----------------
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
export function geoBounds(g) {
  const xs = [];
  const ys = [];
  for (const p of g.points) { xs.push(p.x); ys.push(p.y); }
  for (const c of g.circles) {
    const ctr = g.points.find((p) => p.id === c.c);
    const on = g.points.find((p) => p.id === c.p);
    if (!ctr || !on) continue;
    const r = dist(ctr, on);
    xs.push(ctr.x - r, ctr.x + r);
    ys.push(ctr.y - r, ctr.y + r);
  }
  if (!xs.length) return { xmin: 0, xmax: 6, ymin: 0, ymax: 4 };
  return { xmin: Math.min(...xs) - 0.6, xmax: Math.max(...xs) + 0.6, ymin: Math.min(...ys) - 0.6, ymax: Math.max(...ys) + 0.6 };
}

/** 点のラベルを、図の中心から外向きに置く */
export function autoAnchor(g, p) {
  if (p.pos && p.pos !== 'auto') return p.pos;
  const n = g.points.length || 1;
  const cx = g.points.reduce((s, q) => s + q.x, 0) / n;
  const cy = g.points.reduce((s, q) => s + q.y, 0) / n;
  const dx = p.x - cx;
  const dy = p.y - cy;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return 'above right';
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const dirs = ['right', 'above right', 'above', 'above left', 'left', 'below left', 'below', 'below right'];
  return dirs[(Math.round(ang / 45) + 8) % 8];
}

// ---------------- TikZ ----------------
const texLabel = (s) => (s || '').trim();

export function figureToTikz(spec) {
  if (spec.type === 'image') {
    const w = Math.max(5, Math.min(100, Number(spec.width) || 50)) / 100;
    const inc = `\\includegraphics[width=${w}\\linewidth]{${spec.file}}`;
    if (spec.align === 'left') return `\\noindent${inc}`;
    if (spec.align === 'right') return `\\hfill${inc}`;
    return `\\begin{center}\n  ${inc}\n\\end{center}`;
  }
  const L = [];
  if (spec.type === 'graph') {
    const g = spec;
    L.push('\\begin{center}');
    L.push(`\\begin{tikzpicture}[scale=${Number(g.scale)}, >=stealth]`);
    if (g.grid) L.push(`  \\draw[gray!35, very thin, step=1] (${g.xmin},${g.ymin}) grid (${g.xmax},${g.ymax});`);
    // 面積の塗りつぶし
    const curves = graphCurves(g);
    if (g.area && curves[g.area.fn]?.fn) {
      const fn = curves[g.area.fn].fn;
      const pts = sampleFunction(fn, Number(g.area.from), Number(g.area.to), g.ymin, g.ymax, 120).flat();
      if (pts.length > 1) {
        L.push(`  \\fill[gray!25] (${r3(Number(g.area.from))},0) -- ${pts.map(([x, y]) => `(${x},${y})`).join(' -- ')} -- (${r3(Number(g.area.to))},0) -- cycle;`);
      }
    }
    // 軸
    L.push(`  \\draw[->] (${g.xmin},0) -- (${g.xmax},0) node[right] {$${g.axisX || 'x'}$};`);
    L.push(`  \\draw[->] (0,${g.ymin}) -- (0,${g.ymax}) node[above] {$${g.axisY || 'y'}$};`);
    if (g.origin) L.push('  \\node[below left] at (0,0) {O};');
    if (g.ticks) {
      for (let i = Math.ceil(g.xmin); i <= Math.floor(g.xmax) - 1; i++) {
        if (i !== 0) L.push(`  \\draw (${i},0.08) -- (${i},-0.08) node[below] {\\scriptsize $${i}$};`);
      }
      for (let j = Math.ceil(g.ymin); j <= Math.floor(g.ymax) - 1; j++) {
        if (j !== 0) L.push(`  \\draw (0.08,${j}) -- (-0.08,${j}) node[left] {\\scriptsize $${j}$};`);
      }
    }
    // 曲線（はみ出しは切り取る）
    L.push('  \\begin{scope}');
    L.push(`    \\clip (${g.xmin},${g.ymin}) rectangle (${g.xmax},${g.ymax});`);
    curves.forEach(({ segs, f }) => {
      for (const s of segs) {
        L.push(`    \\draw[thick${f.dashed ? ', dashed' : ''}] ${s.map(([x, y]) => `(${x},${y})`).join(' -- ')};`);
      }
    });
    L.push('  \\end{scope}');
    // 曲線のラベル（右端付近）
    curves.forEach(({ segs, f }) => {
      if (!f.label || !segs.length) return;
      const lp = labelPoint(g, segs);
      if (lp) L.push(`  \\node[${lp.pos}] at (${lp.x},${lp.y}) {${texLabel(f.label)}};`);
    });
    // 点
    for (const p of g.points) {
      if (p.drop) L.push(`  \\draw[dashed] (${p.x},0) -- (${p.x},${p.y}) -- (0,${p.y});`);
      L.push(`  \\fill (${p.x},${p.y}) circle (1.4pt)${p.label ? ` node[${p.pos || 'above right'}] {${texLabel(p.label)}}` : ''};`);
    }
    L.push('\\end{tikzpicture}');
    L.push('\\end{center}');
    return L.join('\n');
  }
  // 図形
  const g = spec;
  const P = (id) => g.points.find((p) => p.id === id);
  L.push('\\begin{center}');
  L.push(`\\begin{tikzpicture}[scale=${Number(g.scale)}]`);
  if (g.grid) {
    const b = geoBounds(g);
    L.push(`  \\draw[gray!35, very thin, step=1] (${Math.floor(b.xmin)},${Math.floor(b.ymin)}) grid (${Math.ceil(b.xmax)},${Math.ceil(b.ymax)});`);
  }
  for (const p of g.points) L.push(`  \\coordinate (${p.id}) at (${r3(p.x)},${r3(p.y)});`);
  for (const s of g.segments) if (P(s.a) && P(s.b)) L.push(`  \\draw${s.dashed ? '[dashed]' : ''} (${s.a}) -- (${s.b});`);
  for (const c of g.circles) {
    const ctr = P(c.c);
    const on = P(c.p);
    if (ctr && on) L.push(`  \\draw${c.dashed ? '[dashed]' : ''} (${c.c}) circle (${r3(dist(ctr, on))});`);
  }
  for (const p of g.points) {
    const dot = p.dot !== false ? `\\fill (${p.id}) circle (1.2pt);` : '';
    const lab = p.label ? ` \\node[${autoAnchor(g, p)}] at (${p.id}) {${texLabel(p.label)}};` : '';
    if (dot || lab) L.push(`  ${dot}${lab}`);
  }
  L.push('\\end{tikzpicture}');
  L.push('\\end{center}');
  return L.join('\n');
}

/** ソースに入れる形（再編集用の JSON 付き） */
export function figureBlock(spec) {
  return `% @fig ${JSON.stringify(spec)}\n${figureToTikz(spec)}\n% @endfig`;
}

const FIG_RE = /% @fig (\{.*\})\n[\s\S]*?% @endfig/g;
export function findFigures(src) {
  const out = [];
  FIG_RE.lastIndex = 0;
  let m;
  while ((m = FIG_RE.exec(src))) {
    try {
      out.push({ from: m.index, to: m.index + m[0].length, spec: JSON.parse(m[1]) });
    } catch {
      /* 壊れた JSON は普通の TikZ として扱う */
    }
  }
  return out;
}

// ---------------- SVG（プレビュー） ----------------
const PX_PER_CM = 96 / 2.54;
let svgSeq = 0;
const escX = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function labelHtml(s) {
  const t = (s || '').trim();
  if (!t) return '';
  // $...$ を含めば数式、そうでなければそのまま
  return t.replace(/\$([^$]+)\$/g, (_m, tex) => katex.renderToString(tex, { throwOnError: false, strict: 'ignore' })).replace(/^([^<]*)$/, (m) => escX(m));
}

/** pos（TikZ のアンカー名）→ ラベルのずらし方 */
function anchorOffset(pos, w, h) {
  const d = 4;
  let x = -w / 2;
  let y = -h / 2;
  if (/right/.test(pos)) x = d;
  if (/left/.test(pos)) x = -w - d;
  if (/above/.test(pos)) y = -h - d;
  if (/below/.test(pos)) y = d;
  return [x, y];
}

function svgLabel(px, py, pos, html, size = 13) {
  const w = 120;
  const h = 26;
  // 幅が分からないので、foreignObject の中で寄せて配置する
  const [ox, oy] = anchorOffset(pos, w, h);
  const justify = /right/.test(pos) ? 'flex-start' : /left/.test(pos) ? 'flex-end' : 'center';
  const align = /above/.test(pos) ? 'flex-end' : /below/.test(pos) ? 'flex-start' : 'center';
  return `<foreignObject x="${px + ox}" y="${py + oy}" width="${w}" height="${h}" style="overflow:visible"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;display:flex;justify-content:${justify};align-items:${align};font-size:${size}px;font-family:var(--serif);white-space:nowrap;color:#1d1d1b">${html}</div></foreignObject>`;
}

/**
 * @param {object} spec
 * @param {{imageUrl?:string, interactive?:boolean}} opts
 */
export function figureToSvg(spec, opts = {}) {
  if (spec.type === 'image') {
    const w = Math.max(5, Math.min(100, Number(spec.width) || 50));
    const just = spec.align === 'left' ? 'flex-start' : spec.align === 'right' ? 'flex-end' : 'center';
    return opts.imageUrl
      ? `<div style="display:flex;justify-content:${just}"><img src="${escX(opts.imageUrl)}" style="width:${w}%" alt="${escX(spec.file)}"></div>`
      : `<div class="pv-placeholder">画像: ${escX(spec.file || '（未選択）')}</div>`;
  }
  const g = spec;
  const u = Number(g.scale) * PX_PER_CM; // 1 単位あたりの px
  const sid = `f${++svgSeq}`; // 図ごとに id を分ける（同じページに複数あっても衝突しない）
  let b;
  if (opts.bounds) b = opts.bounds;
  else if (g.type === 'graph') b = { xmin: g.xmin, xmax: g.xmax, ymin: g.ymin, ymax: g.ymax };
  else b = geoBounds(g);
  const pad = 30;
  const W = (b.xmax - b.xmin) * u + pad * 2;
  const H = (b.ymax - b.ymin) * u + pad * 2;
  const X = (x) => r3(pad + (x - b.xmin) * u);
  const Y = (y) => r3(pad + (b.ymax - y) * u);
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" class="fig-svg" width="${r3(W)}" height="${r3(H)}" viewBox="0 0 ${r3(W)} ${r3(H)}" data-u="${u}" data-xmin="${b.xmin}" data-ymax="${b.ymax}" data-pad="${pad}">`);
  parts.push(`<defs><marker id="${sid}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1d1d1b"/></marker></defs>`);
  const stroke = 'stroke="#1d1d1b" fill="none"';

  if (g.grid || opts.showGrid) {
    const gx0 = Math.ceil(b.xmin);
    const gy0 = Math.ceil(b.ymin);
    for (let x = gx0; x <= b.xmax; x++) parts.push(`<line x1="${X(x)}" y1="${Y(b.ymin)}" x2="${X(x)}" y2="${Y(b.ymax)}" stroke="#ddd" stroke-width="0.6"/>`);
    for (let y = gy0; y <= b.ymax; y++) parts.push(`<line x1="${X(b.xmin)}" y1="${Y(y)}" x2="${X(b.xmax)}" y2="${Y(y)}" stroke="#ddd" stroke-width="0.6"/>`);
  }

  if (g.type === 'graph') {
    const curves = graphCurves(g);
    if (g.area && curves[g.area.fn]?.fn) {
      const pts = sampleFunction(curves[g.area.fn].fn, Number(g.area.from), Number(g.area.to), g.ymin, g.ymax, 120).flat();
      if (pts.length > 1) {
        const d = `M${X(Number(g.area.from))},${Y(0)} ` + pts.map(([x, y]) => `L${X(x)},${Y(y)}`).join(' ') + ` L${X(Number(g.area.to))},${Y(0)} Z`;
        parts.push(`<path d="${d}" fill="#d9d9d6"/>`);
      }
    }
    parts.push(`<line x1="${X(g.xmin)}" y1="${Y(0)}" x2="${X(g.xmax)}" y2="${Y(0)}" ${stroke} stroke-width="1" marker-end="url(#${sid}-arrow)"/>`);
    parts.push(`<line x1="${X(0)}" y1="${Y(g.ymin)}" x2="${X(0)}" y2="${Y(g.ymax)}" ${stroke} stroke-width="1" marker-end="url(#${sid}-arrow)"/>`);
    parts.push(svgLabel(X(g.xmax), Y(0), 'right', labelHtml(`$${g.axisX || 'x'}$`)));
    parts.push(svgLabel(X(0), Y(g.ymax), 'above', labelHtml(`$${g.axisY || 'y'}$`)));
    if (g.origin) parts.push(svgLabel(X(0), Y(0), 'below left', 'O'));
    if (g.ticks) {
      for (let i = Math.ceil(g.xmin); i <= Math.floor(g.xmax) - 1; i++) {
        if (!i) continue;
        parts.push(`<line x1="${X(i)}" y1="${Y(0) - 3}" x2="${X(i)}" y2="${Y(0) + 3}" ${stroke}/>`);
        parts.push(svgLabel(X(i), Y(0) + 3, 'below', labelHtml(`$${i}$`), 10));
      }
      for (let j = Math.ceil(g.ymin); j <= Math.floor(g.ymax) - 1; j++) {
        if (!j) continue;
        parts.push(`<line x1="${X(0) - 3}" y1="${Y(j)}" x2="${X(0) + 3}" y2="${Y(j)}" ${stroke}/>`);
        parts.push(svgLabel(X(0) - 3, Y(j), 'left', labelHtml(`$${j}$`), 10));
      }
    }
    parts.push(`<clipPath id="${sid}-clip"><rect x="${X(g.xmin)}" y="${Y(g.ymax)}" width="${(g.xmax - g.xmin) * u}" height="${(g.ymax - g.ymin) * u}"/></clipPath>`);
    curves.forEach(({ segs, f }) => {
      for (const s of segs) {
        parts.push(`<polyline clip-path="url(#${sid}-clip)" points="${s.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')}" ${stroke} stroke-width="1.6"${f.dashed ? ' stroke-dasharray="5 4"' : ''}/>`);
      }
      if (f.label && segs.length) {
        const lp = labelPoint(g, segs);
        if (lp) parts.push(svgLabel(X(lp.x), Y(lp.y), lp.pos, labelHtml(f.label)));
      }
    });
    g.points.forEach((p, i) => {
      if (p.drop) parts.push(`<polyline points="${X(p.x)},${Y(0)} ${X(p.x)},${Y(p.y)} ${X(0)},${Y(p.y)}" ${stroke} stroke-dasharray="4 3"/>`);
      parts.push(`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${opts.interactive ? 5 : 2.6}" fill="#1d1d1b" data-pt="${i}" class="${opts.interactive ? 'fig-handle' : ''}"/>`);
      if (p.label) parts.push(svgLabel(X(p.x), Y(p.y), p.pos || 'above right', labelHtml(p.label)));
    });
  } else {
    const P = (id) => g.points.find((p) => p.id === id);
    for (const c of g.circles) {
      const ctr = P(c.c);
      const on = P(c.p);
      if (ctr && on) parts.push(`<circle cx="${X(ctr.x)}" cy="${Y(ctr.y)}" r="${r3(dist(ctr, on) * u)}" ${stroke} stroke-width="1.2"${c.dashed ? ' stroke-dasharray="5 4"' : ''} data-circle="${escX(c.c)}"/>`);
    }
    g.segments.forEach((s, i) => {
      const a = P(s.a);
      const bb = P(s.b);
      if (a && bb) parts.push(`<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(bb.x)}" y2="${Y(bb.y)}" ${stroke} stroke-width="1.2"${s.dashed ? ' stroke-dasharray="5 4"' : ''} data-seg="${i}"/>`);
    });
    for (const p of g.points) {
      if (p.dot !== false || opts.interactive) parts.push(`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${opts.interactive ? 5 : 2.2}" fill="${p.dot === false ? '#bbb' : '#1d1d1b'}" data-pid="${escX(p.id)}" class="${opts.interactive ? 'fig-handle' : ''}"/>`);
      if (p.label) parts.push(svgLabel(X(p.x), Y(p.y), autoAnchor(g, p), labelHtml(p.label)));
    }
  }
  parts.push('</svg>');
  return parts.join('');
}
