// 問題集ファイル（.mathprob = JSON）のデータモデル
import { defaultLayout, normalizeLayout, defaultProblemLayout, defaultCover } from './layout.js';

export const FORMAT_VERSION = 1;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function newProblem(partial = {}) {
  return { id: uid(), title: '', tags: [], difficulty: 0, body: '', solution: '', layout: defaultProblemLayout(), ...partial };
}

/** 表紙の既定値は layout.js（テーマの適用で使う）にある */
export { defaultCover };

export function defaultMeta() {
  return {
    title: '数学 演習プリント',
    subtitle: '',
    author: '',
    date: '',
    subject: 'math', // math | physics | chemistry
    answerMode: 'end', // none | after | end | separate
    columns: 1,
    spaceAfter: 0,
    fontSize: '11pt',
    showDifficulty: true,
    nameField: false,
    layout: defaultLayout(),
    cover: defaultCover(),
    preamble: '% 自分用の命令をここに定義できます（プレビューにも反映されます）\n\\newcommand{\\R}{\\mathbb{R}}\n',
  };
}

const SAMPLES = [
  {
    title: '二次方程式',
    tags: ['数I', '方程式'],
    difficulty: 1,
    body: '次の二次方程式を解け。\n\\[\n  x^2 - 5x + 6 = 0\n\\]\n',
    solution: '左辺を因数分解すると $(x-2)(x-3)=0$ となるから\n\\[\n  x = 2,\\ 3\n\\]\n',
  },
  {
    title: '定積分',
    tags: ['数III', '積分'],
    difficulty: 2,
    body: '次の定積分を計算せよ。\n\\begin{enumerate}[label=(\\arabic*)]\n  \\item $\\displaystyle \\int_0^1 x^2 \\, dx$\n  \\item $\\displaystyle \\int_0^{\\pi} \\sin x \\, dx$\n\\end{enumerate}\n',
    solution:
      '\\begin{enumerate}[label=(\\arabic*)]\n  \\item $\\displaystyle \\left[ \\frac{x^3}{3} \\right]_0^1 = \\frac{1}{3}$\n  \\item $\\displaystyle \\left[ -\\cos x \\right]_0^{\\pi} = 2$\n\\end{enumerate}\n',
  },
  {
    title: '逆行列',
    tags: ['行列'],
    difficulty: 2,
    body: '行列 $A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}$ の逆行列 $A^{-1}$ を求めよ。\n',
    solution:
      '$\\det A = 1 \\cdot 4 - 2 \\cdot 3 = -2 \\neq 0$ より\n\\begin{align*}\n  A^{-1} &= -\\frac{1}{2} \\begin{pmatrix} 4 & -2 \\\\ -3 & 1 \\end{pmatrix} \\\\\n         &= \\begin{pmatrix} -2 & 1 \\\\ \\frac{3}{2} & -\\frac{1}{2} \\end{pmatrix}\n\\end{align*}\n',
  },
];

export function newDocument(withSamples = false) {
  return {
    format: 'mathprob',
    version: FORMAT_VERSION,
    meta: defaultMeta(),
    problems: withSamples ? SAMPLES.map((s) => newProblem(structuredClone(s))) : [newProblem()],
  };
}

/** 読み込んだデータを検証し、足りない項目を補う */
export function normalizeDoc(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.problems)) {
    throw new Error('問題集ファイルの形式ではありません');
  }
  const meta = { ...defaultMeta(), ...(data.meta || {}) };
  meta.layout = normalizeLayout(meta.layout);
  meta.cover = { ...defaultCover(), ...(meta.cover || {}) };
  const seen = new Set();
  const problems = data.problems.map((p) => {
    const q = newProblem({
      title: String(p.title ?? ''),
      tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
      difficulty: Math.max(0, Math.min(5, Number(p.difficulty) || 0)),
      body: String(p.body ?? ''),
      solution: String(p.solution ?? ''),
      layout: { ...defaultProblemLayout(), ...(p.layout || {}) },
      points: p.points == null || p.points === '' ? null : Number(p.points),
    });
    if (p.id && !seen.has(p.id)) q.id = String(p.id);
    seen.add(q.id);
    return q;
  });
  return { format: 'mathprob', version: FORMAT_VERSION, meta, problems };
}
