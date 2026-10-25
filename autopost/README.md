# 毎朝の自動投稿（だんボールガチャ ペパポン）

毎朝 7:30（日本時間）に、その日のリール（縦 1080×1920・9.5秒）を自動で企画・生成し、@tamaenergycircle に投稿します。

## しくみ

1. GitHub Actions（`.github/workflows/instagram-daily-autopost.yml`）が 7:05 に起動します。
2. 暗号化された素材（`autopost/assets.tgz.enc`：顔の写らない写真・BGM・予約動画）を `AUTOPOST_ASSETS_KEY` で復号します。
3. 予約動画（10/26〜11/1 の 1 週間分）がある日はそれを使います。それ以外の日はアプリの `/api/cron/autopost` が OpenAI で企画を作ります。
   - 企画の内容は、テーマ・スタイル（pop / kraft / dark / quiz / sdgs / story）・テロップ・写真・キャプション・ハッシュタグです。
   - 直近 14 日の投稿履歴と重ならないように作ります。
   - クイズは、事実確認済みのクイズ一覧からだけ選びます。
   - AI が使えないときは、曜日ローテーションの予備企画で投稿を続けます。
4. `autopost/render.py` で動画を生成します。
5. 生成した動画を Supabase Storage（`autopost` バケット・非公開）に上げます。
6. 7:30 まで待ってから、Instagram Graph API でリールとして公開します。
7. 投稿履歴は Storage の `history.json` に残ります。同じ日は二重投稿しません。

## 必要な設定

| 場所 | 名前 | 内容 |
|---|---|---|
| GitHub Secrets | `CRON_SECRET` | 既存（同期ワークフローと同じ） |
| GitHub Secrets | `AUTOPOST_ASSETS_KEY` | 素材の復号キー |
| Vercel | `OPENAI_API_KEY` / `SUPABASE_*` | 既存 |
| Meta アプリ | `instagram_business_content_publish` | 投稿権限。追加後にアプリで Instagram を再連携 |

## 手動実行

GitHub の Actions →「Instagram Daily Autopost」→ Run workflow から実行できます。

- `dry_run` を ON にすると、動画を作るだけで投稿しません。生成物は Artifacts からダウンロードできます。
- `date` を指定すると、その日付の企画で作ります。

## 素材を差し替えるとき

1. 素材フォルダの構成は次のとおりです。
   - `catalog.json`
   - `photos/*.jpg`
   - `bgm/*.m4a` と `bgm/sections.json`
   - `queue/*.mp4`
   - `capsule.png`
   - `logo.png`
2. 次のコマンドで暗号化し直します。

```bash
tar czf /tmp/assets.tgz catalog.json capsule.png logo.png photos bgm queue
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -in /tmp/assets.tgz -out autopost/assets.tgz.enc -pass env:AUTOPOST_ASSETS_KEY
```
