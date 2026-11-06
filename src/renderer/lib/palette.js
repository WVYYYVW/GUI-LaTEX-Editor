// 記号パレット。‸ は挿入後のカーソル位置（選択中の文字があればそこに入る）。
// kind: 'math' は数式の外で押すと自動で $…$ に包む。'text' はそのまま挿入。
// label はボタンに KaTeX で表示する LaTeX、text はボタンに文字で表示する場合。

const m = (label, insert = label, title) => ({ kind: 'math', label, insert, title });
const t = (text, insert, title) => ({ kind: 'text', text, insert, title });

export const PALETTE = [
  {
    name: '基本',
    items: [
      m('\\frac{a}{b}', '\\frac{‸}{}', '分数'),
      m('\\dfrac{a}{b}', '\\dfrac{‸}{}', '分数（大）'),
      m('\\sqrt{x}', '\\sqrt{‸}', '平方根'),
      m('\\sqrt[n]{x}', '\\sqrt[‸]{}', 'n 乗根'),
      m('x^{n}', '^{‸}', '上付き'),
      m('x_{n}', '_{‸}', '下付き'),
      m('x_{i}^{n}', '_{‸}^{}', '上下付き'),
      m('|x|', '\\left|‸\\right|', '絶対値'),
      m('\\left( x \\right)', '\\left(‸\\right)', '伸びる括弧'),
      m('\\left\\{ x \\right\\}', '\\left\\{‸\\right\\}', '波括弧'),
      m('\\overline{AB}', '\\overline{‸}', '上線（線分）'),
      m('\\vec{a}', '\\vec{‸}', 'ベクトル'),
      m('\\overrightarrow{AB}', '\\overrightarrow{‸}', 'ベクトル（矢印）'),
      m('\\hat{x}', '\\hat{‸}'),
      m('\\dot{x}', '\\dot{‸}'),
      m('\\bar{z}', '\\bar{‸}', '共役'),
      m('\\binom{n}{k}', '\\binom{‸}{}', '二項係数'),
      m('{}_{n}\\mathrm{C}_{r}', '{}_{‸}\\mathrm{C}_{}', '組合せ nCr'),
      m('{}_{n}\\mathrm{P}_{r}', '{}_{‸}\\mathrm{P}_{}', '順列 nPr'),
      m('n!', '!'),
      m('\\pm'), m('\\mp'), m('\\times'), m('\\div'), m('\\cdot'),
      m('\\cdots'), m('\\ldots'), m('\\infty'),
    ],
  },
  {
    name: '関数・微積',
    items: [
      m('\\sin'), m('\\cos'), m('\\tan'),
      m('\\sin^{2}\\theta', '\\sin^{2}\\theta'),
      m('\\log_{a} x', '\\log_{‸}'), m('\\log'), m('\\ln'), m('e^{x}', 'e^{‸}'),
      m('\\lim_{x \\to a}', '\\lim_{x \\to ‸}', '極限'),
      m('\\lim_{n \\to \\infty}', '\\lim_{n \\to \\infty}', '極限 n→∞'),
      m("f'(x)", "f'(‸)", '導関数'),
      m('\\frac{dy}{dx}', '\\frac{dy}{dx}'),
      m('\\frac{d}{dx}', '\\frac{d}{dx}'),
      m('\\frac{\\partial f}{\\partial x}', '\\frac{\\partial ‸}{\\partial }'),
      m('\\int', '\\int ‸ \\, dx', '不定積分'),
      m('\\int_{a}^{b}', '\\int_{‸}^{} \\, dx', '定積分'),
      m('\\left[ F(x) \\right]_{a}^{b}', '\\left[ ‸ \\right]_{}^{}', '定積分の計算'),
      m('\\iint'), m('\\oint'),
      m('\\sum_{k=1}^{n}', '\\sum_{k=1}^{‸}', '総和'),
      m('\\prod_{k=1}^{n}', '\\prod_{k=1}^{‸}', '総乗'),
      m('\\partial'), m('\\nabla'),
      m('\\max'), m('\\min'),
    ],
  },
  {
    name: '関係・論理',
    items: [
      m('='), m('\\neq'), m('<'), m('>'), m('\\leq'), m('\\geq'), m('\\leqq'), m('\\geqq'),
      m('\\fallingdotseq', '\\fallingdotseq', 'ほぼ等しい（日本式）'),
      m('\\approx'), m('\\equiv'), m('\\sim'), m('\\simeq'), m('\\cong', '\\cong', '合同'), m('\\propto'),
      m('\\parallel'), m('\\perp'), m('\\angle'), m('\\triangle'), m('^{\\circ}', '^{\\circ}', '度'),
      m('\\therefore'), m('\\because'),
      m('\\in'), m('\\notin'), m('\\subset'), m('\\subseteq'), m('\\supset'), m('\\cup'), m('\\cap'),
      m('\\emptyset'), m('\\varnothing'), m('\\setminus'),
      m('\\overline{A}', '\\overline{‸}', '補集合'),
      m('\\{\\, x \\mid \\,\\}', '\\{\\, ‸ \\mid  \\,\\}', '集合の内包表記'),
      m('\\forall'), m('\\exists'), m('\\neg'), m('\\land'), m('\\lor'),
      m('\\Rightarrow'), m('\\Leftarrow'), m('\\Leftrightarrow'), m('\\iff'),
      m('\\to'), m('\\mapsto'), m('\\leftarrow'), m('\\leftrightarrow'), m('\\longrightarrow'),
      m('\\mathbb{R}'), m('\\mathbb{N}'), m('\\mathbb{Z}'), m('\\mathbb{Q}'), m('\\mathbb{C}'),
    ],
  },
  {
    name: 'ギリシャ文字',
    items: [
      'alpha', 'beta', 'gamma', 'delta', 'varepsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu',
      'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'varphi', 'chi', 'psi', 'omega',
      'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega',
    ].map((g) => m(`\\${g}`)),
  },
  {
    name: '行列・場合分け',
    items: [
      m('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', '\\begin{pmatrix} ‸ &  \\\\  &  \\end{pmatrix}', '2×2 行列'),
      m(
        '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}',
        '\\begin{pmatrix} ‸ &  &  \\\\  &  &  \\\\  &  &  \\end{pmatrix}',
        '3×3 行列'
      ),
      m('\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}', '\\begin{vmatrix} ‸ &  \\\\  &  \\end{vmatrix}', '行列式'),
      m('\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', '\\begin{bmatrix} ‸ &  \\\\  &  \\end{bmatrix}'),
      m('\\begin{pmatrix} x \\\\ y \\end{pmatrix}', '\\begin{pmatrix} ‸ \\\\  \\end{pmatrix}', '列ベクトル'),
      m(
        'f(x)=\\begin{cases} a & (x \\geq 0) \\\\ b & (x < 0) \\end{cases}',
        '\\begin{cases} ‸ & () \\\\  & () \\end{cases}',
        '場合分け'
      ),
      m(
        '\\left\\{ \\begin{aligned} x+y&=1 \\\\ x-y&=3 \\end{aligned} \\right.',
        '\\left\\{ \\begin{aligned} ‸ &=  \\\\  &=  \\end{aligned} \\right.',
        '連立方程式'
      ),
      m('\\begin{aligned} a &= b \\\\ &= c \\end{aligned}', '\\begin{aligned}\n  ‸ &= \\\\\n    &= \n\\end{aligned}', '式変形（= 揃え）'),
    ],
  },
  {
    name: '文書・環境',
    items: [
      t('$…$ 数式', '$‸$', '文中の数式'),
      t('\\[…\\] 別行立て', '\\[\n  ‸\n\\]', '独立した行の数式'),
      t('align* 式変形', '\\begin{align*}\n  ‸ &= \\\\\n    &= \n\\end{align*}', '= で揃える複数行の式'),
      t('(1)(2) 小問', '\\begin{enumerate}[label=(\\arabic*)]\n  \\item ‸\n  \\item \n\\end{enumerate}', '小問 (1)(2)…'),
      t('(a)(b) 小問', '\\begin{enumerate}[label=(\\alph*)]\n  \\item ‸\n  \\item \n\\end{enumerate}'),
      t('・箇条書き', '\\begin{itemize}\n  \\item ‸\n\\end{itemize}'),
      t('太字', '\\textbf{‸}'),
      t('下線', '\\underline{‸}'),
      t('改行', '\\\\\n'),
      t('空白（縦）', '\\vspace{‸10mm}\n', '解答スペースなど'),
      t('中央揃え', '\\begin{center}\n  ‸\n\\end{center}'),
      t('枠囲み', '\\fbox{‸}'),
      t('表', '\\begin{tabular}{|c|c|c|}\n  \\hline\n  ‸ &  &  \\\\ \\hline\n   &  &  \\\\ \\hline\n\\end{tabular}'),
      t('図（画像）', '\\begin{center}\n  \\includegraphics[width=0.5\\linewidth]{‸}\n\\end{center}', '問題集ファイルと同じフォルダの画像'),
      t(
        'グラフ（TikZ）',
        '\\begin{center}\n\\begin{tikzpicture}[scale=0.8]\n  \\draw[->] (-3,0) -- (3,0) node[right] {$x$};\n  \\draw[->] (0,-1) -- (0,5) node[above] {$y$};\n  \\node[below left] at (0,0) {O};\n  \\draw[thick, domain=-2:2, smooth] plot (\\x, {\\x*\\x});‸\n\\end{tikzpicture}\n\\end{center}',
        '放物線の例'
      ),
    ],
  },
];
