// LaTeX エンジンの検出と PDF コンパイル
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const isWin = process.platform === 'win32';
const exe = (name) => (isWin ? `${name}.exe` : name);

function listDirs(parent) {
  try {
    return fs.readdirSync(parent).map((n) => path.join(parent, n));
  } catch {
    return [];
  }
}

/** エンジンを探す候補ディレクトリ（GUI アプリは PATH が短いことがあるので代表的な場所も見る） */
function candidateDirs() {
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  if (process.platform === 'darwin') {
    dirs.push('/Library/TeX/texbin', '/opt/homebrew/bin', '/usr/local/bin');
    for (const y of listDirs('/usr/local/texlive').sort().reverse()) {
      dirs.push(path.join(y, 'bin', 'universal-darwin'));
    }
  } else if (isWin) {
    for (const root of ['C:\\texlive', 'D:\\texlive']) {
      for (const y of listDirs(root).sort().reverse()) {
        dirs.push(path.join(y, 'bin', 'windows'), path.join(y, 'bin', 'win64'), path.join(y, 'bin', 'win32'));
      }
    }
    const local = process.env.LOCALAPPDATA || '';
    dirs.push(
      path.join(local, 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64'),
      'C:\\Program Files\\MiKTeX\\miktex\\bin\\x64'
    );
  } else {
    dirs.push('/usr/bin', '/usr/local/bin');
    for (const y of listDirs('/usr/local/texlive').sort().reverse()) {
      dirs.push(path.join(y, 'bin', 'x86_64-linux'), path.join(y, 'bin', 'aarch64-linux'));
    }
  }
  return dirs;
}

function detectEngine(name = 'lualatex') {
  for (const d of candidateDirs()) {
    const p = path.join(d, exe(name));
    try {
      if (fs.statSync(p).isFile()) return p;
    } catch {
      /* 次へ */
    }
  }
  return null;
}

function parseErrors(log) {
  const lines = log.split(/\r?\n/);
  const errors = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(?:\.\/|.*[\\/])?main\.tex:(\d+):\s*(.*)$/);
    if (m) {
      errors.push({ line: Number(m[1]), message: m[2], context: lines.slice(i + 1, i + 4).join('\n') });
    } else if (lines[i].startsWith('! ')) {
      errors.push({ line: null, message: lines[i].slice(2), context: lines.slice(i + 1, i + 4).join('\n') });
    }
  }
  return errors.slice(0, 20);
}

/**
 * ログから「TeX に入っていないパッケージのファイル」を拾う（\documentclass・\usepackage の読み込み失敗）。
 * .sty / .cls だけを見る（\input した自分のファイルが無いのはパッケージを入れても直らない）
 */
function missingFiles(log) {
  const found = [];
  const re = /(?:LaTeX Error: File `|! I can't find file `)([^'\s]+\.(?:sty|cls))'/g;
  let m;
  while ((m = re.exec(log || ''))) if (!found.includes(m[1])) found.push(m[1]);
  return found;
}

// アプリが出力する文書が使うファイル → TeX Live のパッケージ名
const FILE_PACKAGES = {
  'ltjsarticle.cls': 'luatexja',
  'luatexja.sty': 'luatexja',
  'luatexja-fontspec.sty': 'luatexja',
  'amsmath.sty': 'amsmath',
  'amssymb.sty': 'amsfonts',
  'amsthm.sty': 'amscls',
  'mathtools.sty': 'mathtools',
  'bm.sty': 'tools',
  'multicol.sty': 'tools',
  'enumitem.sty': 'enumitem',
  'geometry.sty': 'geometry',
  'graphicx.sty': 'graphics',
  'xcolor.sty': 'xcolor',
  'tikz.sty': 'pgf',
  'pgf.sty': 'pgf',
};
// 上のファイルをまとめて入れるコレクション（BasicTeX などの小さい TeX に足りないもの）
const TL_COLLECTIONS = ['collection-langjapanese', 'collection-latexrecommended', 'collection-pictures'];

function packageOf(file) {
  if (FILE_PACKAGES[file]) return FILE_PACKAGES[file];
  if (/^ltj/.test(file) || /^luatexja/.test(file)) return 'luatexja';
  if (/^(tikz|pgf)/.test(file)) return 'pgf';
  return file.replace(/\.(sty|cls|tex|def|cfg)$/, '');
}

const quote = (p) => (/\s/.test(p) ? `"${p}"` : p);

/**
 * 足りないファイルを入れる方法（使っている TeX の種類と OS に合わせる）
 * @param {string[]} files missingFiles の結果
 * @param {{platform?:string, enginePath?:string, exists?:(p:string)=>boolean}} env
 * @returns {null | {files:string[], packages:string[], japanese:boolean, distro:string, message:string, steps:{text:string, command?:string}[], note:string}}
 */
function missingAdvice(files, { platform = process.platform, enginePath = '', exists = fs.existsSync } = {}) {
  if (!files || !files.length) return null;
  const win = platform === 'win32';
  const packages = [...new Set(files.map(packageOf))];
  const japanese = packages.includes('luatexja');
  const known = new Set(Object.values(FILE_PACKAGES));
  const extra = packages.filter((p) => !known.has(p));
  const P = win ? path.win32 : path.posix;
  const dir = enginePath ? P.dirname(enginePath) : '';
  const lower = enginePath.toLowerCase();
  let distro = 'texlive';
  if (lower.includes('miktex')) distro = 'miktex';
  else if (platform === 'linux' && enginePath.startsWith('/usr/bin/')) distro = 'linux';

  const message =
    `TeX に${files.map((f) => `「${f}」`).join('')}がありません。` +
    (japanese
      ? '日本語を組むための luatexja が入っていない TeX です（Mac の BasicTeX など）。'
      : '使っている TeX に、このパッケージが入っていません。') +
    '次の手順で入れてから、もう一度「PDF を作成」してください。';

  const steps = [];
  let note = '';
  if (distro === 'miktex') {
    steps.push({ text: 'MiKTeX Console を開き、Settings → General の「missing packages」の項目を「Always」にする（足りないものを自動で入れるようになる）。コマンドで設定するなら:', command: 'initexmf --set-config-value=[MPM]AutoInstall=1' });
    steps.push({ text: 'または、足りないパッケージを直接入れる:', command: `miktex packages install ${[...new Set([...packages, ...(japanese ? ['haranoaji'] : [])])].join(' ')}` });
    note = 'MiKTeX を「全ユーザー用」に入れた場合は、MiKTeX Console を管理者モードで開いてください。';
  } else if (distro === 'linux') {
    steps.push({ text: 'Debian / Ubuntu の場合:', command: 'sudo apt install texlive-luatex texlive-lang-japanese texlive-latex-recommended texlive-latex-extra texlive-pictures' });
    note = 'ほかのディストリビューションでは、日本語（luatexja）・latex-recommended・pgf を含むパッケージを入れてください。';
  } else {
    let tlmgr = 'tlmgr';
    for (const name of win ? ['tlmgr.bat', 'tlmgr.exe'] : ['tlmgr']) {
      const p = dir ? P.join(dir, name) : '';
      if (p && exists(p)) {
        tlmgr = quote(win ? p.replace(/\.bat$/i, '') : p);
        break;
      }
    }
    const sudo = win ? '' : 'sudo ';
    const where = win ? 'コマンドプロンプトで' : 'ターミナルで';
    steps.push({ text: `${where}次の 2 行を順に実行する（${win ? '' : 'Mac のログインパスワードを聞かれます。'}数分かかります）。まず tlmgr 自身を新しくする:`, command: `${sudo}${tlmgr} update --self` });
    steps.push({ text: '必要なパッケージをまとめて入れる:', command: `${sudo}${tlmgr} install ${[...TL_COLLECTIONS, ...extra].join(' ')}` });
    note =
      '「older than remote repository」と出るときは TeX が古いので、' +
      (platform === 'darwin' ? '最新の MacTeX を入れ直してください（容量に余裕があれば BasicTeX より MacTeX がおすすめです）。' : '最新の TeX Live を入れ直してください。') +
      (win ? 'TeX Live を全ユーザー用に入れた場合は、コマンドプロンプトを「管理者として実行」で開いてください。' : '');
  }
  return { files, packages, japanese, distro, message, steps, note };
}

/**
 * @param {{source:string, enginePath:string, projectDir?:string}} opts
 * @returns {Promise<{ok:boolean, pdfPath?:string, workDir:string, log:string, errors:any[]}>}
 */
function compile({ source, enginePath, projectDir }) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mathprob-'));
  fs.writeFileSync(path.join(workDir, 'main.tex'), source, 'utf8');

  const env = { ...process.env };
  env.PATH = path.dirname(enginePath) + path.delimiter + (env.PATH || '');
  env.max_print_line = '10000'; // ログの折り返しを防いでエラー行を読みやすくする
  if (projectDir) env.TEXINPUTS = projectDir + path.delimiter + (env.TEXINPUTS || '');

  const args = ['-interaction=nonstopmode', '-halt-on-error', '-file-line-error', 'main.tex'];
  return new Promise((resolve) => {
    let out = '';
    const child = spawn(enginePath, args, { cwd: workDir, env, windowsHide: true });
    const timer = setTimeout(() => child.kill(), 5 * 60 * 1000);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, workDir, log: String(e), errors: [{ line: null, message: String(e.message || e) }] });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const pdfPath = path.join(workDir, 'main.pdf');
      let log = out;
      try {
        log = fs.readFileSync(path.join(workDir, 'main.log'), 'utf8');
      } catch {
        /* stdout を使う */
      }
      if (code === 0 && fs.existsSync(pdfPath)) resolve({ ok: true, pdfPath, workDir, log, errors: [] });
      else resolve({ ok: false, workDir, log, errors: parseErrors(log) });
    });
  });
}

module.exports = { detectEngine, compile, parseErrors, missingFiles, missingAdvice };
