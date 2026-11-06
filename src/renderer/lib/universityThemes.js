// 大学入試（二次試験・数学）の問題冊子の体裁を近似したテーマ。
// 各大学の公開 PDF（スキャンを含む）を画像にし、画像解析で測った位置（mm）にもとづく。
//   - 用紙の左端からの本文・大問番号の位置、右余白、1 行目の上端
//   - 本文の文字の大きさ（1 行の幅 ÷ 1 行の文字数）、行送り
//   - 小問番号の位置・番号の後の空き・折り返し位置
// トンボ付きの PDF は裁ち落とし後の B5 の座標に直している。
// 問題文は含まず、体裁だけを再現する。フォント（リュウミン・Century 系など）や印刷管理コードは再現していない。
// 位置の誤差は ±0.5mm 程度（画像の解像度と、文字の形による差）。

const PT_MM = 25.4 / 72.27;
/** n 行 → mm（文字サイズ pt・行送り lh 倍のとき） */
const ln = (n, pt, lh) => Math.round(n * pt * lh * PT_MM * 10) / 10;

function theme(id, name, desc, source, pt, lh, layout, meta = {}) {
  return {
    id,
    name,
    desc,
    source,
    university: true,
    layout: { titleBlock: false, bodyPt: pt, lineHeight: lh, charsPerLine: 0, marginBottom: 22, ...layout },
    meta: { answerMode: 'separate', spaceAfter: 0, showDifficulty: false, ...meta },
  };
}

export const UNIVERSITY_THEMES = [
  // 東京大学：「第 1 問」を中央に。本文 13.7〜168.1mm（左右とも約 13.8mm）。(1) は本文の左端、折り返しは 1 字下げ
  theme('univ-tokyo', '東京大学', '「第 1 問」中央・1問1ページ・B5', 'https://www.u-tokyo.ac.jp/ja/admissions/undergraduate/r8_exam.html', 11.5, 1.9, {
    paper: 'b5',
    marginLeft: 13.7,
    marginRight: 13.4,
    marginTop: 26.5,
    head: { style: 'daiSpaced', font: 'gothic', bold: true, size: 13, position: 'above', align: 'center', showTitle: false, gap: 0 },
    spaceBefore: 0,
    spaceAfterHead: 12,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'half', indent: 0, sep: 1.9, gap: 2.5, wrap: 'left', wrapIndent: 3.9 },
    subLabel: 'paren',
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'blank',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }),
  // 京都大学：□番号（約 7.3mm 角）は 22.9mm、本文は 30.5〜157.1mm（段落の 1 行目は 33.7mm）。配点は右端
  theme('univ-kyoto', '京都大学', '□枠番号・右端に配点・⑴・「，．」', 'https://www.kyoto-u.ac.jp/ja/admissions/undergrad/past-eq/r8-eq', 10, 2.0, {
    paper: 'b5',
    marginLeft: 22.9,
    marginRight: 24.5,
    marginTop: 25.5,
    head: { style: 'box', boxRule: 'thin', boxSize: 7.3, font: 'gothic', bold: false, size: 13, position: 'above', align: 'left', showTitle: false, gap: 3 },
    spaceBefore: 14,
    spaceAfterHead: 1.5,
    bodyIndent: 7.6,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'half', indent: 8.8, sep: 5.3, gap: 3, wrap: 'hang', wrapIndent: 0 },
    subLabel: 'pparen',
    displayAlign: 'left',
    mathIndent: 16.7,
    pointsStyle: 'right',
    pointsFormat: '({n}点)',
    pageNumber: 'dash',
    punct: 'commaPeriod',
    endText: '問題は，このページで終わりである。',
  }),
  // 東北大学：本文 27.2〜157.8mm。□番号は本文の左端より 3.3mm 外。1 行目は番号の後、折り返しは本文の左端
  theme('univ-tohoku', '東北大学', '□枠番号を余白に張り出し・(1)・B5', 'https://admissions.tohoku.ac.jp/ja/materials/ito/', 11, 1.72, {
    paper: 'b5',
    marginLeft: 27.6,
    marginRight: 23.8,
    marginTop: 27.4,
    head: { style: 'box', boxRule: 'thin', boxSize: 5.6, font: 'mincho', bold: false, size: 11, position: 'inline', outdent: 3.7, showTitle: false, gap: 5.4 },
    spaceBefore: 18,
    parIndent: false,
    parSkip: 0,
    sub: { paren: 'half', indent: 6.8, sep: 2.7, gap: 2, wrap: 'hang', wrapIndent: 0 },
    subLabel: 'paren',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }),
  // 名古屋大学：A4。本文 28.1〜190.5mm、太枠番号は本文の左端より 6.1mm 外。⑴ は本文の左端
  theme('univ-nagoya', '名古屋大学', '太枠番号を余白に張り出し・⑴・1行約60字', 'https://www.nagoya-u.ac.jp/admissions/exam/data/answer/sub/post_642.html', 7.7, 2.1, {
    paper: 'a4',
    marginLeft: 27.8,
    marginRight: 19.2,
    marginTop: 23.8,
    header: '問　題　紙',
    headerStyle: 'title',
    head: { style: 'box', boxRule: 'thick', boxSize: 6.0, font: 'gothic', bold: true, size: 11, position: 'inline', outdent: 5.8, showTitle: false, gap: 3.1 },
    spaceBefore: 4,
    parIndent: false,
    parSkip: 0,
    sub: { paren: 'half', indent: 6.3, sep: 3.4, gap: 0, wrap: 'hang', wrapIndent: 0 },
    subLabel: 'pparen',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }),
  // 九州大学：〔 1 〕は 24.6mm、本文は 30.1〜158.2mm。(1) は本文から少し内側、折り返しは番号の右
  theme('univ-kyushu', '九州大学', '〔 1 〕と(配点)・1問1ページ＋下書き用紙', 'https://www.kyushu-u.ac.jp/ja/admission/faculty/exam_question', 10.4, 1.7, {
    paper: 'b5',
    marginLeft: 23.6,
    marginRight: 23.3,
    marginTop: 29.5,
    head: { style: 'bracketSp', font: 'gothic', bold: true, size: 13, position: 'above', align: 'left', showTitle: false, gap: 7.6 },
    spaceBefore: 0,
    spaceAfterHead: 4,
    bodyIndent: 6.6,
    parIndent: false,
    parSkip: 0,
    sub: { paren: 'half', indent: 8.8, sep: 2.7, gap: 0.5, wrap: 'hang', wrapIndent: 0 },
    subLabel: 'paren',
    pointsStyle: 'after',
    pointsFormat: '(配点{n}点)',
    newPageEach: true,
    afterEach: 'draft',
    draftText: '(下書き用紙)',
    pageNumber: 'endash',
    punct: 'commaMaru',
  }),
  // 北海道大学：A4 のスキャン。□番号 42.8mm、本文 52.7〜164.1mm（ぶら下げ）
  theme('univ-hokudai', '北海道大学', '□枠番号をぶら下げ・(1)', 'https://www.hokudai.ac.jp/admission/R08_Aexam_MathB.pdf', 9.6, 1.8, {
    paper: 'a4',
    marginLeft: 42.8,
    marginRight: 45.5,
    marginTop: 46.2,
    head: { style: 'box', boxRule: 'thin', boxSize: 5.4, font: 'mincho', bold: false, size: 10, position: 'hanging', showTitle: false, gap: 3.5 },
    spaceBefore: 12,
    bodyIndent: 9.6,
    parIndent: false,
    parSkip: 0,
    sub: { paren: 'half', indent: 0, sep: 0.5, gap: 2, wrap: 'hang', wrapIndent: 0 },
    subLabel: 'paren',
    displayAlign: 'center',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }),
  // 東京科学大学：太枠番号 23.9mm と「(60点)」。⑴ は 31.1mm、本文は ⑴ の後、折り返しは 34.8mm。字間が広い
  theme('univ-isct', '東京科学大学', '太枠番号と(点)・⑴・1問1ページ', 'https://admissions.isct.ac.jp/ja/013/undergraduate/examination-questions', 10.7, 1.97, {
    paper: 'b5',
    marginLeft: 23.9,
    marginRight: 24.2,
    marginTop: 25.8,
    letterSpace: 0.11,
    head: { style: 'box', boxRule: 'thick', boxSize: 7.1, font: 'gothic', bold: false, size: 12, position: 'above', align: 'left', showTitle: false, gap: 4.3 },
    spaceBefore: 0,
    spaceAfterHead: 1.5,
    bodyIndent: 7.2,
    parIndent: false,
    parSkip: 0,
    sub: { paren: 'half', indent: 0, sep: 3.7, gap: 3, wrap: 'left', wrapIndent: 3.7 },
    subLabel: 'pparen',
    pointsStyle: 'after',
    pointsFormat: '({n}点)',
    newPageEach: true,
    afterEach: 'draft',
    draftText: '(下書き用紙)',
    pageNumber: 'dash',
    punct: 'commaPeriod',
  }),
  // 一橋大学：本文 33.9〜154.1mm。太枠番号は本文の左端より 9.9mm 外、1 行目は番号の後。字間が広い
  theme('univ-hitotsubashi', '一橋大学', '太枠番号を余白に張り出し・(1)', 'https://juken.hit-u.ac.jp/admission/info/ito_26.html', 11.3, 1.68, {
    paper: 'b5',
    marginLeft: 33.9,
    marginRight: 27.4,
    marginTop: 27.8,
    letterSpace: 0.12,
    head: { style: 'box', boxRule: 'thick', boxSize: 7.6, font: 'gothic', bold: false, size: 12, position: 'inline', outdent: 9.9, showTitle: false, gap: 5.2 },
    spaceBefore: 20,
    parIndent: false,
    parSkip: 0,
    sub: { paren: 'half', indent: 13.5, sep: 5.2, gap: 3, wrap: 'hang', wrapIndent: 0 },
    subLabel: 'paren',
    displayAlign: 'center',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }),
  // 神戸大学：「1.」は 24.7mm、本文は 33.8〜157.2mm（ぶら下げ）。(1) は本文の左端
  theme('univ-kobe', '神戸大学', '「1.」をぶら下げ・前文末に配点・「，．」', 'https://www.office.kobe-u.ac.jp/stdnt-examinavi/juken/past_exam/2026/5999.html', 12.5, 1.77, {
    paper: 'b5',
    marginLeft: 24.4,
    marginRight: 24.2,
    marginTop: 25.7,
    head: { style: 'dot', font: 'mincho', bold: true, size: 14, position: 'hanging', showTitle: false, gap: 2.9 },
    spaceBefore: 0,
    bodyIndent: 9.4,
    parIndent: false,
    parSkip: 0,
    sub: { paren: 'half', indent: 6.8, sep: 1.3, gap: 0, wrap: 'hang', wrapIndent: 0 },
    subLabel: 'paren',
    displayAlign: 'center',
    pointsStyle: 'bodyEnd',
    pointsFormat: '(配点{n}点)',
    newPageEach: true,
    afterEach: 'blank',
    pageNumber: 'dash',
    punct: 'commaPeriod',
  }),
  // 慶應義塾大学（理工）：A4 のスキャン。「1」は単独行、本文 23.0〜181.9mm、段落の 1 行目は 1 字下げ。（1）の折り返しは 7.5mm 下げ
  theme('univ-keio', '慶應義塾大学（理工）', '太字「1」単独行・（1）・字下げ折り返し', 'https://www.keio.ac.jp/ja/admissions/faculty/examinations/general-admissions/question-2026/', 11.3, 1.7, {
    paper: 'a4',
    marginLeft: 22.6,
    marginRight: 27.7,
    marginTop: 29.0,
    head: { style: 'number', font: 'mincho', bold: true, size: 15, position: 'above', align: 'left', showTitle: false, gap: 0 },
    spaceBefore: 8,
    spaceAfterHead: 3,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'full', indent: 0, sep: 1.5, gap: 2.5, wrap: 'left', wrapIndent: 7.5 },
    subLabel: 'paren',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }),
];

// 新潟大学：公式の問題 PDF は非公開（入試課で閲覧のみ）。予備校が公開している本試験冊子のスキャン
// （理系冊子 2025 年度。2024・2023 年度も同じ体裁）を計測した。
// 太枠の大きな番号（約 12mm 角）は 18.6mm、本文は 36.6〜156.8mm（ぶら下げ）。(1) は本文から 1mm、本文は +7.9mm
UNIVERSITY_THEMES.push(
  theme('univ-niigata', '新潟大学', '太枠の大きな番号をぶら下げ・(1)・1問1ページ', 'https://www.niigata-u.ac.jp/admissions/disclosure', 11.4, 2.0, {
    paper: 'b5',
    marginLeft: 18.6,
    marginRight: 24.8,
    marginTop: 31.2,
    head: { style: 'box', boxRule: 'thick', boxSize: 12.2, font: 'gothic', bold: true, size: 21, position: 'hanging', showTitle: false, gap: 5.4 },
    spaceBefore: 0,
    bodyIndent: 17.4,
    parIndent: false,
    parSkip: 0,
    sub: { paren: 'half', indent: 8.2, sep: 1.7, gap: 7.5, wrap: 'hang', wrapIndent: 0 }, // 小問の前後は実測で約 7.5mm の空き
    subLabel: 'paren',
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'blank',
    pageNumber: 'dash',
    punct: 'commaMaru',
  })
);

/** 調査したが体裁を確認できなかった大学（テーマは作っていない） */
export const UNVERIFIED_UNIVERSITIES = [
  { name: '早稲田大学', reason: '公式サイトの問題 PDF を自動取得できず、体裁を確認できていません。' },
  { name: '大阪大学', reason: '公式サイトに問題冊子が公開されておらず（解答例・出題の意図のみ）、確認できていません。' },
];
