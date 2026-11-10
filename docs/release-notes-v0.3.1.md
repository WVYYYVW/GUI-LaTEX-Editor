## LaTeX 問題エディタ v0.3.1

PDF 作成で TeX にパッケージが足りないときに、何が足りないかと入れ方を表示するようにしました。

### ダウンロード
- **Windows**：`LaTeX Problem Editor Setup 0.3.1.exe`（インストーラー）
- **macOS（Apple シリコン / M1 以降）**：`LaTeX Problem Editor-0.3.1-mac-arm64.dmg`（または `.zip`）
- **macOS（Intel）**：`LaTeX Problem Editor-0.3.1-mac-x64.dmg`（または `.zip`）

macOS で初めて開くときは、アプリを右クリック →「開く」（開けないときは「システム設定」→「プライバシーとセキュリティ」→「このまま開く」）。「壊れているため開けません」と出るときは、ターミナルで `xattr -dr com.apple.quarantine "/Applications/LaTeX Problem Editor.app"` を実行してください。

### 変更点
- ``File `ltjsarticle.cls' not found`` のように TeX にパッケージが入っていないと、エラーの欄に「TeX に「ltjsarticle.cls」がありません。日本語を組むための luatexja が入っていない TeX です」と出し、入れ方を表示する
  - TeX Live（Mac の BasicTeX を含む）：`tlmgr update --self` と、日本語・作図などアプリに必要なものをまとめて入れる `tlmgr install collection-langjapanese collection-latexrecommended collection-pictures`（Mac では `sudo` 付き）
  - MiKTeX：足りないパッケージを自動で入れる設定の仕方
  - Linux：`apt` のコマンド
  - コマンドは「コピー」ボタンでコピーできる

### Mac で「ltjsarticle.cls が見つからない」と出ていた場合
BasicTeX には日本語の部品（luatexja）が入っていません。ターミナルで次の 2 行を順に実行してから、もう一度「PDF作成」を押してください（容量に余裕があれば、BasicTeX の代わりに MacTeX を入れても直ります）。

```
sudo tlmgr update --self
sudo tlmgr install collection-langjapanese collection-latexrecommended collection-pictures
```
