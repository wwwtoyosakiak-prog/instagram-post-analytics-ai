# Instagram投稿分析AIツール

Instagram公式APIを使わず、ユーザーが手入力またはCSVで登録した投稿データを保存し、アカウント別の一覧・グラフ・AI改善提案・月次レポートを確認するWebアプリです。

## まず読むファイル

サーバーの詳しい起動手順は、同じフォルダ内の `サーバー起動手順.md` を確認してください。

サイトを公開する場合は、同じフォルダ内の `公開手順.md` を確認してください。

## 技術構成

- Next.js
- TypeScript
- Tailwind CSS
- Recharts
- OpenAI API
- Next.js API Route
- Supabase保存
- localStorage保存フォールバック

## 起動方法

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## OpenAI APIキー設定

`.env.local.example` をコピーして `.env.local` を作成します。

```bash
cp .env.local.example .env.local
```

`.env.local` にAPIキーを設定します。

```env
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-4.1-mini
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

APIキーはサーバー側のAPI Routeだけで使用します。フロントエンドには書きません。

APIキーがない場合でも、投稿詳細ページの「サンプル分析」とレポートページの「サンプル総評」で動作確認できます。

APIキーを設定した後は、設定ページの「OpenAI API接続をテスト」で連携状態を確認できます。

## Supabaseでサーバー保存する方法

Supabaseを設定すると、アカウントと投稿データをサーバー側のPostgreSQLに保存できます。未設定の場合は、これまで通りブラウザのlocalStorageで動作します。

### 1. Supabaseでテーブルを作成

SupabaseのSQL Editorで以下のファイルの内容を実行します。

```text
supabase/schema.sql
```

このSQLで作成する主なテーブル:

- `instagram_accounts`
- `instagram_posts`
- `instagram_post_analyses`
- `instagram_monthly_reports`

すでに過去版のSQLを実行済みで、AI分析履歴テーブルだけ追加したい場合は、以下のファイルをSQL Editorで実行します。

```text
supabase/add-analysis-history.sql
```

月次レポート保存テーブルだけ追加したい場合は、以下のファイルをSQL Editorで実行します。

```text
supabase/add-monthly-reports.sql
```

### 2. Vercelに環境変数を追加

VercelのProject SettingsからEnvironment Variablesを開き、以下を追加します。

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`SUPABASE_SERVICE_ROLE_KEY` はサーバー側だけで使います。ブラウザには表示されません。GitHubや画面上に公開しないでください。

### 3. 再デプロイ

環境変数を追加したら、Vercelで再デプロイします。

### 4. 保存状態を確認

設定ページの「サーバー保存状態を確認」を押します。

- サーバー保存は有効です: Supabase保存
- サーバー保存は未設定です: localStorage保存

### 5. 既存データを移行

すでにブラウザ内に登録済みデータがある場合は、設定ページの「ブラウザ内データをサーバーへ移行」を押します。

## データのバックアップ

設定ページの「データ管理」から、登録済みアカウントと投稿データをJSONで書き出し・復元できます。localStorage運用中は、運用前後に定期的にバックアップしてください。

## 将来のAPI・データベース連携

現在の登録データは、Supabase設定済みの場合はサーバー側、未設定の場合はブラウザのlocalStorageに保存します。将来的に外部APIや別データベースへ移行する場合は、`lib/cloud-storage.ts` と `lib/supabase-admin.ts` を差し替えます。差し替え時の契約は `lib/data-repository.ts` に型として整理しています。

想定する移行先:

- Supabase
- PostgreSQL
- MySQL
- 自社API
- 広告・SNS分析API

移行時にサーバー側へ保存したい主なデータ:

- アカウント情報
- 投稿データ
- 投稿画像スクショの保存先URL
- AI分析結果
- 月次レポート結果
- APIから取得した詳細インサイト

API連携後に追加しやすい分析:

- 期間比較
- 投稿タイプ別の伸び率
- フォロワー増減との関係
- リーチ、プロフィールアクセス、リンククリックなどの詳細指標
- AI分析結果の履歴保存

## スクショから自動入力

投稿登録ページで投稿画像スクショをアップロードし、「スクショから自動入力」を押すと、OpenAI APIが画像内のキャプションや数値を読み取り、フォームへ反映します。

この機能もInstagram APIは使いません。画像に見えている情報だけを読み取るため、スクショに表示されていない保存数、シェア数、表示数などは自動入力できない場合があります。登録前に必ず内容を確認してください。

## CSV形式

投稿登録ページからCSVを取り込めます。1行目は以下の列名にしてください。

```csv
accountUsername,date,recordedDate,url,caption,hashtags,type,mediaCount,likes,comments,saves,shares,views,memo
ozops_outdoor,2026-05-01,2026-05-02,https://www.instagram.com/p/example/,"軽量焚き火ギアの紹介","#アウトドアギア #キャンプ道具",reel,1,438,28,96,42,12800,"動画冒頭で使用シーンを見せた"
```

`accountUsername` は登録済みアカウントのユーザー名と一致すると投稿に紐づきます。`type` は `image`、`video`、`reel`、`carousel` のいずれかです。画像スクショはCSVでは取り込まず、フォームから登録します。

## 登録できるアカウントデータ

- アカウント名
- ユーザー名
- プロフィールURL
- 業種
- ターゲット
- 運用目的
- メモ

## 登録できる投稿データ

- 対象アカウント
- 投稿日
- データ登録日
- 投稿URL
- 投稿コメント
- ハッシュタグ
- 投稿タイプ: 画像、動画、リール、カルーセル
- 投稿画像・動画の枚数
- いいね数
- コメント数
- 保存数
- シェア数
- 表示数 / views
- メモ
- 投稿画像スクショ

## 自動計算

- エンゲージメント数 = いいね数 + コメント数 + 保存数 + シェア数
- エンゲージメント率 = エンゲージメント数 / 表示数 * 100
- 保存率 = 保存数 / 表示数 * 100
- コメント率 = コメント数 / 表示数 * 100

## 画面

- トップページ
- アカウント登録ページ
- 投稿登録ページ
- 投稿一覧ページ
- 投稿詳細・AI分析ページ
- ダッシュボードページ
- レポートページ
- 設定ページ

## サンプルデータ

アカウント登録ページの「サンプルアカウントを追加」、または投稿登録ページの「サンプル10件を追加」から、OZOPSのようなアウトドアブランドを想定したダミーデータを追加できます。

## 今後の拡張案

- Supabase Authを追加し、ユーザーごとにデータを分離する
- ユーザー認証を追加し、ブランド別・担当者別にデータを分離する
- CSVエクスポートとPDFレポート出力を追加する
- 投稿タグ、キャンペーン、商品カテゴリを追加して分析軸を増やす
- AI分析結果を保存し、改善前後の比較をできるようにする
- 投稿予約や制作メモなど、運用管理機能を追加する
