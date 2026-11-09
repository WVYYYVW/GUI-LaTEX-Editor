// 問題集データ → LaTeX 文書（LuaLaTeX + ltjsarticle で日本語をそのまま扱う）

import { normalizeLayout, texLayoutPreamble, texProblemOpen, texSubLabel, pointsText, applyPunct } from './layout.js';
import { findMathRanges } from './mathRanges.js';
import { CHEM_PREAMBLE, expandScience } from './chem.js';

const MARK = '% @@';

const ensureNl = (s) => (s.endsWith('\n') ? s : s + '\n');

// 化学式・単位は書き出し時に普通の LaTeX に置き換える（expandScience）。mhchem・siunitx が無い TeX でも組める
export const TEX_SCIENCE = CHEM_PREAMBLE;

// 和文を欧文と同じ大きさで組む。ltjsarticle は和文を欧文の 0.924715 倍（\Cjascale）にするため、
// 10pt の本文の和文が 9.25pt になり、プレビューや実物の冊子より 1 行の字数が多くなっていた。
// 読み込み済みの和文フォント（クラスの読み込み時に使われた大きさ）を捨ててから選び直す。
const JA_SIZES = ['5', '6', '7', '8', '9', '10', '10.95', '11', '12', '14.4', '17.28', '20.74', '24.88'];
export const TEX_JA_SCALE = [
  '\\def\\Cjascale{1}',
  // フォントの形の宣言は宣言のときに倍率を取り込むので、luatexja の既定（lltjdefs.sty）と同じ形で宣言し直す
  '\\makeatletter',
  '\\DeclareFontShape{JY3}{mc}{m}{n}{<-> s*[1] \\ltj@stdmcfont:-kern;jfm=\\ltj@stdyokojfm}{}',
  '\\DeclareFontShape{JY3}{gt}{m}{n}{<-> s*[1] \\ltj@stdgtfont:-kern;jfm=\\ltj@stdyokojfm}{}',
  '\\DeclareFontShape{JT3}{mc}{m}{n}{<-> s*[1] \\ltj@stdmcfont:-kern;jfm=\\ltj@stdtatejfm}{}',
  '\\DeclareFontShape{JT3}{gt}{m}{n}{<-> s*[1] \\ltj@stdgtfont:-kern;jfm=\\ltj@stdtatejfm}{}',
  // 今の大きさ（11pt のクラスでは 10.95001 のような値）で読み込み済みのものも捨てる
  ['JY3/mc/m/n', 'JY3/gt/m/n', 'JT3/mc/m/n', 'JT3/gt/m/n'].map((f) => `\\expandafter\\let\\csname ${f}/\\f@size\\endcsname\\relax`).join(''),
  '\\makeatother',
  JA_SIZES.flatMap((sz) => ['JY3/mc/m/n', 'JY3/gt/m/n', 'JT3/mc/m/n', 'JT3/gt/m/n'].map((f) => `\\expandafter\\let\\csname ${f}/${sz}\\endcsname\\relax`)).join(''),
  '\\selectfont',
];

export function buildTex(doc) {
  const m = doc.meta;
  const lay = normalizeLayout(m.layout);
  const L = [];
  const fs = ['10pt', '11pt', '12pt'].includes(m.fontSize) ? m.fontSize : '11pt';
  L.push(`\\documentclass[${fs}${lay.displayAlign === 'left' ? ',fleqn' : ''}]{ltjsarticle}`);
  L.push('\\usepackage{amsmath,amssymb,amsthm,mathtools,bm}');
  L.push('\\usepackage{multicol}');
  L.push('\\usepackage{graphicx}');
  L.push('\\usepackage{xcolor}');
  L.push('\\IfFileExists{tikz.sty}{\\usepackage{tikz}\\usetikzlibrary{arrows.meta,calc,intersections}}{}');
  // 化学式（\ce{H2O}）と単位（\qty{9.8}{m/s^2}, \unit{N}）。パッケージが無い環境でも同じ書き方で組めるようにする
  L.push(...TEX_SCIENCE);
  L.push(...TEX_JA_SCALE);
  // 小問番号。enumitem が無い TeX 環境でも [label=(\arabic*)] / (\alph*) / (\roman*) が使えるようにする
  const sub = texSubLabel(lay);
  L.push('\\newcommand{\\lpekata}[1]{\\ifcase\\value{#1}\\or ア\\or イ\\or ウ\\or エ\\or オ\\or カ\\or キ\\or ク\\or ケ\\or コ\\or サ\\or シ\\fi}');
  const [pl, pr] = sub.parens;
  L.push('\\makeatletter');
  L.push('\\newcommand{\\lpe@setlabel}[1]{\\def\\lpe@arg{#1}\\ifx\\lpe@arg\\@empty\\else');
  L.push(`  \\in@{\\alph}{#1}\\ifin@\\expandafter\\def\\csname label\\@enumctr\\endcsname{${pl}\\alph{\\@enumctr}${pr}}\\else`);
  L.push(`  \\in@{\\roman}{#1}\\ifin@\\expandafter\\def\\csname label\\@enumctr\\endcsname{${pl}\\roman{\\@enumctr}${pr}}\\else`);
  L.push('  \\relax\\fi\\fi\\fi}'); // (\arabic*) を明示したときはテーマの既定の小問番号を使う
  L.push('\\newcommand{\\lpe@install}{\\let\\lpe@enumerate\\enumerate\\renewcommand{\\enumerate}[1][]{\\lpe@pre\\lpe@enumerate\\lpe@setlabel{##1}\\lpe@subfix}}');
  L.push(
    `\\IfFileExists{enumitem.sty}{\\usepackage{enumitem}\\setlist[enumerate,1]{label=${sub.enumitem},${sub.setlist}}}{\\lpe@install\\renewcommand{\\labelenumi}{${sub.classic}}}`
  );
  L.push('\\makeatother');
  L.push(...texLayoutPreamble(lay, parseInt(fs, 10)));
  L.push('\\newcommand{\\lpecolor}[2]{\\textcolor[HTML]{#1}{#2}}');
  L.push('\\newcounter{lpecovn}');
  L.push(`${MARK} preamble`);
  L.push(ensureNl(m.preamble || '').replace(/\n$/, ''));
  L.push(`${MARK} fixed`);
  L.push('\\begin{document}');

  // 表紙（試験問題冊子の表紙）。表紙にはページ番号を付けず、次のページを 1 ページ目にする
  if (m.cover?.enabled) L.push(...texCover(m.cover, doc.problems.length, (t) => applyPunct(t, lay, findMathRanges)));

  // 1 ページ目の上に大きく入れる見出し（例: 問　題　紙）
  if (lay.header && lay.headerStyle === 'title') L.push(`{\\centering\\Large\\bfseries ${lay.header}\\par}\\vspace{6mm}`);
  // 表題（大学入試テーマなどでは出さない）
  const tb = lay.titleBlock !== false;
  if (tb && (m.title || m.subtitle)) {
    L.push('\\begin{center}');
    if (m.title) L.push(`{\\LARGE\\bfseries ${m.title}}\\par`);
    if (m.subtitle) L.push(`\\smallskip{\\large ${m.subtitle}}\\par`);
    L.push('\\end{center}');
  }
  if (tb && (m.author || m.date)) L.push(`\\noindent ${m.author || ''}\\hfill ${m.date || ''}\\par`);
  if (tb && m.nameField) {
    L.push('\\noindent\\hfill 組\\underline{\\hspace{1.5cm}}\\ 番\\underline{\\hspace{1.5cm}}\\ 氏名\\underline{\\hspace{5cm}}\\par');
  }
  if (tb && (m.title || m.subtitle || m.author || m.date || m.nameField)) L.push('\\medskip\\hrule\\relax');

  const twoCol = m.columns === 2;
  if (twoCol) L.push('\\begin{multicols}{2}');

  doc.problems.forEach((p, i) => {
    const n = i + 1;
    const pl = { pageBreakBefore: false, answerSpace: null, frame: null, ...(p.layout || {}) };
    const stars = m.showDifficulty && p.difficulty > 0 ? `難易度 $${'\\bigstar'.repeat(p.difficulty)}$` : '';
    const { open, close } = texProblemOpen(lay, pl, n, p.title || '', stars, i === 0, p.points);
    L.push(...open);
    // 段落の 1 字下げは、見出し直後の最初の段落にも付ける（文章で始まるときだけ）
    if (lay.parIndent && lay.head.position !== 'inline' && /^\s*[^\s\\$]/.test(p.body || '')) L.push('\\hspace*{\\parindent}%');
    L.push(`${MARK} problem ${n} body`);
    L.push(ensureNl(expandScience(applyPunct(p.body || '', lay, findMathRanges))).replace(/\n$/, ''));
    L.push(`${MARK} fixed`);
    if (lay.pointsStyle === 'bodyEnd' && pointsText(lay, p.points)) L.push(`\\unskip\\ ${pointsText(lay, p.points)}`);
    L.push('\\par');
    if (m.answerMode === 'after' && (p.solution || '').trim()) {
      L.push('\\medskip\\noindent{\\bfseries 【解答】}\\par');
      L.push(`${MARK} problem ${n} solution`);
      L.push(ensureNl(expandScience(applyPunct(p.solution, lay, findMathRanges))).replace(/\n$/, ''));
      L.push(`${MARK} fixed`);
      L.push('\\par');
    }
    const space = pl.answerSpace ?? m.spaceAfter;
    if (Number(space) > 0) L.push(`\\vspace{${Number(space)}mm}`);
    L.push(...close);
    // 大問の後の白紙・下書き用紙
    if (lay.afterEach === 'blank') L.push('\\newpage\\null\\thispagestyle{empty}');
    else if (lay.afterEach === 'draft') {
      const pages = Math.max(1, Math.min(6, Math.round(Number(lay.draftPages) || 1)));
      for (let k = 0; k < pages; k++) L.push(`\\newpage\\begin{center}${lay.draftText || '(下書き用紙)'}\\end{center}`);
    }
  });
  if (lay.endText) L.push(`\\par\\vspace{8mm}{\\centering\\sffamily\\gtfamily ${lay.endText}\\par}`);
  if (twoCol) L.push('\\end{multicols}');

  if ((m.answerMode === 'end' || m.answerMode === 'separate') && doc.problems.some((p) => (p.solution || '').trim())) {
    if (m.answerMode === 'separate') {
      L.push('\\newpage');
      L.push('\\begin{center}{\\Large\\bfseries 解答' + (m.title ? `\\quad ${m.title}` : '') + '}\\end{center}');
    } else {
      L.push('\\par\\bigskip\\hrule\\section*{解答}');
    }
    doc.problems.forEach((p, i) => {
      if (!(p.solution || '').trim()) return;
      const n = i + 1;
      L.push(`\\par\\medskip\\noindent{\\lpeheadfont\\lpenum{${n}}}${p.title ? `\\quad{\\bfseries ${p.title}}` : ''}\\par\\nopagebreak`);
      L.push(`${MARK} problem ${n} solution`);
      L.push(ensureNl(expandScience(applyPunct(p.solution, lay, findMathRanges))).replace(/\n$/, ''));
      L.push(`${MARK} fixed`);
      L.push('\\par');
    });
  }

  L.push('\\end{document}');
  return L.join('\n') + '\n';
}

/** 注意事項の「{n}」を問題数に置き換え、1 行 1 項目の配列にする */
export function coverNotes(cover, count) {
  return String(cover.notes || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\{n\}/g, String(count)));
}

function texCover(c, count, punct = (t) => t) {
  const L = [];
  L.push('\\thispagestyle{empty}');
  // 表紙はテーマの行送り（本文用）を使わず、表紙専用の文字の大きさ・行送りで 1 ページに収める
  L.push('\\begingroup\\fontsize{10.5pt}{17pt}\\selectfont\\setlength{\\parskip}{0pt}');
  L.push('\\begingroup\\sffamily\\gtfamily');
  L.push('\\vspace*{8mm}');
  L.push('\\begin{center}');
  if (c.header) L.push(`{\\fontsize{15pt}{20pt}\\selectfont ${c.header}\\par}\\vspace{14mm}`);
  if (c.subject) L.push(`{\\fontsize{34pt}{40pt}\\selectfont\\bfseries ${c.subject}\\par}\\vspace{6mm}`);
  if (c.target) L.push(`{\\fontsize{15pt}{20pt}\\selectfont ${c.target}\\par}\\vspace{8mm}`);
  if (c.time) L.push(`{\\fontsize{12pt}{16pt}\\selectfont 試験時間\\quad ${c.time}\\par}`);
  L.push('\\end{center}');
  L.push('\\endgroup');
  const notes = coverNotes(c, count);
  if (notes.length) {
    L.push('\\vspace{12mm}');
    L.push('\\noindent{\\sffamily\\gtfamily\\bfseries 注意事項}\\par\\smallskip');
    L.push('\\begin{list}{\\arabic{lpecovn}.}{\\usecounter{lpecovn}\\setlength{\\leftmargin}{2.2\\zw}\\setlength{\\labelwidth}{1.6\\zw}\\setlength{\\labelsep}{0.6\\zw}\\setlength{\\itemsep}{1mm}\\setlength{\\topsep}{0pt}}');
    for (const n of notes) L.push(`  \\item ${punct(n)}`);
    L.push('\\end{list}');
  }
  L.push('\\vfill');
  if (c.idField) {
    L.push('\\begin{center}{\\renewcommand{\\arraystretch}{2.4}\\begin{tabular}{|c|p{62mm}|}\\hline');
    L.push('\\makebox[18mm]{受験番号} & \\\\ \\hline');
    L.push('\\makebox[18mm]{氏\\hfill 名} & \\\\ \\hline');
    L.push('\\end{tabular}}\\end{center}');
    L.push('\\vspace{6mm}');
  }
  if (c.footer) L.push(`{\\centering\\sffamily\\gtfamily\\bfseries ${punct(c.footer)}\\par}`);
  L.push('\\endgroup');
  L.push('\\newpage\\setcounter{page}{1}');
  return L;
}

/**
 * コンパイルエラーの行番号から「どの問題のどの欄の何行目か」を割り出す
 * @returns {{where:'preamble'|'problem'|'template', index?:number, field?:'body'|'solution', line?:number}}
 */
export function locateLine(source, lineNo) {
  const lines = source.split('\n');
  for (let i = Math.min(lineNo, lines.length) - 1; i >= 0; i--) {
    const l = lines[i];
    if (!l.startsWith(MARK)) continue;
    const parts = l.slice(MARK.length).trim().split(/\s+/);
    if (parts[0] === 'fixed') return { where: 'template' };
    if (parts[0] === 'preamble') return { where: 'preamble', line: lineNo - (i + 1) };
    if (parts[0] === 'problem') return { where: 'problem', index: Number(parts[1]) - 1, field: parts[2], line: lineNo - (i + 1) };
  }
  return { where: 'template' };
}
