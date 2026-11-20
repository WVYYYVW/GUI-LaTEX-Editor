// 「(1) …」で書いた小問を LaTeX にする
import test from 'node:test';
import assert from 'node:assert/strict';
import { naturalToLatex, latexToNatural, parseMarker, markerText } from '../src/renderer/lib/natural.js';

const L = (...xs) => xs.join('\n');
const B = '\\begin{enumerate}';
const E = '\\end{enumerate}';

test('「(1) 」の行が小問になる（行の数は変えない）', () => {
  assert.equal(
    naturalToLatex(L('次の問いに答えよ。', '(1) $x$ を求めよ。', '(2) $y$ を求めよ。')),
    L('次の問いに答えよ。', `${B}\\item $x$ を求めよ。`, `\\item $y$ を求めよ。${E}`)
  );
  // 全角括弧・丸括弧数字・全角数字・全角空白
  assert.equal(naturalToLatex(L('（１）　あ', '（２）　い')), L(`${B}\\item あ`, `\\item い${E}`));
  assert.equal(naturalToLatex(L('⑴ あ', '⑵ い')), L(`${B}\\item あ`, `\\item い${E}`));
});

test('空白が無い「(1)式より」は小問にしない', () => {
  const s = L('(1)式より $a=1$ である。');
  assert.equal(naturalToLatex(s), s);
});

test('小問の間の行・数式は前の小問の続き、空行の後の文章でまとまりが終わる', () => {
  const src = L('(1) 次を示せ。', '', '\\[ a=b \\]', '', '(2) 求めよ。', 'つづき', '', '以上。');
  assert.equal(naturalToLatex(src), L(`${B}\\item 次を示せ。`, '', '\\[ a=b \\]', '', '\\item 求めよ。', `つづき${E}`, '', '以上。'));
});

test('(1) から始め直すと別のまとまり', () => {
  assert.equal(naturalToLatex(L('(1) a', '(2) b', '(1) c')), L(`${B}\\item a`, `\\item b${E}`, `${B}\\item c${E}`));
});

test('最後の行がコメントなら \\end は次の行', () => {
  assert.equal(naturalToLatex(L('(1) a % メモ')), L(`${B}\\item a % メモ`, E));
});

test('既にある enumerate の中・コメント・図の中は変えない', () => {
  const s = L(B, '\\item (1) の答え', '(2) そのまま', E, '% (1) メモ');
  assert.equal(naturalToLatex(s), s);
  const fig = L('% @fig {"type":"geo"}', '(1) \\draw (0,0);', '% @endfig');
  assert.equal(naturalToLatex(fig), fig);
});

test('単純な enumerate を「(1) 」の書き方に直す', () => {
  assert.equal(latexToNatural(L('前文', B, '  \\item あ', '  \\item い', E)), L('前文', '(1) あ', '(2) い'));
  // 入れ子・\item[…] はそのまま
  const nested = L(B, '\\item a', B, '\\item b', E, E);
  assert.equal(latexToNatural(nested), nested);
});

test('目印の読み取りと次の目印', () => {
  assert.deepEqual(parseMarker('(12) x'), { n: 12, indent: '', length: 5, circled: false, fullwidth: false });
  assert.equal(markerText(3, parseMarker('⑵ x')), '⑶ ');
  assert.equal(markerText(3, parseMarker('（2） x')), '（3） ');
});
