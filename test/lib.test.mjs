import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMathRanges, normalizeMathText, fullwidthFixes } from '../src/renderer/lib/mathRanges.js';
import { aiTextToLatex, unicodeToLatex } from '../src/renderer/lib/smartPaste.js';
import { buildTex, locateLine } from '../src/renderer/lib/texExport.js';
import { collectMacros } from '../src/renderer/lib/preview.js';
import { newDocument } from '../src/renderer/lib/model.js';

test('数式範囲を検出する', () => {
  const s = '値 $x^2$ と \\[ y \\] と $$z$$ と \\begin{align*} a&=b \\end{align*}、価格は 100\\$ % $無視$';
  const r = findMathRanges(s);
  assert.deepEqual(
    r.map((x) => [x.kind, x.latex.trim()]),
    [
      ['$', 'x^2'],
      ['\\[', 'y'],
      ['$$', 'z'],
      ['env', '\\begin{align*} a&=b \\end{align*}'],
    ]
  );
});

test('数式内の全角英数を半角に（\\text の中は維持）', () => {
  assert.equal(normalizeMathText('ｘ＋１＝２\\text{（答え）}'), 'x+1=2\\text{（答え）}');
  const src = '文章はＡＢＣのまま $ｙ＝２ｘ$';
  const ch = fullwidthFixes(src);
  assert.equal(ch.length, 1);
  assert.equal(ch[0].insert, 'y=2x');
});

test('Claude の Markdown 回答を LaTeX に変換', () => {
  const md = [
    '## 解答',
    '',
    '**ステップ1**: 判別式を求めます。',
    '',
    '$$D = b^2 - 4ac$$',
    '',
    '1. $a = 1$ のとき',
    '2. 割合は 50% です',
    '',
    '| x | y |',
    '|---|---|',
    '| 1 | 2 |',
  ].join('\n');
  const out = aiTextToLatex(md);
  assert.match(out, /\\textbf\{解答\}/);
  assert.match(out, /\\textbf\{ステップ1\}/);
  assert.match(out, /\\\[\n  D = b\^2 - 4ac\n\\\]/);
  assert.match(out, /\\begin\{enumerate\}\n {2}\\item \$a = 1\$ のとき\n {2}\\item 割合は 50\\% です\n\\end\{enumerate\}/);
  assert.match(out, /\\begin\{tabular\}\{\|c\|c\|\}/);
});

test('\\( \\) と \\[ \\] 形式も取り込める', () => {
  const out = aiTextToLatex('よって \\(x=3\\) です。\n\\[\\int_0^1 f(x)\\,dx\\]');
  assert.match(out, /\$x=3\$/);
  assert.match(out, /\\\[\n  \\int_0\^1 f\(x\)\\,dx\n\\\]/);
});

test('Unicode の式を LaTeX に', () => {
  assert.equal(unicodeToLatex('x² + 2x + 1 ≥ 0'), 'x^{2} + 2x + 1 \\geq 0');
  assert.equal(unicodeToLatex('√2 × π'), '\\sqrt{2} \\times \\pi');
  const out = aiTextToLatex('方程式 x² − 4 = 0 を解く');
  assert.match(out, /方程式 \$x\^\{2\} - 4 = 0\$ を解く/);
});

test('TeX 文書の生成とエラー行の逆引き', () => {
  const doc = newDocument(true);
  const tex = buildTex(doc);
  assert.match(tex, /\\documentclass\[11pt\]\{ltjsarticle\}/);
  assert.match(tex, /paperwidth=210mm,paperheight=297mm/);
  assert.match(tex, /\\lpenum\{1\}\}\\hspace\{3mm\}\{\\lpeheadfont 二次方程式\}/);
  const lines = tex.split('\n');
  const idx = lines.findIndex((l) => l.includes('x^2 - 5x + 6 = 0'));
  const loc = locateLine(tex, idx + 1);
  assert.deepEqual(loc, { where: 'problem', index: 0, field: 'body', line: 3 });
});

test('プリアンブルのマクロを読む', () => {
  const m = collectMacros('\\newcommand{\\R}{\\mathbb{R}}\n\\DeclareMathOperator{\\rank}{rank}');
  assert.equal(m['\\R'], '\\mathbb{R}');
  assert.equal(m['\\rank'], '\\operatorname{rank}');
});

import { compileExpr, sampleFunction, figureBlock, findFigures, defaultGraph, defaultGeo } from '../src/renderer/lib/figure.js';

test('グラフの式を解析する（暗黙の掛け算・関数・絶対値）', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
  near(compileExpr('x^2-2x+1')(3), 4);
  near(compileExpr('2(x+1)')(1), 4);
  near(compileExpr('sin(x)')(Math.PI / 2), 1);
  near(compileExpr('|x-3|')(1), 2);
  near(compileExpr('e^x')(1), Math.E);
  near(compileExpr('x^(1/3)')(-8), -2);
  near(compileExpr('ｘ²＋１')(2), 5);
  assert.throws(() => compileExpr('y+1'), /変数は x のみ/);
});

test('1/x は漸近線で線が分かれる', () => {
  const segs = sampleFunction(compileExpr('1/x'), -3, 3, -5, 5);
  assert.equal(segs.length, 2);
});

test('図は JSON 付きで保存し、読み戻せる', () => {
  const g = defaultGraph();
  g.points.push({ x: 1, y: -1, label: 'P', pos: 'below', drop: true });
  const src = `前文\n${figureBlock(g)}\n後文`;
  const figs = findFigures(src);
  assert.equal(figs.length, 1);
  assert.deepEqual(figs[0].spec, g);
  assert.match(src, /\\begin\{tikzpicture\}/);
  const geo = defaultGeo();
  geo.points.push({ id: 'P1', x: 0, y: 0, label: 'A' }, { id: 'P2', x: 3, y: 0, label: 'B' });
  geo.segments.push({ a: 'P1', b: 'P2' });
  assert.match(figureBlock(geo), /\\draw \(P1\) -- \(P2\);/);
});

import { partShapes, PARTS, figureToSvg } from '../src/renderer/lib/figure.js';

test('物理の部品（ばね・抵抗・電池など）は TikZ と SVG の両方に同じ形で出る', () => {
  const g = defaultGeo();
  g.points.push({ id: 'P1', x: 0, y: 0, label: '', dot: false }, { id: 'P2', x: 3, y: 0, label: '', dot: false });
  for (const p of PARTS) {
    g.segments = [{ a: 'P1', b: 'P2', kind: p.id, label: '$k$' }];
    const tikz = figureBlock(g);
    const svg = figureToSvg(g);
    const sh = partShapes(p.id, g.points[0], g.points[1], { label: '$k$' });
    assert.ok(sh.lines.length + sh.fills.length > 0, p.id);
    assert.match(tikz, /\\node at \([-\d.]+,[-\d.]+\) \{\$k\$\}/, p.id);
    if (p.id !== 'line') assert.match(svg, /data-seg="0"/, p.id);
  }
  // ばねはジグザグ（10 点以上の折れ線）
  const spring = partShapes('spring', { x: 0, y: 0 }, { x: 3, y: 0 });
  assert.ok(spring.lines[0].length >= 10);
});

import { expandScience } from '../src/renderer/lib/chem.js';
import { findMathRanges as fmr } from '../src/renderer/lib/mathRanges.js';

test('化学式・単位は書き出し時に普通の LaTeX になり、文章中でも数式として扱う', () => {
  const src = '水 \\ce{H2O} は $\\qty{1.0}{g/cm^3}$，抵抗 \\qty{2.0}{\\kilo\\ohm}，\\unit{m/s}';
  const out = expandScience(src);
  assert.doesNotMatch(out, /\\ce\{|\\qty\{|\\unit\{/);
  assert.match(out, /\\mathrm\{H\}/);
  assert.match(out, /2\.0\\,\\mathrm\{k\\Omega\}/);
  const kinds = fmr(src).map((r) => r.kind);
  assert.deepEqual(kinds, ['cmd', '$', 'cmd', 'cmd']);
  // \centering や \section などは化学式と間違えない
  assert.equal(fmr('\\centering \\section{a} \\sim{x}').length, 0);
});

test('部（\\Part）・空欄（\\blank）・問1 を TeX に出す', () => {
  const doc = newDocument(true);
  doc.meta.layout.subLabel = 'toi';
  doc.meta.layout.part = { ...doc.meta.layout.part, style: 'alphaBracket', inline: true };
  doc.meta.layout.blank = { ...doc.meta.layout.blank, style: 'bracket' };
  const tex = buildTex(doc);
  assert.match(tex, /\\newcommand\{\\lpepartlabel\}\{〔\\Alph\{lpepart\}〕\}/);
  assert.match(tex, /\\providecommand\{\\Part\}\{\\lpepart\}/);
  assert.match(tex, /［\\makebox\[\\lpe@bw\]\[c\]/);
  assert.match(tex, /label=問\\arabic\*|\\renewcommand\{\\labelenumi\}\{問\\arabic\{enumi\}\}/);
  assert.match(tex, /\\setcounter\{lpepart\}\{0\}/);
});

import { UNIVERSITY_THEMES } from '../src/renderer/lib/universityThemes.js';

test('物理・化学の大学テーマ: 科目ごとにあり、番号の形・下書き用紙の枚数・和文の大きさを TeX に出す', () => {
  const by = (s) => UNIVERSITY_THEMES.filter((t) => (t.meta?.subject || 'math') === s);
  assert.ok(by('physics').length >= 9 && by('chemistry').length >= 9);
  assert.equal(new Set(UNIVERSITY_THEMES.map((t) => t.id)).size, UNIVERSITY_THEMES.length);
  const make = (id) => {
    const doc = newDocument(true);
    applyTheme(doc.meta, UNIVERSITY_THEMES.find((t) => t.id === id));
    return { doc, tex: buildTex(doc) };
  };
  // 京都: 「物理問題　I」
  assert.match(make('univ-kyoto-phys').tex, /\\newcommand\{\\lpenum\}\[1\]\{\\setcounter\{lpetmp\}\{#1\}物理問題　\\Roman\{lpetmp\}\}/);
  // 名古屋: 設問(1)：
  assert.match(make('univ-nagoya-phys').tex, /設問\(\\arabic\*\)：|設問\(\\arabic\{enumi\}\)：/);
  // 東京科学: 第 I 問・下書き用紙 2 ページ
  const isct = make('univ-isct-chem');
  assert.match(isct.tex, /第\\hspace\{0\.25\\zw\}\\Roman\{lpetmp\}/);
  assert.equal(isct.tex.split('（下　書　き　用　紙）').length - 1, 2 * isct.doc.problems.length);
  assert.equal(isct.doc.meta.subject, 'chemistry');
  // 九州（化学）: 〔 ア 〕の空欄、⑴ の部
  const ky = make('univ-kyushu-chem').tex;
  assert.match(ky, /〔\\makebox\[\\lpe@bw\]/);
  assert.match(ky, /\\newcommand\{\\lpepartlabel\}\{\\lpepparen\{lpepart\}\}/);
  // 和文を欧文と同じ大きさで組む（ltjsarticle の 0.924715 倍にしない）
  assert.match(ky, /\\def\\Cjascale\{1\}/);
  assert.match(ky, /\\DeclareFontShape\{JY3\}\{mc\}\{m\}\{n\}\{<-> s\*\[1\]/);
  // 見出しの下の本文でも段落の 1 字下げが効く
  assert.match(ky, /\\setlength\{\\listparindent\}\{\\parindent\}/);
});
import { applyTheme, applyPunct } from '../src/renderer/lib/layout.js';

test('大学テーマはすべて TeX を生成できる', () => {
  for (const t of UNIVERSITY_THEMES) {
    const doc = newDocument(true);
    doc.problems[0].points = 30;
    applyTheme(doc.meta, t);
    const tex = buildTex(doc);
    assert.match(tex, /\\begin\{document\}/, t.name);
    if (t.layout.paper === 'b5') assert.match(tex, /paperwidth=182mm,paperheight=257mm/, t.name);
  }
});

test('上下左右の余白・番号の張り出し・枠の大きさを TeX に反映する', () => {
  const doc = newDocument(true);
  applyTheme(doc.meta, UNIVERSITY_THEMES.find((t) => t.id === 'univ-tohoku'));
  const tex = buildTex(doc);
  assert.match(tex, /left=27\.6mm,right=23\.8mm,top=27\.6mm,bottom=22mm/);
  assert.match(tex, /\\hspace\*\{-3\.7mm\}\{\\lpeheadfont\\lpenum\{1\}\}/);
  assert.match(tex, /\\vbox to \\dimexpr5\.6mm-2\\fboxrule/);
  // 2 段目のリスト（字下げ用のリストの中の小問）にも小問の字下げを設定する
  assert.match(tex, /\\setlength\{\\leftmarginii\}\{6\.8mm\}/);
});

test('表紙を付けると、表紙の次のページを 1 ページ目にする', () => {
  const doc = newDocument(true);
  doc.meta.cover = { ...doc.meta.cover, enabled: true, subject: '数学', time: '90分' };
  const tex = buildTex(doc);
  assert.match(tex, /\\thispagestyle\{empty\}/);
  assert.match(tex, /問題は全部で3題である。/);
  assert.match(tex, /試験時間\\quad 90分/);
  assert.match(tex, /\\newpage\\setcounter\{page\}\{1\}/);
  doc.meta.cover.enabled = false;
  assert.doesNotMatch(buildTex(doc), /試験時間/);
});

test('小問のまとまりの前後にも小問の間隔を入れる（小問の中だけで設定する）', () => {
  const doc = newDocument(true);
  applyTheme(doc.meta, UNIVERSITY_THEMES.find((t) => t.id === 'univ-niigata'));
  const tex = buildTex(doc);
  assert.match(tex, /\\def\\@listi\{\\lpe@oi\\topsep7\.5mm/);
  assert.match(tex, /\\renewcommand\{\\enumerate\}\[1\]\[\]\{\\lpe@pre\\lpe@presub\\lpe@enumerate/);
  // 入れ子の enumerate で包み直さない（無限に展開されて TeX が止まるのを防ぐ）
  assert.match(tex, /\\itemsep7\.5mm\}\\let\\lpe@pre\\relax\}/);
  // 全体の \@listi は書き換えない（center などの前後の空きが変わらないように）
  assert.doesNotMatch(tex, /\\let\\@listI\\@listi/);
});

test('句読点の統一は数式の中を変えない', () => {
  const l = { punct: 'commaPeriod' };
  assert.equal(applyPunct('a、b。$f(x)、y$', l, findMathRanges), 'a，b．$f(x)、y$');
});

import { KYOTSU_THEMES } from '../src/renderer/lib/universityThemes.js';
import { normalizeLayout, defaultCover } from '../src/renderer/lib/layout.js';
import { coverNoteItems } from '../src/renderer/lib/texExport.js';
import { renderLatex } from '../src/renderer/lib/preview.js';
import { normalizeDoc } from '../src/renderer/lib/model.js';

test('共通テストのテーマ: 表紙・裏表紙・見出し・解答欄・続きの一文を TeX に出す', () => {
  const doc = newDocument(true);
  doc.problems[0].points = 30;
  doc.problems[0].body = '\\Part 文章 \\blank{ア} \\blank*{イ} \\blank[2]{ア}\n\\begin{enumerate}\\item a\\begin{enumerate}\\item b\\end{enumerate}\\end{enumerate}';
  applyTheme(doc.meta, KYOTSU_THEMES[0]);
  assert.equal(doc.meta.cover.enabled, true);
  assert.equal(doc.meta.cover.style, 'kyotsu');
  const tex = buildTex(doc);
  // B5・本文 24.0〜158.0mm・ページ上部の文字とページ番号の位置
  assert.match(tex, /paperwidth=182mm,paperheight=257mm,left=24mm,right=24mm,top=26\.2mm,bottom=29mm,headheight=5mm,headsep=5\.10mm,footskip=15\.40mm/);
  // 奇数ページは右、偶数ページは左の科目名。1 ページ目は大きな見出し（上部の文字なし）
  assert.match(tex, /\\ifodd\\value\{page\}\\hfil\{\\sffamily\\gtfamily\\fontsize\{12pt\}/);
  assert.match(tex, /\\thispagestyle\{lpeplain\}/);
  assert.match(tex, /（全　問　必　答）/);
  // 「第1問（配点　30）」
  assert.match(tex, /\\hspace\*\{-0\.7mm\}\{\\lpeheadfont\\lpenum\{1\}\}\\hspace\{3mm\}（配点　30）/);
  // 大問の始まり・終わりの目印と「次ページに続く」
  assert.match(tex, /\\InsertMark\{lpe\}\{1\}/);
  assert.match(tex, /（数学Ⅰ，数学Ａ第\{\\lpe@m\}問は次ページに続く。）/);
  // 〔1〕の中身全体を字下げ（\Part から次の \Part / 大問の終わりまでのリスト）
  assert.match(tex, /\\newcommand\{\\lpepartend\}/);
  assert.match(tex, /\\lpepartend\n\\end\{lpebody\}/);
  // 解答欄の枠: 二重の枠と 2 度目以降の細い枠
  assert.match(tex, /\\newcommand\{\\lpeblank\}\{\\@ifstar/);
  assert.match(tex, /12\.04mm/);
  // 2 段目の小問は (i)
  assert.match(tex, /\\setlist\[enumerate,2\]\{label=\(\\roman\*\)/);
  assert.match(tex, /\\renewcommand\{\\labelenumii\}\{\(\\roman\{enumii\}\)\}/);
  // 表紙（共通テストの組み方）・ページ番号つきで 4 ページ目から・裏表紙
  assert.match(tex, /試験開始の合図があるまで/);
  assert.match(tex, /\\loop\\ifnum\\value\{page\}<4/);
  assert.match(tex, /\\begin\{tabularx\}/);
  assert.match(tex, /II\}\\hspace\*\{7\.05mm\}\{\\sffamily\\gtfamily 解答上の注意\}/);
  assert.match(tex, /\\clearpage\\ifodd\\value\{page\}\\thispagestyle\{empty\}\\null\\newpage\\fi/);
});

test('解答欄の * と [2]、部のまとまりをプレビューにも出す', () => {
  const h = renderLatex('\\Part あ \\blank{ア} \\blank*{イ} \\blank[2]{ウ} \\blank*[2]{エ}\n\n\\Part い', {});
  assert.match(h, /<span class="pv-blank">ア<\/span>/);
  assert.match(h, /<span class="pv-blank dbl">イ<\/span>/);
  assert.match(h, /<span class="pv-blank again">ウ<\/span>/);
  assert.match(h, /<span class="pv-blank dbl again">エ<\/span>/);
  assert.equal(h.split('<div class="pv-partbody">').length - 1, 2);
});

test('表紙の注意事項の表（「|」の行）を項目にまとめる', () => {
  const items = coverNoteItems('出題科目は次のとおり。\n|科目|ページ\n|数学|1〜{n}\n試験後は持ち帰る。', 3);
  assert.deepEqual(items, [
    { text: '出題科目は次のとおり。', rows: [['科目', 'ページ'], ['数学', '1〜3']] },
    { text: '試験後は持ち帰る。', rows: [] },
  ]);
});

test('新しい項目は既定値で補い、古いファイルも開ける', () => {
  const l = normalizeLayout({ head: { style: 'box' }, part: { style: 'alpha' } });
  assert.equal(l.title.size, 0);
  assert.equal(l.sub2.label, '');
  assert.equal(l.part.hang, false);
  assert.equal(l.headerAlign, 'center');
  const d = normalizeDoc({ meta: { cover: { enabled: true, subject: '物理' } }, problems: [{ body: 'x' }] });
  assert.equal(d.meta.cover.style, 'standard');
  assert.equal(d.meta.cover.subject, '物理');
  assert.equal(d.meta.cover.backNotes, '');
  // 従来のテーマの TeX には新しい命令が入らない
  const doc = newDocument(true);
  applyTheme(doc.meta, UNIVERSITY_THEMES.find((t) => t.id === 'univ-tohoku'));
  const tex = buildTex(doc);
  assert.doesNotMatch(tex, /InsertMark|lpeplain\}\n|\\setlist\[enumerate,2\]/);
});

test('表紙の設定を持つテーマから持たないテーマに替えると、表紙の文面は既定に戻る', () => {
  const doc = newDocument(true);
  applyTheme(doc.meta, KYOTSU_THEMES[1]);
  assert.equal(doc.meta.cover.themeId, 'kyotsu-math2');
  applyTheme(doc.meta, UNIVERSITY_THEMES.find((t) => t.id === 'univ-niigata'));
  assert.equal(doc.meta.cover.style, 'standard');
  assert.equal(doc.meta.cover.subject, defaultCover().subject);
});

test('enumitem では ⑴・⒜・ア の番号を * 付きで使う（enumitem に番号の形を登録する）', () => {
  const doc = newDocument(true);
  applyTheme(doc.meta, UNIVERSITY_THEMES.find((t) => t.id === 'univ-kyoto'));
  const tex = buildTex(doc);
  assert.match(tex, /\\AddEnumerateCounter\{\\lpepparen\}\{\\lpe@ppn\}\{⑽\}/);
  assert.match(tex, /\\setlist\[enumerate,1\]\{label=\\lpepparen\*,/);
});
