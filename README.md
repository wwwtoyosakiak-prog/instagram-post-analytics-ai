# Instagram投稿分析AIツール

ユーザーが手入力またはCSVで登録した投稿データを保存し、アカウント別の一覧・グラフ・AI改善提案・月次レポートを確認するWebアプリです。必要に応じてInstagram Graph APIからInstagramビジネスアカウントの投稿データを取得する画面も利用できます。

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
OPENAI_API_KEY_OZOPS=sk-account-specific-key
INSTAGRAM_GRAPH_ACCESS_TOKEN=your-instagram-graph-api-token
INSTAGRAM_GRAPH_API_MODE=instagram_login
INSTAGRAM_BUSINESS_ACCOUNT_ID=your-instagram-business-account-id
INSTAGRAM_GRAPH_API_VERSION=v23.0
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

APIキーはサーバー側のAPI Routeだけで使用します。フロントエンドには書きません。

APIキーがない場合でも、投稿詳細ページの「サンプル分析」とレポートページの「サンプル総評」で動作確認できます。

APIキーを設定した後は、設定ページの「OpenAI API接続をテスト」で連携状態を確認できます。

レポートページの「カテゴリ別AIレポートを作成」では、カテゴリごとの表示数、保存率、エンゲージメント率、AIスコアをもとに、テーマ別の強み・課題・次の方針を作成できます。APIキーがない場合は「サンプルカテゴリレポート」で画面確認できます。

## Instagram Graph API設定

Instagram Graph APIを使う場合は、ローカルでは `.env.local`、VercelではEnvironment Variablesに以下を設定します。アクセストークンは画面には表示せず、GitHubにもコミットしません。

```env
INSTAGRAM_GRAPH_ACCESS_TOKEN=your-instagram-graph-api-token
INSTAGRAM_GRAPH_API_MODE=instagram_login
INSTAGRAM_BUSINESS_ACCOUNT_ID=your-instagram-business-account-id
INSTAGRAM_GRAPH_API_VERSION=v23.0
```

Graph APIページでは、Instagramビジネスアカウントから以下を取得します。

- `id`
- `caption`
- `timestamp`
- `media_type`
- `permalink`
- `followers_count`
- `follows_count`
- `media_count`

取得した投稿は一覧表示し、投稿日別の投稿数とハッシュタグ数をグラフ化します。OpenAI APIキーを設定している場合は、取得した投稿本文を分析し、強み・課題・改善案・投稿案・ハッシュタグ改善案を表示できます。

### Graph APIデータをSupabaseへ同期

SupabaseのSQL Editorで、既存環境には次のSQLを1回実行します。

```text
supabase/add-instagram-graph-sync.sql
```

同期APIは `GET /api/instagram/sync` または `POST /api/instagram/sync` です。Instagram Business Accountの `/media` を取得し、投稿ごとの `/insights` を取得します。

- `instagram_posts`: 同じ投稿IDは更新、未登録なら追加
- `instagram_post_insight_snapshots`: 同期を実行するたびに新しいスナップショットを追加
- APIレスポンス: 取得投稿数、投稿保存数、スナップショット保存数、失敗数
- 詳細エラー: VercelのFunctions Logsに出力（トークンは出力しません）

必要な環境変数:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
INSTAGRAM_GRAPH_API_VERSION=v23.0
INSTAGRAM_BUSINESS_ACCOUNT_ID=your-instagram-business-account-id
INSTAGRAM_GRAPH_ACCESS_TOKEN=your-instagram-graph-api-token
INSTAGRAM_GRAPH_API_MODE=instagram_login
```

`SUPABASE_SERVICE_ROLE_KEY` と `INSTAGRAM_GRAPH_ACCESS_TOKEN` はVercelのサーバー側だけで使用します。`NEXT_PUBLIC_` は付けず、GitHubへコミットしないでください。

Metaの「Instagramでメッセージとコンテンツを管理」から発行した `instagram_business_*` 権限のトークンは、`INSTAGRAM_GRAPH_API_MODE=instagram_login` を設定します。この方式では `/me/media` を使うため、`INSTAGRAM_BUSINESS_ACCOUNT_ID` は不要です。従来のFacebookログイン方式を使う場合は `INSTAGRAM_GRAPH_API_MODE=facebook_login` とアカウントIDを設定します。

### 自動同期

`vercel.json` により、Vercel Cronが毎日午前6時ごろ（日本時間）に `/api/instagram/sync` を実行します。VercelのEnvironment Variablesに推測されにくい長い文字列を設定してください。

```env
CRON_SECRET=replace-with-a-long-random-string
```

Graph APIページの「Supabaseへ同期」では手動同期もできます。投稿詳細には最新値と同期履歴グラフを表示し、一覧・ダッシュボード・レポート・AI分析では最新のAPI値を優先します。

## アカウント別のAI/API設定

アカウント登録ページで、アカウントごとにAI分析用の設定を管理できます。

- APIキー環境変数名
- 使用モデル
- アカウント専用の分析方針

APIキー本体はアプリ画面やブラウザには保存しません。`.env.local` またはVercelのEnvironment Variablesに `OPENAI_API_KEY_OZOPS` のような環境変数を追加し、アカウント編集画面にはその環境変数名だけを登録します。

アカウント側のAPIキー環境変数名が未設定の場合は、共通の `OPENAI_API_KEY` を使います。使用モデルが未設定の場合は、共通の `OPENAI_MODEL`、それも未設定なら `gpt-4.1-mini` を使います。

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
- `instagram_improvement_tasks`
- `instagram_monthly_goals`

すでに過去版のSQLを実行済みで、AI分析履歴テーブルだけ追加したい場合は、以下のファイルをSQL Editorで実行します。

```text
supabase/add-analysis-history.sql
```

月次レポート保存テーブルだけ追加したい場合は、以下のファイルをSQL Editorで実行します。

```text
supabase/add-monthly-reports.sql
```

改善タスク管理テーブルだけ追加したい場合は、以下のファイルをSQL Editorで実行します。

```text
supabase/add-improvement-tasks.sql
```

月間目標管理テーブルだけ追加したい場合は、以下のファイルをSQL Editorで実行します。

```text
supabase/add-monthly-goals.sql
```

アカウント別のAI/API設定カラムだけ追加したい場合は、以下のファイルをSQL Editorで実行します。

```text
supabase/add-account-ai-settings.sql
```

すでに過去版の投稿テーブルを作成済みで、投稿カテゴリだけ追加したい場合は、以下のファイルをSQL Editorで実行します。

```text
supabase/add-post-category.sql
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

設定ページの「CSVをまとめて書き出す」から、以下のCSVを出力できます。

- アカウントCSV
- 投稿CSV
- AI分析結果CSV
- 月次レポートCSV
- 改善タスクCSV
- 月間目標CSV

CSVは社内共有や表計算ソフトでの確認に使えます。AI分析結果、月次レポート、改善タスク、月間目標は、Supabase保存が有効な場合に保存済みデータを取得して出力します。

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
- 月間目標
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

## 実投稿のAI評価

投稿一覧ページの「実投稿のAI評価」から、登録済み投稿をOpenAI APIでまとめて評価できます。

- 未分析投稿だけをAI評価
- 表示中の投稿を再評価
- 投稿スコア、改善案、投稿提案、ハッシュタグを保存
- アカウント、投稿タイプ、カテゴリの絞り込みと連動

API料金を抑えるため、一度に評価する投稿は最大10件までです。この機能もInstagram APIは使わず、登録済みの投稿データとアップロード済みスクショだけを使います。

## CSV形式

投稿登録ページからCSVを取り込めます。1行目は以下の列名にしてください。

```csv
accountUsername,date,recordedDate,url,caption,hashtags,type,category,mediaCount,likes,comments,saves,shares,views,memo
ozops_outdoor,2026-05-01,2026-05-02,https://www.instagram.com/p/example/,"軽量焚き火ギアの紹介","#アウトドアギア #キャンプ道具",reel,product,1,438,28,96,42,12800,"動画冒頭で使用シーンを見せた"
```

`accountUsername` は登録済みアカウントのユーザー名と一致すると投稿に紐づきます。`type` は `image`、`video`、`reel`、`carousel` のいずれかです。`category` は `product`、`howto`、`campaign`、`voice`、`recruit`、`store`、`sale`、`brand`、`other` のいずれかです。画像スクショはCSVでは取り込まず、フォームから登録します。

## 登録できるアカウントデータ

- アカウント名
- ユーザー名
- プロフィールURL
- 業種
- ターゲット
- 運用目的
- APIキー環境変数名
- 使用モデル
- アカウント専用の分析方針
- メモ

## 登録できる投稿データ

- 対象アカウント
- 投稿日
- データ登録日
- 投稿URL
- 投稿コメント
- ハッシュタグ
- 投稿タイプ: 画像、動画、リール、カルーセル
- 投稿カテゴリ: 商品紹介、ノウハウ、キャンペーン、お客様の声、採用、店舗紹介、セール告知、ブランド世界観、未分類
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
- 投稿一覧ページ: 表示形式を表・カードで切り替え可能
- 投稿カレンダーページ
- 投稿詳細・AI分析ページ
- 改善タスク管理ページ
- ダッシュボードページ
- レポートページ
- 設定ページ

## 改善タスク管理

投稿詳細・AI分析ページの「改善案をタスク化」から、AI分析の改善案をタスクとして保存できます。タスクページでは、状態・担当者・期限・メモを編集できます。

- 状態: 対応前、対応中、完了
- 担当者
- 期限
- メモ
- 投稿との紐づけ

ダッシュボードでは、改善タスクの進捗も確認できます。

- 未完了タスク数
- 完了率
- 期限切れ数
- 次の期限
- 状態別タスク数
- カテゴリ別タスク数

## 目標管理

目標管理ページでは、月別・アカウント別に運用目標を保存できます。

- 月間投稿数
- 月間表示数
- 月間保存数
- 平均保存率
- 平均エンゲージメント率

保存した目標は、目標管理ページ、ダッシュボード、月次レポートで達成率として確認できます。PDF出力にも目標達成率が含まれます。

## 年度集計

月次レポートページでは、年度ごとの集計も確認できます。年度の開始月は、1月始まりまたは4月始まりを選べます。

- 年間投稿数
- 年間表示数
- 年間保存数
- 平均保存率
- 平均エンゲージメント率
- 月別の投稿数・表示数・保存数
- 年度の伸びた投稿TOP3
- 年度の改善が必要な投稿TOP3
- 年度のカテゴリ別傾向
- 年度目標の達成率

## カテゴリ別AIレポート

月次レポートページでは、カテゴリ別の数値集計に加えて、AIによるカテゴリ別総評を作成できます。

- カテゴリ全体の総評
- カテゴリごとの傾向
- 強み
- 課題
- 次の投稿方針

## PDF出力

月次レポートページの「PDF出力」から、ブラウザの印刷機能を使ってPDF保存できます。

- 月次レポート
- 目標達成率
- 年度集計
- カテゴリ別AIレポート
- 改善タスク進捗
- 伸びた投稿TOP3
- 改善が必要な投稿TOP3

## 投稿カレンダー

投稿カレンダーページでは、投稿日、データ分析に投稿を登録した日、改善タスクの期限を月表示で確認できます。

- 月別表示
- アカウント別の絞り込み
- 投稿日の表示
- 分析登録日の表示
- 改善タスク期限の表示
- カテゴリ別の月間投稿数
- 最も多く投稿したカテゴリ

## サンプルデータ

アカウント登録ページの「サンプルアカウントを追加」、または投稿登録ページの「サンプル10件を追加」から、OZOPSのようなアウトドアブランドを想定したダミーデータを追加できます。

## 今後の拡張案

- Supabase Authを追加し、ユーザーごとにデータを分離する
- ユーザー認証を追加し、ブランド別・担当者別にデータを分離する
- CSVエクスポートとPDFレポート出力を追加する
- 投稿タグ、キャンペーン、商品カテゴリを追加して分析軸を増やす
- AI分析結果を保存し、改善前後の比較をできるようにする
- 投稿予約や制作メモなど、運用管理機能を追加する
