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
  { id: 'daiSpaced', name: '第 1 問' },
  { id: 'dot', name: '1.' },
  { id: 'bracketSp', name: '〔 1 〕' },
  { id: 'roman', name: 'I, II' },
];

export const SUB_LABELS = [
  { id: 'paren', name: '(1)' },
  { id: 'pparen', name: '⑴' },
  { id: 'decimal', name: '1.' },
  { id: 'roman', name: '(i)' },
  { id: 'alpha', name: '(a)' },
  { id: 'kata', name: '(ア)' },
];

export const PAPERS = {
  a4: { name: 'A4', w: 210, h: 297 },
  b5: { name: 'B5', w: 182, h: 257 },
  b4: { name: 'B4', w: 257, h: 364 },
  a3: { name: 'A3', w: 297, h: 420 },
};

/** 句読点の統一（数式の外の文章だけに適用） */
export const PUNCT = {
  asis: null,
  commaMaru: [['、', '，'], ['．', '。']], // 「，。」
  commaPeriod: [['、', '，'], ['。', '．']], // 「，．」
  tenMaru: [['，', '、'], ['．', '。']], // 「、。」
};

export function defaultLayout() {
  return {
    themeId: 'standard',
    paper: 'a4',
    landscape: false,
    margin: 20,
    // 上下左右の余白（mm）。null のときは margin（左右は 1 行の文字数が決まっていれば中央そろえ）
    marginTop: null,
    marginBottom: null,
    marginLeft: null,
    marginRight: null,
    lineSpread: 1.0,
    header: '',
    headerStyle: 'running', // running: 各ページ上部に小さく / title: 1 ページ目の上に大きく
    pageNumber: 'plain', // plain | dash | none
    head: {
      style: 'plain',
      label: '問題',
      font: 'gothic', // gothic | mincho
      size: 13,
      bold: true,
      color: '#000000',
      position: 'above', // above（本文の上）| hanging（左にぶら下げ）| inline（番号の直後に本文）
      showTitle: true,
      gap: 3, // 番号とタイトル／本文の間（mm）
      boxRule: 'thin', // 枠囲みの線: thin | thick
      align: 'left', // 本文の上に置くときの位置: left | center
      outdent: 0, // 番号を本文の左端より外（余白側）に出す量（mm）。「直後に本文」のとき
      boxSize: 0, // 枠囲みの番号の枠の大きさ（mm、正方形）。0 は文字に合わせる
    },
    titleBlock: true, // プリントの表題（タイトル・氏名欄）を出す
    bodyPt: 0, // 本文の文字サイズ（pt。0 は「設定」の文字サイズ）
    lineHeight: 0, // 行送り（文字サイズの何倍か。0 は既定）
    charsPerLine: 0, // 1 行の文字数（0 は余白から自動）
    punct: 'asis', // 句読点の統一: asis | commaMaru | commaPeriod | tenMaru
    pointsStyle: 'none', // 配点: none | right（見出し行の右端）| after（番号の後）| bodyEnd（前文の最後）
    pointsFormat: '({n}点)',
    afterEach: 'none', // 大問の後のページ: none | blank（白紙）| draft（下書き用紙）
    draftText: '(下書き用紙)',
    endText: '', // 問題の最後に入れる一文（例: 問題は，このページで終わりである。）
    spaceBefore: 8,
    spaceAfterHead: 2,
    bodyIndent: 0,
    frame: false,
    rule: false,
    newPageEach: false,
    subLabel: 'paren',
    // 小問（enumerate）の細部
    sub: {
      paren: 'half', // half: (1)  full: （1）
      indent: 8, // 小問の本文の左端（大問本文の左端から, mm）
      sep: 2, // 番号と本文の間（mm）
      gap: 0, // 小問どうしの間（mm）
      wrap: 'hang', // hang: 2 行目以降を本文にそろえる / left: 左端に戻す
      wrapIndent: 0, // left のとき、2 行目以降の字下げ（mm）
    },
    letterSpace: 0, // 字間（全角 1 字に対する割合。例: 0.1）
    parIndent: false, // 段落の行頭を 1 字下げる
    parSkip: 1.5, // 段落と段落の間（mm）
    displayAlign: 'center', // 別行立ての式: center | left
    mathIndent: 10, // 左寄せのときの字下げ（mm）
  };
}

/** 保存データを既定値で補完する */
export function normalizeLayout(l = {}) {
  const d = defaultLayout();
  return { ...d, ...l, head: { ...d.head, ...(l.head || {}) }, sub: { ...d.sub, ...(l.sub || {}) } };
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
  meta.layout = { ...base, ...t, head: { ...base.head, ...(t.head || {}) }, sub: { ...base.sub, ...(t.sub || {}) }, themeId: theme.id };
  // テーマが触る文書設定は、前のテーマの値が残らないよう既定に戻してから適用する
  Object.assign(meta, { spaceAfter: 0, columns: 1, nameField: false, answerMode: 'end', showDifficulty: true }, theme.meta || {});
}

// ---------------- HTML ----------------
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const escH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function headNumberHtml(h, n) {
  switch (h.style) {
    case 'plain':
      return `${escH(h.label || '')}${h.label ? '&thinsp;' : ''}${n}`;
    case 'box': {
      const s = Number(h.boxSize) > 0 ? ` style="width:${Number(h.boxSize)}mm;height:${Number(h.boxSize)}mm"` : '';
      return `<span class="hn-box${h.boxRule === 'thick' ? ' thick' : ''}${s ? ' sized' : ''}"${s}>${n}</span>`;
    }
    case 'daiSpaced':
      return `第　${n}　問`;
    case 'dot':
      return `${n}.`;
    case 'bracketSp':
      return `〔&nbsp;${n}&nbsp;〕`;
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

/** 上下左右の余白（mm）。left/right は個別指定がなければ null（中央そろえ・一律の余白に任せる） */
export function pageMargins(l) {
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  const mg = Number(l.margin);
  return {
    top: num(l.marginTop) ?? mg,
    bottom: num(l.marginBottom) ?? mg,
    left: num(l.marginLeft),
    right: num(l.marginRight),
  };
}

/** プリアンブルに入れるレイアウト関係の定義 */
export function texLayoutPreamble(l, docPt = 11) {
  const { w, h } = paperSize(l);
  const head = l.head;
  const L = [];
  const pt = bodyPt(l, docPt);
  const chars = Number(l.charsPerLine) || 0;
  const m = pageMargins(l);
  // 左右：個別指定 > 1 行の文字数（中央そろえ）> 一律の余白
  const hgeo =
    m.left != null && m.right != null
      ? `left=${m.left}mm,right=${m.right}mm`
      : chars > 0
        ? `textwidth=${(chars * pt).toFixed(2)}pt,hcentering`
        : `hmargin=${Number(l.margin)}mm`;
  L.push(`\\usepackage[paperwidth=${w}mm,paperheight=${h}mm,${hgeo},top=${m.top}mm,bottom=${m.bottom}mm]{geometry}`);
  if (Number(l.lineSpread) !== 1) L.push(`\\linespread{${Number(l.lineSpread).toFixed(2)}}`);
  if (Number(l.bodyPt) > 0 || Number(l.lineHeight) > 0) {
    const lh = Number(l.lineHeight) > 0 ? Number(l.lineHeight) : 1.6;
    L.push(`\\AtBeginDocument{\\fontsize{${pt}pt}{${(pt * lh).toFixed(2)}pt}\\selectfont}`);
  }
  // 字間（和文の文字と文字の間を広げる。全角 1 字に対する割合）
  if (Number(l.letterSpace) > 0) {
    L.push(`\\AtBeginDocument{\\ltjsetparameter{kanjiskip={${Number(l.letterSpace)}\\zw plus 0.5pt minus 0.5pt}}}`);
  }
  // 本文の全角 1 字の幅（大きな番号の枠を本文の行の中央にそろえるのに使う）
  L.push('\\newlength{\\lpebodyzw}\\AtBeginDocument{\\setlength{\\lpebodyzw}{1\\zw}}');
  L.push('\\newcommand{\\lpepparen}[1]{\\ifcase\\value{#1}\\or ⑴\\or ⑵\\or ⑶\\or ⑷\\or ⑸\\or ⑹\\or ⑺\\or ⑻\\or ⑼\\or ⑽\\fi}');
  L.push(`\\definecolor{lpehead}{HTML}{${hex(head.color)}}`);
  const fam = head.font === 'mincho' ? '\\rmfamily\\mcfamily' : '\\sffamily\\gtfamily';
  const sz = Number(head.size) || 13;
  L.push(
    `\\newcommand{\\lpeheadfont}{${fam}${head.bold ? '\\bfseries' : ''}\\fontsize{${sz}pt}{${(sz * 1.3).toFixed(1)}pt}\\selectfont\\color{lpehead}}`
  );
  L.push('\\newlength{\\lpeboxw}\\settowidth{\\lpeboxw}{\\lpeheadfont 00}\\begingroup\\lpeheadfont\\ifdim\\lpeboxw<1.2em\\global\\lpeboxw=1.2em\\fi\\endgroup');
  // 大問番号
  const num = {
    plain: `${head.label ? `${head.label}\\,` : ''}#1`,
    number: '#1',
    // 入試の大問番号のような正方形に近い枠（高さを支柱で 1.25em に）
    box:
      Number(head.boxSize) > 0
        ? // 大きさを指定した正方形の枠。行の高さには影響させず、枠の中心を本文 1 行目の中心にそろえる
          `{\\setlength{\\fboxsep}{0pt}\\setlength{\\fboxrule}{${head.boxRule === 'thick' ? '1.2' : '0.5'}pt}\\raisebox{\\dimexpr0.38\\lpebodyzw-${Number(head.boxSize) / 2}mm\\relax}[0pt][0pt]{\\fcolorbox{lpehead}{white}{\\vbox to \\dimexpr${Number(head.boxSize)}mm-2\\fboxrule\\relax{\\vss\\hbox to \\dimexpr${Number(head.boxSize)}mm-2\\fboxrule\\relax{\\hss#1\\hss}\\vss}}}}`
        : `{\\setlength{\\fboxsep}{1pt}\\setlength{\\fboxrule}{${head.boxRule === 'thick' ? '1.2' : '0.5'}pt}\\fcolorbox{lpehead}{white}{\\makebox[\\lpeboxw][c]{\\rule[-0.3em]{0pt}{1.25em}#1}}}`,
    daiSpaced: '第\\hspace{1\\zw}#1\\hspace{1\\zw}問',
    dot: '#1.',
    bracketSp: '〔\\ #1\\ 〕',
    boxFilled: '{\\setlength{\\fboxsep}{1.5pt}\\colorbox{lpehead}{\\makebox[\\lpeboxw][c]{\\color{white}#1}}}',
    circle:
      '\\ifdefined\\tikz\\tikz[baseline=(lpec.base)]\\node[draw=lpehead,circle,inner sep=0pt,minimum size=1.45em](lpec){#1};\\else\\textcircled{#1}\\fi',
    bracket: '〔#1〕',
    square: '[#1]',
    dai: '第#1問',
    roman: '\\Roman{lpetmp}',
  }[head.style] || '#1';
  L.push('\\newcounter{lpetmp}\\newlength{\\lpehangw}');
  L.push(`\\newcommand{\\lpenum}[1]{\\setcounter{lpetmp}{#1}${num}}`);
  // 本文の字下げ
  L.push(
    `\\newenvironment{lpebody}{\\begin{list}{}{\\setlength{\\leftmargin}{${Number(l.bodyIndent)}mm}\\setlength{\\rightmargin}{0pt}\\setlength{\\topsep}{0pt}\\setlength{\\partopsep}{0pt}\\setlength{\\itemsep}{0pt}\\setlength{\\parsep}{\\parskip}}\\item\\relax}{\\end{list}}`
  );
  // 段落の字下げ・別行立ての式
  L.push(`\\setlength{\\parindent}{${l.parIndent ? '1\\zw' : '0pt'}}\\setlength{\\parskip}{${Number(l.parSkip)}mm}`);
  if (l.displayAlign === 'left') L.push(`\\setlength{\\mathindent}{${Number(l.mathIndent)}mm}`);
  // 小問の字下げ・番号後の空き・間隔（enumitem が無い場合の設定。ある場合は texExport 側で \setlist）
  const s = l.sub;
  const left = s.wrap === 'left';
  // left のときは折り返し行を大問本文の左端（0）に戻し、1 行目だけ「字下げ＋番号＋空き」だけ下げる
  const wi = Number(s.wrapIndent) || 0;
  // 本文自体を字下げ用のリストに入れる配置では小問は 2 段目のリストになるので、2・3 段目にも同じ字下げを設定する
  const lm = `${left ? wi : Number(s.indent)}mm`;
  L.push(`\\setlength{\\leftmargini}{${lm}}\\setlength{\\leftmarginii}{${lm}}\\setlength{\\leftmarginiii}{${lm}}\\setlength{\\labelsep}{${Number(s.sep)}mm}`);
  L.push('\\makeatletter');
  // 小問のまとまりの前後（前の文章との間・後の文章との間）にも小問どうしと同じ空きを入れる。
  // 実物の冊子では「本文 → 1 行空き → (1) → 1 行空き → 本文 → 1 行空き → (2)」のように並ぶ。
  // 小問（enumerate）の中だけで設定する（center などほかの環境の前後の空きは変えない）。
  const g = `${Number(s.gap)}mm`;
  L.push(
    `\\def\\lpe@pre{\\let\\lpe@oi\\@listi\\let\\lpe@oii\\@listii\\let\\lpe@oiii\\@listiii` +
      `\\def\\@listi{\\lpe@oi\\topsep${g}\\partopsep\\z@\\parsep\\z@\\itemsep${g}}` +
      `\\def\\@listii{\\lpe@oii\\topsep${g}\\partopsep\\z@\\parsep\\z@\\itemsep${g}}` +
      `\\def\\@listiii{\\lpe@oiii\\topsep${g}\\partopsep\\z@\\parsep\\z@\\itemsep${g}}}`
  );
  L.push(
    // 番号の幅は実際の幅に（既定の「字下げ−空き」だと字下げ 0 のとき負になり、番号の位置が崩れる）
    // 外側のリスト（ぶら下げの大問）の「番号の後の空き」を引き継がないよう、小問用の値を設定し直す
    `\\newcommand{\\lpe@subfix}{\\setlength{\\itemsep}{${Number(s.gap)}mm}\\setlength{\\labelsep}{${Number(s.sep)}mm}\\settowidth{\\labelwidth}{\\setcounter{\\@enumctr}{1}\\csname label\\@enumctr\\endcsname\\setcounter{\\@enumctr}{0}}${
      left ? `\\setlength{\\itemindent}{\\dimexpr${Number(s.indent) - wi}mm+\\labelwidth+\\labelsep\\relax}` : ''
    }}`
  );
  L.push('\\makeatother');
  // ページ番号・ヘッダ
  const foot =
    { plain: '\\hfil\\thepage\\hfil', dash: '\\hfil--- \\thepage\\ ---\\hfil', endash: '\\hfil-- \\thepage\\ --\\hfil', none: '' }[l.pageNumber] ??
    '\\hfil\\thepage\\hfil';
  const headText = l.header && l.headerStyle !== 'title' ? `\\hfil{\\small ${l.header}}\\hfil` : '';
  L.push('\\makeatletter');
  L.push(`\\def\\ps@lpe{\\def\\@oddhead{${headText}}\\let\\@evenhead\\@oddhead\\def\\@oddfoot{${foot}}\\let\\@evenfoot\\@oddfoot}`);
  L.push('\\makeatother');
  L.push('\\pagestyle{lpe}');
  return L;
}

/** 小問番号の既定（enumerate にオプションを付けなかったとき）。enumitem の有無で書き方が違う */
export function bodyPt(l, docPt = 11) {
  return Number(l.bodyPt) > 0 ? Number(l.bodyPt) : docPt;
}

/** 配点の文字列 */
export function pointsText(l, points) {
  if (!points || l.pointsStyle === 'none') return '';
  return String(l.pointsFormat || '({n}点)').replace('{n}', points);
}

/** 句読点の統一（数式の外だけ）。findMathRanges を渡して数式を避ける */
export function applyPunct(text, l, findMathRanges) {
  const rules = PUNCT[l.punct];
  if (!rules || !text) return text;
  const ranges = findMathRanges(text);
  let out = '';
  let last = 0;
  const conv = (s) => rules.reduce((acc, [a, b]) => acc.split(a).join(b), s);
  for (const r of ranges) {
    out += conv(text.slice(last, r.from)) + text.slice(r.from, r.to);
    last = r.to;
  }
  return out + conv(text.slice(last));
}

export function texSubLabel(l) {
  const map = {
    pparen: ['\\lpepparen{enumi}', '\\lpepparen{enumi}'],
    paren: ['(\\arabic{enumi})', '(\\arabic*)'],
    decimal: ['\\arabic{enumi}.', '\\arabic*.'],
    roman: ['(\\roman{enumi})', '(\\roman*)'],
    alpha: ['(\\alph{enumi})', '(\\alph*)'],
    kata: ['(\\lpekata{enumi})', '(\\lpekata{enumi})'],
  };
  let [classic, enumitem] = map[l.subLabel] || map.paren;
  const full = l.sub?.paren === 'full';
  if (full) [classic, enumitem] = [classic, enumitem].map((s) => s.replace(/^\(/, '（').replace(/\)$/, '）'));
  // 小問の番号を [label=...] で明示したとき（enumitem が無い環境）にも括弧の形をそろえる
  const parens = full ? ['（', '）'] : ['(', ')'];
  const s = l.sub || {};
  const setlist =
    s.wrap === 'left'
      ? `wide=${Number(s.indent)}mm,labelsep=${Number(s.sep)}mm,itemsep=${Number(s.gap)}mm`
      : `leftmargin=${Number(s.indent)}mm,labelsep=${Number(s.sep)}mm,itemsep=${Number(s.gap)}mm`;
  return { classic, enumitem, parens, setlist };
}

/** 大問 1 つ分の LaTeX（見出し＋本文の開始部分と終了部分） */
export function texProblemOpen(l, pl, n, title, stars, isFirst, points) {
  const L = [];
  const head = l.head;
  if (!isFirst && (pl.pageBreakBefore || l.newPageEach)) L.push('\\newpage');
  else if (!isFirst && l.rule) L.push('\\par\\medskip\\hrule\\relax');
  L.push(`\\par\\vspace{${Number(l.spaceBefore)}mm}`);
  const frame = pl.frame ?? l.frame;
  if (frame) L.push('\\begingroup\\setlength{\\fboxsep}{2.5mm}\\noindent\\fbox{\\begin{minipage}{\\dimexpr\\linewidth-2\\fboxsep-2\\fboxrule\\relax}');
  const gapMm = Number(head.gap ?? 3);
  const gap = `\\hspace{${gapMm}mm}`;
  const t = head.showTitle && title ? `${gap}{\\lpeheadfont ${title}}` : '';
  const st = stars ? `\\hfill{\\small ${stars}}` : '';
  const pts = pointsText(l, points);
  // 配点：見出し行の右端（right）か番号の後（after）。本文の最後（bodyEnd）は texExport 側
  const ptsRight = pts && l.pointsStyle === 'right' && head.position === 'above' ? `\\hfill ${pts}` : '';
  const ptsAfter = pts && (l.pointsStyle === 'after' || (l.pointsStyle === 'right' && head.position !== 'above')) ? `${gap}${pts}` : '';
  const close = (inner) => [...inner, ...(frame ? ['\\end{minipage}}\\endgroup'] : [])];
  if (head.position === 'inline') {
    // 番号の直後から本文が始まり、2 行目以降は左端に戻る。outdent があれば番号を余白側に張り出す
    const od = Number(head.outdent) > 0 ? `\\hspace*{-${Number(head.outdent)}mm}` : '';
    L.push(`\\noindent${od}{\\lpeheadfont\\lpenum{${n}}}${t}${ptsAfter}${gap}\\ignorespaces`);
    return { open: L, close: close([]) };
  }
  if (head.position === 'hanging') {
    // 字下げ幅は「設定値」と「見出し番号の幅＋空き」の大きい方
    L.push(
      `\\settowidth{\\lpehangw}{\\lpeheadfont\\lpenum{${n}}}\\addtolength{\\lpehangw}{${gapMm}mm}\\ifdim\\lpehangw<${Number(l.bodyIndent)}mm\\setlength{\\lpehangw}{${Number(l.bodyIndent)}mm}\\fi`
    );
    L.push(
      // 番号は左寄せ（字下げ幅を広げても番号は左端のまま、本文だけが右に寄る）
      `\\begin{list}{}{\\setlength{\\leftmargin}{\\lpehangw}\\setlength{\\labelwidth}{\\dimexpr\\lpehangw-${gapMm}mm\\relax}\\setlength{\\labelsep}{${gapMm}mm}\\setlength{\\topsep}{0pt}\\setlength{\\partopsep}{0pt}\\setlength{\\parsep}{\\parskip}\\def\\makelabel#1{#1\\hfil}}`
    );
    const headLine = t || st || ptsAfter ? `${t ? `{\\lpeheadfont ${title}}` : ''}${ptsAfter}${st}\\par\\vspace{${Number(l.spaceAfterHead)}mm}` : '';
    L.push(`\\item[{\\lpeheadfont\\lpenum{${n}}}]${headLine}`);
    return { open: L, close: close(['\\end{list}']) };
  }
  const line = `{\\lpeheadfont\\lpenum{${n}}}${t}${ptsAfter}`;
  if (head.align === 'center') L.push(`{\\centering ${line}\\par}${ptsRight || st ? `\\noindent\\hfill${ptsRight.replace('\\hfill', '')}${st.replace('\\hfill', '')}\\par` : ''}`);
  else L.push(`\\noindent${line}${ptsRight}${st}\\par`);
  L.push(`\\nopagebreak\\vspace{${Number(l.spaceAfterHead)}mm}`);
  L.push('\\begin{lpebody}');
  return { open: L, close: close(['\\end{lpebody}']) };
}
