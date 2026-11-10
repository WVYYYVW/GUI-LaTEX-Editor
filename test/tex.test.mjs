// TeX に足りないファイルを見つけて、入れ方を案内する
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const tex = require('../electron/tex.js');

const LOG = String.raw`! LaTeX Error: File ${'`'}ltjsarticle.cls' not found.

Type X to quit or <RETURN> to proceed,
or enter new name. (Default extension: cls)

Enter file name:
! Emergency stop.
<read *>

l.2 \usepackage
`;

test('ログから足りないファイルを拾う', () => {
  assert.deepEqual(tex.missingFiles(LOG), ['ltjsarticle.cls']);
  assert.deepEqual(tex.missingFiles("! I can't find file `foo.tex'.\n! LaTeX Error: File `enumitem.sty' not found.\n! LaTeX Error: File `enumitem.sty' not found."), ['enumitem.sty']);
  assert.deepEqual(tex.missingFiles("! I can't find file `main.tex'.\n! LaTeX Error: File `figures/a.tex' not found."), []);
  assert.deepEqual(tex.missingFiles('! Undefined control sequence.'), []);
  assert.equal(tex.missingAdvice([], {}), null);
});

test('Mac（BasicTeX）: sudo tlmgr で日本語などをまとめて入れる', () => {
  const a = tex.missingAdvice(['ltjsarticle.cls'], {
    platform: 'darwin',
    enginePath: '/Library/TeX/texbin/lualatex',
    exists: (p) => p === '/Library/TeX/texbin/tlmgr',
  });
  assert.equal(a.distro, 'texlive');
  assert.ok(a.japanese);
  assert.match(a.message, /ltjsarticle\.cls/);
  assert.equal(a.steps[0].command, 'sudo /Library/TeX/texbin/tlmgr update --self');
  assert.equal(a.steps[1].command, 'sudo /Library/TeX/texbin/tlmgr install collection-langjapanese collection-latexrecommended collection-pictures');
  assert.match(a.note, /MacTeX/);
});

test('Windows の TeX Live: sudo なし、知らないパッケージは名前で足す', () => {
  const a = tex.missingAdvice(['enumitem.sty', 'foo.sty'], {
    platform: 'win32',
    enginePath: 'C:\\texlive\\2025\\bin\\windows\\lualatex.exe',
    exists: (p) => p.endsWith('tlmgr.bat'),
  });
  assert.equal(a.steps[0].command, 'C:\\texlive\\2025\\bin\\windows\\tlmgr update --self');
  assert.match(a.steps[1].command, /install collection-langjapanese collection-latexrecommended collection-pictures foo$/);
  assert.ok(!a.japanese);
});

test('tlmgr が見つからないときと、空白を含む場所', () => {
  const a = tex.missingAdvice(['ltjsarticle.cls'], { platform: 'darwin', enginePath: '/opt/homebrew/bin/lualatex', exists: () => false });
  assert.equal(a.steps[0].command, 'sudo tlmgr update --self');
  const b = tex.missingAdvice(['ltjsarticle.cls'], { platform: 'win32', enginePath: 'D:\\My TeX\\bin\\windows\\lualatex.exe', exists: (p) => p.endsWith('tlmgr.bat') });
  assert.equal(b.steps[0].command, '"D:\\My TeX\\bin\\windows\\tlmgr" update --self');
});

test('MiKTeX と Linux のパッケージ', () => {
  const m = tex.missingAdvice(['ltjsarticle.cls'], { platform: 'win32', enginePath: 'C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\lualatex.exe' });
  assert.equal(m.distro, 'miktex');
  assert.equal(m.steps[0].command, 'initexmf --set-config-value=[MPM]AutoInstall=1');
  assert.equal(m.steps[1].command, 'miktex packages install luatexja haranoaji');
  const l = tex.missingAdvice(['tikz.sty'], { platform: 'linux', enginePath: '/usr/bin/lualatex' });
  assert.equal(l.distro, 'linux');
  assert.match(l.steps[0].command, /^sudo apt install .*texlive-lang-japanese/);
});
