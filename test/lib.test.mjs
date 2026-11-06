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
  assert.match(tex, /\\lpenum\{1\}\}\\quad\{\\lpeheadfont 二次方程式\}/);
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
