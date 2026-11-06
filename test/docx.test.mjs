import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docxToProblems, omml, parseXml, tidyBody } from '../src/renderer/lib/docxImport.js';

const W = (body) => `<?xml version="1.0"?><w:document xmlns:w="w" xmlns:m="m"><w:body>${body}</w:body></w:document>`;
const r = (t) => `<m:r><m:t>${t}</m:t></m:r>`;
const enc = (shape, n) => `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>${String.raw`eq \o\ac(`}${shape},${n})</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;

test('OMML の分数・累乗・根号を LaTeX に', () => {
  const x = parseXml(`<m:oMath><m:f><m:num>${r('1')}</m:num><m:den><m:sSup><m:e>${r('x')}</m:e><m:sup>${r('2')}</m:sup></m:sSup></m:den></m:f>${r('+')}<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${r('3')}</m:e></m:rad></m:oMath>`);
  assert.equal(omml(x.children[0]).replace(/\s+/g, ''), String.raw`\frac{1}{{x}^{2}}+\sqrt{3}`);
});

test('囲み番号で大問を分け、数式内の日本語は文章として出す', () => {
  const xml = W(
    `<w:p>${enc('○', 1)}<m:oMath>${r('C**')}</m:oMath></w:p>` +
      `<w:p><m:oMathPara><m:oMath>${r('x≧1')}<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>のとき</m:t></m:r></m:oMath></m:oMathPara></w:p>` +
      `<w:p><m:oMath><m:d><m:e>${r('1')}</m:e></m:d>${r('f')}<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>を求めよ．</m:t></m:r></m:oMath></w:p>` +
      `<w:p>${enc('□', 2)}</w:p><w:p><w:r><w:t>二問目</w:t></w:r></w:p>`
  );
  const { problems } = docxToProblems(xml);
  assert.equal(problems.length, 2);
  assert.deepEqual(problems[0].tags, ['文理系', 'ランクC']);
  assert.equal(problems[0].difficulty, 2);
  assert.match(problems[0].body, /\$x\\geqq 1\$のとき/);
  assert.match(problems[0].body, /\\begin\{enumerate\}\n {2}\\item \$f\$を求めよ．\n\\end\{enumerate\}/);
  assert.deepEqual(problems[1].tags, ['理系']);
});

test('数式段落の中の ∫・Σ・分数は Word と同じくディスプレイの大きさにする', () => {
  const frac = `<m:f><m:num>${r('1')}</m:num><m:den>${r('n')}</m:den></m:f>`;
  const xml = W(
    `<w:p>${enc('○', 1)}</w:p>` +
      `<w:p><m:oMathPara><m:oMath><m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>値は</m:t></m:r>${frac}<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>である．</m:t></m:r></m:oMath></m:oMathPara></w:p>` +
      `<w:p><m:oMath><m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t>文中の</m:t></m:r>${frac}</m:oMath></w:p>`
  );
  const body = docxToProblems(xml).problems[0].body;
  assert.match(body, /値は\$\\displaystyle \\frac\{1\}\{n\}\$である/);
  assert.match(body, /文中の\$\\frac\{1\}\{n\}\$/);
});

test('●◎ だけの数式は文章に戻し、Word の手での改行は前の行につなぐ', () => {
  const src = '  \item $●●●◎◎◎, ●●●◎●●●$となる確率\n\n    をそれぞれ求めよ．';
  assert.equal(tidyBody(src), '  \item ●●●◎◎◎，●●●◎●●●となる確率をそれぞれ求めよ．');
  // 数式どうしの間の空白、\triangle、環境の終わりの後の文章はそのまま
  const keep = '$x$\n    $=y$ と $\triangle ABC$\n\end{enumerate}\n\nただし，$p$は正とする．';
  assert.equal(tidyBody(keep), keep);
  // 句点で終わる行の後はつながない
  assert.equal(tidyBody('求めよ．\n\nまた'), '求めよ．\n\nまた');
});
