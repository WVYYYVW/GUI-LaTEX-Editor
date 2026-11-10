# コード署名の手順

GitHub のリポジトリに証明書などを「Secrets」として登録すると、タグを push したときのビルド（`.github/workflows/build.yml`）で自動的に署名します。登録していない間は、これまでどおり署名なし（macOS はアドホック署名）で作ります。

Secrets の登録場所: GitHub のリポジトリ → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**。名前は下の表のとおりに付けてください。値は一度登録すると見られなくなり、ビルドのログにも出ません。

---

## macOS（Developer ID ＋ 公証）

署名と公証をすると、「開発元を確認できません」「壊れているため開けません」と出なくなり、ダブルクリックで開けるようになります。

### 1. Apple Developer Program に登録する
- https://developer.apple.com/programs/ から個人として登録（年額 99 米ドル。日本では 12,980 円）。2 ファクタ認証を有効にした Apple ID が必要です。
- 登録後、https://developer.apple.com/account の「メンバーシップの詳細」に出る **チーム ID**（英数字 10 文字）を控えます。

### 2. 「Developer ID Application」証明書を作って .p12 に書き出す（Mac で行う）
1. Xcode を開き、**設定** → **Accounts** で Apple ID を追加 → **Manage Certificates…** → 左下の **＋** → **Developer ID Application**
2. 「キーチェーンアクセス」を開き、「ログイン」→「自分の証明書」にできた **Developer ID Application: （名前）(チーム ID)** を右クリック → **書き出す** → ファイル形式「個人情報交換 (.p12)」で保存。このとき付けるパスワードを控えます。
3. ターミナルで .p12 を文字列にしてクリップボードに入れます:
   ```bash
   base64 -i ~/Desktop/DeveloperID.p12 | pbcopy
   ```

### 3. 公証用の「App 用パスワード」を作る
https://account.apple.com → **サインインとセキュリティ** → **App 用パスワード** で作成（例: 名前「LaTeX Problem Editor 公証」）。

### 4. Secrets に登録する

| 名前 | 値 |
| --- | --- |
| `CSC_LINK` | 手順 2-3 でコピーした .p12 の文字列 |
| `CSC_KEY_PASSWORD` | .p12 を書き出したときのパスワード |
| `APPLE_ID` | Apple ID のメールアドレス |
| `APPLE_APP_SPECIFIC_PASSWORD` | 手順 3 の App 用パスワード |
| `APPLE_TEAM_ID` | 手順 1 のチーム ID |

`CSC_LINK` と `CSC_KEY_PASSWORD` だけでも署名はされますが、公証が無いと macOS の警告は消えません。5 つとも登録してください。公証は Apple 側の処理に数分〜十数分かかります。

---

## Windows（SSL.com eSigner）

署名すると、インストーラーのプロパティに発行元（あなたの名前）が表示され、「Windows によって PC が保護されました」の警告が出にくくなります。ただし SmartScreen の警告は、署名した直後は出ることがあり、ダウンロード数が増えて「評判」がたまると出なくなります。

いまは証明書を USB トークンかクラウドで保管する決まりになっていて、証明書ファイルを GitHub に置くことはできません。そこで、GitHub Actions から使えるクラウド署名の **SSL.com eSigner** を使います（Microsoft の Artifact Signing は、個人は米国・カナダのみが対象のため使えません）。

### 1. 証明書を買う
- https://www.ssl.com/ で **Code Signing Certificate**（個人なら Individual Validation の OV）を購入。注文時に **eSigner**（クラウド署名）での発行を選びます。
- 本人確認（身分証明書の提出など）を済ませると発行されます。
- 証明書の料金のほかに、eSigner の署名回数に応じた月額プランが必要です。リリース 1 回で 2 回署名します（アプリ本体とインストーラー）。最新の価格は SSL.com で確認してください。

### 2. 自動で署名するための情報を控える
- SSL.com のアカウントの **ユーザー名** と **パスワード**
- **TOTP シークレット**: 証明書の注文ページで eSigner の 2 段階認証を設定するときに、QR コードと一緒に表示される文字列（「Automate eSigner」「OTP App」の説明を参照）。認証アプリの QR コードを読むときにだけ表示されることがあるので、その場で控えてください。
- **Credential ID**: 注文ページの eSigner の欄に表示される ID（証明書が 1 つだけなら省略可）

### 3. Secrets に登録する

| 名前 | 値 |
| --- | --- |
| `ES_USERNAME` | SSL.com のユーザー名 |
| `ES_PASSWORD` | SSL.com のパスワード |
| `ES_TOTP_SECRET` | TOTP シークレット |
| `ES_CREDENTIAL_ID` | Credential ID（省略可） |

---

## 登録したあと

次のバージョンのタグ（例: `v0.3.2`）を push すると、署名したインストーラーが Release に付きます。GitHub の **Actions** でそのビルドを開き、「署名の確認」の手順が成功していれば署名できています。

- Windows: インストーラーを右クリック → **プロパティ** → **デジタル署名** に名前が出ていれば OK
- macOS: dmg からアプリを入れ、ダブルクリックで警告なしに開ければ OK（ターミナルで `spctl --assess --verbose "/Applications/LaTeX Problem Editor.app"` と打つと `accepted` `source=Notarized Developer ID` と出ます）

署名をやめるときは、Secrets を削除すれば元の（署名なしの）ビルドに戻ります。
