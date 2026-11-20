import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAiPrompt, splitAiProblems, parseMathprobText, aiFileName } from '../src/renderer/lib/aiPrompt.js';
import { aiTextToLatex } from '../src/renderer/lib/smartPaste.js';
import { normalizeDoc } from '../src/renderer/lib/model.js';

test('AI 用プロンプト: 問題だけ / 問題と解答、科目ごとの約束、.mathprob の形式', () => {
  const both = buildAiPrompt({ subject: 'chemistry', withSolution: true, request: '酸と塩基の問題を2題' });
  assert.match(both, /酸と塩基の問題を2題/);
  assert.match(both, /【解答1】/);
  assert.match(both, /\\ce\{/);
  const only = buildAiPrompt({ subject: 'physics', withSolution: false });
  assert.doesNotMatch(only, /^【解答1】$/m);
  assert.match(only, /解答・ヒント・答えは出力しない/);
  assert.match(only, /\\qty\{/);
  const file = buildAiPrompt({ format: 'mathprob', withSolution: true });
  assert.match(file, /"format": "mathprob"/);
  assert.match(file, /拡張子 \.mpb/); // ファイル名を指定しなければ AI が内容に合わせて付ける
  assert.doesNotMatch(file, /問題集\.mathprob/);
  // ファイル名を指定したとき（拡張子は付け足し、使えない文字は取り除く）
  const named = buildAiPrompt({ format: 'mathprob', fileName: '二次関数 演習/3題' });
  assert.match(named, /「二次関数_演習3題\.mpb」という名前のファイル/);
  assert.equal(aiFileName('a.mathprob'), 'a.mathprob');
  assert.equal(aiFileName('  '), null);
});

test('【問題1】【解答1】の区切りを問題ごとに分ける（コードブロックで貼っても区切りが残る）', () => {
  const reply = [
    '以下が問題です。',
    '```latex',
    '【問題1】（二次関数）',
    '$f(x)=x^2-2ax$ の最小値を求めよ。',
    '【解答1】',
    '平方完成すると $f(x)=(x-a)^2-a^2$。',
    '【問題２】',
    String.raw`\ce{H2O} の分子量を求めよ。`,
    '```',
  ].join('\n');
  const latex = aiTextToLatex(reply);
  const list = splitAiProblems(latex);
  assert.equal(list.length, 2);
  assert.equal(list[0].title, '二次関数');
  assert.match(list[0].body, /最小値を求めよ/);
  assert.match(list[0].solution, /平方完成/);
  assert.equal(list[1].solution, '');
  assert.match(list[1].body, /\\ce\{H2O\}/);
  assert.equal(splitAiProblems('区切りのない文章'), null);
});

test('.mathprob の JSON を貼り付けても読める（コードブロックで囲まれていてもよい）', () => {
  const json = JSON.stringify({ format: 'mathprob', version: 1, meta: { title: 't', subject: 'physics' }, problems: [{ title: 'a', body: String.raw`$\frac12$`, solution: 's', difficulty: 3 }] });
  const d = parseMathprobText('```json\n' + json + '\n```');
  assert.ok(d);
  const doc = normalizeDoc(d);
  assert.equal(doc.problems[0].body, String.raw`$\frac12$`);
  assert.equal(doc.meta.subject, 'physics');
  assert.equal(parseMathprobText('{"a":1}'), null);
  assert.equal(parseMathprobText('ふつうの文章'), null);
});
