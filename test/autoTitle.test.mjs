// 題名の自動設定と一覧の要約
import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestTitle } from '../src/renderer/lib/autoTitle.js';
import { plainSummary } from '../src/renderer/lib/natural.js';
import { normalizeDoc } from '../src/renderer/lib/model.js';

test('数学: 分野と問われていることから題名を付ける', () => {
  assert.equal(suggestTitle('関数 $f(x)=x^2-2ax+3$ について，二次関数のグラフを考える。\n(1) 最小値を求めよ。'), '二次関数の最大・最小');
  assert.equal(suggestTitle('さいころを 3 回投げるとき，目の積が偶数となる確率を求めよ。'), '確率');
  assert.equal(suggestTitle(String.raw`次の定積分を求めよ。\[ \int_0^1 x e^x\,dx \]`), '定積分');
  assert.equal(suggestTitle(String.raw`$a_1=1,\ a_{n+1}=2a_n+1$ で定まる数列の一般項を求めよ。`), '数列');
  assert.equal(suggestTitle(String.raw`$\sin\theta+\cos\theta$ の最大値を求めよ。`), '三角関数の最大・最小');
  assert.equal(suggestTitle(String.raw`$n$ が整数のとき，$n^3-n$ は 6 の倍数であることを示せ。`), '整数の証明');
});

test('物理・化学', () => {
  assert.equal(suggestTitle('ばね定数 k のばねにつけた物体が単振動をする。周期を求めよ。', 'physics'), '単振動');
  assert.equal(suggestTitle('極板間の距離が d のコンデンサーに電池をつなぐ。', 'physics'), 'コンデンサー');
  assert.equal(suggestTitle(String.raw`0.10 mol/L の酢酸水溶液の pH を求めよ。酸の電離度は 0.01 とする。`, 'chemistry'), '酸と塩基');
});

test('手がかりが無いときは最初の一文、空なら空', () => {
  assert.equal(suggestTitle('次の文章を読んで答えよ。あとは自由。'), '文章を読んで答えよ');
  assert.equal(suggestTitle(''), '');
  assert.ok(suggestTitle('あいうえおかきくけこさしすせそたちつてと').endsWith('…'));
});

test('一覧の要約: \\begin{enumerate} などの命令の名前を出さない', () => {
  const s = plainSummary(['\\begin{enumerate}[label=(\\alph*)]', '\\item $f(x)$ の最小値を求めよ。', '\\end{enumerate}'].join('\n'));
  assert.equal(s, 'f(x) の最小値を求めよ。');
  assert.equal(plainSummary('\\textbf{注意} 空欄 \\blank{ア} に入る数 % メモ'), '注意 空欄 （ア） に入る数');
  assert.equal(plainSummary('\\begin{tabular}{|c|c|} a & b \\end{tabular}'), 'a b');
});

test('題名が空の問題は、開いたときに題名を付けて「自動」の印を付ける', () => {
  const doc = normalizeDoc({ format: 'mathprob', version: 1, meta: { subject: 'math' }, problems: [{ title: '', body: '確率を求めよ。さいころを投げる。' }, { title: '自分の題名', body: '確率' }] });
  assert.equal(doc.problems[0].title, '確率');
  assert.equal(doc.problems[0].titleAuto, true);
  assert.equal(doc.problems[1].title, '自分の題名');
  assert.ok(!doc.problems[1].titleAuto);
});
