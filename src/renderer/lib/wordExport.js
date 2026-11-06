// Word へ数式を渡すための変換。
// Word は「MathML をテキストとして貼り付け」ると数式オブジェクトに変換するので、
// KaTeX で LaTeX → MathML を作ってクリップボードに入れる。
import katex from 'katex';
import { findMathRanges } from './mathRanges.js';

export function latexToMathML(latex, display = false, macros = {}) {
  // align* などの環境は別行立てでしか使えない
  if (/\\begin\{(align|gather|multline|equation|flalign|alignat)\*?\}/.test(latex)) display = true;
  const html = katex.renderToString(latex, {
    output: 'mathml',
    displayMode: display,
    throwOnError: true,
    strict: 'ignore',
    macros: { ...macros },
  });
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const math = doc.querySelector('math');
  if (!math) throw new Error('MathML を生成できませんでした');
  // <semantics> と LaTeX 注釈は Word では不要なので外す
  const sem = math.querySelector('semantics');
  if (sem) {
    const first = sem.firstElementChild;
    math.replaceChildren(...(first && first.tagName.toLowerCase() === 'mrow' ? first.childNodes : sem.childNodes));
    math.querySelectorAll('annotation').forEach((a) => a.remove());
  }
  // Word は <mtext> 内の全角記号（（ など）を含む MathML の貼り付けに失敗するため、半角に置き換える
  math.querySelectorAll('mtext, mo, mi, mn').forEach((el) => {
    el.textContent = el.textContent.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  });
  math.setAttribute('xmlns', 'http://www.w3.org/1998/Math/MathML');
  if (display) math.setAttribute('display', 'block');
  return math.outerHTML;
}

/** 文章＋数式を、Word に貼れる HTML（数式部分は MathML）にする */
export function latexDocToWordHtml(src, macros = {}) {
  const ranges = findMathRanges(src);
  let html = '';
  let last = 0;
  const textPart = (t) =>
    t
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/\\\\/g, '<br>')
      .replace(/\n\s*\n/g, '</p><p>')
      .replace(/\\textbf\{([^{}]*)\}/g, '<b>$1</b>')
      .replace(/\\(begin|end)\{(enumerate|itemize)\}(\[[^\]]*\])?/g, '')
      .replace(/\\item\s*/g, '<br>・');
  for (const r of ranges) {
    html += textPart(src.slice(last, r.from));
    try {
      html += latexToMathML(r.latex, r.display, macros);
    } catch {
      html += textPart(src.slice(r.from, r.to));
    }
    last = r.to;
  }
  html += textPart(src.slice(last));
  return `<p>${html}</p>`;
}
