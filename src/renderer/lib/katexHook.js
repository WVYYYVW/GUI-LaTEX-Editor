// KaTeX の拡張（mhchem）がマクロを登録するときに、その関数を受け取っておく（chem.js から使う）。
// このファイルは katex/contrib/mhchem より先に読み込まれる必要がある。
import katex from 'katex';

export const mhchemMacros = {};

if (!katex.__lpeHooked) {
  const orig = katex.__defineMacro;
  katex.__defineMacro = (name, fn) => {
    if (name === '\\ce') mhchemMacros.ce = fn;
    if (name === '\\pu') mhchemMacros.pu = fn;
    return orig(name, fn);
  };
  katex.__lpeHooked = true;
}
