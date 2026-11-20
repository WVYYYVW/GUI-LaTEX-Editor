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

// ---------------- 大学入学共通テスト ----------------
// 大学入試センターが公開している令和 8 年度本試験の「数学①」「数学②」の問題冊子（B5・文字情報のある PDF）の
// 文字と罫線の座標を読み取って測った。本文 24.0〜158.0mm（10pt・1 行 38 字・行送り 7.05mm）、1 行目のベースライン 31.1mm。
//   - 「第1問」はゴシック 14pt を 23.3mm に、同じ行に「（配点　30）」。大問の本文は +1 字（27.5mm）、段落は 1 字下げ
//   - 〔1〕〔2〕は 25.7mm に置き、その中身は 34.6mm（大問の本文 +2 字）から。⑴ は中身の左端、本文 +2 字、折り返し +1 字。(i) も同じ形
//   - 解答欄は線の中心で 12.04×5.69mm の太枠（線 0.4mm）にゴシックの片仮名。3 字以上は 1 字ごとに広がる。選択肢から選ぶ欄は二重の枠、
//     2 度目以降は細い枠。本文では \blank{ア}・\blank*{コ}・\blank[2]{ア} と書く
//   - 別行立ての式は左寄せ（+4 字）、前後に 1 行ずつ空ける
//   - ページ上部の科目名（ゴシック 12pt）は奇数ページは右、偶数ページは左、ベースライン 21.1mm。最初のページは中央に大きく（22pt）
//   - ページ番号「— 4 —」はベースライン 243.4mm。大問が次のページに続くときは最後の行の下に「（…第1問は次ページに続く。）」（8pt）
//   - 表紙: 上に枠で囲んだ注意、「数　学　①」と科目、右に（100点／70分）、「I　注意事項」、下に「II　解答上の注意」。裏表紙に解答上の注意
// 表紙と裏表紙の文面は実物と同じ構成で、言い回しは独自のもの。
// 表せないもの・違うもの: 実物は 1 ページごとに手で組んでいて、大問の途中でも余白を大きく取ってページを替える（ここでは TeX が自動で
//   改ページする）／〔2〕の前の改ページ（必要なら本文に \newpage）／表紙の右上の「Ⓛ」や「(2103—1)」などの印刷管理の印／
//   (i) の字形（実物は 1 字の外字）／マークシートの見本の図（表で代用）。
const KYOTSU_BACK_NOTES = [
  '解答は，解答用紙の問題番号に対応する解答欄にマークしなさい。',
  '問題文中の \\blank{ア}，\\blank{イウ} などには，符号（$-$）または数字（$0$〜$9$）が一つずつ入ります。ア，イ，ウ，…の一つ一つを，解答用紙のア，イ，ウ，…の欄にマークして答えなさい。',
  '例えば \\blank{アイウ} に $-83$ と答えるときは，次のようにマークします。',
  '|欄|ア|イ|ウ',
  '|マークするもの|$-$|$8$|$3$',
  '分数で答えるときは，符号は分子につけ，それ以上約分できない形で答えなさい。',
  '小数で答えるときは，指定された桁の一つ下の桁を四捨五入して答えなさい。指定された桁までの $0$ もマークしなさい。',
  '根号を含む形で答えるときは，根号の中の自然数ができるだけ小さくなる形で答えなさい。',
  '二重の枠で示した \\blank*{コ} などには，選択肢の中から一つを選んで答えなさい。',
  '同じ欄が問題文中に 2 度以上出てくるときは，2 度目からは \\blank[2]{サシ} のように細い枠で示します。',
].join('\n');

function kyotsuTheme(id, name, desc, header, cover, title) {
  return {
    id,
    name,
    desc,
    source: 'https://www.dnc.ac.jp/kyotsu/kakomondai/r8/r8_honshiken_mondai.html',
    university: true,
    layout: {
      titleBlock: false,
      paper: 'b5',
      marginLeft: 24.0,
      marginRight: 24.0,
      marginTop: 26.2, // ltjsarticle の topskip（約 13.9pt）の分（1 行目のベースラインが 31.1mm になる）
      marginBottom: 29.0, // 1 ページ 29 行
      bodyPt: 10,
      lineHeight: 2.0,
      charsPerLine: 0,
      header,
      headerStyle: 'both',
      headerAlign: 'outside',
      headerSize: 12,
      headerFont: 'gothic',
      headBaseline: 21.1,
      footBaseline: 243.4,
      title: { size: 22, font: 'gothic', bold: false, baseline: 36.9, subSize: 12, subBaseline: 45.1, next: 59.8, ...title },
      contNote: `（${header}第{n}問は次ページに続く。）`,
      head: { style: 'dai', font: 'gothic', bold: false, size: 14, position: 'above', align: 'left', showTitle: false, gap: 3.0, outdent: 0.7 },
      spaceBefore: 0,
      spaceAfterHead: 6.6,
      bodyIndent: 3.5,
      parIndent: true,
      parSkip: 0,
      part: { style: 'arabicKikko', font: 'mincho', bold: false, size: 0, align: 'left', hang: true, indent: 0, bodyIndent: 7.05, gap: 0, spaceBefore: 0, spaceAfter: 0 },
      sub: { paren: 'half', indent: 0, sep: 3.5, gap: 7.05, wrap: 'left', wrapIndent: 3.5 },
      subLabel: 'pparen',
      sub2: { label: 'roman', indent: 0, sep: 4.4, gap: 7.05, wrap: 'left', wrapIndent: 3.5 },
      blank: { style: 'kyotsu', width: 12, height: 0 },
      displayAlign: 'left',
      mathIndent: 14.1,
      displaySkip: 7.03,
      displaySkipAbove: 9.4, // 式の上は行送りの調整が入らないので、そのぶん多めに（前後とも 1 行空き）
      pointsStyle: 'after',
      pointsFormat: '（配点　{n}）',
      newPageEach: true,
      afterEach: 'none',
      pageNumber: 'kyotsu',
      punct: 'commaMaru',
    },
    meta: {
      answerMode: 'separate',
      spaceAfter: 0,
      showDifficulty: false,
      cover: {
        enabled: true,
        style: 'kyotsu',
        header: '',
        target: '',
        idField: false,
        notesTitle: '注　意　事　項',
        footer: '試験開始の合図があるまで，この問題冊子を開いてはいけません。',
        backTitle: '解答上の注意',
        backRef: '解答上の注意は裏表紙に書いてあります。問題冊子を裏返して必ず読みなさい。',
        backNotes: KYOTSU_BACK_NOTES,
        pageNumber: true,
        points: '100点',
        time: '70分',
        timeLabel: '',
        ...cover,
      },
    },
  };
}

export const KYOTSU_THEMES = [
  kyotsuTheme(
    'kyotsu-math1',
    '共通テスト（数学①）',
    '表紙・注意事項・解答欄の枠まで共通テストの冊子に合わせる',
    '数学Ⅰ，数学Ａ',
    {
      subject: '数　学　①',
      subtitle: '〔『数学Ⅰ，数学Ａ』〕',
      firstPage: 4,
      notes: [
        '出題科目とページは，次の表のとおりです。',
        '|出　題　科　目|ペ　ー　ジ|解　答　方　法',
        '|『数学Ⅰ，数学Ａ』|4〜|全部の問題に解答しなさい。',
        '解答用紙に正しく記入・マークしていない場合は，採点できないことがあります。とくに，解答用紙の\\textbf{解答科目欄にマークがない場合や，複数の科目にマークした場合は，0点になります。}',
        '試験中に問題冊子の印刷の乱れ，ページの抜けや重なり，解答用紙の汚れなどに気づいたときは，手を挙げて監督者に知らせなさい。',
        '問題冊子の余白は下書きに使ってかまいませんが，どのページも切り離してはいけません。',
        '試験が終わったら，問題冊子は持ち帰りなさい。',
      ].join('\n'),
    },
    { sub: '（全　問　必　答）' }
  ),
  kyotsuTheme(
    'kyotsu-math2',
    '共通テスト（数学②）',
    '数学Ⅱ・B・C の冊子。選択問題の注意つき',
    '数学Ⅱ，数学Ｂ，数学Ｃ',
    {
      subject: '数　学　②',
      subtitle: '〔『数学Ⅱ，数学Ｂ，数学Ｃ』〕',
      firstPage: 3,
      notes: [
        'この問題冊子には，{n}問の問題があります。',
        '解答用紙に正しく記入・マークしていない場合は，採点できないことがあります。',
        '試験中に問題冊子の印刷の乱れ，ページの抜けや重なり，解答用紙の汚れなどに気づいたときは，手を挙げて監督者に知らせなさい。',
        '\\textbf{選択問題は，指定された数の問題を選んで}，その問題番号の解答欄に解答しなさい。',
        '問題冊子の余白は下書きに使ってかまいませんが，どのページも切り離してはいけません。',
        '試験が終わったら，問題冊子は持ち帰りなさい。',
      ].join('\n'),
    },
    { sub: '' }
  ),
];

export const UNIVERSITY_THEMES = [
  ...KYOTSU_THEMES,
  // 東京大学：「第 1 問」を中央に。本文 13.7〜168.1mm（左右とも約 13.8mm）。(1) は本文の左端、折り返しは 1 字下げ
  theme('univ-tokyo', '東京大学', '「第 1 問」中央・1問1ページ・B5', 'https://www.u-tokyo.ac.jp/ja/admissions/undergraduate/r8_exam.html', 11.5, 1.9, {
    paper: 'b5',
    marginLeft: 13.7,
    marginRight: 13.4,
    marginTop: 26.8,
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
    marginTop: 25.6,
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
    marginTop: 27.6,
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
    marginTop: 24,
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
    marginTop: 29.8,
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
    marginTop: 46.4,
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
    marginTop: 26,
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
    marginTop: 27.9,
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
    marginTop: 25.9,
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


// ---------------- 物理・化学 ----------------
// 各大学の公式サイトで公開されている令和 8 年度（2026）の物理・化学の問題 PDF を画像にし、画像解析で測った位置（mm）にもとづく。
// 本文の左右端・1 行目の上端・大問番号の左端は、アプリで組んだ PDF と実物を比べて ±0.5mm 以内（スキャンの京都・名古屋・北海道・慶應は
// ページごとの傾き・ずれがあり、名古屋・慶應は ±1.5mm 程度。慶應はスキャンが拡大されている可能性があり、余白の絶対値は参考値）。
// 大問の中の I, II は「部」（本文で \Part）、空欄は \blank{ア} で書く。
UNIVERSITY_THEMES.push(
  // ---------------- 東京大学 ----------------
  // 理科冊子（B5）。科目の最初のページだけ中央に「物理基礎・物理」（ゴシック太字・約 16pt）。
  // 「第1問」はゴシック太字・本文と同じ大きさで、本文の左端より 1 字外（24.2mm）。本文 27.6〜157.6mm、10pt・行送り 2 倍。
  // I, II は本文の左端・明朝、1 字空けて本文（本文の左端 +7.1mm）、折り返しは 1 字下げ（+3.6mm）。前に 1 行空き。
  // ⑴ は本文 +3.4mm、本文 +10.8mm、折り返しは +7.2mm（2 字下げ）。小問のまとまりの前は 1 行空き、小問どうしは空きなし。
  // 表せないもの: PART の 2 行目以降の字下げ（3.6mm）／小問のまとまりの前だけの 1 行空き（sub.gap は 0 にした）／
  //   科目の最後の「計算用紙（切り離さないで用いよ。）」ページ。
  theme('univ-tokyo-phys', '東京大学（物理）', '「第1問」左上・I, II・⑴・1問ごとに改ページ', 'https://www.u-tokyo.ac.jp/ja/admissions/undergraduate/r8_exam.html', 10, 2.0, {
    paper: 'b5',
    marginLeft: 24.2,
    marginRight: 24.0,
    marginTop: 26.3,
    header: '物理基礎・物理',
    headerStyle: 'title',
    head: { style: 'dai', font: 'gothic', bold: true, size: 10, position: 'above', align: 'left', showTitle: false, gap: 0 },
    spaceBefore: 0,
    spaceAfterHead: 0,
    bodyIndent: 3.4,
    parIndent: true,
    parSkip: 0,
    part: { style: 'roman', font: 'mincho', bold: false, size: 10, align: 'left', indent: 0, inline: true, gap: 3.6, spaceBefore: 7.1, spaceAfter: 0 },
    sub: { paren: 'half', indent: 3.4, sep: 3.8, gap: 0, wrap: 'left', wrapIndent: 7.2 },
    subLabel: 'pparen',
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'none',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'physics' }),
  // 化学：体裁は物理と同じ。設問は「〔問〕」の下に ア, イ, ウ（ゴシック太字・括弧なし）を本文 +3.6mm に置き、
  // 本文は +10.7mm、折り返しも +10.7mm（ぶら下げ）。選択肢は ⑴〜⑸（+10.7mm、本文 +17.8mm）。
  // 空欄は四角の枠に a, b / あ, い（約 14.0×6.1mm）。原子量などは各大問の最初に「元素｜原子量」の表と「気体定数 R = …」。
  // 表せないもの: ア を太字にすること／「〔問〕」の小見出し。
  theme('univ-tokyo-chem', '東京大学（化学）', '「第1問」左上・問ア〜・□空欄・1問ごとに改ページ', 'https://www.u-tokyo.ac.jp/ja/admissions/undergraduate/r8_exam.html', 10, 2.0, {
    paper: 'b5',
    marginLeft: 24.2,
    marginRight: 24.0,
    marginTop: 26.3,
    header: '化学基礎・化学',
    headerStyle: 'title',
    head: { style: 'dai', font: 'gothic', bold: true, size: 10, position: 'above', align: 'left', showTitle: false, gap: 0 },
    spaceBefore: 0,
    spaceAfterHead: 0,
    bodyIndent: 3.4,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'half', indent: 10.7, sep: 3.6, gap: 0, wrap: 'hang', wrapIndent: 0 }, // ぶら下げ: indent は本文の位置（実物の ア は +3.6mm、本文 +10.7mm）
    subLabel: 'kataPlain', // 実物はゴシック太字
    blank: { style: 'box', width: 14.0, height: 6.1 },
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'none',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'chemistry' }),

  // ---------------- 京都大学 ----------------
  // 物理・化学で別冊子（B5・スキャン）。1 ページ目の上に「物　　理」（約 16pt）と右に「(3問題　100点)」。
  // 「物理問題　I」はゴシック太字・約 14pt を本文の左端に。本文 23.3〜157.2mm、10pt・行送り 6.5mm（1.85 倍）、段落は 1 字下げ。
  // (1) は本文の左端、本文と折り返しは +7.1mm（ぶら下げ）。(1) の中の ⒜ は +7.1mm、本文 +14.3mm、折り返し +10.7mm。
  // 空欄は四角の枠にカタカナ（約 14.2×6.0mm）。大問ごとに改ページし、余ったページは中央上に「白紙」。
  // 表せないもの: 見出しの右の「(3問題 100点)」／(1) の中の ⒜ の段。
  theme('univ-kyoto-phys', '京都大学（物理）', '「物理問題 I」・(1)ぶら下げ・□空欄・最後に終わりの一文', 'https://www.kyoto-u.ac.jp/ja/admissions/undergrad/past-eq/r8-eq', 10, 1.85, {
    paper: 'b5',
    marginLeft: 23.2,
    marginRight: 24.4,
    marginTop: 28.4,
    header: '物　　理',
    headerStyle: 'title',
    head: { style: 'plainRoman', label: '物理問題　', font: 'gothic', bold: true, size: 14, position: 'above', align: 'left', showTitle: false, gap: 5 },
    spaceBefore: 0,
    spaceAfterHead: 5.5,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'half', indent: 7.1, sep: 1.6, gap: 6.5, wrap: 'hang', wrapIndent: 0 },
    subLabel: 'paren',
    blank: { style: 'box', width: 14.2, height: 6.0 },
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'none',
    pageNumber: 'dash',
    punct: 'commaMaru',
    endText: '物理問題は，このページで終わりである。',
  }, { subject: 'physics' }),
  // 化学：同じ体裁。設問は「問 1」を本文 +3.5mm、本文 +14.2mm、折り返し +10.6mm、設問の間は 1 行空き。
  // 空欄は四角の枠にひらがな（い, ろ, は）。原子量・定数は各大問の前文に文章で（「原子量は H = 1.0，O = 16 …とする。」）。
  theme('univ-kyoto-chem', '京都大学（化学）', '「化学問題 I」・問 1・□空欄・最後に終わりの一文', 'https://www.kyoto-u.ac.jp/ja/admissions/undergrad/past-eq/r8-eq', 10, 1.85, {
    paper: 'b5',
    marginLeft: 23.4,
    marginRight: 24.0,
    marginTop: 28.2,
    header: '化　　学',
    headerStyle: 'title',
    head: { style: 'plainRoman', label: '化学問題　', font: 'gothic', bold: true, size: 14, position: 'above', align: 'left', showTitle: false, gap: 5 },
    spaceBefore: 0,
    spaceAfterHead: 5.5,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'half', indent: 3.5, sep: 4.8, gap: 6.5, wrap: 'left', wrapIndent: 10.6 },
    subLabel: 'toiSp',
    blank: { style: 'box', width: 14.2, height: 6.0 },
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'none',
    pageNumber: 'dash',
    punct: 'commaMaru',
    endText: '化学問題は，このページで終わりである。',
  }, { subject: 'chemistry' }),

  // ---------------- 東北大学 ----------------
  // 理科冊子（B5・トンボ付き）。科目の最初のページだけ中央に「物　　理」（約 14pt）。
  // □番号（7.0mm 角・細線・ゴシック）は 23.9mm（本文の左端より 7.5mm 外）、1 行目は枠の後 4.0mm から、折り返しは本文の左端。
  // 本文 31.4〜157.6mm、10pt・行送り 2 倍。設問は「問⑴」を本文の左端、本文 +10.3mm、折り返し +7.0mm。
  // その中の (a)(b) は +6.8mm、本文 +13.9mm、折り返し +10.9mm。大問ごとに改ページ、余ったページは右上に「——このページは白紙——」。
  // 表せないもの: 問⑴ の中の (a) の段／白紙ページの文言。
  theme('univ-tohoku-phys', '東北大学（物理）', '□枠番号を余白に張り出し・問⑴・1問ごとに改ページ', 'https://admissions.tohoku.ac.jp/ja/materials/ito/', 10, 2.0, {
    paper: 'b5',
    marginLeft: 31.4,
    marginRight: 24.0,
    marginTop: 26.1,
    header: '物　　理',
    headerStyle: 'title',
    head: { style: 'box', boxRule: 'thin', boxSize: 7.0, font: 'gothic', bold: false, size: 11, position: 'inline', outdent: 7.5, showTitle: false, gap: 4.0 },
    spaceBefore: 0,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'half', indent: 0, sep: 3.3, gap: 7.0, wrap: 'left', wrapIndent: 7.0 },
    subLabel: 'toiPparen',
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'none',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'physics' }),
  // 化学：同じ体裁。科目の最初に「計算のために必要な場合には，次の数値を使用せよ。原子量 H = 1.0 …」（本文 +6.9mm の段落）。
  // 〔I〕〔II〕（明朝）は本文の左端、本文 +10.6mm、折り返し +6.9mm。前に約 9mm、後（問 1 の前）に 1 行空き。
  // 「問 1」は本文の左端、本文 +10.3mm、折り返し +6.9mm、設問の間は 1 行空き。
  // 表せないもの: PART の 2 行目以降の字下げ（6.9mm）。
  theme('univ-tohoku-chem', '東北大学（化学）', '□枠番号を張り出し・〔I〕・問 1・1問ごとに改ページ', 'https://admissions.tohoku.ac.jp/ja/materials/ito/', 10, 2.0, {
    paper: 'b5',
    marginLeft: 31.4,
    marginRight: 24.0,
    marginTop: 26.1,
    header: '化　　学',
    headerStyle: 'title',
    head: { style: 'box', boxRule: 'thin', boxSize: 7.0, font: 'gothic', bold: false, size: 11, position: 'inline', outdent: 7.5, showTitle: false, gap: 4.0 },
    spaceBefore: 0,
    parIndent: true,
    parSkip: 0,
    part: { style: 'romanBracket', font: 'mincho', bold: false, size: 10, align: 'left', indent: 0, inline: true, gap: 4.7, spaceBefore: 9.0, spaceAfter: 7.0 },
    sub: { paren: 'half', indent: 0, sep: 4.0, gap: 7.0, wrap: 'left', wrapIndent: 6.9 },
    subLabel: 'toiSp',
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'none',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'chemistry' }),

  // ---------------- 名古屋大学 ----------------
  // 物理・化学で別 PDF（A4・スキャン。ページごとに 3mm ほどずれるので、本文が用紙の中央に来るとして求めた）。
  // 「物理　問題 I」はゴシック太字・約 15pt を本文の左端に。本文 29.0〜181.1mm（1 行 38 字）、11.4pt・行送り 2 倍、段落は 1 字下げ。
  // 設問は「設問(1)：」を本文の左端に置き、本文は「：」の直後、折り返しは +16.5mm（ぶら下げ）。設問の間は 1 行空き。
  // 表せないもの: 設問の中の (a)(b) の段。
  theme('univ-nagoya-phys', '名古屋大学（物理）', '「物理 問題 I」・設問(1)：・A4・1問ごとに改ページ', 'https://www.nagoya-u.ac.jp/admissions/exam/data/answer/sub/post_642.html', 11.4, 2.0, {
    paper: 'a4',
    marginLeft: 29.0,
    marginRight: 28.5,
    marginTop: 29.7,
    head: { style: 'plainRoman', label: '物理　問題 ', font: 'gothic', bold: true, size: 15, position: 'above', align: 'left', showTitle: false, gap: 1 },
    spaceBefore: 0,
    spaceAfterHead: 7,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'half', indent: 0, sep: 0, gap: 8.0, wrap: 'left', wrapIndent: 16.5 },
    subLabel: 'setsumon',
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'none',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'physics' }),
  // 化学：同じ体裁（本文 27.0〜179.0mm に見えるが、スキャンのずれの範囲。物理と同じ値にした）。
  // 「設問(1)：」の中の (a)(b) は +16.0mm。原子量は公開ページの範囲には無い（科目の最初のページが PDF に含まれていない）。
  theme('univ-nagoya-chem', '名古屋大学（化学）', '「化学 問題 I」・設問(1)：・A4・1問ごとに改ページ', 'https://www.nagoya-u.ac.jp/admissions/exam/data/answer/sub/post_642.html', 11.4, 2.0, {
    paper: 'a4',
    marginLeft: 29.0,
    marginRight: 28.5,
    marginTop: 29.7,
    head: { style: 'plainRoman', label: '化学　問題 ', font: 'gothic', bold: true, size: 15, position: 'above', align: 'left', showTitle: false, gap: 1 },
    spaceBefore: 0,
    spaceAfterHead: 7,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'half', indent: 0, sep: 0, gap: 8.0, wrap: 'left', wrapIndent: 16.5 },
    subLabel: 'setsumon',
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'none',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'chemistry' }),

  // ---------------- 九州大学 ----------------
  // 理科冊子（B5）。科目の最初は「物 理 基 礎・物 理」だけの扉ページ。
  // 〔1〕（ゴシック・約 13pt）は 22.5mm（本文の左端より 8.7mm 外。〔 の字の左の空きの分、outdent は 9.5）、同じ行に「次の文章を読み，問1〜問4に答えよ。(45点)」、その後 1 行空き。
  // 本文 31.2〜156.6mm、10pt・行送り 2 倍、段落は 1 字下げ。「問 1.」（問 はゴシック太字）は本文の左端、本文 +11.1mm、折り返し +6.8mm。
  // その中の ⑴ は +6.6mm、本文 +14.2mm、折り返し +10.7mm、⑴ どうしは約 3.5mm 空き。
  // 表せないもの: 「問」だけ太字にすること／問 1. の中の ⑴ の段／科目の扉ページ／番号の行の後の 1 行空き。
  theme('univ-kyushu-phys', '九州大学（物理）', '〔1〕と前文・(点)・問 1.・1問ごとに改ページ', 'https://www.kyushu-u.ac.jp/ja/admission/faculty/exam_question', 10, 2.0, {
    paper: 'b5',
    marginLeft: 31.2,
    marginRight: 25.0,
    marginTop: 26.3,
    head: { style: 'bracket', font: 'gothic', bold: false, size: 13, position: 'inline', outdent: 9.5, showTitle: false, gap: 6.4 },
    spaceBefore: 0,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'half', indent: 0, sep: 5.2, gap: 7.0, wrap: 'left', wrapIndent: 6.8 },
    subLabel: 'toiDot', // 実物は「問」だけゴシック太字
    pointsStyle: 'bodyEnd',
    pointsFormat: '({n}点)',
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'none',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'physics' }),
  // 化学：同じ体裁。扉ページに「必要な場合は，次の値を用いよ。原子量：H = 1.00, …」と構造式の記入例。
  // 文章 ⑴〜⑶ を ⑴ で区切る（本文の左端、同じ行から本文、折り返し +3.5mm）。空欄は「〔 ア 〕」（亀甲括弧）。
  // 文章の区切りの ⑴ は「部」（\Part）で入れる。表せないもの: 区切りの ⑴ の 2 行目以降の字下げ（3.5mm）。
  theme('univ-kyushu-chem', '九州大学（化学）', '〔1〕と前文・(点)・問 1.・〔 ア 〕空欄', 'https://www.kyushu-u.ac.jp/ja/admission/faculty/exam_question', 10, 2.0, {
    paper: 'b5',
    marginLeft: 31.2,
    marginRight: 25.0,
    marginTop: 26.3,
    head: { style: 'bracket', font: 'gothic', bold: false, size: 13, position: 'inline', outdent: 9.5, showTitle: false, gap: 6.4 },
    spaceBefore: 0,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'half', indent: 0, sep: 5.2, gap: 7.0, wrap: 'left', wrapIndent: 7.6 },
    subLabel: 'toiDot',
    part: { style: 'pparen', font: 'mincho', bold: false, size: 10, align: 'left', indent: 0, inline: true, gap: 1.0, spaceBefore: 7.0, spaceAfter: 0 },
    blank: { style: 'kikko', width: 14.0, height: 0 },
    pointsStyle: 'bodyEnd',
    pointsFormat: '({n}点)',
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'none',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'chemistry' }),

  // ---------------- 北海道大学 ----------------
  // 理科冊子（A4 のスキャン。中身は B5 の冊子を A4 に置いたもの。数学テーマと同じく A4 のまま測った）。
  // 科目の最初のページだけ中央に「物　　理」（約 14pt）。□番号（7.2mm 角・細線）は 37.0mm、本文の左端より 7.3mm 外、1 行目は枠の後 3.7mm。
  // 本文 44.3〜170.4mm（1 行 36 字）、10pt・行送り 2 倍。「問 1」（ゴシック太字）は本文の左端、本文 +10.4mm、折り返し +7.1mm。
  // 空欄は四角の枠に ⑴, ⑵ …（約 13.5×6.0mm）。単位は x₀〔m〕のように亀甲括弧。
  theme('univ-hokudai-phys', '北海道大学（物理）', '□枠番号を張り出し・問 1・□⑴空欄・1問ごとに改ページ', 'https://www.hokudai.ac.jp/admission/R08_Aexam_Science.pdf', 10, 2.0, {
    paper: 'a4',
    marginLeft: 44.3,
    marginRight: 39.2,
    marginTop: 46.4,
    header: '物　　理',
    headerStyle: 'title',
    head: { style: 'box', boxRule: 'thin', boxSize: 7.2, font: 'gothic', bold: false, size: 11, position: 'inline', outdent: 7.3, showTitle: false, gap: 3.7 },
    spaceBefore: 0,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'half', indent: 0, sep: 4.1, gap: 7.0, wrap: 'left', wrapIndent: 7.1 },
    subLabel: 'toiSp', // 実物の「問」はゴシック太字
    blank: { style: 'box', width: 13.5, height: 6.0 },
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'none',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'physics' }),
  // 化学：同じ体裁。科目の最初に「…必要があれば，次の数値を用いよ。原子量：H = 1.0，C = 12 …／ファラデー定数 …」。
  // □番号の行は「I，II に答えよ。」だけ。I, II（明朝）は本文 +1.0mm、同じ行から本文（+7.1mm）。
  // PART の中の文章は本文 +3.6mm（段落の 1 行目はさらに 1 字下げ）、「問 1」も +3.6mm、本文 +14.2mm。空欄は枠に (ア) / A。
  // 表せないもの: PART の中身全体の字下げ（3.6mm）。
  theme('univ-hokudai-chem', '北海道大学（化学）', '□枠番号を張り出し・I, II・問 1・□空欄', 'https://www.hokudai.ac.jp/admission/R08_Aexam_Science.pdf', 10, 2.0, {
    paper: 'a4',
    marginLeft: 44.3,
    marginRight: 39.2,
    marginTop: 46.4,
    header: '化　　学',
    headerStyle: 'title',
    head: { style: 'box', boxRule: 'thin', boxSize: 7.2, font: 'gothic', bold: false, size: 11, position: 'inline', outdent: 7.3, showTitle: false, gap: 3.7 },
    spaceBefore: 0,
    parIndent: true,
    parSkip: 0,
    part: { style: 'roman', font: 'mincho', bold: false, size: 10, align: 'left', indent: 1.0, inline: true, gap: 3.6, spaceBefore: 7.0, spaceAfter: 7.0 },
    sub: { paren: 'half', indent: 14.2, sep: 4.1, gap: 7.0, wrap: 'hang', wrapIndent: 0 },
    subLabel: 'toiSp',
    blank: { style: 'box', width: 13.5, height: 6.1 },
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'none',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'chemistry' }),

  // ---------------- 東京科学大学 ----------------
  // 物理・化学で別冊子（B5・トンボ付き）。最初に「試験問題は，つぎのページより始まります。」のページ。
  // 太枠番号（7.1mm 角）は 23.9mm、その後 4.2mm に「(50点)」。1 行空けて本文 31.3〜157.6mm、10pt・行送り 2 倍、段落は 1 字下げ。
  // 字間は数学の冊子と違って詰めていない（1 行 36 字）。⒜ ⒝ は本文 +7.0mm、本文 +14.1mm、折り返し +11.0mm、⒜ どうしは 1 行空き。
  // 空欄は枠に (ア)（約 15×6.1mm）。各大問の後に「（下　書　き　用　紙）」を 2 ページ。句読点は「，。」（数学は「，．」）。
  
  theme('univ-isct-phys', '東京科学大学（物理）', '太枠番号と(点)・⒜・□空欄・下書き用紙', 'https://admissions.isct.ac.jp/ja/013/undergraduate/examination-questions', 10, 2.0, {
    paper: 'b5',
    marginLeft: 23.9,
    marginRight: 24.0,
    marginTop: 25.9,
    head: { style: 'box', boxRule: 'thick', boxSize: 7.1, font: 'gothic', bold: false, size: 12, position: 'above', align: 'left', showTitle: false, gap: 4.2 },
    spaceBefore: 0,
    spaceAfterHead: 7.0,
    bodyIndent: 7.4,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'half', indent: 7.0, sep: 3.6, gap: 7.0, wrap: 'left', wrapIndent: 11.0 },
    subLabel: 'aparen',
    blank: { style: 'box', width: 15.0, height: 6.1 },
    pointsStyle: 'after',
    pointsFormat: '({n}点)',
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'draft',
    draftText: '（下　書　き　用　紙）',
    draftPages: 2,
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'physics' }),
  // 化学：「第 I 問」（ゴシック太字・約 13pt）と小さく「(50点満点)」。本文 27.7〜157.6mm。
  // 問題番号は通し番号の「1」（ゴシック太字・括弧なし）を本文より 2mm 外に置き、本文 +3.5mm、選択肢は「1.」を +1.9mm、本文 +7.3mm。
  // 原子量は各問題の文中に「ただし，各元素の原子量は，H = 1，C = 12 … とする。」。下書き用紙が多い。
  // 表せないもの: 本文の左端より外に出る太字の通し番号。
  theme('univ-isct-chem', '東京科学大学（化学）', '「第 I 問」と(点満点)・通し番号の問題・下書き用紙', 'https://admissions.isct.ac.jp/ja/013/undergraduate/examination-questions', 10, 2.0, {
    paper: 'b5',
    marginLeft: 23.6,
    marginRight: 24.0,
    marginTop: 26.7,
    head: { style: 'daiRoman', font: 'gothic', bold: true, size: 13, position: 'above', align: 'left', showTitle: false, gap: 1.5 },
    spaceBefore: 0,
    spaceAfterHead: 6.5,
    bodyIndent: 4.1,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'half', indent: 0, sep: 2.0, gap: 7.0, wrap: 'left', wrapIndent: 0 }, // 実物は太字の「1」を本文より 2mm 外に
    subLabel: 'decimal',
    pointsStyle: 'after',
    pointsFormat: '({n}点満点)',
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'draft',
    draftText: '（下　書　き　用　紙）',
    draftPages: 2,
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'chemistry' }),

  // ---------------- 神戸大学 ----------------
  // 理科冊子（B5・トンボ付き）。科目の最初のページだけ中央に「物　　理」（約 14pt）。
  // 「Ⅰ」（明朝・約 12pt）は本文の左端より 1 字外（23.7mm。組んだ PDF で合わせて outdent 4.6）、同じ行から本文（31.9mm）、折り返しは本文の左端（28.2mm）。
  // 本文 28.2〜157.1mm、10.2pt・行送り 7.0mm、段落は 1 字下げ。前文の最後に「(配点25点)」。
  // 「問 1」は本文の左端、本文 +10.5mm、折り返し +7.2mm、設問の間は 1 行空き。大問ごとに改ページ。
  theme('univ-kobe-phys', '神戸大学（物理）', '「I」を張り出し・前文末に配点・問 1', 'https://www.office.kobe-u.ac.jp/stdnt-examinavi/juken/past_exam/2026/5999.html', 10.2, 1.95, {
    paper: 'b5',
    marginLeft: 28.2,
    marginRight: 24.5,
    marginTop: 26.7,
    header: '物　　理',
    headerStyle: 'title',
    head: { style: 'roman', font: 'mincho', bold: false, size: 12, position: 'inline', outdent: 4.6, showTitle: false, gap: 4.8 },
    spaceBefore: 0,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'half', indent: 0, sep: 4.2, gap: 7.0, wrap: 'left', wrapIndent: 7.2 },
    subLabel: 'toiSp',
    pointsStyle: 'bodyEnd',
    pointsFormat: '(配点{n}点)',
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'none',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'physics' }),
  // 化学：同じ体裁。科目の最初に枠囲みで「計算のために必要であれば，次の値を用いなさい。原子量：H 1.0　C 12 …」。
  // 空欄は四角の枠にカタカナ（約 13.1×6.1mm）。設問の中の ⒜ や ⑴ は本文の左端。
  // 表せないもの: 科目の最初の枠囲みの注意書き。
  theme('univ-kobe-chem', '神戸大学（化学）', '「I」を張り出し・前文末に配点・問 1・□空欄', 'https://www.office.kobe-u.ac.jp/stdnt-examinavi/juken/past_exam/2026/5999.html', 10.2, 1.95, {
    paper: 'b5',
    marginLeft: 28.2,
    marginRight: 24.5,
    marginTop: 26.7,
    header: '化　　学',
    headerStyle: 'title',
    head: { style: 'roman', font: 'mincho', bold: false, size: 12, position: 'inline', outdent: 4.6, showTitle: false, gap: 4.8 },
    spaceBefore: 0,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'half', indent: 0, sep: 4.2, gap: 7.0, wrap: 'left', wrapIndent: 7.2 },
    subLabel: 'toiSp',
    blank: { style: 'box', width: 13.1, height: 6.1 },
    pointsStyle: 'bodyEnd',
    pointsFormat: '(配点{n}点)',
    displayAlign: 'center',
    newPageEach: true,
    afterEach: 'none',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'chemistry' }),

  // ---------------- 慶應義塾大学（理工） ----------------
  // 理科（物理・化学）冊子（A4 のスキャン。数学の冊子より文字が大きく余白が小さく写っているので、拡大されている可能性がある）。
  // 左上に「物　理」（明朝太字・約 20pt）。大問番号「1.」（明朝太字・約 24pt）は本文の左端より 5.9mm 外、同じ行から本文。
  // 本文 18.5〜191.5mm（中央にそろえた値）、9.2pt・行送り 1.95 倍、段落は 1 字下げ。
  // 「（1）」（明朝太字・約 11pt）は本文の左端、同じ行から本文、折り返しは左端。前に約 5.5mm 空き。空欄は枠に（ア）（約 11.0×4.8mm）。
  // 余ったページは「このページは余白です。計算および下書きに使用してもかまいません。」。
  // 表せないもの: 左寄せの科目名（headerStyle 'title' は中央）／大きな「1.」の字の大きさ（番号だけ 24pt）。
  theme('univ-keio-phys', '慶應義塾大学（理工・物理）', '太字「1.」を張り出し・（1）・□（ア）空欄・A4', 'https://www.keio.ac.jp/ja/admissions/faculty/examinations/general-admissions/question-2026/', 9.2, 1.95, {
    paper: 'a4',
    marginLeft: 18.5,
    marginRight: 18.1,
    marginTop: 12.0,
    header: '物　理',
    headerStyle: 'title',
    head: { style: 'dot', font: 'mincho', bold: true, size: 24, position: 'inline', outdent: 5.9, showTitle: false, gap: 1.4 },
    spaceBefore: 8,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'full', indent: 0, sep: 2.5, gap: 5.5, wrap: 'left', wrapIndent: 0 },
    subLabel: 'paren',
    blank: { style: 'box', width: 11.0, height: 4.8 },
    displayAlign: 'center',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'physics' }),
  // 化学：同じ体裁。科目の最初に「(注意) 必要であれば次の原子量と数値を用いなさい。…」と原子量・定数を 3 行で。
  // （1）の折り返しは本文 +6.1mm。空欄は枠に (ア)・(い) など。
  theme('univ-keio-chem', '慶應義塾大学（理工・化学）', '太字「1.」を張り出し・（1）・□（ア）空欄・A4', 'https://www.keio.ac.jp/ja/admissions/faculty/examinations/general-admissions/question-2026/', 9.2, 1.95, {
    paper: 'a4',
    marginLeft: 18.5,
    marginRight: 18.1,
    marginTop: 12.0,
    header: '化　学',
    headerStyle: 'title',
    head: { style: 'dot', font: 'mincho', bold: true, size: 24, position: 'inline', outdent: 5.9, showTitle: false, gap: 1.4 },
    spaceBefore: 8,
    parIndent: true,
    parSkip: 0,
    sub: { paren: 'full', indent: 0, sep: 2.5, gap: 5.5, wrap: 'left', wrapIndent: 6.1 },
    subLabel: 'paren',
    blank: { style: 'box', width: 11.0, height: 4.8 },
    displayAlign: 'center',
    pageNumber: 'dash',
    punct: 'commaMaru',
  }, { subject: 'chemistry' }),
);

/** 調査したが体裁を確認できなかった大学（テーマは作っていない） */
export const UNVERIFIED_UNIVERSITIES = [
  { name: '早稲田大学', reason: '公式サイトの問題 PDF を自動取得できず、体裁を確認できていません。' },
  { name: '大阪大学', reason: '公式サイトに問題冊子が公開されておらず（解答例・出題の意図のみ）、確認できていません。' },
];
