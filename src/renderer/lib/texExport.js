// 問題集データ → LaTeX 文書（LuaLaTeX + ltjsarticle で日本語をそのまま扱う）

import { normalizeLayout, texLayoutPreamble, texProblemOpen, texSubLabel, pointsText, applyPunct, defaultCover, pageMargins, paperSize, coverPositions, COVER_NUMBERS } from './layout.js';
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
  L.push('\\usepackage{tabularx}'); // 表紙の注意事項の表
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
  L.push('\\newcommand{\\lpe@install}{\\let\\lpe@enumerate\\enumerate\\renewcommand{\\enumerate}[1][]{\\lpe@pre\\lpe@presub\\lpe@enumerate\\lpe@setlabel{##1}\\lpe@subfix}}');
  const set2 = sub.setlist2 ? `\\setlist[enumerate,2]{${sub.setlist2}}` : '';
  // ⑴・⒜・ア の番号は、enumitem では \lpepparen* のように * を付けて使う（enumitem に番号の形として登録する）
  const circ = (name, list) => `\\newcommand{\\${name}}[1]{\\ifcase#1${list.map((x) => `\\or ${x}`).join('')}\\fi}`;
  L.push(circ('lpe@ppn', [...'⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽']));
  L.push(circ('lpe@apn', [...'⒜⒝⒞⒟⒠⒡⒢⒣⒤⒥']));
  L.push(circ('lpe@kan', [...'アイウエオカキクケコサシ']));
  const addc = '\\AddEnumerateCounter{\\lpepparen}{\\lpe@ppn}{⑽}\\AddEnumerateCounter{\\lpeaparen}{\\lpe@apn}{⒥}\\AddEnumerateCounter{\\lpekata}{\\lpe@kan}{シ}';
  L.push(
    `\\IfFileExists{enumitem.sty}{\\usepackage{enumitem}${addc}\\setlist[enumerate,1]{label=${sub.enumitem},${sub.setlist}}${set2}}{\\lpe@install\\renewcommand{\\labelenumi}{${sub.classic}}}`
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
  const punct = (t) => applyPunct(t, lay, findMathRanges);
  const cover = m.cover?.enabled ? { ...defaultCover(), ...m.cover } : null;
  if (cover) L.push(...texCover(cover, doc.problems.length, punct, lay));

  // 1 ページ目の上に大きく入れる見出し（例: 問　題　紙）
  if (lay.header && (lay.headerStyle === 'title' || lay.headerStyle === 'both')) L.push(...texTitle(lay));
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
  // 裏表紙（解答上の注意など）。冊子の最後のページ（偶数ページ）に入れる
  if (cover && coverNotes({ notes: cover.backNotes }, doc.problems.length).length) L.push(...texBackCover(cover, doc.problems.length, punct));

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
      if (lay.part?.hang) L.push('\\lpepartend');
    });
  }

  L.push('\\end{document}');
  return L.join('\n') + '\n';
}

/** 注意事項の「{n}」を問題数に置き換え、1 行 1 項目の配列にする（「|」で始まる表の行も 1 項目として返す） */
export function coverNotes(cover, count) {
  return String(cover.notes || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\{n\}/g, String(count)));
}

/**
 * 注意事項を項目ごとにまとめる。「|」で始まる行は直前の項目に付く表の行（セルは「|」で区切る）
 * @returns {{text:string, rows:string[][]}[]}
 */
export function coverNoteItems(text, count) {
  const items = [];
  for (const line of coverNotes({ notes: text }, count)) {
    if (line.startsWith('|')) {
      const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim());
      if (!items.length) items.push({ text: '', rows: [] });
      items[items.length - 1].rows.push(cells);
    } else items.push({ text: line, rows: [] });
  }
  return items;
}

const gt = '\\sffamily\\gtfamily';
const fsz = (pt, lh = 1.25) => `\\fontsize{${pt}pt}{${(pt * lh).toFixed(1)}pt}\\selectfont`;
/** 用紙の上端からのベースライン B（mm）の位置に、高さ 0 の箱として置く（その行は本文 1 行目の位置にある前提） */
const lower = (B, top) => `-\\dimexpr${Number(B).toFixed(2)}mm-${top}mm-\\topskip\\relax`;
const atC = (B, top, body) => `\\rlap{\\makebox[\\linewidth][c]{\\raisebox{${lower(B, top)}}[0pt][0pt]{${body}}}}`;
const atL = (B, top, x, body) => `\\rlap{\\hspace*{${x}mm}\\raisebox{${lower(B, top)}}[0pt][0pt]{${body}}}`;
const atR = (B, top, x, body) => `\\rlap{\\hspace*{${x}mm}\\llap{\\raisebox{${lower(B, top)}}[0pt][0pt]{${body}}}}`;

/**
 * 注意事項の表（「|」の行）。項目の 1 行目の本文の位置（ind mm）から、右は同じだけ内側まで。
 * 共通テストの表紙の表に合わせて、前の行のベースラインから罫線まで約 4mm、表の下から次の行のベースラインまで約 6.6mm あける
 */
function texNoteTable(rows, punct, ind) {
  const n = Math.max(...rows.map((r) => r.length));
  const spec = `|${'c|'.repeat(Math.max(0, n - 1))}X|`;
  const body = rows.map((r) => `${[...r, ...Array(n - r.length).fill('')].map((x) => punct(x)).join(' & ')}\\\\ \\hline`).join('\n');
  return (
    // [t] の表は上の罫線が行のベースラインに来て、その前に行送りの分が入るので、その分を戻す
    `\\par\\vspace{-3.0mm}\\noindent\\hspace*{${ind}mm}\\begin{tabularx}{\\dimexpr\\linewidth-${(2 * ind).toFixed(2)}mm\\relax}[t]{${spec}}\\hline\n${body}\n` +
    '\\end{tabularx}\\par\\vspace{3.0mm}'
  );
}

/** 注意事項のリスト。label: 番号の形、geom: 番号の位置・本文の位置・折り返しの位置（項目の左端から mm） */
function texNoteList(items, punct, { label, num, text, wrap, right = 0, itemGap = 0 }) {
  const L = [];
  const lw = Math.max(0, text - num - 1.5);
  L.push(
    `\\begin{list}{${label}}{\\usecounter{lpecovn}\\setlength{\\leftmargin}{${wrap.toFixed(2)}mm}\\setlength{\\rightmargin}{${right.toFixed(2)}mm}\\setlength{\\itemindent}{${(text - wrap).toFixed(2)}mm}` +
      `\\setlength{\\labelwidth}{${lw.toFixed(2)}mm}\\setlength{\\labelsep}{${(text - num - lw).toFixed(2)}mm}\\def\\makelabel#1{#1\\hfil}` +
      `\\setlength{\\itemsep}{${Number(itemGap) || 0}mm}\\setlength{\\topsep}{0pt}\\setlength{\\partopsep}{0pt}\\setlength{\\parsep}{0pt}}`
  );
  for (const it of items) {
    L.push(`  \\item ${punct(it.text)}`);
    if (it.rows.length) L.push(texNoteTable(it.rows, punct, Math.max(0, text - wrap)));
  }
  L.push('\\end{list}');
  return L;
}

/** 表紙（試験問題冊子の表紙） */
function texCover(c, count, punct = (t) => t, lay) {
  const L = [];
  const pm = pageMargins(lay);
  const { w } = paperSize(lay);
  const left = pm.left ?? Number(lay.margin);
  const geo = { top: pm.top, left, w, textW: w - left - (pm.right ?? Number(lay.margin)) };
  L.push(`\\thispagestyle{${c.pageNumber ? 'lpeplain' : 'empty'}}`);
  L.push(...(c.style === 'kyotsu' ? texCoverKyotsu(c, count, punct, geo.top) : texCoverStandard(c, count, punct, geo)));
  // 次のページの番号: 表紙に番号を付けないなら 1 から。付けるなら続き（firstPage まで白紙を入れる）
  if (!c.pageNumber) L.push('\\newpage\\setcounter{page}{1}');
  else {
    L.push('\\newpage');
    const first = Math.round(Number(c.firstPage) || 0);
    if (first > 2) L.push(`\\loop\\ifnum\\value{page}<${first}\\thispagestyle{empty}\\null\\newpage\\repeat`);
  }
  return L;
}

/**
 * 注意事項の番号・本文・折り返し・右端の位置（本文の左端から mm）。表紙の notesX / notesText / notesWrap / notesRight
 * （用紙の左端から mm）を指定していればそれを使う
 */
export function coverNotesGeometry(c, left, textW) {
  const rel = (v, d) => (Number(v) > 0 ? Number(v) - left : d);
  const num = rel(c.notesX, 1.0);
  const text = rel(c.notesText, num + 6.0);
  const wrap = rel(c.notesWrap, text);
  const right = Number(c.notesRight) > 0 ? Math.max(0, left + textW - Number(c.notesRight)) : 0;
  return { num, text, wrap, right };
}

function texCoverStandard(c, count, punct, geo) {
  const L = [];
  const { top } = geo;
  const P = coverPositions(c, top);
  // 表紙はテーマの行送り（本文用）を使わず、表紙専用の文字の大きさ・行送りで 1 ページに収める
  const pitch = Number(c.notesPitch) > 0 ? Number(c.notesPitch) : 6.0;
  const nsz = Number(c.notesSize) > 0 ? Number(c.notesSize) : 10.5;
  L.push(`\\begingroup\\fontsize{${nsz}pt}{${(pitch / (25.4 / 72.27)).toFixed(2)}pt}\\selectfont\\setlength{\\parskip}{0pt}\\setlength{\\parindent}{0pt}`);
  const fam = (f) => (f === 'mincho' ? '\\rmfamily\\mcfamily' : gt);
  const o = [];
  const headers = String(c.header || '').split('|').filter((s) => s.trim());
  headers.forEach((h, i) => {
    const body = `{${fam(c.headerFont)}${fsz(Number(c.headerSize) || 15)} ${h.trim()}}`;
    if (c.headerAlign === 'left') o.push(atL(P.header[i], top, 0, body));
    else if (c.headerAlign === 'right') o.push(`\\rlap{\\makebox[\\linewidth][r]{\\raisebox{${lower(P.header[i], top)}}[0pt][0pt]{${body}}}}`);
    else o.push(atC(P.header[i], top, body));
  });
  if (c.subject) {
    const sub = c.subtitle ? `\\hspace{0.5\\zw}{${fsz(Math.max(10, Number(c.subjectSize) * 0.6))} ${c.subtitle}}` : '';
    o.push(atC(P.subject, top, `{${fam(c.subjectFont)}${c.subjectBold ? '\\bfseries' : ''}${fsz(Number(c.subjectSize) || 34)} ${c.subject}${sub}}`));
  }
  if (c.target) o.push(atC(P.target, top, `{${gt}${fsz(Number(c.targetSize) || 15)} ${c.target}}`));
  if (c.points) o.push(atC(P.points, top, `{${fsz(Number(c.pointsSize) || 12)} ${c.points}}`));
  if (c.time) {
    const body = `{${fam(c.timeFont)}${fsz(Number(c.timeSize) || 12)} ${c.timeLabel ? `${c.timeLabel}\\quad ` : ''}${c.time}}`;
    if (c.timeAlign === 'left') o.push(atL(P.time, top, 0, body));
    else if (c.timeAlign === 'right') o.push(`\\rlap{\\makebox[\\linewidth][r]{\\raisebox{${lower(P.time, top)}}[0pt][0pt]{${body}}}}`);
    else o.push(atC(P.time, top, body));
  }
  const items = coverNoteItems(c.notes, count);
  const tsz = Number(c.notesTitleSize) > 0 ? fsz(Number(c.notesTitleSize)) : '';
  const title = c.notesTitle ? `{${gt}\\bfseries${tsz} ${c.notesTitle}}` : '';
  const g = coverNotesGeometry(c, geo.left, geo.textW);
  const tx = Number(c.notesTitleX) > 0 ? Number(c.notesTitleX) - geo.left : 0;
  if (title && !c.notesFrame) o.push(c.notesTitleAlign === 'center' ? atC(P.notes, top, title) : atL(P.notes, top, tx.toFixed(2), title));
  L.push(`\\noindent${o.join('%\n')}\\par`);
  if (items.length || (title && c.notesFrame)) {
    // 1 行目（高さ 0 の行）から注意事項の見出しのベースラインまで下げる（最初の項目は見出しの 1 行下）
    const gap = c.notesGap != null && c.notesGap !== '' ? `+${Number(c.notesGap)}mm-\\baselineskip` : '';
    L.push(`\\vspace{\\dimexpr${P.notes.toFixed(2)}mm-${top}mm-\\topskip${c.notesFrame ? '-\\baselineskip' : ''}${gap}\\relax}`);
    const num = COVER_NUMBERS[c.notesNumber] || COVER_NUMBERS.dot;
    const list = texNoteList(items, punct, { label: num.tex, ...g, itemGap: c.notesItemGap });
    if (c.notesFrame) {
      L.push('\\noindent\\setlength{\\fboxsep}{3mm}\\setlength{\\fboxrule}{0.35mm}\\fbox{\\begin{minipage}{\\dimexpr\\linewidth-2\\fboxsep-2\\fboxrule\\relax}');
      if (title) L.push(`{\\centering ${title}\\par}\\vspace{1mm}`);
      L.push(...list);
      L.push('\\end{minipage}}');
    } else L.push(...list);
  }
  L.push('\\vfill');
  if (c.idField) {
    const labels = String(c.idLabels || '受験番号|氏　　名').split('|').filter(Boolean);
    L.push('\\begin{center}{\\renewcommand{\\arraystretch}{2.4}\\begin{tabular}{|c|p{62mm}|}\\hline');
    for (const lab of labels) L.push(`\\makebox[18mm]{${lab.trim()}} & \\\\ \\hline`);
    L.push('\\end{tabular}}\\end{center}');
    L.push('\\vspace{6mm}');
  }
  if (c.footer) L.push(`{\\centering${gt}\\bfseries ${punct(c.footer)}\\par}`);
  L.push('\\endgroup');
  return L;
}

/**
 * 大学入学共通テストの冊子の表紙（令和 8 年度の数学①②の冊子で測った位置。x は本文の左端から, B は用紙の上端から mm）
 *   上に枠で囲んだ「試験開始の指示があるまで…」（footer）、「数　学　①」（22pt）と科目の一覧（12pt）、右に配点と試験時間を ( ) でくくって縦に、
 *   「I　注 意 事 項」と番号付きの注意（10pt・行送り 7.05mm）、下に「II　解答上の注意」と裏表紙への案内
 */
function texCoverKyotsu(c, count, punct, top) {
  const L = [];
  L.push('\\begingroup\\fontsize{10pt}{20pt}\\selectfont\\setlength{\\parskip}{0pt}\\setlength{\\parindent}{0pt}');
  const o = [];
  if (c.footer) {
    // 線（0.12mm）の中心で、文字の左右に 1.7mm、ベースラインの上 4.1mm・下 1.5mm
    o.push(atC(32.1, top, `\\setlength{\\fboxsep}{0pt}\\setlength{\\fboxrule}{0.12mm}\\fbox{\\hspace{1.64mm}\\rule[-1.44mm]{0pt}{5.48mm}{${gt} ${punct(c.footer)}}\\hspace{1.64mm}}`));
  }
  if (c.subject) {
    // 実物の〔 は全角幅（字は右半分）。ltjsarticle では半角幅なので、その分（2.1mm）右に寄せる
    const sub = c.subtitle ? `\\hspace{4.3mm}\\raisebox{1.4mm}{${fsz(12)} ${c.subtitle}}` : '';
    o.push(atL(47.5, top, 7.0, `{${gt}${fsz(22)} ${c.subject}}${sub}`));
  }
  if (c.points || c.time) {
    // 大きな ( ) の中に配点と試験時間を右寄せで 2 段に
    const paren = (d) => `$\\${d === '(' ? 'left(' : 'left.'}\\rule[-4.4mm]{0pt}{10.6mm}\\${d === ')' ? 'right)' : 'right.'}$`;
    o.push(atL(45.9, top, 111.1, paren('(')));
    o.push(atL(45.9, top, 127.0, paren(')')));
    if (c.points) o.push(atR(42.4, top, 127.0, c.points));
    if (c.time) o.push(atR(49.4, top, 127.0, c.time));
  }
  const items = coverNoteItems(c.notes, count);
  if (c.notesTitle) o.push(atL(59.3, top, 0, '{\\rmfamily\\bfseries I}'), atL(59.3, top, 7.05, `{${gt} ${c.notesTitle}}`));
  const back = coverNotes({ notes: c.backNotes }, count).length > 0;
  if (back || c.backRef) {
    o.push(atL(221.6, top, 0, '{\\rmfamily\\bfseries II}'), atL(221.6, top, 7.05, `{${gt} ${c.backTitle || '解答上の注意'}}`));
    if (c.backRef) o.push(atL(228.6, top, 7.05, `{${gt}${fsz(9.9)} ${punct(c.backRef)}}`));
  }
  L.push(`\\noindent${o.join('%\n')}\\par`);
  if (items.length) {
    // 1 行目（高さ 0 の行）から「注意事項」の行まで下げ、次の行から項目（番号 4.7mm・本文 10.6mm・折り返し 7.05mm）
    L.push('\\vspace{\\dimexpr59.3mm-' + top + 'mm-\\topskip\\relax}');
    L.push(...texNoteList(items, punct, { label: '\\arabic{lpecovn}', num: 4.7, text: 10.58, wrap: 7.05 }));
  }
  L.push('\\endgroup');
  return L;
}

/** 裏表紙（解答上の注意など）。冊子の最後のページ（偶数ページ）にページ番号なしで入れる */
function texBackCover(c, count, punct) {
  const L = [];
  // 次のページが奇数ページなら白紙を 1 枚入れて、裏表紙を偶数ページにする
  L.push('\\clearpage\\ifodd\\value{page}\\thispagestyle{empty}\\null\\newpage\\fi');
  L.push('\\thispagestyle{empty}');
  const kyotsu = c.style === 'kyotsu';
  L.push(`\\begingroup\\fontsize{10pt}{20pt}\\selectfont\\setlength{\\parskip}{0pt}\\setlength{\\parindent}{0pt}`);
  const title = c.backTitle || '解答上の注意';
  if (kyotsu) L.push(`\\noindent\\rlap{\\rmfamily\\bfseries II}\\hspace*{7.05mm}{${gt} ${title}}\\par`);
  else L.push(`{\\centering${gt}\\bfseries ${title}\\par}`);
  const items = coverNoteItems(c.backNotes, count);
  const num = kyotsu ? { tex: '\\arabic{lpecovn}' } : COVER_NUMBERS[c.notesNumber] || COVER_NUMBERS.dot;
  L.push(...texNoteList(items, punct, kyotsu ? { label: num.tex, num: 4.7, text: 10.58, wrap: 7.05 } : { label: num.tex, num: 1.0, text: 7.0, wrap: 7.0 }));
  L.push('\\endgroup');
  return L;
}

/**
 * 1 ページ目に大きく入れる見出し（layout.header）。title.size が 0 なら従来どおり \Large 太字。
 * 大きさを指定したときは、見出し・小さな行・次の行のベースラインを用紙の上端からの位置で置く
 */
function texTitle(lay) {
  const t = lay.title || {};
  const L = [];
  if (lay.headerStyle === 'both') L.push('\\thispagestyle{lpeplain}');
  if (!(Number(t.size) > 0)) {
    L.push(`{\\centering\\Large\\bfseries ${lay.header}\\par}\\vspace{6mm}`);
    return L;
  }
  const top = pageMargins(lay).top;
  const fam = t.font === 'mincho' ? '\\rmfamily\\mcfamily' : gt;
  const B = Number(t.baseline) > 0 ? Number(t.baseline) : top + 8;
  const o = [atC(B, top, `{${fam}${t.bold ? '\\bfseries' : ''}${fsz(Number(t.size))} ${lay.header}}`)];
  const SB = Number(t.subBaseline) > 0 ? Number(t.subBaseline) : B + Number(t.subSize || 12) * 0.6;
  if (t.sub) o.push(atC(SB, top, `{${fam}${fsz(Number(t.subSize) || 12)} ${t.sub}}`));
  L.push(`\\begingroup\\setlength{\\parskip}{0pt}\\noindent${o.join('%\n')}\\par\\endgroup`);
  // 次の行（最初の大問の見出し）のベースラインが title.next に来るように空ける（大問の前の空きの分を引く）
  const next = Number(t.next) > 0 ? Number(t.next) : (t.sub ? SB : B) + 12;
  L.push(`\\vspace{\\dimexpr${next}mm-${top}mm-\\topskip-\\baselineskip-${Number(lay.spaceBefore) || 0}mm\\relax}`);
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
