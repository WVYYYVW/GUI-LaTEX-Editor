// レイアウト（大問見出し・余白・用紙など）とテーマ。
// 1 つの layout オブジェクトから、プレビュー用 HTML と PDF 用 LaTeX の両方を作る。

export const HEAD_STYLES = [
  { id: 'plain', name: '問題 1' },
  { id: 'number', name: '1（太字）' },
  { id: 'box', name: '□ 枠囲み' },
  { id: 'boxFilled', name: '■ 白抜き' },
  { id: 'circle', name: '○ 丸囲み' },
  { id: 'bracket', name: '〔1〕' },
  { id: 'square', name: '[1]' },
  { id: 'dai', name: '第1問' },
  { id: 'roman', name: 'I, II' },
];

export const SUB_LABELS = [
  { id: 'paren', name: '(1)' },
  { id: 'decimal', name: '1.' },
  { id: 'roman', name: '(i)' },
  { id: 'alpha', name: '(a)' },
  { id: 'kata', name: '(ア)' },
];

export const PAPERS = { a4: { name: 'A4', w: 210, h: 297 }, b4: { name: 'B4', w: 257, h: 364 }, a3: { name: 'A3', w: 297, h: 420 } };

export function defaultLayout() {
  return {
    themeId: 'standard',
    paper: 'a4',
    landscape: false,
    margin: 20,
    lineSpread: 1.0,
    header: '',
    pageNumber: 'plain', // plain | dash | none
    head: {
      style: 'plain',
      label: '問題',
      font: 'gothic', // gothic | mincho
      size: 13,
      bold: true,
      color: '#000000',
      position: 'above', // above | hanging
      showTitle: true,
    },
    spaceBefore: 8,
    spaceAfterHead: 2,
    bodyIndent: 0,
    frame: false,
    rule: false,
    newPageEach: false,
    subLabel: 'paren',
  };
}

/** 保存データを既定値で補完する */
export function normalizeLayout(l = {}) {
  const d = defaultLayout();
  return { ...d, ...l, head: { ...d.head, ...(l.head || {}) } };
}

/** 問題ごとの上書き設定 */
export function defaultProblemLayout() {
  return { pageBreakBefore: false, answerSpace: null, frame: null };
}

// ---------------- テーマ ----------------
// 汎用テーマ。大学別テーマは universityThemes.js から追加される。
export const BASE_THEMES = [
  {
    id: 'standard',
    name: '標準プリント',
    desc: '「問題 1」見出し・ゴシック',
    layout: {},
  },
  {
    id: 'teiki',
    name: '定期テスト風',
    desc: '□枠囲みの大問・解答スペースあり',
    layout: {
      head: { style: 'box', size: 14, font: 'gothic', showTitle: false },
      spaceBefore: 6,
      bodyIndent: 4,
      rule: true,
    },
    meta: { spaceAfter: 35, nameField: true },
  },
  {
    id: 'simple',
    name: 'シンプル（ぶら下げ）',
    desc: '番号を左に出して本文を字下げ',
    layout: {
      head: { style: 'number', size: 12, font: 'mincho', position: 'hanging', showTitle: false },
      bodyIndent: 9,
      spaceBefore: 5,
    },
  },
  {
    id: 'kokushi',
    name: '国公立二次風',
    desc: '第1問・明朝・大問ごとに改ページ',
    layout: {
      head: { style: 'dai', size: 13, font: 'mincho', showTitle: false },
      bodyIndent: 0,
      newPageEach: true,
      pageNumber: 'dash',
      paper: 'b4',
      margin: 25,
      lineSpread: 1.25,
    },
    meta: { answerMode: 'separate' },
  },
];

export function applyTheme(meta, theme) {
  const base = defaultLayout();
  const t = theme.layout || {};
  meta.layout = { ...base, ...t, head: { ...base.head, ...(t.head || {}) }, themeId: theme.id };
  if (theme.meta) Object.assign(meta, theme.meta);
}

// ---------------- HTML ----------------
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const escH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function headNumberHtml(h, n) {
  switch (h.style) {
    case 'plain':
      return `${escH(h.label || '')}${h.label ? '&thinsp;' : ''}${n}`;
    case 'box':
      return `<span class="hn-box">${n}</span>`;
    case 'boxFilled':
      return `<span class="hn-boxf" style="background:${escH(h.color)}">${n}</span>`;
    case 'circle':
      return `<span class="hn-circle">${n}</span>`;
    case 'bracket':
      return `〔${n}〕`;
    case 'square':
      return `[${n}]`;
    case 'dai':
      return `第${n}問`;
    case 'roman':
      return ROMAN[n] || String(n);
    default:
      return String(n);
  }
}

export function headStyleCss(h, scale = 1) {
  const fam = h.font === 'mincho' ? 'var(--serif)' : 'var(--sans)';
  return `font-family:${fam};font-size:${(h.size * scale).toFixed(2)}pt;font-weight:${h.bold ? 700 : 400};color:${escH(h.color)}`;
}

// ---------------- LaTeX ----------------
const hex = (c) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c.slice(1).toUpperCase() : '000000');

export function paperSize(l) {
  const p = PAPERS[l.paper] || PAPERS.a4;
  return l.landscape ? { w: p.h, h: p.w } : { w: p.w, h: p.h };
}

/** プリアンブルに入れるレイアウト関係の定義 */
export function texLayoutPreamble(l) {
  const { w, h } = paperSize(l);
  const head = l.head;
  const L = [];
  L.push(`\\usepackage[paperwidth=${w}mm,paperheight=${h}mm,margin=${Number(l.margin)}mm]{geometry}`);
  if (Number(l.lineSpread) !== 1) L.push(`\\linespread{${Number(l.lineSpread).toFixed(2)}}`);
  L.push(`\\definecolor{lpehead}{HTML}{${hex(head.color)}}`);
  const fam = head.font === 'mincho' ? '\\rmfamily\\mcfamily' : '\\sffamily\\gtfamily';
  const sz = Number(head.size) || 13;
  L.push(
    `\\newcommand{\\lpeheadfont}{${fam}${head.bold ? '\\bfseries' : ''}\\fontsize{${sz}pt}{${(sz * 1.3).toFixed(1)}pt}\\selectfont\\color{lpehead}}`
  );
  L.push('\\newlength{\\lpeboxw}\\settowidth{\\lpeboxw}{\\lpeheadfont 00}');
  // 大問番号
  const num = {
    plain: `${head.label ? `${head.label}\\,` : ''}#1`,
    number: '#1',
    box: '{\\setlength{\\fboxsep}{1.5pt}\\setlength{\\fboxrule}{0.6pt}\\fcolorbox{lpehead}{white}{\\makebox[\\lpeboxw][c]{#1}}}',
    boxFilled: '{\\setlength{\\fboxsep}{1.5pt}\\colorbox{lpehead}{\\makebox[\\lpeboxw][c]{\\color{white}#1}}}',
    circle:
      '\\ifdefined\\tikz\\tikz[baseline=(lpec.base)]\\node[draw=lpehead,circle,inner sep=0pt,minimum size=1.45em](lpec){#1};\\else\\textcircled{#1}\\fi',
    bracket: '〔#1〕',
    square: '[#1]',
    dai: '第#1問',
    roman: '\\Roman{lpetmp}',
  }[head.style] || '#1';
  L.push('\\newcounter{lpetmp}');
  L.push(`\\newcommand{\\lpenum}[1]{\\setcounter{lpetmp}{#1}${num}}`);
  // 本文の字下げ
  L.push(
    `\\newenvironment{lpebody}{\\begin{list}{}{\\setlength{\\leftmargin}{${Number(l.bodyIndent)}mm}\\setlength{\\rightmargin}{0pt}\\setlength{\\topsep}{0pt}\\setlength{\\partopsep}{0pt}\\setlength{\\itemsep}{0pt}\\setlength{\\parsep}{\\parskip}}\\item\\relax}{\\end{list}}`
  );
  // ページ番号・ヘッダ
  const foot = { plain: '\\hfil\\thepage\\hfil', dash: '\\hfil--- \\thepage\\ ---\\hfil', none: '' }[l.pageNumber] ?? '\\hfil\\thepage\\hfil';
  const headText = l.header ? `\\hfil{\\small ${l.header}}\\hfil` : '';
  L.push('\\makeatletter');
  L.push(`\\def\\ps@lpe{\\def\\@oddhead{${headText}}\\let\\@evenhead\\@oddhead\\def\\@oddfoot{${foot}}\\let\\@evenfoot\\@oddfoot}`);
  L.push('\\makeatother');
  L.push('\\pagestyle{lpe}');
  return L;
}

/** 小問番号の既定（enumerate にオプションを付けなかったとき）。enumitem の有無で書き方が違う */
export function texSubLabel(l) {
  const map = {
    paren: ['(\\arabic{enumi})', '(\\arabic*)'],
    decimal: ['\\arabic{enumi}.', '\\arabic*.'],
    roman: ['(\\roman{enumi})', '(\\roman*)'],
    alpha: ['(\\alph{enumi})', '(\\alph*)'],
    kata: ['(\\lpekata{enumi})', '(\\lpekata{enumi})'],
  };
  const [classic, enumitem] = map[l.subLabel] || map.paren;
  return { classic, enumitem };
}

/** 大問 1 つ分の LaTeX（見出し＋本文の開始部分と終了部分） */
export function texProblemOpen(l, pl, n, title, stars, isFirst) {
  const L = [];
  const head = l.head;
  if (!isFirst && (pl.pageBreakBefore || l.newPageEach)) L.push('\\newpage');
  else if (!isFirst && l.rule) L.push('\\par\\medskip\\hrule\\relax');
  L.push(`\\par\\vspace{${Number(l.spaceBefore)}mm}`);
  const frame = pl.frame ?? l.frame;
  if (frame) L.push('\\begingroup\\setlength{\\fboxsep}{2.5mm}\\noindent\\fbox{\\begin{minipage}{\\dimexpr\\linewidth-2\\fboxsep-2\\fboxrule\\relax}');
  const t = head.showTitle && title ? `\\quad{\\lpeheadfont ${title}}` : '';
  const st = stars ? `\\hfill{\\small ${stars}}` : '';
  if (head.position === 'hanging') {
    const hang = Math.max(Number(l.bodyIndent), 8);
    L.push(
      `\\begin{list}{}{\\setlength{\\leftmargin}{${hang}mm}\\setlength{\\labelwidth}{${hang - 2}mm}\\setlength{\\labelsep}{2mm}\\setlength{\\topsep}{0pt}\\setlength{\\partopsep}{0pt}\\setlength{\\parsep}{\\parskip}}`
    );
    L.push(`\\item[{\\lpeheadfont\\lpenum{${n}}}]${t ? `{\\lpeheadfont ${title}}${st}\\par\\vspace{${Number(l.spaceAfterHead)}mm}` : st ? `${st}\\par` : ''}`);
    return { open: L, close: ['\\end{list}', ...(frame ? ['\\end{minipage}}\\endgroup'] : [])] };
  }
  L.push(`\\noindent{\\lpeheadfont\\lpenum{${n}}}${t}${st}\\par\\nopagebreak\\vspace{${Number(l.spaceAfterHead)}mm}`);
  L.push('\\begin{lpebody}');
  return { open: L, close: ['\\end{lpebody}', ...(frame ? ['\\end{minipage}}\\endgroup'] : [])] };
}
