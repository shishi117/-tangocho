# 単語帳ツール

資格試験学習用のフラッシュカードWebアプリ。React + TypeScript + Vite + Firebase。

## いまここ（Slice 0）

到達点は「Googleサインインすると空のアプリシェルが出る」。最もリスクの高い統合
（認証・セキュリティルール・オフライン永続化）を先に端から端まで通してある。

## セットアップ

1. `npm install`
2. Firebaseコンソールでプロジェクト作成 → Authentication で **Google** を有効化
   → Firestore を作成（本番モード）。
3. `.env.example` を `.env` にコピーし、Firebase設定値を記入。
4. `firestore.rules` の `<OWNER_UID>` を自分のUIDに置換。
   （UIDは初回サインイン後、Authentication画面またはブラウザのコンソールで確認）
5. ルールをデプロイ: `firebase deploy --only firestore:rules`
6. `npm run dev` で起動。

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバ |
| `npm run build` | 型チェック＋本番ビルド（`dist/`） |
| `npm test` | Vitest（domain層の自己チェック） |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## 設計方針

- **domain/** … フレームワーク非依存の純粋ロジック。ここだけがテスト対象（80%カバレッジ要件）。
- **data/** … Firestore境界の薄いラッパ。オフライン永続化ONで、成績再送（FR009）と
  読み取り枠節約はSDKに委譲する。自前は「ローカル保持500件警告」の差分のみ（後続スライス）。
- **ui/** … Reactコンポーネント。ルーターは入れず `view` state で切替。

## ビルド順（縦スライス優先）

- **Slice 0** ✅ 基盤（認証・ルール・永続化）
- **Slice 1** 背骨: CSV取込 → 出題 → 成績更新（取込→出題→成績を貫通）
- **Slice 2** 統計: 正答率・習得率・連続日数
- **Slice 3** 管理系: プレビュー編集・手動編集・検索絞込・帳切替・D方式プロンプト
- **Slice 4** 堅牢化: 無料枠状態遷移・500件警告・a11y仕上げ・テスト拡充
