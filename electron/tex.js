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

module.exports = { detectEngine, compile, parseErrors };
