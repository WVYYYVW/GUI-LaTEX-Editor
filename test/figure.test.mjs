// グラフの補助：縦の直線、範囲を自動、要点を打つ
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultGraph, readGraphExpr, autoYRange, autoRange, graphKeyPoints, niceNumber, figureToSvg, figureErrors } from '../src/renderer/lib/figure.js';

const graph = (exprs, extra = {}) => ({ ...defaultGraph(), functions: exprs.map((expr) => ({ expr, from: '', to: '', dashed: false, label: '' })), points: [], ...extra });

test('関数の欄: y= は省ける、x=2 は縦の直線', () => {
  assert.deepEqual(readGraphExpr('y = x^2'), { kind: 'fn', expr: 'x^2' });
  assert.deepEqual(readGraphExpr('x=2'), { kind: 'vline', x: 2 });
  assert.deepEqual(readGraphExpr('x = pi/2').kind, 'vline');
  assert.equal(readGraphExpr('  '), null);
  const g = graph(['x^2', 'x=1']);
  assert.deepEqual(figureErrors(g), []);
  assert.match(figureToSvg(g), /<svg/);
});

test('要点: 切片・極値・交点を見やすい数で', () => {
  const pts = graphKeyPoints(graph(['x^2-2x']));
  const byKind = (k) => pts.filter((p) => p.kind === k).map((p) => [p.x, p.y, p.label]);
  assert.deepEqual(byKind('min'), [[1, -1, '$(1,\\,-1)$']]);
  assert.deepEqual(byKind('xint'), [[2, 0, '']]); // 整数は目盛りの数字があるので名前なし。原点は「O」なので打たない
  // 2 つの関数の交点
  const cross = graphKeyPoints(graph(['x^2', 'x+2'])).filter((p) => p.kind === 'cross');
  assert.deepEqual(cross.map((p) => [p.x, p.y]), [[-1, 1], [2, 4]]);
  // 重解（x 軸に接する）
  const touch = graphKeyPoints(graph(['(x-1)^2'])).filter((p) => p.kind === 'xint');
  assert.deepEqual(touch.map((p) => p.x), [1]);
  // 1/x の x=0 は零点ではない
  assert.equal(graphKeyPoints(graph(['1/x'])).filter((p) => p.kind === 'xint').length, 0);
  // すでにある点とは重ならない
  const g = graph(['x^2-2x']);
  g.points = graphKeyPoints(g);
  assert.equal(graphKeyPoints(g).length, 0);
});

test('数の書き方と、y の範囲の自動', () => {
  assert.equal(niceNumber(0.5), '\\frac{1}{2}');
  assert.equal(niceNumber(-1.5), '-\\frac{3}{2}');
  assert.equal(niceNumber(Math.SQRT2), '1.41');
  const r = autoYRange(graph(['x^2'], { xmin: -3, xmax: 3 }));
  assert.ok(r.ymin <= 0 && r.ymax >= 9 && r.ymax <= 11, JSON.stringify(r));
  const inv = autoYRange(graph(['1/x'], { xmin: -4, xmax: 4 }));
  assert.ok(inv.ymax - inv.ymin < 60, JSON.stringify(inv)); // 漸近線で広がりすぎない
});

test('範囲を自動: 切片・極値が収まり、形が見える範囲', () => {
  const r = autoRange(graph(['x^3-3x']));
  assert.ok(r.xmin <= -2 && r.xmax >= 2 && r.xmax <= 4, JSON.stringify(r));
  assert.ok(r.ymin >= -15 && r.ymax <= 15 && r.ymax >= 2, JSON.stringify(r));
  // y 軸が端にくっつかない
  const q = autoRange(graph(['x^2-2x']));
  assert.ok(q.xmin < 0 && q.xmax > 2, JSON.stringify(q));
  // 要点が 1 つだけ（e^x の y 切片）でも狭くなりすぎない
  const e = autoRange(graph(['e^x']));
  assert.ok(e.xmax - e.xmin >= 4, JSON.stringify(e));
});
