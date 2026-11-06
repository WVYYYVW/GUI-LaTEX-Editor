// 問題集データ → LaTeX 文書（LuaLaTeX + ltjsarticle で日本語をそのまま扱う）

import { normalizeLayout, texLayoutPreamble, texProblemOpen, texSubLabel } from './layout.js';

const MARK = '% @@';

const ensureNl = (s) => (s.endsWith('\n') ? s : s + '\n');

export function buildTex(doc) {
  const m = doc.meta;
  const lay = normalizeLayout(m.layout);
  const L = [];
  const fs = ['10pt', '11pt', '12pt'].includes(m.fontSize) ? m.fontSize : '11pt';
  L.push(`\\documentclass[${fs}]{ltjsarticle}`);
  L.push('\\usepackage{amsmath,amssymb,amsthm,mathtools,bm}');
  L.push('\\usepackage{multicol}');
  L.push('\\usepackage{graphicx}');
  L.push('\\usepackage{xcolor}');
  L.push('\\IfFileExists{tikz.sty}{\\usepackage{tikz}\\usetikzlibrary{arrows.meta,calc,intersections}}{}');
  // 小問番号。enumitem が無い TeX 環境でも [label=(\arabic*)] / (\alph*) / (\roman*) が使えるようにする
  const sub = texSubLabel(lay);
  L.push('\\newcommand{\\lpekata}[1]{\\ifcase\\value{#1}\\or ア\\or イ\\or ウ\\or エ\\or オ\\or カ\\or キ\\or ク\\or ケ\\or コ\\or サ\\or シ\\fi}');
  L.push('\\makeatletter');
  L.push('\\newcommand{\\lpe@setlabel}[1]{\\def\\lpe@arg{#1}\\ifx\\lpe@arg\\@empty\\else');
  L.push('  \\in@{\\alph}{#1}\\ifin@\\expandafter\\def\\csname label\\@enumctr\\endcsname{(\\alph{\\@enumctr})}\\else');
  L.push('  \\in@{\\roman}{#1}\\ifin@\\expandafter\\def\\csname label\\@enumctr\\endcsname{(\\roman{\\@enumctr})}\\else');
  L.push('  \\expandafter\\def\\csname label\\@enumctr\\endcsname{(\\arabic{\\@enumctr})}\\fi\\fi\\fi}');
  L.push('\\newcommand{\\lpe@install}{\\let\\lpe@enumerate\\enumerate\\renewcommand{\\enumerate}[1][]{\\lpe@enumerate\\lpe@setlabel{##1}}}');
  L.push(
    `\\IfFileExists{enumitem.sty}{\\usepackage{enumitem}\\setlist[enumerate,1]{label=${sub.enumitem}}}{\\lpe@install\\renewcommand{\\labelenumi}{${sub.classic}}}`
  );
  L.push('\\makeatother');
  L.push(...texLayoutPreamble(lay));
  L.push('\\setlength{\\parindent}{0pt}');
  L.push('\\setlength{\\parskip}{0.3\\baselineskip}');
  L.push(`${MARK} preamble`);
  L.push(ensureNl(m.preamble || '').replace(/\n$/, ''));
  L.push(`${MARK} fixed`);
  L.push('\\begin{document}');

  // 表題
  if (m.title || m.subtitle) {
    L.push('\\begin{center}');
    if (m.title) L.push(`{\\LARGE\\bfseries ${m.title}}\\par`);
    if (m.subtitle) L.push(`\\smallskip{\\large ${m.subtitle}}\\par`);
    L.push('\\end{center}');
  }
  if (m.author || m.date) L.push(`\\noindent ${m.author || ''}\\hfill ${m.date || ''}\\par`);
  if (m.nameField) {
    L.push('\\noindent\\hfill 組\\underline{\\hspace{1.5cm}}\\ 番\\underline{\\hspace{1.5cm}}\\ 氏名\\underline{\\hspace{5cm}}\\par');
  }
  if (m.title || m.subtitle || m.author || m.date || m.nameField) L.push('\\medskip\\hrule\\relax');

  const twoCol = m.columns === 2;
  if (twoCol) L.push('\\begin{multicols}{2}');

  doc.problems.forEach((p, i) => {
    const n = i + 1;
    const pl = { pageBreakBefore: false, answerSpace: null, frame: null, ...(p.layout || {}) };
    const stars = m.showDifficulty && p.difficulty > 0 ? `難易度 $${'\\bigstar'.repeat(p.difficulty)}$` : '';
    const { open, close } = texProblemOpen(lay, pl, n, p.title || '', stars, i === 0);
    L.push(...open);
    L.push(`${MARK} problem ${n} body`);
    L.push(ensureNl(p.body || '').replace(/\n$/, ''));
    L.push(`${MARK} fixed`);
    L.push('\\par');
    if (m.answerMode === 'after' && (p.solution || '').trim()) {
      L.push('\\medskip\\noindent{\\bfseries 【解答】}\\par');
      L.push(`${MARK} problem ${n} solution`);
      L.push(ensureNl(p.solution).replace(/\n$/, ''));
      L.push(`${MARK} fixed`);
      L.push('\\par');
    }
    const space = pl.answerSpace ?? m.spaceAfter;
    if (Number(space) > 0) L.push(`\\vspace{${Number(space)}mm}`);
    L.push(...close);
  });
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
      L.push(ensureNl(p.solution).replace(/\n$/, ''));
      L.push(`${MARK} fixed`);
      L.push('\\par');
    });
  }

  L.push('\\end{document}');
  return L.join('\n') + '\n';
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
