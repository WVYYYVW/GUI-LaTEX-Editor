// プレビューの HTML
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLatex, renderSheet, renderSheetParts } from '../src/renderer/lib/preview.js';
import { newDocument, newProblem } from '../src/renderer/lib/model.js';

test('小問の間に空行があっても、すべての小問が同じリストに入る', () => {
  const src = ['(1) まず $a$ を求める。', '', '\\[ x=1 \\]', '', '(2) 次に $b$。', '', '(3) 最後。', '', '以上。'].join('\n');
  const html = renderLatex(src, {});
  const ol = html.match(/<ol[^>]*>([\s\S]*)<\/ol>/);
  assert.ok(ol, 'リストがある');
  assert.equal((html.match(/<li>/g) || []).length, 3);
  assert.equal((ol[1].match(/class="pv-par"/g) || []).length, 0, 'リストの中で段落に切られていない');
  assert.match(html, /<\/ol>[\s\S]*以上/);
});

test('プリント全体は問題ごとに分けて作れ、つなげると全体と同じ', () => {
  const doc = newDocument(false);
  doc.problems = [1, 2, 3].map((n) => Object.assign(newProblem(), { title: `問${n}`, body: `(1) $x^${n}$ を求めよ。`, solution: `答え ${n}` }));
  const parts = renderSheetParts(doc, {}, { interactive: true });
  assert.equal(parts.items.length, 3);
  assert.equal(parts.answers.length, 3);
  const joined =
    parts.head +
    parts.items.map((h, i) => `<div class="sh-item" data-item="${i}">${h}</div>`).join('') +
    parts.mid +
    parts.answers.map((h, i) => `<div class="sh-item sh-ans-item" data-item="${i}">${h}</div>`).join('') +
    parts.tail;
  assert.equal(renderSheet(doc, {}, { interactive: true }), joined);
  // 1 題だけ変えると、その部分だけが変わる
  doc.problems[1].body = '(1) 変更';
  const p2 = renderSheetParts(doc, {}, { interactive: true });
  assert.deepEqual(p2.items.map((h, i) => h === parts.items[i]), [true, false, true]);
});
