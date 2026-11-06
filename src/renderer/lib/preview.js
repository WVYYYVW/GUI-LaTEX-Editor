// LaTeX（問題文）→ HTML プレビュー。数式は KaTeX、文章部分はよく使う命令だけを簡易変換する。
import katex from 'katex';
import { findMathRanges, maskComments } from './mathRanges.js';
import { normalizeLayout, paperSize, headNumberHtml, headStyleCss } from './layout.js';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** プリアンブルの \newcommand / \DeclareMathOperator を KaTeX のマクロに変換 */
export function collectMacros(preamble = '') {
  const macros = {};
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
  return katex.renderToString(latex, {
    displayMode: display,
    throwOnError: false,
    strict: 'ignore',
    trust: false,
    macros: { ...macros },
  });
}

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

  s = esc(s);
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
  const masked = maskComments(src);
  const ranges = findMathRanges(src);
  const maths = [];
  let joined = '';
  let last = 0;
  for (const r of ranges) {
    joined += masked.slice(last, r.from) + `\u0001${maths.length}\u0002`;
    let h = renderMath(r.latex, r.display, macros);
    if (opts.field) {
      h = `<span class="pv-math${r.display ? ' pv-display' : ''}" data-field="${opts.field}" data-from="${r.from}" title="ダブルクリックで数式エディタ / 右クリックで Word 用にコピー">${h}</span>`;
    }
    maths.push(h);
    last = r.to;
  }
  joined += masked.slice(last);
  return textToHtml(joined).replace(/\u0001(\d+)\u0002/g, (_m, i) => maths[Number(i)]);
}

export function renderInline(src, macros) {
  return `<span class="inline-latex">${renderLatex(src, macros)}</span>`;
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
  const { w } = paperSize(l);
  const headCss = headStyleCss(h);
  const fontPt = parseInt(m.fontSize, 10) || 11;

  let out = `<div class="sheet page sub-${l.subLabel}${m.columns === 2 ? ' cols-2' : ''}" style="width:${w}mm;padding:${l.margin}mm;font-size:${fontPt}pt;line-height:${(1.75 * l.lineSpread).toFixed(2)}">`;
  if (l.header) out += `<div class="sh-runhead">${esc(l.header)}</div>`;
  if (m.title || m.subtitle || m.author || m.date || m.nameField) {
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
    const hang = Math.max(Number(l.bodyIndent), 8);
    out += `<section class="sh-problem${frame ? ' framed' : ''}${hanging ? ' hanging' : ''}${brk ? ' brk' : ''}" data-index="${i}" style="margin-top:${l.spaceBefore}mm${hanging ? `;grid-template-columns:${hang}mm 1fr` : ''}">`;
    const num = `<span class="sh-num" style="${headCss}" data-index="${i}" title="クリックでレイアウト設定">${headNumberHtml(h, n)}</span>`;
    const title = h.showTitle && p.title ? `<span class="sh-title" style="${headCss}">${renderInline(p.title, macros)}</span>` : '';
    const st = m.showDifficulty ? stars(p.difficulty) : '';
    const body = `<div class="sh-body">${renderLatex(p.body, macros)}</div>`;
    let answer = '';
    if (m.answerMode === 'after' && p.solution.trim()) answer = `<div class="sh-answer"><b>【解答】</b>${renderLatex(p.solution, macros)}</div>`;
    const space = Number(pl.answerSpace ?? m.spaceAfter) || 0;
    const spaceEl = opts.interactive
      ? `<div class="sh-space" data-index="${i}" style="height:${space}mm"><div class="sh-handle" data-index="${i}" title="上下にドラッグして解答スペースを調整（ダブルクリックで全体設定に戻す）">⇕ 解答スペース ${space}mm${pl.answerSpace == null ? '（全体設定）' : ''}</div></div>`
      : space > 0
        ? `<div style="height:${space}mm"></div>`
        : '';
    if (hanging) {
      out += `<div class="sh-hcol">${num}</div><div>${title || st ? `<div class="sh-head" style="margin-bottom:${l.spaceAfterHead}mm">${title}${st}</div>` : ''}${body}${answer}${spaceEl}</div>`;
    } else {
      out += `<div class="sh-head" style="margin-bottom:${l.spaceAfterHead}mm">${num}${title}${st}</div>`;
      out += `<div style="margin-left:${l.bodyIndent}mm">${body}${answer}</div>${spaceEl}`;
    }
    out += '</section>';
  });
  out += '</div>';
  if ((m.answerMode === 'end' || m.answerMode === 'separate') && ps.some((p) => p.solution.trim())) {
    out += `<div class="sh-answers${m.answerMode === 'separate' ? ' separate' : ''}">`;
    if (m.answerMode === 'separate') out += '<div class="sh-pagebreak"><span>改ページ</span></div>';
    out += '<h2>解答</h2>';
    ps.forEach((p, i) => {
      if (!p.solution.trim()) return;
      out += `<section class="sh-problem"><div class="sh-head"><span class="sh-num" style="${headCss}">${headNumberHtml(h, i + 1)}</span>${p.title ? `<span class="sh-title">${renderInline(p.title, macros)}</span>` : ''}</div><div class="sh-body">${renderLatex(p.solution, macros)}</div></section>`;
    });
    out += '</div>';
  }
  return out + '</div>';
}
