// Word（.docx）の本文 XML → 問題集。
// Word の数式（OMML）を LaTeX に変換し、日本語の文章まで数式の中に打ち込まれている
// （Word で日本語の数式を書くとよく起きる）場合も、文章と数式を分けて取り出す。
import { newProblem } from './model.js';

// ---------------- 最小限の XML パーサー（DOMParser が無い Node でも動くように） ----------------
const ENT = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const decode = (s) =>
  s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m
  );

export function parseXml(xml) {
  const root = { name: '#root', attrs: {}, children: [] };
  const stack = [root];
  const re = /<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|([^<]+)/g;
  let m;
  while ((m = re.exec(xml))) {
    const top = stack[stack.length - 1];
    if (m[6] !== undefined) {
      top.children.push({ text: decode(m[6]) });
    } else if (m[5] !== undefined) {
      top.children.push({ text: m[5] });
    } else if (m[2]) {
      if (m[1]) {
        stack.pop();
        continue;
      }
      const attrs = {};
      for (const a of m[3].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decode(a[2] ?? a[3]);
      const node = { name: m[2], attrs, children: [] };
      top.children.push(node);
      if (!m[4]) stack.push(node);
    }
  }
  return root;
}

const kids = (n, name) => (n?.children || []).filter((c) => c.name === name);
const kid = (n, name) => (n?.children || []).find((c) => c.name === name);
const attr = (n, name) => n?.attrs?.[name];
const prop = (n, prName, child) => attr(kid(kid(n, prName), child), 'm:val');

// ---------------- 文字の変換 ----------------
const MATH_SYM = {
  '≧': '\\geqq ', '≦': '\\leqq ', '≥': '\\geq ', '≤': '\\leq ', '≠': '\\neq ', '≒': '\\fallingdotseq ', '≈': '\\approx ', '≡': '\\equiv ',
  '∼': '\\sim ', '～': '\\sim ', '∝': '\\propto ', '×': '\\times ', '÷': '\\div ', '·': '\\cdot ', '⋅': '\\cdot ', '∙': '\\cdot ', '±': '\\pm ', '∓': '\\mp ',
  '⋯': '\\cdots ', '…': '\\ldots ', '⋮': '\\vdots ', '⋱': '\\ddots ', '∞': '\\infty ', '∂': '\\partial ', '∇': '\\nabla ',
  '→': '\\to ', '←': '\\leftarrow ', '↔': '\\leftrightarrow ', '⇒': '\\Rightarrow ', '⇐': '\\Leftarrow ', '⇔': '\\Leftrightarrow ', '↦': '\\mapsto ',
  '∈': '\\in ', '∋': '\\ni ', '∉': '\\notin ', '⊂': '\\subset ', '⊃': '\\supset ', '⊆': '\\subseteq ', '⊇': '\\supseteq ', '∪': '\\cup ', '∩': '\\cap ',
  '⋃': '\\cup ', '⋂': '\\cap ', '∅': '\\emptyset ', '∀': '\\forall ', '∃': '\\exists ', '¬': '\\neg ', '∧': '\\land ', '∨': '\\lor ', '∴': '\\therefore ', '∵': '\\because ',
  '∘': '\\circ ', '∠': '\\angle ', '△': '\\triangle ', '⊥': '\\perp ', '∥': '\\parallel ', '°': '^{\\circ}', '′': "'", '″': "''", '−': '-', '∗': '*', '∣': '\\mid ',
  '∫': '\\int ', '∬': '\\iint ', '∮': '\\oint ', '∑': '\\sum ', '∏': '\\prod ', '√': '\\surd ',
  'ℝ': '\\mathbb{R}', 'ℕ': '\\mathbb{N}', 'ℤ': '\\mathbb{Z}', 'ℚ': '\\mathbb{Q}', 'ℂ': '\\mathbb{C}', 'ℯ': 'e', 'ⅈ': 'i', 'ℎ': 'h',
  'α': '\\alpha ', 'β': '\\beta ', 'γ': '\\gamma ', 'δ': '\\delta ', 'ε': '\\varepsilon ', 'ϵ': '\\epsilon ', 'ζ': '\\zeta ', 'η': '\\eta ', 'θ': '\\theta ',
  'ϑ': '\\vartheta ', 'ι': '\\iota ', 'κ': '\\kappa ', 'λ': '\\lambda ', 'μ': '\\mu ', 'ν': '\\nu ', 'ξ': '\\xi ', 'π': '\\pi ', 'ρ': '\\rho ', 'σ': '\\sigma ',
  'τ': '\\tau ', 'υ': '\\upsilon ', 'φ': '\\varphi ', 'ϕ': '\\phi ', 'χ': '\\chi ', 'ψ': '\\psi ', 'ω': '\\omega ',
  'Γ': '\\Gamma ', 'Δ': '\\Delta ', 'Θ': '\\Theta ', 'Λ': '\\Lambda ', 'Ξ': '\\Xi ', 'Π': '\\Pi ', 'Σ': '\\Sigma ', 'Φ': '\\Phi ', 'Ψ': '\\Psi ', 'Ω': '\\Omega ',
  '{': '\\{', '}': '\\}', '%': '\\%', '#': '\\#', '\u2009': '\\,', '\u200a': '\\,', '\u2061': '', '\u2062': '', '\u2063': '',
};

/** 数式用英数字（𝑥 など）や全角英数を普通の英数に */
function plainChar(ch) {
  const cp = ch.codePointAt(0);
  if (cp >= 0x1d400 && cp <= 0x1d6a3) {
    const i = (cp - 0x1d400) % 52;
    return i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(97 + i - 26);
  }
  if (cp >= 0x1d7ce && cp <= 0x1d7ff) return String((cp - 0x1d7ce) % 10);
  if (cp >= 0xff01 && cp <= 0xff5e) return String.fromCharCode(cp - 0xfee0);
  if (cp === 0x3000) return ' ';
  return ch;
}
const mathText = (s) => [...s].map((c) => MATH_SYM[c] ?? MATH_SYM[plainChar(c)] ?? plainChar(c)).join('');

// 日本語（かな・漢字・全角記号）。数式の中にあっても文章として外に出す
// ●◎◉■◆★☆ の記号も、数式の中に打たれていても文章として扱う（途中で折り返せるように）。△○□ などは数式の記号（\triangle など）として残す
const CJK = /[\u3001-\u30ff\u3400-\u9fff\uf900-\ufaff\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65\u25a0\u25c6\u25c9\u25ce\u25cf\u2605\u2606]/;

// ---------------- OMML → LaTeX ----------------
const DELIM = { '(': '(', ')': ')', '[': '[', ']': ']', '{': '\\{', '}': '\\}', '|': '|', '‖': '\\|', '⌊': '\\lfloor', '⌋': '\\rfloor', '⌈': '\\lceil', '⌉': '\\rceil', '〈': '\\langle', '〉': '\\rangle', '⟨': '\\langle', '⟩': '\\rangle', '': '.' };
const FUNCS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'arg', 'deg', 'dim', 'sinh', 'cosh', 'tanh', 'arcsin', 'arccos', 'arctan', 'gcd']);
const ACCENT = { '\u0302': '\\hat', '\u0303': '\\tilde', '\u0304': '\\bar', '\u0305': '\\overline', '\u0307': '\\dot', '\u0308': '\\ddot', '\u030c': '\\check', '\u0306': '\\breve', '\u20d7': '\\vec', '\u2192': '\\vec', '\u00af': '\\overline' };

function textOf(n) {
  if (!n) return '';
  if (n.text !== undefined) return n.text;
  return n.children.map(textOf).join('');
}

/** OMML の要素 → LaTeX（数式の中身） */
export function omml(n) {
  if (!n) return '';
  if (n.text !== undefined) return '';
  const all = () => n.children.map(omml).join('');
  const sub = (name) => omml(kid(n, name));
  switch (n.name) {
    case 'm:r': {
      const t = kids(n, 'm:t').map(textOf).join('');
      const plain = prop(n, 'm:rPr', 'm:sty') === 'p';
      if (CJK.test(t)) return `\\text{${t}}`;
      const s = mathText(t);
      // 立体（sty=p）の英字は関数名なら \sin などに、それ以外は \mathrm
      if (plain && /^[A-Za-z]{2,}$/.test(t)) return FUNCS.has(t) ? `\\${t} ` : `\\mathrm{${t}}`;
      return s;
    }
    case 'm:f': {
      const type = prop(n, 'm:fPr', 'm:type');
      const num = sub('m:num');
      const den = sub('m:den');
      if (type === 'lin') return `${num}/${den}`;
      if (type === 'noBar') return `\\binom{${num}}{${den}}`;
      return `\\frac{${num}}{${den}}`;
    }
    case 'm:sSup':
      return `{${sub('m:e')}}^{${sub('m:sup')}}`;
    case 'm:sSub':
      return `{${sub('m:e')}}_{${sub('m:sub')}}`;
    case 'm:sSubSup':
      return `{${sub('m:e')}}_{${sub('m:sub')}}^{${sub('m:sup')}}`;
    case 'm:sPre':
      return `{}_{${sub('m:sub')}}^{${sub('m:sup')}}{${sub('m:e')}}`;
    case 'm:rad': {
      const hide = prop(n, 'm:radPr', 'm:degHide');
      const deg = sub('m:deg');
      return hide === '1' || hide === 'on' || !deg ? `\\sqrt{${sub('m:e')}}` : `\\sqrt[${deg}]{${sub('m:e')}}`;
    }
    case 'm:d': {
      const pr = kid(n, 'm:dPr');
      const beg = attr(kid(pr, 'm:begChr'), 'm:val') ?? '(';
      const end = attr(kid(pr, 'm:endChr'), 'm:val') ?? ')';
      const sep = attr(kid(pr, 'm:sepChr'), 'm:val') ?? '|';
      // 左の波括弧だけ＋複数行（eqArr）＝場合分け → cases（条件の「(…のとき)」を右の列に）
      const es = kids(n, 'm:e');
      const inner = es.length === 1 ? es[0].children.filter((c) => c.name && !/Pr$/.test(c.name)) : [];
      const onlyArr = inner[0]?.name === 'm:eqArr';
      if (beg === '{' && (end === '' || end === undefined) && onlyArr) {
        // 波括弧の中で eqArr の後ろに続く部分（例: (n=2,3,…)）は cases の外へ
        const tail = inner.slice(1).map(omml).join('');
        const rows = kids(kid(es[0], 'm:eqArr'), 'm:e').map((e) => {
          const s = omml(e).trim();
          // 行末の括弧が条件（日本語や不等号を含む）なら & で右の列へ
          const m = s.match(/^(.+?)\s*(\\left\( (?:(?!\\left\().)*\\right\))\s*$/) || s.match(/^(.+?)\s*(\((?:[^()]|\([^()]*\))*\))\s*$/);
          const ok = m && !/\\left\s*$/.test(m[1]) && /\\text|\\leq|\\geq|<|>|\\neq|\\in/.test(m[2]);
          return ok ? `${m[1]} & ${m[2]}` : s;
        });
        return `\\begin{cases} ${rows.join(' \\\\ ')} \\end{cases}${tail ? ` \\quad ${tail}` : ''}`;
      }
      const parts = es.map(omml);
      const body = parts.join(sep === '|' ? ' \\mid ' : mathText(sep));
      // 中身が行列なら pmatrix などに
      const mat = parts.length === 1 && /^\\begin\{matrix\}/.test(parts[0]);
      if (mat) {
        const env = { '(': 'pmatrix', '[': 'bmatrix', '{': 'Bmatrix', '|': 'vmatrix', '‖': 'Vmatrix' }[beg];
        if (env && (DELIM[end] !== '.' || beg === '{')) return parts[0].replace(/matrix\}/g, `${env}}`);
      }
      return `\\left${DELIM[beg] ?? beg} ${body} \\right${DELIM[end] ?? end}`;
    }
    case 'm:nary': {
      const pr = kid(n, 'm:naryPr');
      const chr = attr(kid(pr, 'm:chr'), 'm:val') ?? '∫';
      const op = { '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint', '∑': '\\sum', '∏': '\\prod', '⋃': '\\bigcup', '⋂': '\\bigcap' }[chr] ?? mathText(chr);
      const subHide = ['1', 'on'].includes(attr(kid(pr, 'm:subHide'), 'm:val'));
      const supHide = ['1', 'on'].includes(attr(kid(pr, 'm:supHide'), 'm:val'));
      const lo = subHide ? '' : sub('m:sub');
      const hi = supHide ? '' : sub('m:sup');
      return `${op}${lo ? `_{${lo}}` : ''}${hi ? `^{${hi}}` : ''} ${sub('m:e')}`;
    }
    case 'm:func': {
      const name = sub('m:fName').trim();
      return `${name.startsWith('\\') || name.startsWith('{') ? name : FUNCS.has(name.replace(/^\\mathrm\{(\w+)\}$/, '$1')) ? `\\${name.replace(/^\\mathrm\{(\w+)\}$/, '$1')}` : name} ${sub('m:e')}`;
    }
    case 'm:limLow': {
      const base = sub('m:e').trim();
      const lim = sub('m:lim');
      if (/^\\(lim|max|min|sup|inf)\s*$/.test(base) || /^\\mathrm\{(lim|max|min)\}$/.test(base)) return `${base.replace(/^\\mathrm\{(\w+)\}$/, '\\$1').trim()}_{${lim}}`;
      return `\\underset{${lim}}{${base}}`;
    }
    case 'm:limUpp':
      return `\\overset{${sub('m:lim')}}{${sub('m:e')}}`;
    case 'm:acc': {
      const chr = attr(kid(kid(n, 'm:accPr'), 'm:chr'), 'm:val') ?? '\u0302';
      const e = sub('m:e');
      let cmd = ACCENT[chr] ?? '\\hat';
      // 2 文字以上へのベクトル記号・上線は伸びる形に
      if (cmd === '\\vec' && e.replace(/[{}\s]/g, '').length > 1) cmd = '\\overrightarrow';
      if (cmd === '\\bar' && e.replace(/[{}\s]/g, '').length > 1) cmd = '\\overline';
      return `${cmd}{${e}}`;
    }
    case 'm:bar':
      return prop(n, 'm:barPr', 'm:pos') === 'bot' ? `\\underline{${sub('m:e')}}` : `\\overline{${sub('m:e')}}`;
    case 'm:groupChr': {
      const chr = attr(kid(kid(n, 'm:groupChrPr'), 'm:chr'), 'm:val') ?? '⏟';
      const pos = attr(kid(kid(n, 'm:groupChrPr'), 'm:pos'), 'm:val') ?? 'bot';
      if (chr === '⏞' || pos === 'top') return `\\overbrace{${sub('m:e')}}`;
      return `\\underbrace{${sub('m:e')}}`;
    }
    case 'm:eqArr':
      return `\\begin{aligned}${kids(n, 'm:e').map(omml).join(' \\\\ ')}\\end{aligned}`;
    case 'm:m':
      return `\\begin{matrix}${kids(n, 'm:mr').map((r) => kids(r, 'm:e').map(omml).join(' & ')).join(' \\\\ ')}\\end{matrix}`;
    case 'm:box':
    case 'm:borderBox':
    case 'm:phant':
      return sub('m:e');
    case 'w:r':
      return mathText(kids(n, 'w:t').map(textOf).join(''));
    default:
      if (/Pr$/.test(n.name)) return '';
      return all();
  }
}

// ---------------- 段落 ----------------
/**
 * oMath の直下を「文章」と「数式」に分ける。
 * 直下の m:r に日本語があれば文章として外に出し、それ以外（分数などの構造）は数式のまま。
 */
function splitMath(oMath) {
  const segs = [];
  const push = (kind, s) => {
    if (!s) return;
    const last = segs[segs.length - 1];
    if (last && last.kind === kind) last.s += s;
    else segs.push({ kind, s });
  };
  for (const c of oMath.children) {
    if (c.name === 'm:r') {
      const t = kids(c, 'm:t').map(textOf).join('');
      const plain = prop(c, 'm:rPr', 'm:sty') === 'p';
      if (!CJK.test(t)) {
        // 立体の句読点だけ（「,」など）は文章側に付ける
        if (plain && /^[\s,.;:、。，．]+$/.test(t) && segs[segs.length - 1]?.kind === 'text') push('text', t.replace(/,/g, '，').replace(/\./g, '．'));
        else push('math', omml(c));
        continue;
      }
      // 日本語と英数が混ざった run は細かく分ける
      for (const part of t.match(/[\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff\uff01-\uff65\u25a0\u25c6\u25c9\u25ce\u25cf\u2605\u2606]+|[^\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff\uff01-\uff65\u25a0\u25c6\u25c9\u25ce\u25cf\u2605\u2606]+/g) || []) {
        if (CJK.test(part) || /^[\s\u3000]+$/.test(part)) push('text', part.replace(/\u3000/g, ' '));
        else push('math', mathText(part));
      }
    } else if (c.name && !/Pr$/.test(c.name)) {
      push('math', omml(c));
    }
  }
  return segs;
}

function runText(r, fmt) {
  let s = '';
  for (const c of r.children) {
    if (c.name === 'w:t') s += textOf(c);
    else if (c.name === 'w:tab') s += ' ';
    else if (c.name === 'w:br') s += '\n';
  }
  if (!s) return '';
  s = s.replace(/[\\{}%#$&_^~]/g, (ch) => ({ '\\': '\\textbackslash{}', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}' })[ch] ?? `\\${ch}`);
  const rPr = kid(r, 'w:rPr');
  const bold = kid(rPr, 'w:b') && attr(kid(rPr, 'w:b'), 'w:val') !== '0';
  return fmt && bold && s.trim() ? `\\textbf{${s}}` : s;
}

/**
 * 段落を { tokens:[{type:'text'|'math'|'enc', ...}], displayOnly } に変換
 * enc は「囲み文字」フィールド（eq \o\ac(○,1) など）
 */
function readParagraph(p) {
  const tokens = [];
  let field = null; // フィールドコードの収集中
  const visit = (node) => {
    for (const c of node.children) {
      if (!c.name) continue;
      if (c.name === 'w:r') {
        const fc = kid(c, 'w:fldChar');
        if (fc) {
          const t = attr(fc, 'w:fldCharType');
          if (t === 'begin') field = { instr: '', result: false };
          else if (t === 'separate' && field) field.result = true;
          else if (t === 'end' && field) {
            const m = field.instr.match(/\\o\s*\\ac\s*\(\s*(.)\s*,\s*([^)]*)\)/);
            if (m) tokens.push({ type: 'enc', shape: m[1], label: m[2].trim() });
            field = null;
          }
          continue;
        }
        const it = kid(c, 'w:instrText');
        if (it && field) {
          field.instr += textOf(it);
          continue;
        }
        if (field && !field.result) continue;
        const s = runText(c, true);
        if (s) tokens.push({ type: 'text', s });
      } else if (c.name === 'm:oMath') {
        for (const seg of splitMath(c)) tokens.push(seg.kind === 'text' ? { type: 'text', s: seg.s } : { type: 'math', s: seg.s });
      } else if (c.name === 'm:oMathPara') {
        for (const om of kids(c, 'm:oMath')) {
          // 数式段落（oMathPara）は Word ではディスプレイの大きさで表示される → display を記録
          for (const seg of splitMath(om)) tokens.push(seg.kind === 'text' ? { type: 'text', s: seg.s } : { type: 'math', s: seg.s, display: true });
          tokens.push({ type: 'text', s: '\n' });
        }
      } else if (c.name === 'w:hyperlink' || c.name === 'w:smartTag' || c.name === 'w:ins' || c.name === 'w:fldSimple') {
        visit(c);
      }
    }
  };
  visit(p);
  // 前後の空白を整理
  while (tokens.length && tokens[tokens.length - 1].type === 'text' && !tokens[tokens.length - 1].s.trim()) tokens.pop();
  return tokens;
}

/** 数式の整形：単純な中身の \left( … \right) は普通の括弧に */
const cleanMath = (s) => {
  let t = s.replace(/\s+/g, ' ').trim();
  for (let k = 0; k < 5; k++) {
    const before = t;
    t = t.replace(/\\left\( ([^()\\]*?|(?:[^()\\]|\\[a-zA-Z]+ ?|\{[^{}]*\})*?) \\right\)/g, (m, x) => (/\\(frac|sum|int|prod|begin|left|dfrac|binom)/.test(x) ? m : `(${x})`));
    t = t.replace(/\\left\[ ([^\[\]\\]*?) \\right\]/g, '[$1]');
    t = t.replace(/\\left\| ((?:[^|\\]|\\vec\{[^{}]*\}|\\[a-zA-Z]+ ?|\{[^{}]*\})*?) \\right\|/g, (m, x) => (/\\(frac|sum|int)/.test(x) ? m : `|${x}|`));
    if (t === before) break;
  }
  return t.replace(/\{([A-Za-z0-9])\}(?=[_^])/g, '$1');
};

/**
 * Word の数式段落の中の式は、文中に置いてもディスプレイの大きさ（∫・Σ・分数・lim が大きい）で表示される。
 * 見た目をそろえるため、大きさが変わる記号を含む式だけ \displaystyle を付ける。
 */
const BIG = /\\(int|iint|iiint|oint|sum|prod|frac|lim|binom|bigcup|bigcap|max|min)(?![a-zA-Z])/;
export function displayIfBig(s, display) {
  return display && BIG.test(s) && !/^\\displaystyle/.test(s) ? `\\displaystyle ${s}` : s;
}

const LABEL = /^\\left\( ?(\d+|i{1,3}|iv|vi{0,3}|ix|x|[a-h]) ?\\right\)\s*|^\((\d+|i{1,3}|iv|vi{0,3}|ix|x|[a-h])\)\s*/;

/** 数式トークンの先頭の小問番号「(1)」や、前後の句読点を文章側に出す */
function liftTokens(tokens) {
  const out = [];
  let first = true;
  for (const t of tokens) {
    if (t.type !== 'math') {
      if (t.type === 'text' && t.s.trim()) first = false;
      out.push(t);
      continue;
    }
    let s = t.s.trim();
    if (first) {
      const m = s.match(LABEL);
      if (m) {
        out.push({ type: 'text', s: `(${m[1] ?? m[2]}) ` });
        s = s.slice(m[0].length);
      }
    }
    first = false;
    const lead = s.match(/^[.,]\s*/);
    if (lead && out.some((x) => x.type === 'text' && x.s.trim())) {
      out.push({ type: 'text', s: lead[0].trim() === '.' ? '．' : '，' });
      s = s.slice(lead[0].length);
    }
    const trail = s.match(/\s*([.,])$/);
    let after = '';
    if (trail && !/\\[a-zA-Z]+\s*[.,]$/.test(s)) {
      after = trail[1] === '.' ? '．' : '，';
      s = s.slice(0, -trail[0].length);
    }
    if (s.trim()) out.push({ type: 'math', s, display: t.display });
    if (after) out.push({ type: 'text', s: after });
  }
  return out;
}

/** トークン列 → LaTeX の 1 段落 */
function tokensToLatex(tokens) {
  tokens = liftTokens(tokens);
  const hasText = tokens.some((t) => t.type === 'text' && t.s.trim());
  const maths = tokens.filter((t) => t.type === 'math' && t.s.trim());
  if (!hasText && maths.length) {
    // 数式だけの段落は別行立て
    return `\\[\n  ${cleanMath(maths.map((t) => t.s).join(' '))}\n\\]`;
  }
  let out = '';
  for (const t of tokens) {
    if (t.type === 'text') out += t.s;
    else if (t.type === 'math' && t.s.trim()) out += `$${displayIfBig(cleanMath(t.s), t.display)}$`;
  }
  return out
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/^[ \t]+|[ \t]+$/g, '')
    .replace(/\$\s*\$/g, '');
}

// 小問の行頭 (1) （1） ⑴ (i) (ア)
const ITEM_RE = /^(?:\(([0-9]+|[ivx]+|[a-z]|[ア-ン])\)|（([0-9０-９]+|[ア-ン])）|([⑴-⒇]))\s*/;

const numOf = (lab) => {
  if (/^[⑴-⒇]$/.test(lab)) return lab.charCodeAt(0) - 0x2473;
  return Number(lab.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
};

/**
 * 小問の行を enumerate にまとめる。
 * (1)(2)… は番号付きの enumerate（番号の形はテーマで決まる）、その中の (i)(ii)… は入れ子。
 * 途中に文章が挟まって番号が続く場合は \setcounter で番号を引き継ぐ。
 */
function groupItems(paras) {
  const out = [];
  const stack = []; // 'num' | 'other'
  const pad = () => '  '.repeat(stack.length);
  const close = (depth) => {
    while (stack.length > depth) {
      stack.pop();
      out.push(`${pad()}\\end{enumerate}`);
    }
  };
  for (const p of paras) {
    const m = p.match(ITEM_RE);
    if (m) {
      const lab = m[1] ?? m[2] ?? m[3];
      const isNum = /^[0-9０-９⑴-⒇]+$/.test(lab);
      const rest = p.slice(m[0].length);
      if (isNum) {
        close(stack[0] === 'num' ? 1 : 0);
        if (!stack.length) {
          const n = numOf(lab);
          out.push(n > 1 ? `\\begin{enumerate}\\setcounter{enumi}{${n - 1}}` : '\\begin{enumerate}');
          stack.push('num');
        }
        out.push(`${pad()}\\item ${rest}`);
      } else {
        if (stack[stack.length - 1] !== 'other') {
          out.push(`${pad()}\\begin{enumerate}`);
          stack.push('other');
        }
        out.push(`${pad()}\\item[(${lab})] ${rest}`);
      }
    } else if (stack.length === 1 && stack[0] === 'other' && p.trim() && !/^\s*(\$[^$]*\$\s*)+[．。,，]?\s*$|^\s*\\\[/.test(p)) {
      // 条件 (i)(ii)… の並びの後の文章は地の文（数式だけの行は条件の続き）
      close(0);
      out.push(p);
    } else if (stack.length && p.trim() && !/(よ|せ|か|い)[．。.]\s*\$?\s*$/.test(out[out.length - 1] || '')) {
      // 小問の続き（数式など）は字下げして同じ項目に
      out.push(p.split('\n').map((l) => `${pad()}  ${l}`).join('\n'));
    } else if (stack.length && p.trim()) {
      // 問い（〜せよ．〜か．）の後の文章は次の小問の前置き → リストを閉じて地の文に
      close(0);
      out.push(p);
    } else if (p.trim()) {
      out.push(p);
    }
  }
  close(0);
  // 段落の間は空行、リストの中は詰める
  let s = '';
  for (const line of out) {
    const listCmd = /^\s*(\\item|\\end\{enumerate\}|\\begin\{enumerate\})/.test(line);
    // 小問の中の続きの段落（Word では別の行）は改段落にして、行がつながらないように
    const cont = !listCmd && /^\s{2,}/.test(line);
    s += s ? (listCmd ? '\n' : '\n\n') + line : line;
    if (cont) continue;
  }
  return s;
}

/**
 * 変換後の LaTeX を整える
 *  - ●◎ などの記号だけの数式は文章に戻す（1 つの数式だと途中で折り返せない）
 *  - Word で行の長さに合わせて手で改行した箇所（句点で終わらない行の次が、ひらがなで始まる段落）を前の行につなぐ
 */
export function tidyBody(s) {
  // 記号で始まる $…$ だけを対象にする（「$x$ と $y$」の間の空白を 1 つの数式と取り違えないように）
  s = s.replace(/\$([■◆◉◎●★☆][■◆◉◎●★☆ ,，、]*)\$/g, (_m, x) => x.replace(/\s*,\s*/g, '，'));
  // 前の行が日本語の文字か数式（$）で終わるときだけ（\end{enumerate} などの後はつながない）
  s = s.replace(/([ぁ-ゖァ-ヺー一-鿿々$])\n\n[ \t]*(?=[ぁ-ゖ])/g, '$1');
  return s;
}

/**
 * Word の本文 XML → { title, problems }
 * 囲み番号（○1 や □2 など）で始まる段落を大問の区切りとみなす。
 * 番号の直後の「C***」のような表記は難易度（★の数）とランク、○/□ は文理の区分としてタグにする。
 */
export function docxToProblems(xml, opts = {}) {
  const root = parseXml(xml);
  const body = kid(kid(root, 'w:document'), 'w:body');
  if (!body) throw new Error('Word 文書の本文が見つかりません');
  const paras = kids(body, 'w:p').map(readParagraph);

  const problems = [];
  let pre = [];
  let cur = null;
  const flush = () => {
    if (!cur) return;
    cur.body = tidyBody(groupItems(cur.lines)).trim() + '\n';
    delete cur.lines;
    delete cur.diffDone;
    problems.push(cur);
  };
  // 「C***」「B**∘」のような難易度表記（ランク・★の数・印）
  const DIFF = /^([A-Z])?(\*+|★+)(∘|○|◦|\\circ)?$/;
  const applyDiff = (p, m) => {
    if (m[1]) p.tags.push(`ランク${m[1]}`);
    p.difficulty = Math.min(5, m[2].length);
    if (m[3]) p.tags.push('∘印');
    p.diffDone = true;
  };
  for (const tokens of paras) {
    const enc = tokens.find((t) => t.type === 'enc' && /^\d+$/.test(t.label));
    if (enc && tokens.indexOf(enc) <= 1) {
      flush();
      // 番号の後ろ（難易度など）
      const rest = tokens.slice(tokens.indexOf(enc) + 1);
      const restText = rest.map((t) => t.s || '').join('').replace(/\s+/g, '');
      const tags = [];
      if (enc.shape === '○' || enc.shape === '〇') tags.push(opts.circleTag ?? '文理系');
      else if (enc.shape === '□') tags.push(opts.boxTag ?? '理系');
      cur = newProblem({ title: '', tags, difficulty: 0, body: '', solution: '', lines: [] });
      cur.number = enc.label;
      const dm = restText.match(DIFF);
      if (dm) applyDiff(cur, dm);
      else if (restText) cur.lines.push(tokensToLatex(rest));
      continue;
    }
    // 番号の次の段落に難易度だけが書かれている場合
    if (cur && !cur.diffDone && !cur.lines.some((l) => l.trim())) {
      const dm = tokens.map((t) => t.s || '').join('').replace(/\s+/g, '').match(DIFF);
      if (dm) {
        applyDiff(cur, dm);
        continue;
      }
    }
    const line = tokensToLatex(tokens);
    if (cur) cur.lines.push(line);
    else pre.push(line);
  }
  flush();
  const title = (pre.find((l) => l.trim()) || '').split(/\s+:|：/)[0].replace(/\\textbf\{|\}/g, '').trim();
  return { title, problems, preamble: pre };
}

/** 解答の Word 文書（大問 1 つ分）→ LaTeX の本文 */
export function docxToLatex(xml) {
  const root = parseXml(xml);
  const body = kid(kid(root, 'w:document'), 'w:body');
  if (!body) throw new Error('Word 文書の本文が見つかりません');
  const lines = kids(body, 'w:p').map((p) => tokensToLatex(readParagraph(p)));
  return tidyBody(groupItems(lines)).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
