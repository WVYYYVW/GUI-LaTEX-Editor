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

import { UNIVERSITY_THEMES } from '../src/renderer/lib/universityThemes.js';
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
  assert.match(tex, /left=27\.6mm,right=23\.8mm,top=27\.4mm,bottom=22mm/);
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
  assert.match(tex, /\\renewcommand\{\\enumerate\}\[1\]\[\]\{\\lpe@pre\\lpe@enumerate/);
  // 入れ子の enumerate で包み直さない（無限に展開されて TeX が止まるのを防ぐ）
  assert.match(tex, /\\itemsep7\.5mm\}\\let\\lpe@pre\\relax\}/);
  // 全体の \@listi は書き換えない（center などの前後の空きが変わらないように）
  assert.doesNotMatch(tex, /\\let\\@listI\\@listi/);
});

test('句読点の統一は数式の中を変えない', () => {
  const l = { punct: 'commaPeriod' };
  assert.equal(applyPunct('a、b。$f(x)、y$', l, findMathRanges), 'a，b．$f(x)、y$');
});
