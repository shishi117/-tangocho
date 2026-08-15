# 単語帳ツール

資格試験学習用のフラッシュカードWebアプリ。**ビルド無し・install不要**の素のES module構成。
ライブラリ（Firebase）はCDN（gstatic）から直接読み込む。

## いまここ（Slice 1 まで）

- Slice 0 ✅ 認証・セキュリティルール・オフライン永続化の疎通
- Slice 1 ✅ **CSV取り込み → 出題 → 成績更新** の縦貫通

サインイン後、上部タブで「取り込み」「学習」を切り替える。

### 使い方

1. **取り込み**タブ: 単語帳名を入れ、CSVを貼り付け（またはファイル選択）て「取り込む」。
   - CSV先頭行は列名: `term,meaning,example,explanation,partOfSpeech,tags,importance`
   - `term` のみ必須。`tags` は `;` 区切り。`importance` は1〜5（範囲外は3）。
   - 各項目256文字超過・`term`空はエラー行として除外し、件数と行番号を表示。
   - 同一単語帳内で `term` が重複するカードはスキップ（上書き/両方は Slice 3）。
2. **学習**タブ: 単語帳とセッション（20枚／単語帳一巡）を選び「開始」。
   表面→「裏面を見る」→「正解／不正解」。箱の重み（16:8:4:2:1）で出題順が決まり、
   回答ごとに正答率・箱がFirestoreに保存される。終了時にセッションの正答率を表示。

## セットアップ（install不要）

1. **Firebase側**: プロジェクト作成 → Authenticationで**Google**を有効化 → Firestoreを作成（本番モード）。
2. **設定**: `config.example.js` を `config.js` にコピーし設定値を記入
   （「プロジェクト設定 > マイアプリ」。これらは公開値でシークレットではない）。
3. **ルール**: `firestore.rules` の `<OWNER_UID>` を自分のUIDに置換し、
   コンソールの **Firestore > ルール** に貼り付けて公開（CLI不要）。
   UIDは初回サインイン後に Authentication 画面で確認。初回は仮のまま進めてよい。
4. **配信**: `file://` はCDN読込がブロックされるため、必ずhttpで配信する。
   `python -m http.server 5173` を実行し `http://localhost:5173/` を開く（他の静的サーバも可）。

**npm/yarn/bun の install は一切不要。**

## テスト（Nodeのみ・install不要）

```
node --test
```

`src/domain/` の純粋ロジックを検証（TR-1 抽選比収束・TR-3 CSV検証を含む）。追加パッケージ不要。
保守性要件の「間隔反復抽選・正答率算出・CSV正規化」の行カバレッジはこの層で満たす。

## デプロイ（任意）

- 静的ファイル一式なので、任意の静的ホスティングに置くだけで動く（Cloudflare Pages 等）。
- Firebase Hosting を使う場合のみ `firebase-tools` の導入が必要。不要なら他の静的ホストで代替。

## 構成

```
index.html            エントリ（module scriptを直読み）
config.example.js     Firebase設定の雛形 → config.js にコピー
firestore.rules       FR016 セキュリティルール（付録A＋設定ブロック）
firebase.json         Firebase Hosting用の任意設定
package.json          依存ゼロ。node --test 用スクリプトのみ
src/
  app.js              認証ゲート＋シェル＋取り込み/学習UI（素のDOM、ルーター無し）
  auth.js             FR016 Googleサインイン（popup）
  firebase.js         初期化＋オフライン永続化（CDN直import）
  decks.js            FR012 単語帳の一覧/find-or-create
  cards.js            FR005/009 取込(重複スキップ・バッチ分割)・成績更新
  styles.css          デザイントークン＋a11y（16px/コントラスト/フォーカス）
  domain/             純粋ロジック（テスト対象。フレームワーク非依存）
    card.js           FR001 accuracy / importance補正
    leitner.js        FR010 16:8:4:2:1 抽選 / box更新
    csv.js            FR005 CSVパース/正規化/検証
    __tests__/        leitner・csv の自己チェック
```

## 設計方針・割り切り

- **domain/** は外部import無しの純粋ロジック。node/ブラウザ両方で動き、テストはここだけ。
- Firestore SDKの**オフライン永続化**で、成績再送（FR009）と読み取り枠節約をSDKへ委譲。
  自前で足すのは「ローカル保持500件警告」の差分のみ（Slice 4）。
- UIはルーター無し・素のDOM。動的値は全て `escapeHtml`/`textContent` で入れXSSを防ぐ。
- 完全install不要を優先し ESLint/Prettier は外した（必要なら開発時のみ導入）。
- CSVパーサは `split(',')` ではなくRFC4180準拠の自前実装（引用符内カンマ・改行に対応）。

## ビルド順（縦スライス優先）

- **Slice 0** ✅ 基盤（認証・ルール・永続化）
- **Slice 1** ✅ 背骨: CSV取込 → 出題 → 成績更新
- **Slice 2** 統計: 正答率（カード/帳/テーマ・全期間/直近20）・習得率・連続学習日数
- **Slice 3** 管理系: プレビュー編集(FR006)・重複時動作選択・手動編集・検索絞込・帳/テーマ切替・D方式プロンプト
- **Slice 4** 堅牢化: 無料枠状態遷移(FR017)・500件警告・トークン失効保全・a11y仕上げ・テスト拡充
