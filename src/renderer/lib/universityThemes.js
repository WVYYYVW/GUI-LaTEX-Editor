// 大学入試（二次試験・数学）の問題冊子の体裁を近似したテーマ。
// 2026 年度（R8）の公式公開 PDF を描画・拡大して測った値にもとづく（多くは R7 とも同じ体裁を確認）。
// 問題文は含まず、見出し・番号・字下げ・行組みなどの「体裁」だけを再現する。
// 値は「字」（本文の全角 1 字）単位の目測を mm に換算したもので、±0.5 字程度の誤差がある。
// フォント（リュウミン・Century 系など）や印刷管理コードは再現していない。

const PT_MM = 25.4 / 72.27;
/** n 字 → mm（本文の文字サイズ pt のとき） */
const z = (n, pt) => Math.round(n * pt * PT_MM * 100) / 100;
/** n 行 → mm（文字サイズ pt・行送り lh 倍のとき） */
const ln = (n, pt, lh) => Math.round(n * pt * lh * PT_MM * 10) / 10;

function theme(id, name, desc, source, pt, lh, layout, meta = {}) {
  return {
    id,
    name,
    desc,
    source,
    university: true,
    layout: { titleBlock: false, bodyPt: pt, lineHeight: lh, margin: 18, ...layout },
    meta: { answerMode: 'separate', spaceAfter: 0, showDifficulty: false, ...meta },
  };
}

export const UNIVERSITY_THEMES = [
  (() => {
    const pt = 11.5;
    const lh = 1.9;
    return theme('univ-tokyo', '東京大学', '「第 1 問」中央・1問1ページ・B5', 'https://www.u-tokyo.ac.jp/ja/admissions/undergraduate/r8_exam.html', pt, lh, {
      paper: 'b5',
      charsPerLine: 38,
      head: { style: 'daiSpaced', font: 'gothic', bold: true, size: 13, position: 'above', align: 'center', showTitle: false, gap: 0 },
      spaceBefore: 0,
      spaceAfterHead: ln(2, pt, lh) - 2,
      parIndent: true,
      parSkip: 0,
      sub: { paren: 'half', indent: 0, sep: z(0.6, pt), gap: ln(1, pt, lh) - 3, wrap: 'left', wrapIndent: z(1, pt) },
      subLabel: 'paren',
      displayAlign: 'center',
      newPageEach: true,
      afterEach: 'blank',
      pageNumber: 'dash',
      punct: 'commaMaru',
    });
  })(),
  (() => {
    const pt = 10.5;
    const lh = 2.0;
    return theme('univ-kyoto', '京都大学', '□枠番号・右端に配点・⑴・「，．」', 'https://www.kyoto-u.ac.jp/ja/admissions/undergrad/past-eq/r8-eq', pt, lh, {
      paper: 'b5',
      charsPerLine: 36,
      head: { style: 'box', boxRule: 'thin', font: 'gothic', bold: false, size: 14, position: 'above', align: 'left', showTitle: false, gap: z(1, pt) },
      spaceBefore: ln(4.5, pt, lh),
      spaceAfterHead: 0,
      bodyIndent: z(1.5, pt),
      parIndent: true,
      parSkip: 0,
      sub: { paren: 'half', indent: z(2.5, pt), sep: z(1.5, pt), gap: ln(1, pt, lh) - 3, wrap: 'hang', wrapIndent: 0 }, // ⑴ は本文の左端・1.5 字空け
      subLabel: 'pparen',
      displayAlign: 'left',
      mathIndent: z(3.5, pt),
      pointsStyle: 'right',
      pointsFormat: '({n}点)',
      pageNumber: 'dash',
      punct: 'commaPeriod',
      endText: '問題は，このページで終わりである。',
    });
  })(),
  (() => {
    const pt = 10;
    const lh = 2.0;
    return theme('univ-tohoku', '東北大学', '□枠番号をぶら下げ・(1)・B5', 'https://admissions.tohoku.ac.jp/ja/materials/ito/', pt, lh, {
      paper: 'b5',
      charsPerLine: 34,
      head: { style: 'box', boxRule: 'thin', font: 'mincho', bold: false, size: pt, position: 'hanging', showTitle: false, gap: z(1.3, pt) },
      spaceBefore: ln(2, pt, lh),
      bodyIndent: 0,
      parIndent: false,
      parSkip: 0,
      sub: { paren: 'half', indent: 0, sep: z(0.5, pt), gap: ln(1, pt, lh) - 3, wrap: 'hang', wrapIndent: 0 },
      subLabel: 'paren',
      pageNumber: 'dash',
      punct: 'commaMaru',
    });
  })(),
  (() => {
    const pt = 8; // 実測: 1 行 約 60 字で本文幅 約 169mm
    const lh = 2.1; // 実測: 行送り 約 6.2mm
    return theme('univ-nagoya', '名古屋大学', '太枠番号・直後に本文・⑴・1行約60字', 'https://www.nagoya-u.ac.jp/admissions/exam/data/answer/sub/post_642.html', pt, lh, {
      paper: 'a4',
      charsPerLine: 60,
      header: '問　題　紙',
      headerStyle: 'title',
      head: { style: 'box', boxRule: 'thick', font: 'gothic', bold: true, size: 11, position: 'inline', showTitle: false, gap: z(0.5, pt) },
      spaceBefore: ln(1, pt, lh),
      parIndent: false,
      parSkip: 0,
      sub: { paren: 'half', indent: z(1, pt), sep: z(1, pt), gap: 0, wrap: 'left', wrapIndent: z(1.5, pt) },
      subLabel: 'pparen',
      pageNumber: 'dash',
      punct: 'commaMaru',
    });
  })(),
  (() => {
    const pt = 10;
    const lh = 1.6; // 実測: 行送り 約 5.8mm
    return theme('univ-kyushu', '九州大学', '〔 1 〕と(配点)・1問1ページ＋下書き用紙', 'https://www.kyushu-u.ac.jp/ja/admission/faculty/exam_question', pt, lh, {
      paper: 'b5',
      charsPerLine: 35,
      margin: 25,
      head: { style: 'bracketSp', font: 'gothic', bold: true, size: 13, position: 'above', align: 'left', showTitle: false, gap: z(1.5, pt) },
      spaceBefore: 0,
      spaceAfterHead: ln(0.5, pt, lh),
      bodyIndent: z(2, pt),
      parIndent: false,
      parSkip: 0,
      sub: { paren: 'half', indent: z(2.2, pt), sep: z(0.5, pt), gap: 0, wrap: 'hang', wrapIndent: 0 }, // (1) は本文から 0.5 字内側
      subLabel: 'paren',
      pointsStyle: 'after',
      pointsFormat: '(配点{n}点)',
      newPageEach: true,
      afterEach: 'draft',
      draftText: '(下書き用紙)',
      pageNumber: 'endash',
      punct: 'commaMaru',
    });
  })(),
  (() => {
    const pt = 10.5;
    const lh = 1.8;
    return theme('univ-hokudai', '北海道大学', '□枠番号をぶら下げ・(1)', 'https://www.hokudai.ac.jp/admission/R08_Aexam_MathB.pdf', pt, lh, {
      paper: 'b5',
      charsPerLine: 33,
      head: { style: 'box', boxRule: 'thin', font: 'mincho', bold: false, size: pt, position: 'hanging', showTitle: false, gap: z(0.5, pt) },
      spaceBefore: ln(2, pt, lh),
      parIndent: false,
      parSkip: 0,
      sub: { paren: 'half', indent: z(2.4, pt), sep: z(0.6, pt), gap: ln(1, pt, lh) - 3, wrap: 'hang', wrapIndent: 0 },
      subLabel: 'paren',
      displayAlign: 'center',
      pageNumber: 'dash',
      punct: 'commaMaru',
    });
  })(),
  (() => {
    const pt = 10.5;
    const lh = 1.9;
    return theme('univ-isct', '東京科学大学', '太枠番号と(点)・⑴・1問1ページ', 'https://admissions.isct.ac.jp/ja/013/undergraduate/examination-questions', pt, lh, {
      paper: 'b5',
      charsPerLine: 30,
      head: { style: 'box', boxRule: 'thick', font: 'gothic', bold: false, size: pt, position: 'above', align: 'left', showTitle: false, gap: z(1, pt) },
      spaceBefore: 0,
      spaceAfterHead: 0,
      parIndent: false,
      parSkip: 0,
      sub: { paren: 'half', indent: z(3.5, pt), sep: z(1, pt), gap: ln(1.5, pt, lh) - 4, wrap: 'hang', wrapIndent: 0 },
      subLabel: 'pparen',
      pointsStyle: 'after',
      pointsFormat: '({n}点)',
      newPageEach: true,
      afterEach: 'draft',
      draftText: '(下書き用紙)',
      pageNumber: 'dash',
      punct: 'commaPeriod',
    });
  })(),
  (() => {
    const pt = 11;
    const lh = 1.5;
    return theme('univ-hitotsubashi', '一橋大学', '太枠番号・直後に本文・(1)', 'https://juken.hit-u.ac.jp/admission/info/ito_26.html', pt, lh, {
      paper: 'b5',
      charsPerLine: 27,
      head: { style: 'box', boxRule: 'thick', font: 'gothic', bold: false, size: pt, position: 'inline', showTitle: false, gap: z(1.2, pt) },
      spaceBefore: ln(3, pt, lh),
      parIndent: false,
      parSkip: 0,
      sub: { paren: 'half', indent: z(3.7, pt), sep: z(1.5, pt), gap: ln(1, pt, lh) - 3, wrap: 'hang', wrapIndent: 0 }, // (1) は本文から 1 字内側
      subLabel: 'paren',
      displayAlign: 'center',
      pageNumber: 'dash',
      punct: 'commaMaru',
    });
  })(),
  (() => {
    const pt = 10.5;
    const lh = 1.75;
    return theme('univ-kobe', '神戸大学', '「1.」をぶら下げ・前文末に配点・「，．」', 'https://www.office.kobe-u.ac.jp/stdnt-examinavi/juken/past_exam/2026/5999.html', pt, lh, {
      paper: 'b5',
      charsPerLine: 28,
      head: { style: 'dot', font: 'mincho', bold: true, size: 14, position: 'hanging', showTitle: false, gap: z(0.3, pt) },
      spaceBefore: 0,
      parIndent: false,
      parSkip: 0,
      sub: { paren: 'half', indent: z(1.7, pt), sep: z(0.5, pt), gap: 0, wrap: 'hang', wrapIndent: 0 }, // (1) は本文の左端
      subLabel: 'paren',
      displayAlign: 'center',
      pointsStyle: 'bodyEnd',
      pointsFormat: '(配点{n}点)',
      newPageEach: true,
      afterEach: 'blank',
      pageNumber: 'dash',
      punct: 'commaPeriod',
    });
  })(),
  (() => {
    const pt = 10.5;
    const lh = 1.8;
    return theme('univ-keio', '慶應義塾大学（理工）', '太字「1」単独行・（1）・字下げ折り返し', 'https://www.keio.ac.jp/ja/admissions/faculty/examinations/general-admissions/question-2026/', pt, lh, {
      paper: 'b5',
      charsPerLine: 40,
      head: { style: 'number', font: 'mincho', bold: true, size: 13, position: 'above', align: 'left', showTitle: false, gap: 0 },
      spaceBefore: ln(1.5, pt, lh),
      spaceAfterHead: 1,
      parIndent: true,
      parSkip: 0,
      sub: { paren: 'full', indent: 0, sep: z(1, pt) - z(0.5, pt), gap: ln(1, pt, lh) - 3, wrap: 'left', wrapIndent: z(2, pt) },
      subLabel: 'paren',
      pageNumber: 'dash',
      punct: 'commaMaru',
    });
  })(),
];

// 新潟大学：公式の問題 PDF は非公開（入試課で閲覧のみ）。予備校が公開している本試験冊子のスキャン
// （理系冊子 2025 年度。2024・2023 年度も同じ体裁）を計測した。
UNIVERSITY_THEMES.push(
  (() => {
    const pt = 11;
    const lh = 2.0;
    return theme(
      'univ-niigata',
      '新潟大学',
      '太枠の大きな番号をぶら下げ・(1)・1問1ページ',
      'https://www.niigata-u.ac.jp/admissions/disclosure',
      pt,
      lh,
      {
        paper: 'b5',
        charsPerLine: 30,
        head: { style: 'box', boxRule: 'thick', font: 'gothic', bold: true, size: 20, position: 'hanging', showTitle: false, gap: z(1.5, pt) },
        spaceBefore: 0,
        bodyIndent: z(4.6, pt), // 本文の左端は枠の左端から約 4.6 字
        parIndent: false,
        parSkip: 0,
        sub: { paren: 'half', indent: z(2, pt), sep: z(0.6, pt), gap: ln(1, pt, lh) - 3, wrap: 'hang', wrapIndent: 0 }, // (1) は本文の左端、本文は 2 字目から
        subLabel: 'paren',
        displayAlign: 'center',
        newPageEach: true,
        afterEach: 'blank',
        pageNumber: 'dash',
        punct: 'commaMaru',
      }
    );
  })()
);

/** 調査したが体裁を確認できなかった大学（テーマは作っていない） */
export const UNVERIFIED_UNIVERSITIES = [
  { name: '早稲田大学', reason: '公式サイトの問題 PDF を自動取得できず、体裁を確認できていません。' },
  { name: '大阪大学', reason: '公式サイトに問題冊子が公開されておらず（解答例・出題の意図のみ）、確認できていません。' },
];
