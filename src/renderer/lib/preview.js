// LaTeX（問題文）→ HTML プレビュー。数式は KaTeX、文章部分はよく使う命令だけを簡易変換する。
import katex from 'katex';
import { SCIENCE_MACROS, normalizeNumbers } from './chem.js'; // \ce{…}（化学式, mhchem）・単位のマクロ
import { findMathRanges, maskComments } from './mathRanges.js';
import { normalizeLayout, paperSize, headNumberHtml, headStyleCss, bodyPt, pointsText, applyPunct, pageMargins } from './layout.js';
import { findFigures, figureToSvg } from './figure.js';
import { coverNotes } from './texExport.js';

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
  // 空欄 \blank{ア}
  for (let k = 0; k < 3; k++) s = s.replace(/\\blank\s*\{([^{}]*)\}/g, (_m, t) => `\u0006B${t}\u0007`);

  s = esc(s);
  s = s
    .replace(/\u0006P([^\u0006]*)\u0006/g, (_m, lab) => `<span class="pv-part"${lab ? ` data-label="${esc(decodeURIComponent(lab))}"` : ''}></span>`)
    .replace(/\u0006B([^\u0007]*)\u0007/g, '<span class="pv-blank">$1</span>');
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
  html = paras.map((p) => `<div class="pv-par">${p}</div>`).join('');

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
    pa.align === 'center' ? 'part-center' : pa.inline ? 'part-inline' : '',
    `blank-${bl.style}`,
  ].filter(Boolean);
  const vars =
    `--part-font:${pa.font === 'mincho' ? 'var(--serif)' : 'var(--sans)'};--part-weight:${pa.bold ? 700 : 400};--part-size:${Number(pa.size) > 0 ? `${Number(pa.size)}pt` : '1em'}` +
    `;--part-indent:${Number(pa.indent) || 0}mm;--part-gap:${Number(pa.gap) || 0}mm;--part-sb:${Number(pa.spaceBefore) || 0}mm;--part-sa:${Number(pa.spaceAfter) || 0}mm` +
    `;--blank-w:${Number(bl.width) || 0}mm${Number(bl.height) > 0 ? `;--blank-h:${Number(bl.height)}mm` : ''}`;
  return { classes, vars };
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
    contentStyle(l).vars;
  // 上下左右の余白（個別指定があればそれを使う。PDF と同じ考え方）
  const pm = pageMargins(l);
  const padL = pm.left ?? padX;
  const padR = pm.right ?? padX;
  const ls = Number(l.letterSpace) > 0 ? `;--letter-space:${Number(l.letterSpace)}em` : '';
  let out = `<div class="${cls}" style="width:${w}mm;padding:${pm.top}mm ${Number(padR).toFixed(2)}mm ${pm.bottom}mm ${Number(padL).toFixed(2)}mm;font-size:${pt}pt;line-height:${lineHeight.toFixed(2)};${vars}${ls}">`;
  if (l.header) out += l.headerStyle === 'title' ? `<div class="sh-titlehead">${esc(l.header)}</div>` : `<div class="sh-runhead">${esc(l.header)}</div>`;
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
      out += `<div class="sh-head${center ? ' center' : ''}" style="margin-bottom:${l.spaceAfterHead}mm">${num}${title}${ptsAfter}${ptsRight}${st}</div>`;
      out += `<div style="margin-left:${l.bodyIndent}mm">${body}${answer}</div>${spaceEl}`;
    }
    out += '</section>';
    if (l.afterEach === 'blank') out += '<div class="sh-pagebreak"><span>改ページ（白紙のページ）</span></div>';
    else if (l.afterEach === 'draft') out += `<div class="sh-pagebreak"><span>改ページ（${esc(l.draftText || '下書き用紙')}）</span></div>`;
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
  // 表紙は別のページとして先頭に置く
  const cover = m.cover?.enabled
    ? coverPage(m.cover, ps.length, `width:${w}mm;min-height:${paperH}mm;padding:${pm.top}mm ${Number(padR).toFixed(2)}mm ${pm.bottom}mm ${Number(padL).toFixed(2)}mm;font-size:${pt}pt`, punct)
    : '';
  return cover + out + '</div>';
}

function coverPage(c, count, style, punct) {
  let h = `<div class="sheet page cover-page" style="${style}">`;
  h += '<div class="cv-top">';
  if (c.header) h += `<div class="cv-header">${esc(c.header)}</div>`;
  if (c.subject) h += `<div class="cv-subject">${esc(c.subject)}</div>`;
  if (c.target) h += `<div class="cv-target">${esc(c.target)}</div>`;
  if (c.time) h += `<div class="cv-time">試験時間　${esc(c.time)}</div>`;
  h += '</div>';
  const notes = coverNotes(c, count);
  if (notes.length) {
    h += '<div class="cv-notes"><div class="cv-notes-title">注意事項</div><ol>';
    for (const n of notes) h += `<li>${renderInline(punct(n), {})}</li>`;
    h += '</ol></div>';
  }
  h += '<div class="cv-bottom">';
  if (c.idField) h += '<table class="cv-id"><tr><th>受験番号</th><td></td></tr><tr><th>氏　　名</th><td></td></tr></table>';
  if (c.footer) h += `<div class="cv-footer">${esc(punct(c.footer))}</div>`;
  h += '</div></div>';
  return h;
}

const PT_MM = 25.4 / 72.27;
