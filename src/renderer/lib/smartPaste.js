// AI（Claude など）の回答を LaTeX の問題文へ変換する
//  - claude.ai 等の「表示された回答」をコピーした HTML（KaTeX/MathML の注釈付き）
//  - 「コピー」ボタンで得られる Markdown（$...$, $$...$$, \(...\), \[...\], **太字**, 箇条書き, 表）
//  - LaTeX を使っていない Unicode の式（x² + √2 ≤ π など）
import { findMathRanges, normalizeMathText } from './mathRanges.js';

// ---------------- HTML（レンダリング済み回答） ----------------

const TEX_ANNOT = 'annotation[encoding="application/x-tex"], annotation[encoding="application/x-latex"], annotation[encoding="TeX"]';

export function htmlHasTex(html) {
  return !!html && /application\/x-(la)?tex|encoding="TeX"|data-latex=|data-math=|class="[^"]*(katex|MathJax|mjx)/.test(html);
}

function texOfMathElement(el) {
  const ann = el.querySelector(TEX_ANNOT);
  if (ann) return ann.textContent.trim();
  const attr = el.getAttribute('data-latex') || el.getAttribute('data-math') || el.getAttribute('alttext');
  if (attr) return attr.trim();
  const m = el.querySelector('math[alttext]');
  if (m) return m.getAttribute('alttext').trim();
  return null;
}

function htmlToMarkdownish(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  const walk = (node, ctx) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push(node.textContent.replace(/\s+/g, ' '));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = /** @type {HTMLElement} */ (node);
    const tag = el.tagName.toLowerCase();
    const cls = el.className && typeof el.className === 'string' ? el.className : '';

    // 数式
    const isDisplay = /katex-display|MathJax_Display|mjx-display/.test(cls) || el.getAttribute('display') === 'block' || el.getAttribute('display') === 'true';
    if (/\bkatex-display\b/.test(cls) || /\bkatex\b/.test(cls) || tag === 'math' || tag === 'mjx-container' || el.hasAttribute('data-latex') || el.hasAttribute('data-math')) {
      const tex = texOfMathElement(el);
      if (tex !== null) {
        out.push(isDisplay ? `\n$$${tex}$$\n` : `$${tex}$`);
        return;
      }
    }
    if (tag === 'script' || tag === 'style' || tag === 'annotation') return;
    if (/\bkatex-mathml\b|\bkatex-html\b/.test(cls) && el.closest('.katex')) return;

    const kids = () => el.childNodes.forEach((c) => walk(c, ctx));
    switch (tag) {
      case 'br':
        out.push('\n');
        return;
      case 'p':
      case 'div':
      case 'section':
        out.push('\n');
        kids();
        out.push('\n');
        return;
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        out.push('\n\n### ');
        kids();
        out.push('\n\n');
        return;
      case 'strong':
      case 'b':
        out.push('**');
        kids();
        out.push('**');
        return;
      case 'em':
      case 'i':
        out.push('*');
        kids();
        out.push('*');
        return;
      case 'code':
        if (el.closest('pre')) return kids();
        out.push('`');
        kids();
        out.push('`');
        return;
      case 'pre':
        out.push('\n```\n' + el.textContent + '\n```\n');
        return;
      case 'ul':
      case 'ol': {
        out.push('\n');
        let n = 1;
        for (const li of el.children) {
          if (li.tagName.toLowerCase() !== 'li') continue;
          out.push('  '.repeat(ctx.depth) + (tag === 'ol' ? `${n++}. ` : '- '));
          li.childNodes.forEach((c) => walk(c, { depth: ctx.depth + 1 }));
          out.push('\n');
        }
        out.push('\n');
        return;
      }
      case 'table': {
        out.push('\n');
        for (const tr of el.querySelectorAll('tr')) {
          const cells = [...tr.children].map((td) => {
            const save = out.length;
            td.childNodes.forEach((c) => walk(c, ctx));
            const t = out.splice(save).join('').replace(/\n+/g, ' ').trim();
            return t;
          });
          out.push('| ' + cells.join(' | ') + ' |\n');
        }
        out.push('\n');
        return;
      }
      default:
        kids();
    }
  };
  walk(doc.body, { depth: 0 });
  return out
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------- Unicode の式 → LaTeX ----------------

const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', 'ⁿ': 'n', 'ˣ': 'x', 'ⁱ': 'i' };
const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₊': '+', '₋': '-', 'ₙ': 'n', 'ᵢ': 'i', 'ₖ': 'k', 'ₓ': 'x' };
const SYM = {
  '≤': '\\leq', '≥': '\\geq', '≦': '\\leqq', '≧': '\\geqq', '≠': '\\neq', '≈': '\\approx', '≡': '\\equiv', '±': '\\pm', '∓': '\\mp',
  '×': '\\times', '÷': '\\div', '·': '\\cdot', '⋅': '\\cdot', '∞': '\\infty', '∫': '\\int', '∬': '\\iint', '∮': '\\oint', '∑': '\\sum', '∏': '\\prod',
  '∂': '\\partial', '∇': '\\nabla', '→': '\\to', '←': '\\leftarrow', '↔': '\\leftrightarrow', '⇒': '\\Rightarrow', '⇔': '\\Leftrightarrow', '⟹': '\\Longrightarrow',
  '∈': '\\in', '∉': '\\notin', '⊂': '\\subset', '⊆': '\\subseteq', '⊃': '\\supset', '∪': '\\cup', '∩': '\\cap', '∅': '\\emptyset', '∀': '\\forall', '∃': '\\exists',
  '∴': '\\therefore', '∵': '\\because', '∠': '\\angle', '⊥': '\\perp', '∥': '\\parallel', '△': '\\triangle', '°': '^\\circ', '′': "'", '…': '\\ldots', '⋯': '\\cdots',
  'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\varepsilon', 'θ': '\\theta', 'λ': '\\lambda', 'μ': '\\mu', 'π': '\\pi', 'ρ': '\\rho',
  'σ': '\\sigma', 'τ': '\\tau', 'φ': '\\varphi', 'ω': '\\omega', 'Δ': '\\Delta', 'Σ': '\\Sigma', 'Ω': '\\Omega', 'Π': '\\Pi', 'Θ': '\\Theta',
  'ℝ': '\\mathbb{R}', 'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}', 'ℚ': '\\mathbb{Q}', 'ℂ': '\\mathbb{C}',
};
const SUP_CH = Object.keys(SUP).join('');
const SUB_CH = Object.keys(SUB).join('');
const SYM_CH = Object.keys(SYM).join('');

export function unicodeToLatex(s) {
  s = s.replace(/[−–]/g, '-');
  s = s.replace(new RegExp(`[${SUP_CH}]+`, 'g'), (m) => `^{${[...m].map((c) => SUP[c]).join('')}}`);
  s = s.replace(new RegExp(`[${SUB_CH}]+`, 'g'), (m) => `_{${[...m].map((c) => SUB[c]).join('')}}`);
  s = s.replace(/[√∛]\s*(\([^()]*\)|[A-Za-z0-9.]+)/g, (_m, a) => `\\sqrt{${a.replace(/^\((.*)\)$/, '$1')}}`);
  s = s.replace(new RegExp(`[${SYM_CH}]`, 'g'), (c) => `${SYM[c]} `);
  return s.replace(/\s+/g, ' ').replace(/ ([_^])/g, '$1').trim();
}

// 文中の「式らしい部分」（Unicode 数学記号を含む英数式の並び）を $...$ に包む
const MATHY = new RegExp(`[A-Za-z0-9 +\\-−–*/=()<>.,^|'${SUP_CH}${SUB_CH}${SYM_CH}√∛]+`, 'g');
const STRONG = new RegExp(`[${SUP_CH}${SUB_CH}${SYM_CH}√∛=<>^]`);
const FN_NAMES = /^(sin|cos|tan|log|ln|exp|lim|max|min|det|dx|dy|dt)$/;
function wrapUnicodeMath(line) {
  return line.replace(MATHY, (seg) => {
    if (!STRONG.test(seg)) return seg;
    // 前後の英単語（"Solve", "has solutions" など）は式から外す。sin/log などの関数名は残す
    const toks = seg.split(/(\s+)/);
    const isWord = (t) => /^\s*$/.test(t) || (/^[A-Za-z]{2,}[.,:;]?$/.test(t) && !FN_NAMES.test(t));
    let lead = '';
    let trail = '';
    while (toks.length && isWord(toks[0])) lead += toks.shift();
    while (toks.length && isWord(toks[toks.length - 1])) trail = toks.pop() + trail;
    let body = toks.join('');
    if (!body || !STRONG.test(body)) return seg;
    const punct = /[.,]$/.test(body) ? body.slice(-1) : '';
    if (punct) body = body.slice(0, -1);
    return `${lead}$${unicodeToLatex(body)}$${punct}${trail}`;
  });
}

// ---------------- Markdown → LaTeX ----------------

function escapeText(s) {
  return s.replace(/([%&#])/g, '\\$1').replace(/(?<![\\a-zA-Z])_/g, '\\_');
}

function inlineMd(s) {
  s = s.replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_m, a, b) => `\\textbf{${a ?? b}}`);
  s = s.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, (_m, a) => `\\textit{${a}}`);
  s = s.replace(/`([^`]+)`/g, (_m, a) => `\\texttt{${a}}`);
  return s;
}

function tableToTabular(rows) {
  const cells = rows
    .filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r))
    .map((r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
  const n = Math.max(...cells.map((c) => c.length));
  return [
    '\\begin{center}',
    `\\begin{tabular}{|${'c|'.repeat(n)}}`,
    '\\hline',
    ...cells.map((c) => c.join(' & ') + ' \\\\ \\hline'),
    '\\end{tabular}',
    '\\end{center}',
  ].join('\n');
}

/** 数式を退避した Markdown テキストを LaTeX へ */
function markdownBlocksToLatex(text, opts) {
  const lines = text.split('\n');
  const out = [];
  const listStack = []; // {type:'itemize'|'enumerate', indent}
  const closeLists = (indent = -1) => {
    while (listStack.length && listStack[listStack.length - 1].indent > indent) {
      out.push('  '.repeat(listStack.length - 1) + `\\end{${listStack.pop().type}}`);
    }
  };
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // 表
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      i--;
      closeLists();
      out.push(tableToTabular(rows.map((r) => inlineMd(escapeText(r)))));
      continue;
    }
    const li = line.match(/^(\s*)([-*+]|\d+[.)]|[（(]\d+[)）])\s+(.*)$/);
    if (li) {
      const indent = li[1].replace(/\t/g, '    ').length;
      const type = /^[-*+]$/.test(li[2]) ? 'itemize' : 'enumerate';
      closeLists(indent);
      const top = listStack[listStack.length - 1];
      if (!top || top.indent < indent || top.type !== type) {
        if (top && top.indent === indent) out.push('  '.repeat(listStack.length - 1) + `\\end{${listStack.pop().type}}`);
        const label = type === 'enumerate' && /^[（(]/.test(li[2]) ? '[label=(\\arabic*)]' : '';
        out.push('  '.repeat(listStack.length) + `\\begin{${type}}${label}`);
        listStack.push({ type, indent });
      }
      out.push('  '.repeat(listStack.length) + `\\item ${prepLine(li[3], opts)}`);
      continue;
    }
    if (listStack.length && /^\s+\S/.test(line)) {
      // リスト項目の続き行
      out.push('  '.repeat(listStack.length + 1) + prepLine(line.trim(), opts));
      continue;
    }
    if (line.trim() === '' && listStack.length) {
      // 空行の後もリストが続くなら閉じない
      const next = lines.slice(i + 1).find((l) => l.trim() !== '');
      if (next && /^(\s*)([-*+]|\d+[.)])\s+/.test(next)) continue;
    }
    closeLists();
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) {
      out.push('', `\\textbf{${prepLine(h[1].replace(/\*\*/g, ''), opts)}}`, '');
      continue;
    }
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      out.push('\\medskip');
      continue;
    }
    line = line.replace(/^\s*>\s?/, '');
    out.push(prepLine(line, opts));
  }
  closeLists();
  return out.join('\n');
}

function prepLine(s, opts) {
  // 退避中の数式（\u0001n\u0002）以外の部分だけを処理する
  return s
    .split(/(\u0001\d+\u0002)/)
    .map((part) => {
      if (/^\u0001\d+\u0002$/.test(part)) return part;
      let t = escapeText(part);
      if (opts.unicodeMath) t = wrapUnicodeMath(t);
      return inlineMd(t);
    })
    .join('');
}

/**
 * AI の回答テキスト（Markdown + LaTeX）を問題文用 LaTeX に変換する
 * @param {string} text
 * @param {{unicodeMath?:boolean, displayStyle?:'bracket'|'dollar'}} opts
 */
export function aiTextToLatex(text, opts = {}) {
  opts = { unicodeMath: true, displayStyle: 'bracket', ...opts };
  text = text.replace(/\r\n?/g, '\n');

  // コードブロック: ```latex / ```tex は中身をそのまま LaTeX として採用、それ以外は verbatim
  const blocks = [];
  text = text.replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, (_m, lang, body) => {
    // 言語名なしのコードブロックも、LaTeX の命令・$・問題の区切り（【問題1】）があれば LaTeX とみなす
    const isTex = /^(la)?tex|math$/i.test(lang) || (!lang && /\\[a-zA-Z]|\$|【(?:問題|解答)\s*\d/.test(body));
    blocks.push(isTex ? body.replace(/\n$/, '') : `\\begin{verbatim}\n${body}\\end{verbatim}`);
    return `\n\u0004${blocks.length - 1}\u0004\n`;
  });

  // 数式を退避
  const maths = [];
  let joined = '';
  let last = 0;
  for (const r of findMathRanges(text)) {
    joined += text.slice(last, r.from);
    let inner = normalizeMathText(r.latex.trim());
    let rendered;
    if (r.kind === 'cmd') rendered = r.latex; // \ce{…} / \qty{…}{…} はそのまま（文章中に書いてよい）
    else if (r.kind === 'env') rendered = normalizeMathText(r.latex);
    else if (r.display) rendered = opts.displayStyle === 'dollar' ? `$$\n  ${inner}\n$$` : `\\[\n  ${inner}\n\\]`;
    else rendered = `$${inner}$`;
    if (r.display) {
      joined += `\n\u0001${maths.length}\u0002\n`;
    } else {
      joined += `\u0001${maths.length}\u0002`;
    }
    maths.push(rendered);
    last = r.to;
  }
  joined += text.slice(last);

  let latex = markdownBlocksToLatex(joined, opts);
  latex = latex.replace(/\u0001(\d+)\u0002/g, (_m, i) => maths[Number(i)]);
  latex = latex.replace(/\u0004(\d+)\u0004/g, (_m, i) => blocks[Number(i)]);
  return latex.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** クリップボードの内容（HTML / テキスト）から LaTeX を作る */
export function clipboardToLatex({ html, text }, opts) {
  if (htmlHasTex(html)) {
    const md = htmlToMarkdownish(html);
    if (md.trim()) return { latex: aiTextToLatex(md, opts), source: 'html' };
  }
  return { latex: aiTextToLatex(text || '', opts), source: 'text' };
}
