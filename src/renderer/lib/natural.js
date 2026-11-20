// LaTeX を知らなくても書けるようにするための「ふつうの書き方」。
// 行の先頭の「(1) 」「（1） 」「⑴ 」を小問（\begin{enumerate} … \item …）として扱う。
// 番号の形（(1)・問1・⑴ など）はレイアウトの設定に従うので、書いた数字はそのままは使わない（目印）。
//
// 小問のまとまりの決め方:
//   - 「(1)」で始まる行から新しいまとまりを始める（2 つ目以降の番号はそのまとまりの続き）
//   - 小問と小問の間の行は、前の小問の続き
//   - 最後の小問は、空行までで終わる。ただし空行の次が字下げした行・別行の数式（\[ や \begin{…}）なら続き
//   - 既にある \begin{enumerate} … \end{enumerate} の中は変えない

const CIRCLED = '⑴⑵⑶⑷⑸⑹⑺⑻⑼⑽⑾⑿⒀⒁⒂⒃⒄⒅⒆⒇';
// 目印の後には空白（半角・全角）が要る。「(1)式より」のような参照を小問と間違えないため
export const MARKER_RE = new RegExp(`^([ \\t]*)(?:[(（]([0-9０-９]{1,2})[)）]|([${CIRCLED}]))[ \\t　]`);

const toHalf = (s) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/** 行が小問の目印で始まっていれば番号と目印の長さを返す */
export function parseMarker(line) {
  const m = MARKER_RE.exec(line);
  if (!m) return null;
  const n = m[2] ? Number(toHalf(m[2])) : CIRCLED.indexOf(m[3]) + 1;
  return { n, indent: m[1], length: m[0].length, circled: !!m[3], fullwidth: m[2] ? m[0].includes('（') : false };
}

/** 次の小問の目印（前の目印の形に合わせる） */
export function markerText(n, like) {
  if (like?.circled && n <= CIRCLED.length) return `${CIRCLED[n - 1]} `;
  if (like?.fullwidth) return `（${n}） `;
  return `(${n}) `;
}

const ENV_OPEN = /\\begin\{(enumerate|itemize)\}/g;
const ENV_CLOSE = /\\end\{(enumerate|itemize)\}/g;
const count = (re, s) => (s.match(re) || []).length;
// 空行の後でも小問の続きとみなす行（字下げした行・別行の数式・数式の目印 \u0001）
const continuesAfterBlank = (line) => /^[ \t　]/.test(line) || /^\s*(\\\[|\$\$|\\begin\{|\u0001|\u0004|\u0005|% @fig)/.test(line);

/** 空行のあとでも、先に次の小問（2 以上）があれば、小問の続きとみなす */
function nextMarkerAhead(lines, i) {
  for (let k = i; k < lines.length; k++) {
    if (/\\begin\{(enumerate|itemize)\}/.test(lines[k])) return false;
    const mk = parseMarker(lines[k]);
    if (mk) return mk.n > 1;
  }
  return false;
}

/**
 * 「(1) …」の行を \begin{enumerate} \item … \end{enumerate} にする
 * @param {string} src
 * @returns {string}
 */
export function naturalToLatex(src) {
  if (!src || !/[(（⑴-⒇]/.test(src)) return src;
  const lines = src.split('\n');
  const out = [];
  let depth = 0; // 既にある enumerate / itemize の深さ（中の行は変えない）
  let inList = false;
  let blanks = []; // 小問の後の空行（続きかどうかは次の行で決める）
  let inFig = false; // 図（% @fig … % @endfig）の中は変えない
  const flushBlanks = () => {
    out.push(...blanks);
    blanks = [];
  };
  // 行の数を変えないよう、\begin{enumerate} は最初の小問と同じ行に、\end{enumerate} は最後の行の末尾に付ける
  // （TeX のエラーの行番号がエディタの行と合うように）。最後の行がコメントで終わるときだけ次の行に置く
  const closeList = () => {
    const k = out.length - 1;
    if (k >= 0 && !/(^|[^\\])%/.test(out[k])) out[k] += '\\end{enumerate}';
    else out.push('\\end{enumerate}');
    inList = false;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*% @fig /.test(line)) inFig = true;
    const mk = depth === 0 && !inFig && !/^\s*%/.test(line) ? parseMarker(line) : null;
    if (/% @endfig/.test(line)) inFig = false;
    if (inList && depth === 0) {
      if (line.trim() === '') {
        blanks.push(line);
        continue;
      }
      const ends = mk ? mk.n === 1 : blanks.length > 0 && !continuesAfterBlank(line) && !nextMarkerAhead(lines, i);
      if (ends) closeList();
    }
    flushBlanks();
    if (mk) {
      out.push(`${mk.indent}${inList ? '' : '\\begin{enumerate}'}\\item ${line.slice(mk.length)}`);
      inList = true;
    } else {
      out.push(line);
    }
    depth = Math.max(0, depth + count(ENV_OPEN, line) - count(ENV_CLOSE, line));
  }
  if (inList) closeList();
  flushBlanks();
  return out.join('\n');
}

/**
 * 問題文から、一覧に出す短い要約を作る（題名が無いとき用）。
 * \begin{enumerate} のような環境の目印・\item・レイアウト用の命令・コメント・図は取り除き、
 * \textbf{…} などの中身の文字と数式の中身は残す。
 */
export function plainSummary(src, max = 40) {
  let s = String(src || '');
  s = s.replace(/% @fig [\s\S]*?% @endfig/g, ' '); // 図
  s = s.replace(/(^|[^\\])%.*$/gm, '$1'); // コメント
  s = s.replace(/\\(begin|end)\s*\{[^{}]*\}(\s*\[[^\]]*\])?(\s*\{[^{}]*\})?/g, ' '); // 環境の目印（表の列指定も）
  s = s.replace(/\\(item|Part)(?![a-zA-Z])(\s*\[[^\]]*\])?/g, ' ');
  s = s.replace(/\\(label|ref|eqref|vspace|hspace|setcounter|addtocounter|includegraphics|setlength)\*?(\s*\[[^\]]*\])?(\s*\{[^{}]*\})+/g, ' ');
  s = s.replace(/\\blank\s*\{([^{}]*)\}/g, '（$1）');
  s = s.replace(/\\[a-zA-Z]+\*?/g, ' ').replace(/\\./g, ' ');
  s = s.replace(/[{}$[\]&]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.slice(0, max);
}

/**
 * 単純な \begin{enumerate} … \end{enumerate}（入れ子・オプション・\item[…] なし）を「(1) …」の書き方に直す。
 * 直せないまとまりはそのまま残す。
 */
export function latexToNatural(src) {
  return src.replace(/\\begin\{enumerate\}[ \t]*\n([\s\S]*?)\n[ \t]*\\end\{enumerate\}/g, (whole, inner) => {
    if (/\\begin\{(enumerate|itemize)\}|\\item\[/.test(inner)) return whole;
    let n = 0;
    const lines = inner.split('\n').map((ln) =>
      ln.replace(/^[ \t]*\\item(?:[ \t]+|(?![a-zA-Z]))/, () => {
        n += 1;
        return markerText(n);
      })
    );
    // \item の前に文章がある場合は直さない
    if (n === 0 || !(lines.find((l) => l.trim() !== '') || '').startsWith('(1) ')) return whole;
    return lines.join('\n');
  });
}
