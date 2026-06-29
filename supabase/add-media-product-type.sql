-- =============================================
-- media_product_type 列を追加
-- リール(REELS) / フィード動画(FEED) / フィード画像(FEED) の区別に使用
-- Supabase SQL Editor で実行してください
-- =============================================

-- 同期ルートが書き込む投稿テーブル
alter table public.instagram_posts
  add column if not exists media_product_type text;

-- フルシンクルートが書き込む投稿テーブル
alter table public.instagram_media
  add column if not exists media_product_type text;
