// プレビュー用に、TikZ の図 1 つを LuaLaTeX で小さな PDF にする（余白なしで切り抜く）。
// 同じ図は作り直さないよう、ユーザーデータのフォルダに PDF をとっておく。
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const tex = require('./tex');

const MAX_CACHE = 400; // とっておく図の数の上限（古いものから消す）

/** 図 1 つだけの LaTeX 文書。中身の大きさにページを合わせる（standalone などのパッケージが無くても動くように） */
function tikzDocument(code, preamble) {
  return [
    '\\documentclass{ltjsarticle}',
    '\\usepackage{amsmath,amssymb,bm}',
    '\\usepackage{xcolor}',
    '\\usepackage{tikz}',
    '\\usetikzlibrary{arrows.meta,calc,intersections}',
    preamble || '',
    '\\pagestyle{empty}',
    '\\begin{document}',
    '\\setbox0=\\hbox{%',
    code,
    '}',
    '\\pagewidth=\\dimexpr\\wd0+4pt\\relax',
    '\\pageheight=\\dimexpr\\ht0+\\dp0+4pt\\relax',
    '\\pdfvariable horigin=2pt',
    '\\pdfvariable vorigin=2pt',
    '\\shipout\\box0',
    '\\end{document}',
  ].join('\n');
}

let queue = Promise.resolve();

/**
 * @param {{code:string, preamble?:string, enginePath:string|null, cacheDir:string, projectDir?:string}} o
 * @returns {Promise<{ok:true, pdf:string} | {ok:false, error:string}>} pdf は base64
 */
function renderTikz(o) {
  const run = async () => {
    if (!o.enginePath) return { ok: false, error: 'noEngine' };
    const key = crypto.createHash('sha1').update(`${o.code}\u0000${o.preamble || ''}`).digest('hex');
    const cached = path.join(o.cacheDir, `${key}.pdf`);
    try {
      const buf = await fsp.readFile(cached);
      return { ok: true, pdf: buf.toString('base64') };
    } catch {
      /* まだ無い */
    }
    const res = await tex.compile({ source: tikzDocument(o.code, o.preamble), enginePath: o.enginePath, projectDir: o.projectDir });
    try {
      if (!res.ok) return { ok: false, error: res.errors[0]?.message || 'TikZ の図を作れませんでした' };
      const buf = await fsp.readFile(res.pdfPath);
      await fsp.mkdir(o.cacheDir, { recursive: true });
      await fsp.writeFile(cached, buf);
      pruneCache(o.cacheDir);
      return { ok: true, pdf: buf.toString('base64') };
    } finally {
      fsp.rm(res.workDir, { recursive: true, force: true }).catch(() => {});
    }
  };
  // LuaLaTeX は重いので 1 つずつ
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

function pruneCache(dir) {
  try {
    const files = fs
      .readdirSync(dir)
      .filter((n) => n.endsWith('.pdf'))
      .map((n) => ({ n, t: fs.statSync(path.join(dir, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const f of files.slice(MAX_CACHE)) fs.rmSync(path.join(dir, f.n), { force: true });
  } catch {
    /* 片付けに失敗しても図は出せる */
  }
}

module.exports = { renderTikz, tikzDocument };
