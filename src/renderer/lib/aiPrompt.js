// AI（Claude・ChatGPT など）に問題を作らせるときのプロンプトと、その出力の読み取り。
//  - 貼り付け用: 1 つのコードブロックに【問題1】【解答1】…の区切りで LaTeX を書かせる → 「AI の回答を貼り付け」で
//    問題文と解答を一度に取り込める
//  - ファイル用: ファイルを作れる AI に .mpb（中身は JSON）を書き出させる → そのまま「開く」で読める

const SUBJECT_NAME = { math: '数学', physics: '物理', chemistry: '化学' };

/** 科目ごとの書き方の約束 */
function subjectRules(subject) {
  const common = [
    '数式は文中なら $…$、独立した行なら \\[ … \\] で書く（\\( \\) や $$ $$ は使わない）。',
    '小問は \\begin{enumerate} \\item … \\item … \\end{enumerate} で書き、番号 (1)(2) は自分で書かない（番号の形はアプリのテーマが決める）。小問の中の小問も enumerate を入れ子にする。',
    '分数は \\frac{}{}、ベクトルは \\vec{a} または \\overrightarrow{AB}、≦ ≧ は \\leqq \\geqq、度は ^{\\circ} で書く。',
    '全角の英数字・記号を数式の中に入れない（ｘ＋１ ではなく x+1）。日本語の文章は数式の外に書く。',
    '句読点は「，」と「。」を使う。',
    'Markdown の記法（**太字**、# 見出し、- 箇条書き、表の |）は使わない。強調が必要なら \\textbf{…}。',
    '\\documentclass・\\usepackage・\\begin{document} などの文書全体の命令は書かない（問題文と解答の中身だけ）。',
    '図が必要なときは、本文に「（図：…）」と文章で説明を入れる。どうしても必要なら簡単な TikZ（\\begin{center}\\begin{tikzpicture} … \\end{tikzpicture}\\end{center}）で書いてよい。',
  ];
  const physics = [
    '単位は \\qty{数値}{単位}（例: \\qty{9.8}{m/s^2}、\\qty{2.0}{\\kilo\\ohm}）または \\unit{単位}（例: \\unit{N}）で書く。数値は 1.0\\times10^{3} のように書く。',
    '問題がいくつかの部分に分かれるときは、各部分の初めに \\Part とだけ書いた行を置く（I, II などの番号はアプリが付ける）。',
    '穴埋めの空欄は \\blank{ア}、\\blank{イ} … と書く。',
    '物理定数は g、\\hbar、\\varepsilon_{0}、\\mu_{0}、k_{\\mathrm{B}}、N_{\\mathrm{A}} のように書く。',
  ];
  const chemistry = [
    '化学式・イオン・反応式は \\ce{…} で書く（例: \\ce{H2SO4}、\\ce{SO4^2-}、\\ce{Cu^2+}、\\ce{2H2 + O2 -> 2H2O}、可逆反応は \\ce{N2 + 3H2 <=> 2NH3}、気体の発生は \\ce{O2 ^}、沈殿は \\ce{BaSO4 v}、水和物は \\ce{CuSO4*5H2O}）。$ で囲まなくてよい。',
    '単位は \\qty{数値}{単位}（例: \\qty{22.4}{L/mol}、\\qty{-286}{kJ/mol}）または \\unit{mol/L} で書く。',
    '原子量などの値が必要なら、問題文の初めに「必要があれば，原子量は次の値を用いよ。H $1.0$，C $12$，O $16$」のように書く。',
    '問題がいくつかの部分に分かれるときは、各部分の初めに \\Part とだけ書いた行を置く。穴埋めの空欄は \\blank{ア} と書く。',
    '構造式は図として描けないので、示性式（\\ce{CH3-CH2-OH} など）で書くか、「（構造式：…）」と文章で説明する。',
  ];
  return [...common, ...(subject === 'physics' ? physics : subject === 'chemistry' ? chemistry : [])];
}

/**
 * @param {{subject?:'math'|'physics'|'chemistry', withSolution?:boolean, format?:'paste'|'mathprob', request?:string, fileName?:string}} o
 */
/**
 * AI に書き出させるファイルの名前。空なら null（AI が内容に合わせて付ける）。
 * 拡張子が無ければ .mpb を付け、ファイル名に使えない文字は取り除く。
 */
export function aiFileName(name) {
  let s = String(name || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_');
  if (!s) return null;
  if (!/\.(mpb|mathprob)$/i.test(s)) s += '.mpb';
  return s;
}

export function buildAiPrompt(o = {}) {
  const subject = o.subject || 'math';
  const withSolution = o.withSolution !== false;
  const sname = SUBJECT_NAME[subject] || '数学';
  const request = (o.request || '').trim() || `${sname}の問題を作ってください。`;
  const rules = subjectRules(subject)
    .map((r, i) => `${i + 1}. ${r}`)
    .join('\n');
  const L = [];
  L.push('あなたは日本の大学入試問題の作成者です。次の依頼に従って問題を作ってください。');
  L.push('');
  L.push('【依頼】');
  L.push(request);
  L.push('');
  L.push(`【出力するもの】${withSolution ? '問題と、その解答（途中の式と考え方を含む論証付きの解答）' : '問題だけ（解答・ヒント・答えは出力しない）'}`);
  L.push('');
  if (o.format === 'mathprob') {
    L.push('【出力の形式】');
    const fileName = aiFileName(o.fileName);
    L.push(
      (fileName
        ? `結果を「${fileName}」という名前のファイル（中身は UTF-8 の JSON）として書き出してください。`
        : '結果を、内容が分かる短い日本語の名前（例: 二次関数の最大最小_3題.mpb）で、拡張子 .mpb のファイル（中身は UTF-8 の JSON）として書き出してください。') +
        'チャットに JSON を貼るのではなく、ファイルとして出力してください（ファイルを作れない場合だけ、JSON 全体を 1 つのコードブロック ```json に入れて出力してください）。'
    );
    L.push('JSON の形は次のとおりです（この形以外のキーは付けない）。');
    L.push('```json');
    L.push(
      JSON.stringify(
        {
          format: 'mathprob',
          version: 1,
          meta: { title: '問題集の題名', subject, answerMode: withSolution ? 'end' : 'none' },
          problems: [
            { title: '問題の短い題名', tags: ['分野'], difficulty: 2, body: '問題文の LaTeX', solution: withSolution ? '解答の LaTeX' : '' },
          ],
        },
        null,
        2
      )
    );
    L.push('```');
    L.push('- problems は問題の数だけ並べる。difficulty は 1〜5 の整数（易しい 1 〜 難しい 5）。');
    L.push(withSolution ? '- solution に解答を入れる。' : '- solution は空文字列 "" にする。');
    L.push('- body・solution は下の約束に従った LaTeX の文字列。JSON の文字列なので、\\ は \\\\ と、改行は \\n と書く（例: "$\\\\frac{1}{2}$"）。');
    L.push('- 出力の前に、JSON として正しく読めること（括弧・引用符・エスケープ）を確かめる。');
  } else {
    L.push('【出力の形式】');
    L.push('説明や前置きは書かず、全体を 1 つのコードブロック（```latex で始まり ``` で終わる）に入れて出力してください。');
    L.push('コードブロックの中は、問題ごとに次の区切りの行で始めます（区切りの行は 1 行で、この形のまま書く）。');
    L.push('```latex');
    L.push('【問題1】（問題の短い題名）');
    L.push('問題文の LaTeX');
    if (withSolution) {
      L.push('【解答1】');
      L.push('解答の LaTeX');
    }
    L.push('【問題2】（問題の短い題名）');
    L.push('…');
    L.push('```');
    if (!withSolution) L.push('【解答…】の区切りと解答は出力しないでください。');
  }
  L.push('');
  L.push('【LaTeX の書き方の約束】（この約束を守ると、問題作成アプリにそのまま取り込めて数式が正しく表示されます）');
  L.push(rules);
  return L.join('\n');
}

// ---------------- 読み取り ----------------

const MARK_RE = /^[ \t]*【\s*(問題|解答)\s*([0-9０-９]+)\s*】[ \t]*(.*)$/gm;

/**
 * 【問題1】【解答1】… の区切りで書かれた LaTeX を問題ごとに分ける。区切りが無ければ null。
 * @returns {{title:string, body:string, solution:string}[] | null}
 */
export function splitAiProblems(latex) {
  const text = String(latex || '').replace(/\r\n?/g, '\n');
  const marks = [...text.matchAll(MARK_RE)];
  if (!marks.some((m) => m[1] === '問題')) return null;
  const toNum = (s) => Number(s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
  const byNum = new Map();
  const order = [];
  marks.forEach((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    const content = text.slice(start, end).replace(/^\n+|\s+$/g, '');
    const n = toNum(m[2]);
    if (!byNum.has(n)) {
      byNum.set(n, { title: '', body: '', solution: '' });
      order.push(n);
    }
    const p = byNum.get(n);
    if (m[1] === '問題') {
      p.title = m[3].replace(/^[（(]\s*|\s*[）)]$/g, '').trim();
      p.body = content ? content + '\n' : '';
    } else {
      p.solution = content ? content + '\n' : '';
    }
  });
  return order.map((n) => byNum.get(n));
}

/**
 * 貼り付けた文字列が .mathprob（JSON）なら、その内容を返す。コードブロックで囲まれていてもよい。違えば null。
 */
export function parseMathprobText(text) {
  let t = String(text || '').trim();
  const fence = t.match(/^```[a-zA-Z]*\n([\s\S]*?)\n?```$/);
  if (fence) t = fence[1].trim();
  if (!t.startsWith('{')) return null;
  try {
    const data = JSON.parse(t);
    if (data && Array.isArray(data.problems)) return data;
  } catch {
    /* JSON ではない */
  }
  return null;
}
