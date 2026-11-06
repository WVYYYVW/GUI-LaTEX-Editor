# LaTeX 問題エディタ

数学の問題・解答を **GUI で LaTeX 入力**し、プリントや入試形式の PDF を作るデスクトップアプリです（Windows / macOS）。
Word の数式機能の「日本語で使いにくい」「AI が書いた式を打ち直す必要がある」といった不満を解消することを目標にしています。

## Word の数式機能の問題点と、このアプリでの改善

| Word で困ること | このアプリでは |
| --- | --- |
| 構造（分数・積分の型）を先に選ぶ入力方式で、式を変形しながら書くと手間が多い。`sin` の引数から抜けるのに矢印キーが必要、など操作に癖がある | LaTeX のソースを直接書ける（数式部分は色付きで表示）。記号パレットからの挿入、MathLive による見たままの数式入力（`/` で分数、`^` で上付き、Tab で次の枠）も使える |
| 日本語入力（IME）が ON のまま打つと `ｘ＋１` のように全角になり、数式として崩れる | 数式の中の全角英数字は自動で半角に直る（`\text{…}` の中の日本語はそのまま） |
| 数式フォントは Cambria Math 固定に近く、本文（明朝）と数式の書体がそろわない。番号付き数式・`=` 揃えが難しい | LuaLaTeX（`ltjsarticle`）で組版するので、日本語と数式の書体がそろう。`align*` などで `=` 揃えもできる |
| Claude などの AI が書いた数式は、Word では手で打ち直すしかない（LaTeX を貼るにはモード切替が必要、MathML はテキストになることがある） | **「AI の回答を貼り付け」**：Claude の回答（表示されたものをコピーしても、Markdown でコピーしても可）を、数式・箇条書き・表ごと LaTeX に変換して取り込む |
| 問題と解答の管理、プリントの体裁作りは手作業 | 問題一覧（タグ・難易度・検索・並べ替え）、解答の出力位置の切り替え、テーマによる体裁の一括切り替え |
| Mac 版と Windows 版で挙動の違いや不具合がある | Electron 製で、Windows / macOS とも同じ画面と同じ出力 |

参考: [Word で数式をきれいに記述するには（NIMS）](https://mdr.nims.go.jp/datasets/937a1789-3549-4164-ab82-83caff1ff3b2.md)、[マイナビ「Wordで数式を入力する」](https://news.mynavi.jp/techplus/article/Wordomoidori-44/)、[Microsoft Q&A: web から数式を貼る](https://learn.microsoft.com/en-us/answers/questions/5452270/how-to-import-equations-from-a-web-source-into-wor)、[Word for Mac の数式エディタ既知の問題](https://support.microsoft.com/ko-KR/Support/known-issues/equation-editor-may-not-open-or-convert-expressions-as-expected-in-word-for-mac)

## 主な機能

- **問題一覧**：追加・複製・削除・ドラッグで並べ替え、タグ・難易度（★）、検索
- **エディタ**：LaTeX ソース（シンタックスハイライト、数式部分を色付け）、記号パレット（分数・積分・行列・場合分け・小問・TikZ グラフなど）
- **数式エディタ**（Ctrl/⌘+E）：見たまま入力。カーソル位置の数式、またはプレビューで数式をダブルクリックすると、その式を編集できる
- **ライブプレビュー**：KaTeX で即時表示。「プリント全体」は用紙サイズどおりに表示する
- **AI の回答を貼り付け**（Ctrl/⌘+Shift+V）
  - claude.ai などで表示された回答をそのまま選択してコピー → KaTeX の注釈から元の LaTeX を復元
  - 「コピー」ボタンで得た Markdown（`$…$`, `$$…$$`, `\(…\)`, `\[…\]`, **太字**, 箇条書き, 表）→ LaTeX
  - `x² + √2 ≤ π` のような Unicode の式も `$x^{2} + \sqrt{2} \leq \pi$` に変換
  - 変換結果をその場で確認・修正してから、カーソル位置／問題文／解答／新しい問題に取り込める
- **Word 用にコピー**（Ctrl/⌘+Shift+C、またはプレビューの数式を右クリック）：MathML としてコピーし、Word に貼ると編集できる数式オブジェクトになる
- **レイアウト / テーマ**
  - 大問見出し：`問題 1`・`1`・□枠囲み・■白抜き・○丸囲み・〔1〕・[1]・第1問・I/II、書体（ゴシック/明朝）、大きさ、色、位置（本文の上／左にぶら下げ）
  - 余白：大問の前、見出しの後、本文の字下げ、解答スペース（プレビューの「⇕」をドラッグして問題ごとに調整可）
  - 大問を枠で囲む、区切り線、大問ごとに改ページ、小問番号の既定（(1)/1./(i)/(a)/(ア)）
  - 用紙：A4/B4/A3、縦/横、1段/2段、余白、行間、ページ上部の文字、ページ番号の形式
  - 問題ごとの上書き：前で改ページ、枠、解答スペース
  - テーマ：汎用テーマ、大学入試の体裁テーマ、自分で保存したテーマ
- **PDF 作成**（Ctrl/⌘+Shift+B）：LuaLaTeX で組版。エラーは「問題 3（解答）2 行目」のように場所を示し、クリックで該当行へ移動
- **簡易 PDF**：TeX がなくてもプレビューを PDF として保存
- **.tex 書き出し**：そのまま他の環境でもコンパイルできる LaTeX ファイル

## 必要なもの

- Node.js 20 以上（開発時）
- PDF 作成には LuaLaTeX（Windows: [TeX Live](https://www.tug.org/texlive/)、macOS: [MacTeX](https://www.tug.org/mactex/)）。場所は自動で探す（設定で指定も可）。`enumitem` が入っていない環境でも動くようにしてある

## 開発

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

## インストーラーの作成

```bash
npm run dist:win
```

```bash
npm run dist:mac
```

macOS 版は Mac 上でビルドする必要があります。`v` で始まるタグを push すると、GitHub Actions（`.github/workflows/build.yml`）が Windows / macOS 両方のインストーラーを作ります（コード署名はしていないため、初回起動時に OS の警告が出ます）。

## ファイル形式

問題集は `.mathprob`（JSON）で保存します。問題文・解答は LaTeX のテキスト、レイアウトは `meta.layout`、問題ごとの配置は `problems[].layout` に入ります。

## 構成

```
electron/        メインプロセス（ファイル保存、PDF 作成、クリップボード）
src/renderer/    画面
  lib/mathRanges.js    数式範囲の検出、全角→半角
  lib/preview.js       LaTeX → HTML プレビュー
  lib/texExport.js     LaTeX 文書の生成、エラー行の逆引き
  lib/layout.js        レイアウト・テーマ（HTML / LaTeX の両方を生成）
  lib/universityThemes.js  大学入試の体裁テーマ
  lib/smartPaste.js    AI の回答 → LaTeX
  lib/wordExport.js    LaTeX → MathML（Word 用）
  layoutPanel.js       レイアウト画面とプレビュー上の直接操作
test/            単体テスト
```
