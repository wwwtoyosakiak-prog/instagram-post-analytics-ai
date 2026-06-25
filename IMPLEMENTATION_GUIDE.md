# Instagram Graph API フル対応 実装手順

## 1. Supabaseでスキーマを拡張する

Supabase SQL Editor で以下を実行してください：

```
supabase/add-instagram-graph-full.sql
```

このSQLで追加・変更されるもの：
- `instagram_accounts` に Graph API 用カラム追加（ig_user_id, access_token など）
- `instagram_media` テーブル新規作成（Graph APIから取得した投稿データ）
- `instagram_media_insights` テーブル新規作成（投稿インサイト、時系列保存）
- `instagram_account_insights` テーブル新規作成（アカウント全体インサイト）
- `instagram_daily_snapshots` テーブル新規作成（フォロワー推移）

---

## 2. ファイルをリポジトリにコピーする

以下のファイルをリポジトリの対応する場所にコピーしてください：

```
src/
  lib/
    instagram-graph-api.ts         ← Graph API ユーティリティ（新規）
  app/
    api/
      instagram/
        full-sync/route.ts         ← フルSync API（新規）
        media/route.ts             ← 投稿一覧API（新規）
        reel-insights/route.ts     ← リールインサイトAPI（新規）
        dashboard/route.ts         ← ダッシュボードデータAPI（新規）
      analysis/
        reel/route.ts              ← リールAI分析API（新規）
    reel-insights/page.tsx         ← リール詳細分析ページ（新規）
    ig-dashboard/page.tsx          ← 新ダッシュボード（新規）
    ig-media/page.tsx              ← 投稿一覧ページ新版（新規）
.github/
  workflows/
    instagram-hourly-sync.yml      ← 既存ファイルを置き換え
```

---

## 3. 環境変数の確認

`.env.local` に以下が設定されていることを確認してください：

```env
# Instagram Graph API（必須）
INSTAGRAM_GRAPH_ACCESS_TOKEN=your-access-token
INSTAGRAM_GRAPH_API_MODE=instagram_login
INSTAGRAM_GRAPH_API_VERSION=v23.0

# Supabase（必須）
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI（AI分析機能用）
OPENAI_API_KEY=sk-your-key
OPENAI_MODEL=gpt-4.1-mini
```

Vercel にも同じ環境変数を設定してください。

---

## 4. GitHub Actions のシークレット追加

`Settings → Secrets and variables → Actions` に追加：
- `VERCEL_URL` : `https://your-app.vercel.app`
- `CRON_SECRET` : 任意のランダム文字列

---

## 5. 動作確認

### ① 同期テスト
```
POST /api/instagram/full-sync
```
または ig-dashboard ページの「Instagramデータ同期」ボタンを押す。

レスポンス例：
```json
{
  "ok": true,
  "media_fetched": 48,
  "insights_fetched": 45,
  "insights_failed": 3,
  "snapshot_saved": true
}
```

### ② 新ページにアクセス
- `/ig-dashboard` — 新ダッシュボード
- `/ig-media` — 投稿一覧（Graph APIデータ）
- `/reel-insights?id=<media_id>` — リール詳細分析

---

## 6. エラー時の対応

| エラー | 原因 | 対処 |
|--------|------|------|
| `token_expired` | アクセストークン期限切れ | Meta Developer でトークン再発行 |
| `permission_denied` | API権限不足 | Meta アプリ設定で権限追加 |
| `insights_failed` が多い | 投稿タイプ不一致など | 正常（スキップ処理済み）|
| Supabase エラー | 環境変数・RLS 問題 | SERVICE_ROLE_KEY を確認 |

---

## 7. 新テーブル構造（参考）

### instagram_media
Graph API から取得した投稿そのもの。`id` は Instagram の media_id。

### instagram_media_insights
投稿インサイトの時系列スナップショット。同期するたびに行が追加されるため、
「いいね数の推移」などが追えます。

### instagram_account_insights
アカウント全体の日別インサイト（リーチ、インプレッションなど）。

### instagram_daily_snapshots
フォロワー数の日別記録。フォロワー推移グラフに使います。

---

## 8. APIで取得できない項目について

以下はInstagram Graph APIの仕様上、取得不可です：
- 秒ごとの視聴維持率
- スキップ率
- 再投稿率
- 閲覧数の上位ソース（リールタブ/発見タブ/プロフィール等）
- 他社アカウントのインサイト

これらは UI 上「APIでは取得不可」と表示します。
