// LaTeX（問題文）→ HTML プレビュー。数式は KaTeX、文章部分はよく使う命令だけを簡易変換する。
import katex from 'katex';
import { SCIENCE_MACROS, normalizeNumbers } from './chem.js'; // \ce{…}（化学式, mhchem）・単位のマクロ
import { findMathRanges, maskComments } from './mathRanges.js';
import { normalizeLayout, paperSize, headNumberHtml, headStyleCss, bodyPt, pointsText, applyPunct, pageMargins, defaultCover, coverPositions, COVER_NUMBERS } from './layout.js';
import { findFigures, figureToSvg } from './figure.js';
import { coverNotes, coverNoteItems } from './texExport.js';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export { SCIENCE_MACROS };

/** プリアンブルの \newcommand / \DeclareMathOperator を KaTeX のマクロに変換 */
export function collectMacros(preamble = '') {
  // アプリの書式ボタンが使う色の命令（PDF 側はプリアンブルで \textcolor[HTML] として定義）
  const macros = { '\\lpecolor': '\\textcolor{###1}{#2}', ...SCIENCE_MACROS };
  const src = maskComments(preamble);
  const readGroup = (s, i) => {
    while (s[i] === ' ' || s[i] === '\n') i++;
    if (s[i] !== '{') return null;
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}' && --depth === 0) return { text: s.slice(i + 1, j), end: j + 1 };
    }
    return null;
  };
  const re = /\\(?:re|provide)?newcommand\*?\s*\{?\s*\\([a-zA-Z]+)\s*\}?\s*(?:\[\d\])?\s*(?:\[[^\]]*\])?/g;
  let m;
  while ((m = re.exec(src))) {
    const g = readGroup(src, re.lastIndex);
    if (g) macros[`\\${m[1]}`] = g.text;
  }
  const op = /\\DeclareMathOperator(\*?)\s*\{?\s*\\([a-zA-Z]+)\s*\}?/g;
  while ((m = op.exec(src))) {
    const g = readGroup(src, op.lastIndex);
    if (g) macros[`\\${m[2]}`] = `\\operatorname${m[1]}{${g.text}}`;
  }
  return macros;
}

export function renderMath(latex, display, macros = {}) {
  return katex.renderToString(normalizeNumbers(latex), {
    displayMode: display,
    throwOnError: false,
    strict: 'ignore',
    trust: false,
    macros: { ...macros },
  });
}

const SIZE_EM = { tiny: 0.5, scriptsize: 0.7, footnotesize: 0.8, small: 0.9, large: 1.2, Large: 1.44, LARGE: 1.73, huge: 2.07 };

const LIST_ENVS = 'itemize|enumerate|description|center|flushright|flushleft|quote';

function enumClass(opt = '') {
  if (/\\alph|\(a\)|\ba\)/.test(opt)) return 'en-alpha';
  if (/\\roman|\(i\)/.test(opt)) return 'en-roman';
  if (/\\arabic|\(1\)|1\)/.test(opt)) return 'en-paren';
  if (/\\textcircled|①/.test(opt)) return 'en-circle';
  return 'en-decimal';
}

function convertTabular(body) {
  const rows = body
    .split(/\\\\/)
    .map((r) => r.replace(/\\hline|\\cline\{[^}]*\}/g, '').trim())
    .filter(Boolean);
  return (
    '<table class="pv-table">' +
    rows.map((r) => '<tr>' + r.split('&amp;').map((c) => `<td>${c.trim()}</td>`).join('') + '</tr>').join('') +
    '</table>'
  );
}

function textToHtml(s) {
  // 図・TikZ は PDF でのみ表示
  s = s.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, '\u0003TIKZ\u0003');
  s = s.replace(/\\includegraphics\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g, (_m, f) => `\u0003IMG:${f}\u0003`);
  // 大問の中の「部」（\Part, \Part[A]）は新しい段落にする。番号の形はプリント全体の CSS（part-…）で決まる
  s = s.replace(/\\Part(?![a-zA-Z])\s*(?:\[([^\]]*)\])?/g, (_m, lab) => `\n\n\u0006P${lab == null ? '' : encodeURIComponent(lab)}\u0006`);
  // 空欄 \blank{ア}。\blank*{コ} は二重の枠（選択肢から選ぶ空欄）、\blank[2]{ア} は 2 度目以降（細い枠）
  for (let k = 0; k < 3; k++) {
    s = s.replace(/\\blank(\*?)\s*(?:\[([^\]]*)\])?\s*\{([^{}]*)\}/g, (_m, st, opt, t) => `\u0006B${st ? 'd' : ''}${(opt || '').trim() === '2' ? 't' : ''}\u0008${t}\u0007`);
  }

  s = esc(s);
  s = s
    .replace(/\u0006P([^\u0006]*)\u0006/g, (_m, lab) => `<span class="pv-part"${lab ? ` data-label="${esc(decodeURIComponent(lab))}"` : ''}></span>`)
    .replace(/\u0006B([dt]*)\u0008([^\u0007]*)\u0007/g, (_m, f, t) => `<span class="pv-blank${f.includes('d') ? ' dbl' : ''}${f.includes('t') ? ' again' : ''}">${t}</span>`);
  // エスケープ文字
  s = s
    .replace(/\\\{/g, '&#123;')
    .replace(/\\\}/g, '&#125;')
    .replace(/\\%/g, '%')
    .replace(/\\&amp;/g, '&amp;amp;')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_')
    .replace(/\\\$/g, '$')
    .replace(/\\textbackslash(\{\})?/g, '&#92;');

  // tabular
  s = s.replace(/\\begin\{tabular\}\s*\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g, (_m, body) => convertTabular(body));
  s = s.replace(/&amp;amp;/g, '&amp;');

  // 見出し
  s = s.replace(/\\(sub)?section\*?\{([^{}]*)\}/g, (_m, sub, t) => (sub ? `<h4>${t}</h4>` : `<h3>${t}</h3>`));

  // 文字装飾（入れ子に対応するため変化がなくなるまで繰り返す）
  const deco = {
    textbf: (t) => `<b>${t}</b>`,
    textit: (t) => `<i>${t}</i>`,
    emph: (t) => `<em>${t}</em>`,
    underline: (t) => `<u>${t}</u>`,
    texttt: (t) => `<code>${t}</code>`,
    textrm: (t) => t,
    textsf: (t) => `<span class="sf">${t}</span>`,
    fbox: (t) => `<span class="fbox">${t}</span>`,
    mbox: (t) => t,
    ruby: (t) => t,
  };
  for (let k = 0; k < 10; k++) {
    const before = s;
    s = s.replace(/\\(textbf|textit|emph|underline|texttt|textrm|textsf|fbox|mbox)\s*\{([^{}]*)\}/g, (_m, c, t) => deco[c](t));
    s = s.replace(/\\textcolor\{([a-zA-Z]+)\}\{([^{}]*)\}/g, (_m, c, t) => `<span style="color:${c}">${t}</span>`);
    s = s.replace(/\\(?:textcolor\[HTML\]|lpecolor)\{([0-9a-fA-F]{6})\}\{([^{}]*)\}/g, (_m, c, t) => `<span style="color:#${c}">${t}</span>`);
    s = s.replace(/\{\\(tiny|scriptsize|footnotesize|small|large|Large|LARGE|huge)\s+([^{}]*)\}/g, (_m, c, t) => `<span style="font-size:${SIZE_EM[c]}em">${t}</span>`);
    s = s.replace(/\\ruby\{([^{}]*)\}\{([^{}]*)\}/g, (_m, b, r) => `<ruby>${b}<rt>${r}</rt></ruby>`);
    if (s === before) break;
  }

  // 空白・改行系
  s = s
    .replace(/\\\\(\[[^\]]*\])?/g, '<br>')
    .replace(/\\qquad\b/g, '  ')
    .replace(/\\quad\b/g, ' ')
    .replace(/\\[,;: ]/g, ' ')
    .replace(/~/g, ' ')
    .replace(/\\hfill\b/g, '<span class="hfill"></span>')
    .replace(/\\[vh]space\*?\{[^}]*\}/g, '<span class="vspace"></span>')
    .replace(/\\(small|med|big)skip\b/g, '<span class="vspace"></span>')
    .replace(/\\(newpage|clearpage)\b/g, '<hr class="pagebreak">')
    .replace(/\\(noindent|centering|par|indent|maketitle)\b/g, (m, c) => (c === 'par' ? '\n\n' : ''))
    .replace(/\\(tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge|bfseries|itshape|rmfamily|sffamily)\b/g, '')
    .replace(/``/g, '“')
    .replace(/''/g, '”');

  // リスト・中央揃えなど
  const tokRe = new RegExp(`(\\\\begin\\{(?:${LIST_ENVS})\\}(?:\\[[^\\]]*\\])?|\\\\end\\{(?:${LIST_ENVS})\\}|\\\\item(?:\\[[^\\]]*\\])?)`);
  const parts = s.split(tokRe);
  const stack = [];
  let html = '';
  for (const p of parts) {
    let m;
    if ((m = p.match(/^\\begin\{(\w+)\}(?:\[([^\]]*)\])?$/))) {
      const env = m[1];
      stack.push({ env, open: false });
      if (env === 'itemize') html += '<ul>';
      else if (env === 'enumerate') html += `<ol class="${enumClass(m[2])}">`;
      else if (env === 'description') html += '<dl>';
      else html += `<div class="env-${env}">`;
    } else if ((m = p.match(/^\\end\{(\w+)\}$/))) {
      const top = stack.pop();
      if (!top) continue;
      if (top.open) html += top.env === 'description' ? '</dd>' : '</li>';
      html += top.env === 'itemize' ? '</ul>' : top.env === 'enumerate' ? '</ol>' : top.env === 'description' ? '</dl>' : '</div>';
    } else if ((m = p.match(/^\\item(?:\[([^\]]*)\])?$/))) {
      const top = stack[stack.length - 1];
      if (!top) continue;
      if (top.open) html += top.env === 'description' ? '</dd>' : '</li>';
      top.open = true;
      if (top.env === 'description') html += `<dt>${m[1] ?? ''}</dt><dd>`;
      else if (m[1] !== undefined) html += `<li class="li-custom"><span class="li-label">${m[1]}</span>`;
      else html += '<li>';
    } else {
      // \begin{enumerate}\setcounter{enumi}{k} → (k+1) から番号を始める
      const sc = p.match(/^\s*\\setcounter\{enumi\}\{(\d+)\}/);
      if (sc && /<ol class="[^"]*">$/.test(html)) {
        const k = Number(sc[1]);
        html = html.replace(/<ol class="([^"]*)">$/, `<ol class="$1" start="${k + 1}" style="counter-reset: en ${k}">`);
        html += p.slice(sc[0].length);
        continue;
      }
      html += p;
    }
  }
  while (stack.length) {
    const top = stack.pop();
    if (top.open) html += '</li>';
    html += top.env === 'itemize' ? '</ul>' : top.env === 'enumerate' ? '</ol>' : '</div>';
  }

  // 未対応の命令は控えめに表示、余った波括弧は除去
  html = html.replace(/\\([a-zA-Z]+)\*?/g, '<span class="pv-unknown">\\$1</span>').replace(/[{}]/g, '');

  // 改行の扱い：日本語同士の改行は詰め、それ以外は空白
  html = html.replace(/([　-鿿＀-￯])\n[ \t]*(?=[　-鿿＀-￯])/g, '$1');
  const paras = html
    .split(/\n[ \t]*\n+/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean);
  // 部（\Part）から次の部までを 1 つのまとまりにする（部の中身全体を字下げするテーマで使う）
  let partOpen = false;
  html =
    paras
      .map((p) => {
        let pre = '';
        if (p.startsWith('<span class="pv-part"')) {
          pre = `${partOpen ? '</div>' : ''}<div class="pv-partbody">`;
          partOpen = true;
        }
        return `${pre}<div class="pv-par">${p}</div>`;
      })
      .join('') + (partOpen ? '</div>' : '');

  return html
    .replace(/\u0003TIKZ\u0003/g, '<div class="pv-placeholder">TikZ の図（PDF 出力で表示されます）</div>')
    .replace(/\u0003IMG:([^\u0003]*)\u0003/g, (_m, f) => `<div class="pv-placeholder">画像: ${f}（PDF 出力で表示されます）</div>`);
}

/**
 * @param {string} src LaTeX
 * @param {object} macros KaTeX マクロ
 * @param {{field?:string}} opts field を渡すと数式に data 属性を付け、ダブルクリック編集に使う
 */
export function renderLatex(src, macros = {}, opts = {}) {
  if (!src || !src.trim()) return '<div class="pv-empty">（未入力）</div>';
  // 図（% @fig … % @endfig）は同じ長さの目印に置き換えてから処理し、最後に SVG を差し込む
  const figs = findFigures(src);
  let work = src;
  for (let k = figs.length - 1; k >= 0; k--) {
    const f = figs[k];
    const mark = `\u0005${k}\u0005`;
    work = work.slice(0, f.from) + mark + ' '.repeat(Math.max(0, f.to - f.from - mark.length)) + work.slice(f.to);
  }
  src = work;
  const masked = maskComments(src);
  const ranges = findMathRanges(src);
  const maths = [];
  let joined = '';
  let last = 0;
  for (const r of ranges) {
    joined += masked.slice(last, r.from) + `\u0001${maths.length}\u0002`;
    let h = renderMath(r.latex, r.display, macros);
    // 化学式・単位（\ce など）は数式エディタでは編集できないので、ダブルクリックの対象にしない
    if (opts.field && r.kind !== 'cmd') {
      h = `<span class="pv-math${r.display ? ' pv-display' : ''}" data-field="${opts.field}" data-from="${r.from}" title="ダブルクリックで数式エディタ / 右クリックで Word 用にコピー">${h}</span>`;
    }
    maths.push(h);
    last = r.to;
  }
  joined += masked.slice(last);
  return textToHtml(joined)
    .replace(/\u0001(\d+)\u0002/g, (_m, i) => maths[Number(i)])
    .replace(/\u0005(\d+)\u0005/g, (_m, k) => {
      const f = figs[Number(k)];
      const svg = figureToSvg(f.spec, { imageUrl: f.spec.type === 'image' ? imageResolver?.(f.spec.file) : undefined });
      const attrs = opts.field ? ` data-field="${opts.field}" data-from="${f.from}" title="ダブルクリックで図を編集"` : '';
      return `<div class="pv-fig"${attrs}>${svg}</div>`;
    });
}

// 画像ファイル → 表示用 URL（main.js から設定。未取得なら null を返し、取得後に再描画させる）
let imageResolver = null;
export function setImageResolver(fn) {
  imageResolver = fn;
}

export function renderInline(src, macros) {
  return `<span class="inline-latex">${renderLatex(src, macros)}</span>`;
}

/**
 * 問題文の中身の見た目（小問番号・部・空欄）をレイアウトに合わせるためのクラスと CSS 変数。
 * プリント全体だけでなく、「この問題」のプレビューや貼り付けダイアログのプレビューにも使う。
 */
export function contentStyle(layout) {
  const l = normalizeLayout(layout);
  const pa = l.part;
  const bl = l.blank;
  const classes = [
    `sub-${l.subLabel}`,
    l.sub.paren === 'full' ? 'sub-full' : '',
    `part-${pa.style}`,
    pa.hang ? 'part-hang' : pa.align === 'center' ? 'part-center' : pa.inline ? 'part-inline' : '',
    `blank-${bl.style}`,
    l.sub2?.label ? `sub2-${l.sub2.label}` : '',
    l.sub2?.label && l.sub2.wrap === 'left' ? 'sub2-wrapleft' : '',
  ].filter(Boolean);
  const s2 = l.sub2 || {};
  const vars =
    `--part-font:${pa.font === 'mincho' ? 'var(--serif)' : 'var(--sans)'};--part-weight:${pa.bold ? 700 : 400};--part-size:${Number(pa.size) > 0 ? `${Number(pa.size)}pt` : '1em'}` +
    `;--part-indent:${Number(pa.indent) || 0}mm;--part-gap:${Number(pa.gap) || 0}mm;--part-sb:${Number(pa.spaceBefore) || 0}mm;--part-sa:${Number(pa.spaceAfter) || 0}mm` +
    `;--part-body:${Number(pa.bodyIndent) || 0}mm` +
    `;--blank-w:${Number(bl.width) || 0}mm${Number(bl.height) > 0 ? `;--blank-h:${Number(bl.height)}mm` : ''}` +
    (s2.label ? `;--sub2-indent:${Number(s2.indent) || 0}mm;--sub2-sep:${Number(s2.sep) || 0}mm;--sub2-gap:${Number(s2.gap) || 0}mm;--sub2-wrap:${Number(s2.wrapIndent) || 0}mm` : '');
  return { classes, vars };
}

/** ページ上部に小さく入れる文字の書体・大きさ */
function runheadStyle(l) {
  const css = [];
  if (Number(l.headerSize) > 0) css.push(`font-size:${Number(l.headerSize)}pt`);
  if (l.headerFont === 'gothic') css.push('font-family:var(--sans);color:inherit');
  return css.length ? ` style="${css.join(';')}"` : '';
}

/**
 * 1 ページ目に大きく入れる見出し。title.size を指定したテーマでは、見出し・小さな行・最初の大問の見出しを
 * PDF と同じベースライン（用紙の上端から mm）に近づけて置く
 */
function titleHtml(l, top, head) {
  const t = l.title || {};
  if (!(Number(t.size) > 0)) return `<div class="sh-titlehead">${esc(l.header)}</div>`;
  const mm = (pt) => pt * PT_MM;
  const fam = t.font === 'mincho' ? 'var(--serif)' : 'var(--sans)';
  const sz = Number(t.size);
  const B = Number(t.baseline) > 0 ? Number(t.baseline) : top + 8;
  let h = `<div class="sh-titlehead sized" style="font-family:${fam};font-weight:${t.bold ? 700 : 400};font-size:${sz}pt;line-height:1;margin:${Math.max(0, B - top - 0.88 * mm(sz)).toFixed(2)}mm 0 0">${esc(l.header)}</div>`;
  let last = B;
  let lastSz = sz;
  if (t.sub) {
    const ss = Number(t.subSize) || 12;
    const SB = Number(t.subBaseline) > 0 ? Number(t.subBaseline) : B + ss * 0.6;
    h += `<div class="sh-titlehead sized" style="font-family:${fam};font-weight:400;font-size:${ss}pt;line-height:1;margin:${Math.max(0, SB - 0.88 * mm(ss) - B - 0.12 * mm(sz)).toFixed(2)}mm 0 0">${esc(t.sub)}</div>`;
    last = SB;
    lastSz = ss;
  }
  // 次の行（最初の大問の見出し）までの空き（見出しの行の高さの分を引いた概算。大問の前の空きは別に入る）
  const next = Number(t.next) > 0 ? Number(t.next) : last + 12;
  const hs = mm(Number(head?.size) || 13);
  h += `<div style="height:${Math.max(0, next - last - 0.12 * mm(lastSz) - hs * 1.05 - (Number(l.spaceBefore) || 0)).toFixed(2)}mm"></div>`;
  return h;
}

const stars = (n) => (n > 0 ? `<span class="sh-stars">難易度 ${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>` : '');

/**
 * プリント全体の HTML。用紙サイズ・余白・見出しを mm / pt 単位で描くので、PDF とほぼ同じ見た目になる。
 * @param {{interactive?:boolean}} opts interactive のとき解答スペースのドラッグ用ハンドルを付ける
 */
export function renderSheet(doc, macros, opts = {}) {
  const m = doc.meta;
  const l = normalizeLayout(m.layout);
  const h = l.head;
  const ps = doc.problems;
  const { w, h: paperH } = paperSize(l);
  const headCss = headStyleCss(h);
  const pt = bodyPt(l, parseInt(m.fontSize, 10) || 11);
  const lineHeight = Number(l.lineHeight) > 0 ? Number(l.lineHeight) : 1.75 * l.lineSpread;
  const punct = (t) => applyPunct(t, l, findMathRanges);

  // 1 行の文字数が決まっていれば、本文幅＝文字数×文字サイズにして左右中央に置く（PDF と同じ）
  const chars = Number(l.charsPerLine) || 0;
  const textW = chars > 0 ? chars * pt * PT_MM : null;
  const padX = textW ? Math.max(5, (w - textW) / 2) : Number(l.margin);

  const s = l.sub;
  const cls = [
    'sheet page',
    s.wrap === 'left' ? 'sub-wrapleft' : '',
    l.parIndent ? 'parindent' : '',
    l.displayAlign === 'left' ? 'fleqn' : '',
    m.columns === 2 ? 'cols-2' : '',
    ...contentStyle(l).classes,
  ].filter(Boolean).join(' ');
  const vars =
    `--sub-indent:${Number(s.indent)}mm;--sub-sep:${Number(s.sep)}mm;--sub-gap:${Number(s.gap)}mm;--sub-wrap:${Number(s.wrapIndent) || 0}mm;--math-indent:${Number(l.mathIndent)}mm;--par-skip:${Number(l.parSkip)}mm;` +
    (Number(l.displaySkip) > 0 ? `--disp-above:${Number(l.displaySkipAbove) > 0 ? Number(l.displaySkipAbove) : Number(l.displaySkip)}mm;--disp-below:${Number(l.displaySkip)}mm;` : '') +
    contentStyle(l).vars;
  // 上下左右の余白（個別指定があればそれを使う。PDF と同じ考え方）
  const pm = pageMargins(l);
  const padL = pm.left ?? padX;
  const padR = pm.right ?? padX;
  const ls = Number(l.letterSpace) > 0 ? `;--letter-space:${Number(l.letterSpace)}em` : '';
  let out = `<div class="${cls}" style="width:${w}mm;padding:${pm.top}mm ${Number(padR).toFixed(2)}mm ${pm.bottom}mm ${Number(padL).toFixed(2)}mm;font-size:${pt}pt;line-height:${lineHeight.toFixed(2)};${vars}${ls}">`;
  if (l.header) {
    if (l.headerStyle === 'title' || l.headerStyle === 'both') out += titleHtml(l, pm.top, h);
    else out += `<div class="sh-runhead${l.headerAlign === 'outside' ? ' outside' : ''}"${runheadStyle(l)}>${esc(l.header)}</div>`;
  }
  if (l.titleBlock !== false && (m.title || m.subtitle || m.author || m.date || m.nameField)) {
    out += '<header class="sh-header">';
    if (m.title) out += `<h1>${renderInline(m.title, macros)}</h1>`;
    if (m.subtitle) out += `<div class="sh-sub">${renderInline(m.subtitle, macros)}</div>`;
    if (m.author || m.date) out += `<div class="sh-meta"><span>${esc(m.author || '')}</span><span>${esc(m.date || '')}</span></div>`;
    if (m.nameField) out += '<div class="sh-name">組＿＿＿　番＿＿＿　氏名＿＿＿＿＿＿＿＿＿＿＿＿</div>';
    out += '</header>';
  }
  out += '<div class="sh-problems">';
  ps.forEach((p, i) => {
    const pl = { pageBreakBefore: false, answerSpace: null, frame: null, ...(p.layout || {}) };
    const n = i + 1;
    const brk = i > 0 && (pl.pageBreakBefore || l.newPageEach);
    if (brk) out += '<div class="sh-pagebreak"><span>改ページ</span></div>';
    else if (i > 0 && l.rule) out += '<hr class="sh-rule">';
    const frame = pl.frame ?? l.frame;
    const hanging = h.position === 'hanging';
    const gapMm = Number(h.gap ?? 3);
    // ぶら下げ幅は「字下げ設定」と「見出し番号の幅＋空き」の大きい方（PDF 側と同じ考え方）
    // 列の間の空き（gapMm）も字下げ幅に含める（PDF 側は「字下げ幅」と「番号の幅＋空き」の大きい方）
    const hangCol = `minmax(${Math.max(0, Number(l.bodyIndent) - gapMm)}mm, max-content)`;
    out += `<section class="sh-problem${frame ? ' framed' : ''}${hanging ? ' hanging' : ''}${brk ? ' brk' : ''}" data-index="${i}" style="margin-top:${l.spaceBefore}mm${hanging ? `;grid-template-columns:${hangCol} 1fr;column-gap:${gapMm}mm` : ''}">`;
    const num = `<span class="sh-num" style="${headCss}${hanging ? '' : `;margin-right:${gapMm}mm`}" data-index="${i}" title="クリックでレイアウト設定">${headNumberHtml(h, n)}</span>`;
    const title = h.showTitle && p.title ? `<span class="sh-title" style="${headCss};margin-right:${gapMm}mm">${renderInline(p.title, macros)}</span>` : '';
    const st = m.showDifficulty ? stars(p.difficulty) : '';
    const ptsText = pointsText(l, p.points);
    const ptsRight = ptsText && l.pointsStyle === 'right' && h.position === 'above' ? `<span class="sh-points right">${esc(ptsText)}</span>` : '';
    const ptsAfter = ptsText && (l.pointsStyle === 'after' || (l.pointsStyle === 'right' && h.position !== 'above')) ? `<span class="sh-points" style="margin-right:${gapMm}mm">${esc(ptsText)}</span>` : '';
    const bodySrc = punct(p.body) + (ptsText && l.pointsStyle === 'bodyEnd' ? ` ${ptsText}` : '');
    const body = `<div class="sh-body">${renderLatex(bodySrc, macros)}</div>`;
    let answer = '';
    if (m.answerMode === 'after' && p.solution.trim()) answer = `<div class="sh-answer"><b>【解答】</b>${renderLatex(punct(p.solution), macros)}</div>`;
    const space = Number(pl.answerSpace ?? m.spaceAfter) || 0;
    const spaceEl = opts.interactive
      ? `<div class="sh-space" data-index="${i}" style="height:${space}mm"><div class="sh-handle" data-index="${i}" title="上下にドラッグして解答スペースを調整（ダブルクリックで全体設定に戻す）">⇕ 解答スペース ${space}mm${pl.answerSpace == null ? '（全体設定）' : ''}</div></div>`
      : space > 0
        ? `<div style="height:${space}mm"></div>`
        : '';
    if (h.position === 'inline') {
      // 番号の直後から本文。2 行目以降は左端に戻る
      const od = Number(h.outdent) > 0 ? Number(h.outdent) : 0;
      // 番号を本文の左端より外（余白側）に張り出す
      const fl = (x, c) => x.replace(`class="${c}"`, `class="${c} sh-float"${c === 'sh-num' && od ? ` data-outdent="${od}"` : ''}`).replace(c === 'sh-num' && od ? 'style="' : '\u0000', `style="margin-left:-${od}mm;`);
      out += `<div class="sh-inline">${fl(num, 'sh-num')}${title ? fl(title, 'sh-title') : ''}${ptsAfter ? fl(ptsAfter, 'sh-points') : ''}${body}${answer}</div>${spaceEl}`;
    } else if (hanging) {
      out += `<div class="sh-hcol">${num}</div><div>${title || st || ptsAfter ? `<div class="sh-head" style="margin-bottom:${l.spaceAfterHead}mm">${title}${ptsAfter}${st}</div>` : ''}${body}${answer}${spaceEl}</div>`;
    } else {
      const center = h.align === 'center';
      const od = !center && Number(h.outdent) > 0 ? `;margin-left:-${Number(h.outdent)}mm` : '';
      out += `<div class="sh-head${center ? ' center' : ''}" style="margin-bottom:${l.spaceAfterHead}mm${od}">${num}${title}${ptsAfter}${ptsRight}${st}</div>`;
      out += `<div style="margin-left:${l.bodyIndent}mm">${body}${answer}</div>${spaceEl}`;
    }
    out += '</section>';
    if (l.afterEach === 'blank') out += '<div class="sh-pagebreak"><span>改ページ（白紙のページ）</span></div>';
    else if (l.afterEach === 'draft') {
      const pages = Math.max(1, Math.min(6, Math.round(Number(l.draftPages) || 1)));
      out += `<div class="sh-pagebreak"><span>改ページ（${esc(l.draftText || '下書き用紙')}${pages > 1 ? ` × ${pages} ページ` : ''}）</span></div>`;
    }
  });
  out += '</div>';
  if (l.endText) out += `<div class="sh-endtext">${esc(l.endText)}</div>`;
  if ((m.answerMode === 'end' || m.answerMode === 'separate') && ps.some((p) => p.solution.trim())) {
    out += `<div class="sh-answers${m.answerMode === 'separate' ? ' separate' : ''}">`;
    if (m.answerMode === 'separate') out += '<div class="sh-pagebreak"><span>改ページ</span></div>';
    out += '<h2>解答</h2>';
    ps.forEach((p, i) => {
      if (!p.solution.trim()) return;
      out += `<section class="sh-problem"><div class="sh-head"><span class="sh-num" style="${headCss}">${headNumberHtml(h, i + 1)}</span>${p.title ? `<span class="sh-title">${renderInline(p.title, macros)}</span>` : ''}</div><div class="sh-body">${renderLatex(punct(p.solution), macros)}</div></section>`;
    });
    out += '</div>';
  }
  // 表紙は別のページとして先頭に、裏表紙（解答上の注意）は最後のページとして置く
  const c = m.cover?.enabled ? { ...defaultCover(), ...m.cover } : null;
  const pageStyle = `width:${w}mm;min-height:${paperH}mm;height:${paperH}mm;padding:${pm.top}mm ${Number(padR).toFixed(2)}mm ${pm.bottom}mm ${Number(padL).toFixed(2)}mm;font-size:${pt}pt`;
  const geo = { top: pm.top, left: Number(padL), right: Number(padR), bottom: pm.bottom, w, h: paperH, footBaseline: Number(l.footBaseline) || 0, pageNumber: l.pageNumber };
  const cover = c ? coverPage(c, ps.length, pageStyle, punct, macros, geo) : '';
  const back = c && coverNotes({ notes: c.backNotes }, ps.length).length ? backCoverPage(c, ps.length, pageStyle, punct, macros, geo) : '';
  return cover + out + '</div>' + back;
}

const PT_MM = 25.4 / 72.27;
const mmOf = (pt) => pt * PT_MM;

/** 用紙の上端からのベースライン B（mm）に文字を置く（ページの中での絶対位置） */
function cvAt(B, sizePt, html, { align = 'center', left, right, family, weight = 400, x } = {}, geo) {
  const top = (B - 0.88 * mmOf(sizePt)).toFixed(2);
  const lr = x != null ? `left:${(geo.left + x).toFixed(2)}mm` : `left:${(left ?? geo.left).toFixed(2)}mm;right:${(right ?? geo.right).toFixed(2)}mm`;
  return `<div class="cv-abs" style="top:${top}mm;${lr};text-align:${align};font-size:${sizePt}pt;font-weight:${weight};${family ? `font-family:${family};` : ''}">${html}</div>`;
}

/** 注意事項（番号付き。「|」の行は表） */
function noteListHtml(text, count, punct, macros, { label, num, textX, wrap, pitch, fontPt }) {
  const items = coverNoteItems(text, count);
  let h = `<div class="cv-list" style="font-size:${fontPt}pt;line-height:${pitch.toFixed(2)}mm">`;
  items.forEach((it, i) => {
    h += `<div class="cv-item" style="padding-left:${wrap}mm;text-indent:${(textX - wrap).toFixed(2)}mm;position:relative">`;
    h += `<span class="cv-num" style="position:absolute;left:${num}mm;text-indent:0">${esc(label(i + 1))}</span>${renderInline(punct(it.text), macros)}`;
    if (it.rows.length) {
      h += `<table class="cv-table" style="margin:${(4.0 - 0.7 * pitch + 0.3 * pitch).toFixed(2)}mm ${(textX - wrap).toFixed(2)}mm ${(6.6 - 0.7 * pitch).toFixed(2)}mm;width:calc(100% - ${(2 * (textX - wrap)).toFixed(2)}mm)">`;
      for (const r of it.rows) h += `<tr>${r.map((x) => `<td>${renderInline(punct(x), macros)}</td>`).join('')}</tr>`;
      h += '</table>';
    }
    h += '</div>';
  });
  return h + '</div>';
}

/** 表紙のページ番号（表紙にページ番号を付けるとき） */
function cvPageNumber(geo) {
  const B = geo.footBaseline > 0 ? geo.footBaseline : geo.h - geo.bottom + 12;
  const t = geo.pageNumber === 'kyotsu' || geo.pageNumber === 'dash' ? '—&ensp;1&ensp;—' : geo.pageNumber === 'endash' ? '–&ensp;1&ensp;–' : '1';
  return cvAt(B, 10, t, { family: 'var(--serif)' }, geo);
}

function coverPage(c, count, style, punct, macros, geo) {
  return c.style === 'kyotsu' ? coverKyotsu(c, count, style, punct, macros, geo) : coverStandard(c, count, style, punct, macros, geo);
}

function coverStandard(c, count, style, punct, macros, geo) {
  const P = coverPositions(c, geo.top);
  let h = `<div class="sheet page cover-page" style="${style}">`;
  const headers = String(c.header || '').split('|').filter((s) => s.trim());
  headers.forEach((t, i) => (h += cvAt(P.header[i], Number(c.headerSize) || 15, esc(t.trim()), { align: c.headerAlign || 'center', family: 'var(--sans)' }, geo)));
  if (c.subject) {
    const sz = Number(c.subjectSize) || 34;
    const sub = c.subtitle ? `<span style="font-size:${Math.max(10, sz * 0.5)}pt;font-weight:400;margin-left:0.5em">${esc(c.subtitle)}</span>` : '';
    h += cvAt(P.subject, sz, esc(c.subject) + sub, { family: c.subjectFont === 'mincho' ? 'var(--serif)' : 'var(--sans)', weight: c.subjectBold ? 700 : 400 }, geo);
  }
  if (c.target) h += cvAt(P.target, 15, esc(c.target), { family: 'var(--sans)' }, geo);
  if (c.points) h += cvAt(P.points, 12, esc(c.points), {}, geo);
  if (c.time) h += cvAt(P.time, 12, `${c.timeLabel ? `${esc(c.timeLabel)}　` : ''}${esc(c.time)}`, { family: 'var(--sans)' }, geo);
  const pitch = Number(c.notesPitch) > 0 ? Number(c.notesPitch) : 6.0;
  const num = COVER_NUMBERS[c.notesNumber] || COVER_NUMBERS.dot;
  const list = noteListHtml(c.notes, count, punct, macros, { label: num.html, num: 1.0, textX: 7.0, wrap: 7.0, pitch, fontPt: 10.5 });
  const title = c.notesTitle ? `<div class="cv-notes-title" style="text-align:${c.notesTitleAlign === 'center' ? 'center' : 'left'}">${esc(c.notesTitle)}</div>` : '';
  const top = (P.notes - 0.88 * mmOf(10.5)).toFixed(2);
  h += `<div class="cv-notes${c.notesFrame ? ' framed' : ''}" style="position:absolute;top:${top}mm;left:${geo.left}mm;right:${geo.right}mm;line-height:${pitch}mm">${title}${list}</div>`;
  h += `<div class="cv-bottom" style="position:absolute;left:${geo.left}mm;right:${geo.right}mm;bottom:${geo.bottom}mm">`;
  if (c.idField) {
    const labels = String(c.idLabels || '受験番号|氏　　名').split('|').filter(Boolean);
    h += `<table class="cv-id">${labels.map((x) => `<tr><th>${esc(x.trim())}</th><td></td></tr>`).join('')}</table>`;
  }
  if (c.footer) h += `<div class="cv-footer">${esc(punct(c.footer))}</div>`;
  h += '</div>';
  if (c.pageNumber) h += cvPageNumber(geo);
  return h + '</div>';
}

/** 共通テストの表紙（位置は texExport.js の texCoverKyotsu と同じ） */
function coverKyotsu(c, count, style, punct, macros, geo) {
  let h = `<div class="sheet page cover-page kyotsu" style="${style}">`;
  if (c.footer) h += cvAt(32.1, 10, `<span class="cv-kbox">${esc(punct(c.footer))}</span>`, { family: 'var(--sans)' }, geo);
  if (c.subject) {
    const sub = c.subtitle ? `<span style="font-size:12pt;font-family:var(--serif);margin-left:2.2mm;position:relative;top:-1.4mm">${esc(c.subtitle)}</span>` : '';
    h += cvAt(47.5, 22, esc(c.subject) + sub, { align: 'left', x: 7.0, family: 'var(--sans)' }, geo);
  }
  if (c.points || c.time) {
    h += `<div class="cv-abs cv-kparen" style="top:39.7mm;left:${(geo.left + 111.1).toFixed(2)}mm;width:21.2mm;height:10.6mm"></div>`;
    if (c.points) h += cvAt(42.4, 10, esc(c.points), { align: 'right', left: 0, right: geo.w - geo.left - 127.0 }, geo);
    if (c.time) h += cvAt(49.4, 10, esc(c.time), { align: 'right', left: 0, right: geo.w - geo.left - 127.0 }, geo);
  }
  if (c.notesTitle) {
    h += cvAt(59.3, 10, '<b style="font-family:var(--serif)">I</b>', { align: 'left', x: 0 }, geo);
    h += cvAt(59.3, 10, esc(c.notesTitle), { align: 'left', x: 7.05, family: 'var(--sans)' }, geo);
  }
  const list = noteListHtml(c.notes, count, punct, macros, { label: (n) => String(n), num: 4.7, textX: 10.58, wrap: 7.05, pitch: 7.03, fontPt: 10 });
  h += `<div class="cv-abs" style="top:${(66.3 - 0.88 * mmOf(10) - (7.03 - mmOf(10)) / 2).toFixed(2)}mm;left:${geo.left}mm;right:${geo.right}mm;font-family:var(--serif)">${list}</div>`;
  if (coverNotes({ notes: c.backNotes }, count).length || c.backRef) {
    h += cvAt(221.6, 10, '<b style="font-family:var(--serif)">II</b>', { align: 'left', x: 0 }, geo);
    h += cvAt(221.6, 10, esc(c.backTitle || '解答上の注意'), { align: 'left', x: 7.05, family: 'var(--sans)' }, geo);
    if (c.backRef) h += cvAt(228.6, 9.9, esc(punct(c.backRef)), { align: 'left', x: 7.05, family: 'var(--sans)' }, geo);
  }
  if (c.pageNumber) h += cvPageNumber(geo);
  return h + '</div>';
}

/** 裏表紙（解答上の注意） */
function backCoverPage(c, count, style, punct, macros, geo) {
  const kyotsu = c.style === 'kyotsu';
  let h = `<div class="sheet page cover-page back-cover" style="${style}">`;
  const title = esc(c.backTitle || '解答上の注意');
  h += kyotsu
    ? `<div class="cv-back-title" style="font-size:10pt;line-height:7.03mm"><b style="font-family:var(--serif);display:inline-block;width:7.05mm">II</b>${title}</div>`
    : `<div class="cv-back-title center">${title}</div>`;
  const num = kyotsu ? { html: (n) => String(n) } : COVER_NUMBERS[c.notesNumber] || COVER_NUMBERS.dot;
  h += noteListHtml(c.backNotes, count, punct, macros, kyotsu ? { label: num.html, num: 4.7, textX: 10.58, wrap: 7.05, pitch: 7.03, fontPt: 10 } : { label: num.html, num: 1.0, textX: 7.0, wrap: 7.0, pitch: 7.03, fontPt: 10 });
  return h + '</div>';
}

