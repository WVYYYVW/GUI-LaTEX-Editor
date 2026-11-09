// LaTeX ソース中の数式範囲を見つけるユーティリティ（プレビュー・エディタ・貼り付け変換で共用）

const DISPLAY_ENVS = 'equation|align|gather|multline|alignat|flalign|eqnarray';

/** コメント（% から行末）を同じ長さの空白で塗りつぶす。位置はずらさない。 */
export function maskComments(src) {
  return src.replace(/(^|[^\\])(%[^\n]*)/g, (_m, pre, c) => pre + ' '.repeat(c.length));
}

// { … }（中に { … { … } … } を 2 段まで含んでよい）
const GROUP = '\\{(?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*\\}';

const MATH_RE = new RegExp(
  [
    `\\\\begin\\{((?:${DISPLAY_ENVS})\\*?)\\}([\\s\\S]*?)\\\\end\\{\\1\\}`, // 1,2: 環境
    '\\$\\$([\\s\\S]+?)\\$\\$', // 3: $$ $$
    '\\\\\\[([\\s\\S]+?)\\\\\\]', // 4: \[ \]
    '\\\\\\(([\\s\\S]+?)\\\\\\)', // 5: \( \)
    '(?<!\\\\)\\$((?:\\\\.|[^$\\\\])+?)\\$', // 6: $ $
    // 7: 文章中に書ける化学式・単位の命令（\ce{H2O}, \pu{}, \unit{}, \si{}, \num{} と \qty{9.8}{m/s^2}, \SI{}{}）。波括弧は 2 段まで入れ子可
    `\\\\(?:ce|pu|unit|si|num)\\s*${GROUP}(?![a-zA-Z])|\\\\(?:qty|SI)\\s*${GROUP}\\s*${GROUP}`,
  ].join('|'),
  'g'
);

/**
 * @typedef {{from:number,to:number,innerFrom:number,innerTo:number,display:boolean,kind:string,latex:string}} MathRange
 * @returns {MathRange[]}
 */
export function findMathRanges(src) {
  const text = maskComments(src);
  const out = [];
  MATH_RE.lastIndex = 0;
  let m;
  while ((m = MATH_RE.exec(text))) {
    const from = m.index;
    const to = from + m[0].length;
    if (m[1] !== undefined) {
      out.push({ from, to, innerFrom: from, innerTo: to, display: true, kind: 'env', env: m[1], latex: src.slice(from, to) });
    } else if (m[3] === undefined && m[4] === undefined && m[5] === undefined && m[6] === undefined) {
      // 文章中の \ce{…} / \qty{…}{…} など。命令ごと KaTeX（mhchem）で表示し、句読点の統一などからも守る
      out.push({ from, to, innerFrom: from, innerTo: to, display: false, kind: 'cmd', latex: src.slice(from, to) });
    } else {
      const g = m[3] ?? m[4] ?? m[5] ?? m[6];
      const kind = m[3] !== undefined ? '$$' : m[4] !== undefined ? '\\[' : m[5] !== undefined ? '\\(' : '$';
      const open = kind === '$' ? 1 : 2;
      out.push({
        from,
        to,
        innerFrom: from + open,
        innerTo: to - open,
        display: kind === '$$' || kind === '\\[',
        kind,
        latex: src.slice(from + open, to - open),
      });
    }
  }
  return out;
}

export function rangeAt(src, pos) {
  return findMathRanges(src).find((r) => pos >= r.from && pos <= r.to) || null;
}

/** 数式中の全角英数記号を半角へ（IME が ON のまま入力したときの救済）。\text{…} の中は変えない。 */
const FW_MAP = { '　': ' ', '−': '-', 'ー': '-', '×': '\\times ', '÷': '\\div ', '≦': '\\leqq ', '≧': '\\geqq ', '≠': '\\neq ', '・': '\\cdot ' };
export function normalizeMathText(latex) {
  let out = '';
  let i = 0;
  while (i < latex.length) {
    const t = latex.slice(i).match(/^\\(?:text|mathrm|textrm|textbf|mbox)\s*\{/);
    if (t) {
      // 対応する } までそのまま
      let depth = 0;
      let j = i + t[0].length - 1;
      for (; j < latex.length; j++) {
        if (latex[j] === '{') depth++;
        else if (latex[j] === '}' && --depth === 0) break;
      }
      out += latex.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    const ch = latex[i];
    const code = ch.charCodeAt(0);
    if (code >= 0xff01 && code <= 0xff5e) out += String.fromCharCode(code - 0xfee0);
    else if (FW_MAP[ch] !== undefined && ch !== 'ー') out += FW_MAP[ch];
    else out += ch;
    i++;
  }
  return out;
}

const FW_TEST = /[！-～　]|[−×÷≦≧≠・]/;
/** ソース全体のうち、数式部分にある全角英数だけを半角にした変更リストを返す */
export function fullwidthFixes(src) {
  const changes = [];
  for (const r of findMathRanges(src)) {
    const inner = src.slice(r.innerFrom, r.innerTo);
    if (!FW_TEST.test(inner)) continue;
    const fixed = normalizeMathText(inner);
    if (fixed !== inner) changes.push({ from: r.innerFrom, to: r.innerTo, insert: fixed });
  }
  return changes;
}
