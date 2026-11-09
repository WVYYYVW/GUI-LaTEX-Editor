// 化学式 \ce{…}・単位 \pu{…}（mhchem の書き方）を、普通の LaTeX の数式に変換する。
// KaTeX に付属する mhchem（mhchem 3.3 の移植）の変換部分をそのまま使うので、プレビューと PDF の見た目がそろい、
// mhchem パッケージが入っていない TeX 環境でも PDF を作れる。
//
// KaTeX の mhchem は変換関数を外に出していないため、登録の瞬間（katex.__defineMacro）に受け取っておく。
// この import の順序（先に katex を書き換え、次に mhchem を読み込む）は変えないこと。
import './katexHook.js';
import 'katex/contrib/mhchem';
import { mhchemMacros } from './katexHook.js';

const call = (fn, s) => fn({ consumeArgs: () => [[{ text: s, loc: { start: 0 } }]] });

/** \ce の中身 → LaTeX の数式（$ は付けない） */
export function ceToTex(s) {
  if (!mhchemMacros.ce) return `\\mathrm{${s}}`;
  return call(mhchemMacros.ce, s);
}

/** \pu の中身 → LaTeX の数式 */
export function puToTex(s) {
  if (!mhchemMacros.pu) return `\\mathrm{${s}}`;
  return call(mhchemMacros.pu, s);
}

/**
 * 単位（siunitx の書き方）。プレビュー（KaTeX のマクロ）と PDF（書き出し時の置き換え）の両方で使う。
 * \qty{9.8}{m/s^2}・\unit{\kilo\ohm} のように書ける。数値は書いたとおりに組む（1.0\times10^{3} など）。
 */
export const UNIT_NAMES = {
  '\\ohm': '\\Omega',
  '\\kilo': 'k',
  '\\mega': 'M',
  '\\giga': 'G',
  '\\milli': 'm',
  '\\micro': '\\mu ',
  '\\nano': 'n',
  '\\pico': 'p',
  '\\centi': 'c',
  '\\metre': 'm',
  '\\meter': 'm',
  '\\second': 's',
  '\\gram': 'g',
  '\\kilogram': 'kg',
  '\\newton': 'N',
  '\\joule': 'J',
  '\\watt': 'W',
  '\\pascal': 'Pa',
  '\\volt': 'V',
  '\\ampere': 'A',
  '\\coulomb': 'C',
  '\\farad': 'F',
  '\\henry': 'H',
  '\\tesla': 'T',
  '\\weber': 'Wb',
  '\\hertz': 'Hz',
  '\\kelvin': 'K',
  '\\mole': 'mol',
  '\\litre': 'L',
  '\\liter': 'L',
  '\\degreeCelsius': '{}^{\\circ}\\mathrm{C}',
  '\\electronvolt': 'eV',
  '\\percent': '\\%',
  '\\per': '/',
  '\\squared': '^{2}',
  '\\cubed': '^{3}',
};

/** KaTeX 用のマクロ（単位・空欄） */
export const SCIENCE_MACROS = {
  '\\qty': '#1\\,\\mathrm{#2}',
  '\\SI': '#1\\,\\mathrm{#2}',
  '\\unit': '\\mathrm{#1}',
  '\\si': '\\mathrm{#1}',
  '\\num': '#1',
  '\\blank': '\\boxed{\\text{#1}}',
  ...UNIT_NAMES,
};

/** 変換結果が使う、KaTeX にしかない命令を LaTeX でも使えるようにする。プリアンブルに入れる */
export const CHEM_PREAMBLE = [
  // mhchem の三重線（結合の記号）と、KaTeX だけにある平衡の矢印
  '\\providecommand{\\tripledash}{{\\vphantom{-}\\raisebox{0.18em}{$\\mkern2mu\\text{\\tiny -}\\mkern1mu\\text{\\tiny -}\\mkern1mu\\text{\\tiny -}\\mkern2mu$}}}',
  '\\providecommand{\\xrightequilibrium}[2][]{\\xrightleftharpoons[#1]{#2}}',
  '\\providecommand{\\xleftequilibrium}[2][]{\\xrightleftharpoons[#1]{#2}}',
  '\\providecommand{\\xrightleftarrows}[2][]{\\xrightleftharpoons[#1]{#2}}',
  '\\providecommand{\\xlongequal}[2][]{\\overset{#2}{\\underset{#1}{=\\!=\\!=}}}',
  // 書き出し時に置き換えるので普通は使われない（プリアンブルなどに書かれたときの予備）
  '\\providecommand{\\ce}[1]{\\ensuremath{\\mathrm{#1}}}\\providecommand{\\pu}[1]{\\ensuremath{\\mathrm{#1}}}',
];

// { … }（2 段まで入れ子可）
const GROUP = '\\{((?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*)\\}';
const CE_RE = new RegExp(`\\\\(ce|pu)\\s*${GROUP}`, 'g');
const QTY_RE = new RegExp(`\\\\(qty|SI)\\s*${GROUP}\\s*${GROUP}|\\\\(unit|si|num)\\s*${GROUP}`, 'g');

/** \qty{1.0e-3}{…} / \num{2e5} の e 表記を 1.0\times10^{-3} にする（プレビューと PDF の両方で使う） */
export function normalizeNumbers(latex) {
  if (!latex || !/[eE]/.test(latex)) return latex;
  return latex.replace(/\\(qty|SI|num)(\s*)\{\s*([-+]?(?:\d+\.?\d*|\.\d+))\s*[eE]\s*([-+]?\d+)\s*\}/g, (_m, c, sp, a, e) => `\\${c}${sp}{${a}\\times10^{${e.replace(/^\+/, '')}}}`);
}

/** 単位の文字列（\kilo\ohm, m/s^2）→ \mathrm{…} の中身 */
export function unitToTex(u) {
  return u.replace(/\\[a-zA-Z]+/g, (c) => UNIT_NAMES[c] ?? c).replace(/\s+/g, ' ').trim();
}

/** 文章・数式の中の \ce{…} / \pu{…} / \qty{…}{…} / \unit{…} などを、普通の LaTeX に置き換える（PDF 出力用） */
export function expandScience(src) {
  if (!src || !/\\(?:ce|pu|qty|SI|unit|si|num)\s*\{/.test(src)) return src;
  let out = normalizeNumbers(src).replace(CE_RE, (m, cmd, body) => {
    try {
      return `\\ensuremath{${cmd === 'ce' ? ceToTex(body) : puToTex(body)}}`;
    } catch {
      return m;
    }
  });
  out = out.replace(QTY_RE, (m, c2, num, unit, c1, arg) => {
    if (c2) return `\\ensuremath{${num}\\,\\mathrm{${unitToTex(unit)}}}`;
    if (c1 === 'num') return `\\ensuremath{${arg}}`;
    return `\\ensuremath{\\mathrm{${unitToTex(arg)}}}`;
  });
  return out;
}
