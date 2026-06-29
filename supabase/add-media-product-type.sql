-- =============================================
-- media_product_type 列を追加
-- リール(REELS) / フィード動画(FEED) の区別に使用
--
-- Supabase SQL Editor で実行してください。
-- この migration を実行後、sync/route.ts の post_save upsert に
-- media_product_type フィールドを追加する変更が必要です。
-- =============================================

-- sync ルートが書き込む投稿テーブル
alter table public.instagram_posts
  add column if not exists media_product_type text;

-- full-sync ルートが書き込む投稿テーブル
alter table public.instagram_media
  add column if not exists media_product_type text;
