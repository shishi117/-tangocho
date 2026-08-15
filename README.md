# 単語帳ツール

資格試験学習用のフラッシュカードWebアプリ。**ビルド無し・install不要**の素のES module構成。
ライブラリ（Firebase）はCDN（gstatic）から直接読み込む。

## いまここ（Slice 0）

到達点は「Googleサインインすると空のアプリシェルが出る」。最もリスクの高い統合
（認証・セキュリティルール・オフライン永続化）を先に端から端まで通してある。

## セットアップ（install不要）

1. **Firebase側の用意**
   - Firebaseコンソールでプロジェクトを作成。
   - Authentication で **Google** サインインを有効化。
   - Firestore データベースを作成（本番モード）。
2. **設定を書く**
   - `config.example.js` を `config.js` にコピーし、Firebaseの設定値を記入する。
     （設定値は「プロジェクト設定 > マイアプリ」で確認。これらは公開値でシークレットではない）
3. **セキュリティルールを反映**
   - `firestore.rules` の `<OWNER_UID>` を自分のUIDに置換。
     UIDは手順5で初回サインイン後、Authenticationの画面かブラウザのコンソール
     （`console.log(firebase.auth().currentUser)` 相当）で確認できる。初回は仮のまま進めてよい。
   - コンソールの **Firestore > ルール** タブに `firestore.rules` の内容を貼り付けて「公開」。
     （CLIのinstallは不要。GUIで貼り付けるだけ）
4. **静的サーバで開く**（`file://` ではCDN読込がブロックされるため、必ずhttpで配信する）
   - Pythonがあれば: `python -m http.server 5173` を実行し、`http://localhost:5173/` を開く。
   - 他の静的サーバでも可（VS Code の Live Server 等）。
5. 初回サインイン → UIDを控えて手順3の `<OWNER_UID>` を確定 → ルール再公開。

これで「サインイン → 空のシェル」まで到達する。**npm/yarn/bun の install は一切不要。**

## テスト（Nodeのみ・install不要）

```
node --test
```

Node 標準のテストランナーで `src/domain/` の純粋ロジックを検証する（TR-1 の抽選比収束を含む）。
追加パッケージ不要。80%カバレッジ要件はこの `domain/` に対して満たす。

## デプロイ（任意）

- 静的ファイル一式なので、任意の静的ホスティングに置くだけで動く（Cloudflare Pages 等）。
- Firebase Hosting を使う場合のみ `firebase-tools` の導入が必要（`firebase deploy`）。
  この一点だけは install が要るため、不要なら他の静的ホストで代替する。

## 構成

```
index.html            エントリ（module scriptを直読み）
config.example.js     Firebase設定の雛形 → config.js にコピーして記入
firestore.rules       FR016 セキュリティルール（付録A＋設定ブロック）
firebase.json         Firebase Hosting用の任意設定
package.json          依存ゼロ。node --test 用スクリプトのみ
src/
  app.js              Slice 0 認証ゲート（素のDOM操作、ルーター無し）
  auth.js             FR016 Googleサインイン（popup）
  firebase.js         初期化＋オフライン永続化（CDN直import）
  styles.css          デザイントークン＋a11y（16px/コントラスト/フォーカス）
  domain/             純粋ロジック（テスト対象。フレームワーク非依存）
    card.js           FR001 accuracy / importance補正
    leitner.js        FR010 16:8:4:2:1 抽選 / box更新
    __tests__/leitner.test.js
```

## 設計方針

- **domain/** … 外部import無しの純粋ロジック。node/ブラウザ両方で動く。テストはここだけ。
- Firestore SDKの**オフライン永続化**をONにし、成績再送（FR009）と読み取り枠節約はSDKへ委譲。
  自前で足すのは「ローカル保持500件警告」の差分のみ（後続スライス）。
- UIは素のDOM操作。ルーターは入れず、画面追加は `app.js` の描画関数を増やす方針。
  描画が繰り返しになってきたら小さな `h()` ヘルパを足す（アップグレードパス）。
- **意図的な割り切り**: 完全install不要を優先し、ESLint/Prettier は外した。
  整形が必要なら開発時のみ別途導入する。

## ビルド順（縦スライス優先）

- **Slice 0** ✅ 基盤（認証・ルール・永続化）
- **Slice 1** 背骨: CSV取込 → 出題 → 成績更新
- **Slice 2** 統計: 正答率・習得率・連続日数
- **Slice 3** 管理系: プレビュー編集・手動編集・検索絞込・帳切替・D方式プロンプト
- **Slice 4** 堅牢化: 無料枠状態遷移・500件警告・a11y仕上げ・テスト拡充
