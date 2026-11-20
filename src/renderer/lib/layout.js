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
  { id: 'plainRoman', name: '問題 I' },
  { id: 'daiRoman', name: '第 I 問' },
  { id: 'squareRoman', name: '[ I ]' },
];

export const SUB_LABELS = [
  { id: 'paren', name: '(1)' },
  { id: 'pparen', name: '⑴' },
  { id: 'decimal', name: '1.' },
  { id: 'roman', name: '(i)' },
  { id: 'alpha', name: '(a)' },
  { id: 'kata', name: '(ア)' },
  { id: 'toi', name: '問1' },
  { id: 'toiSp', name: '問 1' },
  { id: 'toiDot', name: '問 1.' },
  { id: 'toiPparen', name: '問⑴' },
  { id: 'setsumon', name: '設問(1)：' },
  { id: 'aparen', name: '⒜' },
  { id: 'kataPlain', name: 'ア' },
  { id: 'toiBold', name: '問 1（問 太字）' },
  { id: 'toiBoldDot', name: '問 1.（問 太字）' },
  { id: 'kataBold', name: 'ア（太字）' },
  { id: 'numBold', name: '1（太字）' },
  { id: 'toiParenFull', name: '（問 1）' },
];

/** 大問の中の「部」（物理・化学の I, II / A, B など）。本文では \Part（ラベルを指定するときは \Part[A]）と書く */
export const PART_STYLES = [
  { id: 'roman', name: 'I', tex: '\\Roman{lpepart}', css: 'counter(lpepart, upper-roman)' },
  { id: 'romanBracket', name: '〔I〕', tex: '〔\\Roman{lpepart}〕', css: "'〔' counter(lpepart, upper-roman) '〕'" },
  { id: 'romanSquare', name: '[I]', tex: '[\\Roman{lpepart}]', css: "'[' counter(lpepart, upper-roman) ']'" },
  { id: 'alpha', name: 'A', tex: '\\Alph{lpepart}', css: 'counter(lpepart, upper-alpha)' },
  { id: 'alphaBracket', name: '〔A〕', tex: '〔\\Alph{lpepart}〕', css: "'〔' counter(lpepart, upper-alpha) '〕'" },
  { id: 'alphaSquare', name: '[A]', tex: '[\\Alph{lpepart}]', css: "'[' counter(lpepart, upper-alpha) ']'" },
  { id: 'pparen', name: '⑴', tex: '\\lpepparen{lpepart}', css: 'counter(lpepart, lpe-pparen)' },
  // 共通テストの〔1〕: 数字を全角 1 字の幅の中央に置く
  { id: 'arabicKikko', name: '〔1〕', tex: '〔\\makebox[1\\zw]{\\arabic{lpepart}}〕', css: "'〔' counter(lpepart) '〕'" },
];

/**
 * 空欄（穴埋め）。本文では \blank{ア} と書く。
 * \blank*{コ} は選択肢から選ぶ空欄（二重の枠）、\blank[2]{ア} は 2 度目以降に出てくる空欄（細い枠）。
 * 枠以外の形では * と [2] は見た目を変えない。
 */
export const BLANK_STYLES = [
  { id: 'box', name: '枠 ア' },
  { id: 'bracket', name: '［ ア ］' },
  { id: 'paren', name: '（ ア ）' },
  { id: 'underline', name: '下線' },
  { id: 'kikko', name: '〔 ア 〕' },
  { id: 'kyotsu', name: '共通テスト ア' },
];

/** 共通テストの解答欄の枠（実物の PDF の線の中心で測った値, mm） */
export const KYOTSU_BOX = { w: 12.04, h: 5.69, depth: 1.5, rule: 0.4, thin: 0.12, inset: 0.7, inner: 0.116, pad: 5.0 };

/** 科目（パレットの並び・テーマの絞り込み・表紙の科目名に使う） */
export const SUBJECTS = [
  { id: 'math', name: '数学', cover: '数　学' },
  { id: 'physics', name: '物理', cover: '物　理' },
  { id: 'chemistry', name: '化学', cover: '化　学' },
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
    // running: 各ページ上部に小さく / title: 1 ページ目の上に大きく / both: 1 ページ目に大きく、2 ページ目からは上部に小さく
    headerStyle: 'running',
    headerAlign: 'center', // 上部に小さく入れるときの位置: center | outside（奇数ページは右、偶数ページは左）
    headerSize: 0, // 上部に小さく入れるときの文字の大きさ（pt。0 は \small）
    headerFont: 'mincho', // mincho | gothic
    headBaseline: 0, // ページ上部の文字のベースラインの位置（用紙の上端から mm。0 は既定）
    footBaseline: 0, // ページ番号のベースラインの位置（用紙の上端から mm。0 は既定）
    // 1 ページ目に大きく入れる見出し（headerStyle が title / both のとき）。size が 0 なら従来の見た目（\Large 太字）
    title: {
      size: 0, // pt
      font: 'gothic', // gothic | mincho
      bold: false,
      baseline: 0, // 見出しのベースライン（用紙の上端から mm）
      sub: '', // 見出しの下の小さな行（例: （全　問　必　答））
      subSize: 12,
      subBaseline: 0, // 小さな行のベースライン（用紙の上端から mm）
      next: 0, // その次の行（最初の大問の見出し）のベースライン（用紙の上端から mm）
    },
    contNote: '', // 大問がページをまたぐとき、ページの最後に入れる一文（{n} は大問の番号）。例: （第{n}問は次ページに続く。）
    pageNumber: 'plain', // plain | dash | endash | kyotsu（共通テストの「— 1 —」）| none
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
      boxHeight: 0, // 枠の高さ（mm）。0 は boxSize と同じ（正方形）
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
    draftPages: 1, // 大問の後の下書き用紙の枚数
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
      before: 0, // 小問のまとまりの前だけに足す空き（mm。小問どうしの間の空きに加えて）
    },
    // 小問の中の小問（2 段目の enumerate）。label が空なら 1 段目と同じ扱い（従来どおり）
    sub2: {
      label: '', // SUB_LABELS の id（例: roman で (i)）
      indent: 0, // 番号の位置（1 段目の小問の本文の左端から, mm）。wrap が hang のときは本文の左端
      sep: 2,
      gap: 0,
      wrap: 'hang',
      wrapIndent: 0,
    },
    // 大問の中の「部」（\Part）
    part: {
      style: 'roman', // PART_STYLES の id
      font: 'gothic', // gothic | mincho
      bold: true,
      size: 0, // pt（0 は本文と同じ）
      align: 'left', // left | center
      indent: 0, // 本文の左端からの字下げ（mm）
      inline: false, // true: ラベルの後に同じ行で本文が続く
      gap: 2, // inline のときのラベルの後の空き（mm）
      spaceBefore: 4, // 部の前の空き（mm）
      spaceAfter: 1.5, // 部のラベルの後の空き（mm。inline でないとき）
      // true: 部の中身全体を bodyIndent だけ字下げし、番号は indent の位置に（字下げの中にぶら下げる）。次の \Part か大問の終わりまで
      hang: false,
      bodyIndent: 0, // hang のときの部の中身の左端（大問の本文の左端から, mm）
    },
    // 空欄（\blank{ア}）
    blank: {
      style: 'box', // BLANK_STYLES の id
      width: 10, // 最小の幅（mm）
      height: 0, // 枠の高さ（mm。0 は文字に合わせる）
    },
    letterSpace: 0, // 字間（全角 1 字に対する割合。例: 0.1）
    parIndent: false, // 段落の行頭を 1 字下げる
    parSkip: 1.5, // 段落と段落の間（mm）
    displayAlign: 'center', // 別行立ての式: center | left
    mathIndent: 10, // 左寄せのときの字下げ（mm）
    displaySkip: 0, // 別行立ての式の上下の空き（mm。0 は既定）
    displaySkipAbove: 0, // 式の上の空きだけ別にするとき（mm。0 は displaySkip と同じ）
  };
}

/** 入れ子の設定（head / sub / sub2 / part / blank / title）。既定値と保存データを項目ごとに合わせる */
const NESTED = ['head', 'sub', 'sub2', 'part', 'blank', 'title'];
function mergeNested(base, over = {}) {
  const out = { ...base, ...over };
  for (const k of NESTED) out[k] = { ...base[k], ...(over[k] || {}) };
  return out;
}

/** 保存データを既定値で補完する */
export function normalizeLayout(l = {}) {
  return mergeNested(defaultLayout(), l);
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

/** 表紙（試験問題冊子の表紙）。style が kyotsu のときは共通テストの冊子の表紙の組み方にする */
export function defaultCover() {
  return {
    enabled: false,
    style: 'standard', // standard | kyotsu
    header: '令和○年度 入学試験問題', // 「|」で区切ると複数行
    headerAlign: 'center', // center | left | right
    headerSize: 15, // pt
    subject: '数　学',
    subjectSize: 34, // pt
    subjectFont: 'gothic', // gothic | mincho
    subjectBold: true,
    subtitle: '', // 科目名の右に小さく（例: 〔『数学Ⅰ，数学Ａ』『数学Ⅰ』〕・（理科）・〔理系〕）
    target: '（理系）',
    time: '120分',
    timeLabel: '試験時間', // 空なら試験時間の文字だけ（例: 「令和8年2月25日　14時―16時30分」）
    points: '', // 配点（例: 100点）。kyotsu では試験時間と縦に並べ、standard では科目名の下の行に
    // 各行のベースラインの位置（用紙の上端から mm）。省略した行は上から順に既定の間隔で並べる
    pos: {},
    notesTitle: '注意事項',
    notesTitleAlign: 'left', // left | center
    notesNumber: 'dot', // dot: 1. / zdot: 1．/ plain: 1 / paren: (1) / pparen: ⑴
    notesFrame: false, // 注意事項を枠で囲む
    notesPitch: 0, // 注意事項の行送り（mm。0 は既定）
    notesSize: 0, // 注意事項の文字の大きさ（pt。0 は 10.5pt）
    notesTitleSize: 0, // 注意事項の見出しの大きさ（pt。0 は注意事項と同じ）
    notesTitleX: 0, // 見出しの左端（用紙の左端から mm。0 は本文の左端）
    notesGap: null, // 見出しのベースラインから最初の項目のベースラインまで（mm。null は行送りと同じ。0 は見出しと同じ行）
    notesItemGap: 0, // 項目と項目の間に足す空き（mm）
    timeAlign: 'center', // 試験時間の行の位置: center | left | right
    // 注意事項の番号・本文（1 行目）・折り返し・右端の位置（用紙の左端から mm。0 は本文の左端から 1mm・7mm・7mm・本文の右端）
    notesX: 0,
    notesText: 0,
    notesWrap: 0,
    notesRight: 0,
    headerFont: 'gothic', // 年度・試験名の書体: gothic | mincho
    targetSize: 15,
    pointsSize: 12,
    timeSize: 12,
    timeFont: 'gothic',
    // 1 行 1 項目。{n} は問題数。「|」で始まる行は表の行（「|出題科目|ページ|選択方法」のように区切る）
    notes: [
      '問題は全部で{n}題である。',
      '問題冊子に落丁・乱丁・印刷の不鮮明な箇所があれば，手を挙げて監督者に知らせること。',
      '解答は，解答用紙の所定の欄に記入すること。所定の欄以外に記入したものは採点しない。',
      '問題冊子の余白は，下書きに使用してよい。',
      '試験終了後，問題冊子は持ち帰ってよい。',
    ].join('\n'),
    idField: true,
    idLabels: '受験番号|氏　　名', // 受験番号の欄の見出し（「|」で区切る）
    footer: '指示があるまで，この問題冊子を開いてはいけない。',
    // 裏表紙に入れる注意（1 行 1 項目。空なら裏表紙を付けない）と、表紙に入れるその案内
    backTitle: '解答上の注意',
    backNotes: '',
    backRef: '',
    pageNumber: false, // 表紙にもページ番号を付け、次のページを 2 ページ目にする
    firstPage: 0, // 問題の最初のページの番号（表紙にページ番号を付けるとき。間は白紙。0 は表紙の次のページ）
  };
}

/**
 * 表紙（standard）の各行のベースライン（用紙の上端から mm）。pos で指定した行はその位置、ほかは上から順に並べる。
 * TeX とプレビューで同じ位置を使う
 */
export function coverPositions(c, top) {
  const pos = c.pos || {};
  const out = {};
  let y = top + 12;
  const place = (key, gap, present) => {
    if (!present) return;
    y = Number(pos[key]) > 0 ? Number(pos[key]) : y + gap;
    out[key] = y;
  };
  const headers = String(c.header || '').split('|').filter((s) => s.trim());
  out.header = [];
  headers.forEach((_, i) => {
    y = Number(pos.header) > 0 && i === 0 ? Number(pos.header) : y + (i ? Number(c.headerSize) * 0.5 : 8);
    out.header.push(y);
  });
  place('subject', headers.length ? Number(c.subjectSize) * 0.6 + 8 : Number(c.subjectSize) * 0.4, !!c.subject);
  place('target', 13, !!c.target);
  place('points', 10, !!c.points);
  place('time', 10, !!c.time);
  place('notes', 22, true);
  return out;
}

/** 表紙の注意事項の番号の形（TeX / 表示用） */
export const COVER_NUMBERS = {
  dot: { tex: '\\arabic{lpecovn}.', html: (n) => `${n}.` },
  zdot: { tex: '\\arabic{lpecovn}．', html: (n) => `${n}．` },
  plain: { tex: '\\arabic{lpecovn}', html: (n) => `${n}` },
  paren: { tex: '(\\arabic{lpecovn})', html: (n) => `(${n})` },
  pparen: { tex: '\\lpepparen{lpecovn}', html: (n) => '⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽'[n - 1] || `(${n})` },
  zdigit: { tex: '\\lpezdigit{lpecovn}', html: (n) => String(n).replace(/\d/g, (d) => '０１２３４５６７８９'[d]) },
  bullet: { tex: '・', html: () => '・' },
  none: { tex: '', html: () => '' },
};

export function applyTheme(meta, theme) {
  meta.layout = { ...mergeNested(defaultLayout(), theme.layout || {}), themeId: theme.id };
  // テーマが触る文書設定は、前のテーマの値が残らないよう既定に戻してから適用する
  const { cover, ...rest } = theme.meta || {};
  Object.assign(meta, { spaceAfter: 0, columns: 1, nameField: false, answerMode: 'end', showDifficulty: true }, rest);
  // 表紙: テーマに表紙の設定があれば、その大学の表紙の文面・組み方にする（表紙を付けるかどうかは今の設定のまま。
  // テーマが enabled を指定していればそれに従う）。表紙の設定のないテーマに替えたときは、テーマ由来の文面だけ既定に戻す
  const prev = meta.cover || defaultCover();
  if (cover) meta.cover = { ...defaultCover(), ...cover, enabled: cover.enabled ?? !!prev.enabled, themeId: theme.id };
  else if (prev.themeId) meta.cover = { ...defaultCover(), enabled: !!prev.enabled };
}

// ---------------- HTML ----------------
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const escH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 番号の枠の高さ（boxHeight が無ければ正方形） */
const boxH = (h) => (Number(h.boxHeight) > 0 ? Number(h.boxHeight) : Number(h.boxSize));

export function headNumberHtml(h, n) {
  switch (h.style) {
    case 'plain':
      return `${escH(h.label || '')}${h.label ? '&thinsp;' : ''}${n}`;
    case 'box': {
      const s = Number(h.boxSize) > 0 ? ` style="width:${Number(h.boxSize)}mm;height:${boxH(h)}mm"` : '';
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
    case 'plainRoman':
      return `${escH(h.label || '')}${ROMAN[n] || n}`;
    case 'daiRoman':
      return `第&thinsp;${ROMAN[n] || n}&thinsp;問`;
    case 'roman':
      return ROMAN[n] || String(n);
    case 'squareRoman':
      return `[&nbsp;<b>${ROMAN[n] || n}</b>&nbsp;]`;
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
  // ページ上部の文字・ページ番号のベースラインの位置（用紙の上端から）を指定したときは headsep / footskip に直す
  let vgeo = '';
  if (Number(l.headBaseline) > 0) vgeo += `,headheight=5mm,headsep=${(m.top - Number(l.headBaseline)).toFixed(2)}mm`;
  if (Number(l.footBaseline) > 0) vgeo += `,footskip=${(Number(l.footBaseline) - (h - m.bottom)).toFixed(2)}mm`;
  L.push(`\\usepackage[paperwidth=${w}mm,paperheight=${h}mm,${hgeo},top=${m.top}mm,bottom=${m.bottom}mm${vgeo}]{geometry}`);
  if (Number(l.lineSpread) !== 1) L.push(`\\linespread{${Number(l.lineSpread).toFixed(2)}}`);
  // 別行立ての式の上下の空き
  if (Number(l.displaySkip) > 0) {
    const ds = `${Number(l.displaySkip)}mm`;
    const ab = `${Number(l.displaySkipAbove) > 0 ? Number(l.displaySkipAbove) : Number(l.displaySkip)}mm`;
    L.push(`\\AtBeginDocument{\\setlength{\\abovedisplayskip}{${ab}}\\setlength{\\belowdisplayskip}{${ds}}\\setlength{\\abovedisplayshortskip}{${ab}}\\setlength{\\belowdisplayshortskip}{${ds}}}`);
  }
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
  L.push('\\newcommand{\\lpezdigit}[1]{\\ifcase\\value{#1}０\\or １\\or ２\\or ３\\or ４\\or ５\\or ６\\or ７\\or ８\\or ９\\or １０\\or １１\\or １２\\or １３\\else\\arabic{#1}\\fi}');
  L.push('\\newcommand{\\lpeaparen}[1]{\\ifcase\\value{#1}\\or ⒜\\or ⒝\\or ⒞\\or ⒟\\or ⒠\\or ⒡\\or ⒢\\or ⒣\\or ⒤\\or ⒥\\fi}');
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
          // boxHeight を指定すると横長・縦長の枠（幅 boxSize × 高さ boxHeight）
          `{\\setlength{\\fboxsep}{0pt}\\setlength{\\fboxrule}{${head.boxRule === 'thick' ? '1.2' : '0.5'}pt}\\raisebox{\\dimexpr0.38\\lpebodyzw-${boxH(head) / 2}mm\\relax}[0pt][0pt]{\\fcolorbox{lpehead}{white}{\\vbox to \\dimexpr${boxH(head)}mm-2\\fboxrule\\relax{\\vss\\hbox to \\dimexpr${Number(head.boxSize)}mm-2\\fboxrule\\relax{\\hss#1\\hss}\\vss}}}}`
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
    // 見出しの文字（例: 「物理問題　」）の後にローマ数字。文字と数字の間の空きは見出しの文字に含める
    plainRoman: `${head.label || ''}\\Roman{lpetmp}`,
    daiRoman: '第\\hspace{0.25\\zw}\\Roman{lpetmp}\\hspace{0.25\\zw}問',
    // 早稲田の「[ Ⅰ ]」（数字だけ太字）
    squareRoman: '[\\hspace{0.3em}{\\bfseries\\Roman{lpetmp}}\\hspace{0.3em}]',
  }[head.style] || '#1';
  L.push('\\newcounter{lpetmp}\\newlength{\\lpehangw}');
  L.push(`\\newcommand{\\lpenum}[1]{\\setcounter{lpetmp}{#1}${num}}`);
  // 本文の字下げ
  L.push(
    `\\newenvironment{lpebody}{\\begin{list}{}{\\setlength{\\leftmargin}{${Number(l.bodyIndent)}mm}\\setlength{\\rightmargin}{0pt}\\setlength{\\topsep}{0pt}\\setlength{\\partopsep}{0pt}\\setlength{\\itemsep}{0pt}\\setlength{\\parsep}{\\parskip}\\setlength{\\listparindent}{\\parindent}}\\item\\relax}{\\end{list}}`
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
      `\\def\\@listiii{\\lpe@oiii\\topsep${g}\\partopsep\\z@\\parsep\\z@\\itemsep${g}}` +
      // 入れ子の小問では包み直さない（包んだものをさらに包むと \lpe@oi が自分自身を呼び、TeX が止まらなくなる）
      `\\let\\lpe@pre\\relax}`
  );
  // 番号の幅は実際の幅に（既定の「字下げ−空き」だと字下げ 0 のとき負になり、番号の位置が崩れる）
  // 外側のリスト（ぶら下げの大問）の「番号の後の空き」を引き継がないよう、小問用の値を設定し直す
  const subfix = (x) => {
    const xl = x.wrap === 'left';
    const xwi = Number(x.wrapIndent) || 0;
    return `\\setlength{\\itemsep}{${Number(x.gap)}mm}\\setlength{\\labelsep}{${Number(x.sep)}mm}\\settowidth{\\labelwidth}{\\setcounter{\\@enumctr}{1}\\csname label\\@enumctr\\endcsname\\setcounter{\\@enumctr}{0}}${
      xl ? `\\setlength{\\itemindent}{\\dimexpr${Number(x.indent) - xwi}mm+\\labelwidth+\\labelsep\\relax}` : ''
    }`;
  };
  const s2 = l.sub2 || {};
  if (s2.label) {
    // 2 段目の小問（小問の中の小問）は別の字下げ・番号の後の空き。リストの深さではなく enumerate の深さで切り替える
    const lm2 = `${s2.wrap === 'left' ? Number(s2.wrapIndent) || 0 : Number(s2.indent)}mm`;
    L.push(`\\newcommand{\\lpe@subfix}{\\ifnum\\@enumdepth>1 ${subfix(s2)}\\else ${subfix(s)}\\fi}`);
    // 2 段目の enumerate を始める前に、その字下げを（どの深さのリストでも）使うようにする
    L.push(
      `\\newcommand{\\lpe@presub}{\\ifnum\\@enumdepth>0 \\setlength{\\leftmarginii}{${lm2}}\\setlength{\\leftmarginiii}{${lm2}}\\setlength{\\leftmarginiv}{${lm2}}\\setlength{\\leftmarginv}{${lm2}}\\fi}`
    );
    const lab = texSubLabelOf(s2.label, l.sub?.paren === 'full', 'enumii');
    L.push(`\\AtBeginDocument{\\renewcommand{\\labelenumii}{${lab.classic}}}`);
  } else {
    L.push(`\\newcommand{\\lpe@subfix}{${subfix(s)}}`);
    L.push('\\newcommand{\\lpe@presub}{}');
  }
  L.push('\\makeatother');
  // 小問のまとまりの前だけに足す空き（いちばん外側の enumerate の前）
  if (Number(s.before)) {
    L.push(`\\makeatletter\\ifdefined\\AddToHook\\AddToHook{env/enumerate/before}{\\ifnum\\@enumdepth=0 \\par\\vspace{${Number(s.before)}mm}\\fi}\\fi\\makeatother`);
  }
  L.push(...texPartAndBlank(l));
  // ページ番号・ヘッダ
  // 共通テストの「— 1 —」: 全角幅の細い線（明朝の — と同じ高さ）と番号の間を 2.1mm あける
  const kyDash = '\\rule[0.36\\lpebodyzw]{1\\lpebodyzw}{0.1mm}';
  let foot =
    {
      plain: '\\hfil\\thepage\\hfil',
      dash: '\\hfil--- \\thepage\\ ---\\hfil',
      endash: '\\hfil-- \\thepage\\ --\\hfil',
      kyotsu: `\\hfil${kyDash}\\hspace{2.1mm}\\thepage\\hspace{2.1mm}${kyDash}\\hfil`,
      none: '',
    }[l.pageNumber] ?? '\\hfil\\thepage\\hfil';
  const hsz = Number(l.headerSize) > 0 ? `\\fontsize{${Number(l.headerSize)}pt}{${(Number(l.headerSize) * 1.2).toFixed(1)}pt}\\selectfont` : '\\small';
  const hfont = `${l.headerFont === 'gothic' ? '\\sffamily\\gtfamily' : ''}${hsz}`;
  let headText = '';
  if (l.header && l.headerStyle !== 'title') {
    headText =
      l.headerAlign === 'outside'
        ? `\\ifodd\\value{page}\\hfil{${hfont} ${l.header}}\\else{${hfont} ${l.header}}\\hfil\\fi`
        : `\\hfil{${hfont} ${l.header}}\\hfil`;
  }
  L.push('\\makeatletter');
  if (l.contNote) {
    // 大問がページをまたぐとき、そのページの最後の行の下（右寄せ）に「…次ページに続く。」を入れる。
    // 大問の始まりと終わりに目印（mark）を入れ、ページの最後の目印が「始まり」ならまたいでいる
    const note = String(l.contNote).replace(/\{n\}/g, '{\\lpe@m}'); // 和文の文字が命令名に続かないよう {} で囲む
    L.push('\\ifdefined\\NewMarkClass\\NewMarkClass{lpe}\\fi');
    L.push(
      `\\newcommand{\\lpe@contnote}{\\ifdefined\\LastMark\\edef\\lpe@m{\\LastMark{lpe}}\\ifx\\lpe@m\\@empty\\else{\\sffamily\\gtfamily\\fontsize{8pt}{10pt}\\selectfont ${note}}\\fi\\fi}`
    );
    foot = `\\rlap{\\hbox to\\textwidth{\\hfil\\raisebox{\\dimexpr\\footskip-2.9mm\\relax}[0pt][0pt]{\\lpe@contnote}}}${foot}`;
  }
  L.push(`\\def\\ps@lpe{\\def\\@oddhead{${headText}}\\let\\@evenhead\\@oddhead\\def\\@oddfoot{${foot}}\\let\\@evenfoot\\@oddfoot}`);
  // ページ上部の文字を出さないページ（表紙・1 ページ目に大きく見出しを入れたページ）
  L.push(`\\def\\ps@lpeplain{\\def\\@oddhead{}\\let\\@evenhead\\@oddhead\\def\\@oddfoot{${foot}}\\let\\@evenfoot\\@oddfoot}`);
  L.push('\\makeatother');
  L.push('\\pagestyle{lpe}');
  return L;
}

/** 「部」（\Part）と空欄（\blank）の定義 */
export function texPartAndBlank(l) {
  const L = [];
  const p = l.part;
  const st = PART_STYLES.find((x) => x.id === p.style) || PART_STYLES[0];
  const fam = p.font === 'mincho' ? '\\rmfamily\\mcfamily' : '\\sffamily\\gtfamily';
  const sz = Number(p.size) > 0 ? `\\fontsize{${Number(p.size)}pt}{${(Number(p.size) * 1.3).toFixed(1)}pt}\\selectfont` : '';
  L.push('\\newcounter{lpepart}');
  L.push(`\\newcommand{\\lpepartfont}{${fam}${p.bold ? '\\bfseries' : ''}${sz}}`);
  L.push(`\\newcommand{\\lpepartlabel}{${st.tex}}`);
  const label = '{\\lpepartfont\\ifx\\lpe@arg\\@empty\\lpepartlabel\\else\\lpe@arg\\fi}';
  const ind = Number(p.indent) > 0 ? `\\hspace*{${Number(p.indent)}mm}` : '';
  let show;
  if (p.align === 'center') show = `{\\centering${label}\\par}\\nopagebreak\\vspace{${Number(p.spaceAfter)}mm}`;
  else if (p.inline) show = `\\noindent${ind}${label}\\hspace{${Number(p.gap)}mm}\\ignorespaces`;
  else show = `\\noindent${ind}${label}\\par\\nopagebreak\\vspace{${Number(p.spaceAfter)}mm}`;
  L.push('\\makeatletter');
  if (p.hang) {
    // 部の中身全体を字下げする: \Part から次の \Part（または大問の終わり）までを 1 つのリストにし、番号を字下げの中にぶら下げる。
    // 番号は大問の本文の左端から indent、1 行目の本文は「番号の後 gap」と bodyIndent の右の方から、2 行目以降は bodyIndent
    const bi = `${Number(p.bodyIndent) || 0}mm`;
    const pi = `${Number(p.indent) || 0}mm`;
    const pg = `${Number(p.gap) || 0}mm`;
    L.push('\\newif\\iflpe@partopen\\newlength{\\lpe@pw}');
    L.push('\\newcommand{\\lpepartend}{\\iflpe@partopen\\global\\lpe@partopenfalse\\end{list}\\fi}');
    L.push(
      `\\newcommand{\\lpepart}[1][]{\\lpepartend\\par\\vspace{${Number(p.spaceBefore)}mm}\\refstepcounter{lpepart}\\def\\lpe@arg{#1}` +
        `\\settowidth{\\lpe@pw}{${label}}\\addtolength{\\lpe@pw}{\\dimexpr${pi}+${pg}\\relax}\\ifdim\\lpe@pw<${bi}\\setlength{\\lpe@pw}{${bi}}\\fi` +
        `\\begin{list}{}{\\setlength{\\leftmargin}{${bi}}\\setlength{\\itemindent}{\\dimexpr\\lpe@pw-${bi}\\relax}\\setlength{\\labelsep}{${pg}}` +
        `\\setlength{\\labelwidth}{\\dimexpr\\lpe@pw-${pi}-${pg}\\relax}\\setlength{\\topsep}{0pt}\\setlength{\\partopsep}{0pt}\\setlength{\\itemsep}{0pt}` +
        `\\setlength{\\parsep}{\\parskip}\\setlength{\\listparindent}{\\parindent}\\def\\makelabel##1{##1\\hfil}}` +
        `\\global\\lpe@partopentrue\\item[${label}]\\ignorespaces}`
    );
  } else {
    L.push('\\newcommand{\\lpepartend}{}');
    L.push(`\\newcommand{\\lpepart}[1][]{\\par\\vspace{${Number(p.spaceBefore)}mm}\\refstepcounter{lpepart}\\def\\lpe@arg{#1}${show}}`);
  }
  // 空欄: 中身の幅が最小の幅より広ければ広げる
  const b = l.blank;
  const w = `${Math.max(0, Number(b.width) || 0)}mm`;
  const h =
    Number(b.height) > 0
      ? `\\rule[-\\dimexpr(${Number(b.height)}mm-0.88\\zw)/2\\relax]{0pt}{${Number(b.height)}mm}`
      : '\\rule[-0.22\\zw]{0pt}{1.1\\zw}';
  L.push('\\newlength{\\lpe@bw}');
  const measure = (extra) => `\\settowidth{\\lpe@bw}{#1}\\addtolength{\\lpe@bw}{${extra}}\\ifdim\\lpe@bw<${w}\\setlength{\\lpe@bw}{${w}}\\fi`;
  // 共通テストの解答欄: 線の中心で 12.04×5.69mm（文字が 3 字以上なら 1 字ごとに広げる）、ベースラインの下 1.5mm まで。
  // 太い線（0.4mm）が普通の空欄、* は二重の枠（選択肢から選ぶ）、[2] は 2 度目以降の細い線
  const K = KYOTSU_BOX;
  const fx = (x) => +x.toFixed(3);
  const kin = (w, hh, d, t) => `\\hbox to\\dimexpr${w}\\relax{\\hss\\rule[-\\dimexpr${d}\\relax]{0pt}{\\dimexpr${hh}\\relax}{\\lpe@kfont ${t}}\\hss}`;
  const kyotsu =
    `\\settowidth{\\lpe@bw}{\\lpe@kfont #1}\\addtolength{\\lpe@bw}{${K.pad}mm}\\ifdim\\lpe@bw<${K.w}mm\\setlength{\\lpe@bw}{${K.w}mm}\\fi` +
    `\\ifx\\lpe@bo\\lpe@two\\setlength{\\lpe@kr}{${K.thin}mm}\\else\\setlength{\\lpe@kr}{${K.rule}mm}\\fi` +
    `\\setlength{\\fboxsep}{0pt}\\setlength{\\fboxrule}{\\lpe@kr}` +
    `\\ifnum\\lpe@bd=1 \\setlength{\\fboxsep}{\\dimexpr${K.inset}mm-0.5\\lpe@kr-${K.inner / 2}mm\\relax}` +
    `\\fbox{\\setlength{\\fboxsep}{0pt}\\setlength{\\fboxrule}{${K.inner}mm}\\fbox{${kin(`\\lpe@bw-${fx(2 * K.inset)}mm-${K.inner}mm`, `${fx(K.h - 2 * K.inset)}mm-${K.inner}mm`, `${fx(K.depth - K.inset)}mm-${fx(K.inner / 2)}mm`, '#1')}}}` +
    `\\else\\fbox{${kin('\\lpe@bw-\\lpe@kr', `${K.h}mm-\\lpe@kr`, `${K.depth}mm-0.5\\lpe@kr`, '#1')}}\\fi`;
  const body =
    {
      box: `${measure('0.8\\zw')}{\\setlength{\\fboxsep}{0pt}\\setlength{\\fboxrule}{0.5pt}\\ifnum\\lpe@bd=1 \\fbox{\\setlength{\\fboxsep}{0.6pt}\\fbox{\\makebox[\\lpe@bw][c]{${h}\\textup{#1}}}}\\else\\fbox{\\makebox[\\lpe@bw][c]{${h}\\textup{#1}}}\\fi}`,
      bracket: `${measure('0.5\\zw')}［\\makebox[\\lpe@bw][c]{\\textup{#1}}］`,
      paren: `${measure('0.5\\zw')}（\\makebox[\\lpe@bw][c]{\\textup{#1}}）`,
      underline: `${measure('1\\zw')}\\underline{\\makebox[\\lpe@bw][c]{${h}\\textup{#1}}}`,
      kikko: `${measure('0.5\\zw')}〔\\makebox[\\lpe@bw][c]{\\textup{#1}}〕`,
      kyotsu,
    }[b.style] || '#1';
  L.push('\\newlength{\\lpe@kr}\\newcommand{\\lpe@kfont}{\\normalfont\\sffamily\\gtfamily}\\def\\lpe@two{2}');
  // \blank{ア} / \blank*{コ}（二重の枠）/ \blank[2]{ア}（2 度目以降）
  L.push('\\newcommand{\\lpeblank}{\\@ifstar{\\def\\lpe@bd{1}\\lpe@blanko}{\\def\\lpe@bd{0}\\lpe@blanko}}');
  L.push('\\newcommand{\\lpe@blanko}[1][]{\\def\\lpe@bo{#1}\\lpe@blankb}');
  L.push(`\\newcommand{\\lpe@blankb}[1]{\\mbox{${body}}}`);
  L.push('\\makeatother');
  // 利用者向けの名前（プリアンブルで同じ名前を定義していれば、そちらを優先）
  L.push('\\AtBeginDocument{\\providecommand{\\Part}{\\lpepart}\\providecommand{\\blank}{\\lpeblank}}');
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

/** 小問番号の形（SUB_LABELS の id）→ [enumitem が無いときの \labelenumi, enumitem の label]。ctr は enumi / enumii */
export function texSubLabelOf(id, full, ctr = 'enumi') {
  const [classic, enumitem] = SUB_LABEL_TEX[id] || SUB_LABEL_TEX.paren;
  let c = classic.replace(/\{enumi\}/g, `{${ctr}}`);
  let e = enumitem.replace(/\{enumi\}/g, `{${ctr}}`);
  if (full) [c, e] = [c, e].map((s) => s.replace(/^\(/, '（').replace(/\)$/, '）'));
  return { classic: c, enumitem: e };
}

const SUB_LABEL_TEX = {
  pparen: ['\\lpepparen{enumi}', '\\lpepparen*'],
  paren: ['(\\arabic{enumi})', '(\\arabic*)'],
  decimal: ['\\arabic{enumi}.', '\\arabic*.'],
  roman: ['(\\roman{enumi})', '(\\roman*)'],
  alpha: ['(\\alph{enumi})', '(\\alph*)'],
  kata: ['(\\lpekata{enumi})', '(\\lpekata*)'],
  toi: ['問\\arabic{enumi}', '問\\arabic*'],
  toiSp: ['問\\,\\arabic{enumi}', '問\\,\\arabic*'],
  toiDot: ['問\\,\\arabic{enumi}.', '問\\,\\arabic*.'],
  toiPparen: ['問\\lpepparen{enumi}', '問\\lpepparen*'],
  setsumon: ['設問(\\arabic{enumi})：', '設問(\\arabic*)：'],
  aparen: ['\\lpeaparen{enumi}', '\\lpeaparen*'],
  kataPlain: ['\\lpekata{enumi}', '\\lpekata*'],
  toiBold: ['{\\sffamily\\gtfamily\\bfseries 問}\\,\\arabic{enumi}', '{\\sffamily\\gtfamily\\bfseries 問}\\,\\arabic*'],
  toiBoldDot: ['{\\sffamily\\gtfamily\\bfseries 問}\\,\\arabic{enumi}.', '{\\sffamily\\gtfamily\\bfseries 問}\\,\\arabic*.'],
  kataBold: ['{\\sffamily\\gtfamily\\bfseries\\lpekata{enumi}}', '{\\sffamily\\gtfamily\\bfseries\\lpekata*}'],
  numBold: ['{\\sffamily\\gtfamily\\bfseries\\arabic{enumi}}', '{\\sffamily\\gtfamily\\bfseries\\arabic*}'],
  toiParenFull: ['（問\\,\\arabic{enumi}）', '（問\\,\\arabic*）'],
};

export function texSubLabel(l) {
  const full = l.sub?.paren === 'full';
  const { classic, enumitem } = texSubLabelOf(l.subLabel, full);
  // 小問の番号を [label=...] で明示したとき（enumitem が無い環境）にも括弧の形をそろえる
  const parens = full ? ['（', '）'] : ['(', ')'];
  // enumitem の設定。2 行目以降を左に戻すとき（wrap: left）は、番号を indent に置き（wide）、折り返しを wrapIndent に。
  // 小問のまとまりの前後の空きも小問どうしと同じにする（enumitem が無いときの \lpe@pre と同じ）
  const opts = (x) => {
    const g = `${Number(x.gap)}mm`;
    const common = `labelsep=${Number(x.sep)}mm,itemsep=${g},topsep=${g},partopsep=0pt,parsep=0pt`;
    return x.wrap === 'left'
      ? `wide=${Number(x.indent)}mm,leftmargin=${Number(x.wrapIndent) || 0}mm,${common}`
      : `leftmargin=${Number(x.indent)}mm,${common}`;
  };
  const setlist = opts(l.sub || {});
  const s2 = l.sub2 || {};
  const setlist2 = s2.label ? `label=${texSubLabelOf(s2.label, full, 'enumii').enumitem},${opts(s2)}` : '';
  return { classic, enumitem, parens, setlist, setlist2 };
}

/** 大問 1 つ分の LaTeX（見出し＋本文の開始部分と終了部分） */
export function texProblemOpen(l, pl, n, title, stars, isFirst, points) {
  const L = [];
  const head = l.head;
  if (!isFirst && (pl.pageBreakBefore || l.newPageEach)) L.push('\\newpage');
  else if (!isFirst && l.rule) L.push('\\par\\medskip\\hrule\\relax');
  L.push('\\setcounter{lpepart}{0}'); // 部（I, II）の番号は大問ごとに 1 から
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
  // 「…次ページに続く。」のための目印（大問の始まり＝番号、終わり＝空）。終わりの目印は本文の最後の段落の直後に置く
  if (l.contNote) L.push(`\\ifdefined\\InsertMark\\InsertMark{lpe}{${n}}\\fi`);
  const tail = [...(l.contNote ? ['\\ifdefined\\InsertMark\\InsertMark{lpe}{}\\fi'] : []), ...(l.part?.hang ? ['\\lpepartend'] : [])];
  const close = (inner) => [...tail, ...inner, ...(frame ? ['\\end{minipage}}\\endgroup'] : [])];
  // 番号を本文の左端より外（余白側）に出す量
  const od = Number(head.outdent) > 0 ? `\\hspace*{-${Number(head.outdent)}mm}` : '';
  if (head.position === 'inline') {
    // 番号の直後から本文が始まり、2 行目以降は左端に戻る。outdent があれば番号を余白側に張り出す
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
      `\\begin{list}{}{\\setlength{\\leftmargin}{\\lpehangw}\\setlength{\\labelwidth}{\\dimexpr\\lpehangw-${gapMm}mm\\relax}\\setlength{\\labelsep}{${gapMm}mm}\\setlength{\\topsep}{0pt}\\setlength{\\partopsep}{0pt}\\setlength{\\parsep}{\\parskip}\\setlength{\\listparindent}{\\parindent}\\def\\makelabel#1{#1\\hfil}}`
    );
    const headLine = t || st || ptsAfter ? `${t ? `{\\lpeheadfont ${title}}` : ''}${ptsAfter}${st}\\par\\vspace{${Number(l.spaceAfterHead)}mm}` : '';
    L.push(`\\item[{\\lpeheadfont\\lpenum{${n}}}]${headLine}`);
    return { open: L, close: close(['\\end{list}']) };
  }
  const line = `{\\lpeheadfont\\lpenum{${n}}}${t}${ptsAfter}`;
  if (head.align === 'center') L.push(`{\\centering ${line}\\par}${ptsRight || st ? `\\noindent\\hfill${ptsRight.replace('\\hfill', '')}${st.replace('\\hfill', '')}\\par` : ''}`);
  else L.push(`\\noindent${od}${line}${ptsRight}${st}\\par`);
  L.push(`\\nopagebreak\\vspace{${Number(l.spaceAfterHead)}mm}`);
  L.push('\\begin{lpebody}');
  return { open: L, close: close(['\\end{lpebody}']) };
}
