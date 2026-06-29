-- =============================================
-- instagram_post_insight_snapshots に必要な全カラムを追加
-- (各 add-*.sql を一括適用する統合版)
-- Supabase SQL Editor で実行してください
-- 何度実行しても安全 (IF NOT EXISTS)
-- =============================================

-- 基本メトリクス追加 (add-insight-extra-metrics.sql と同等)
alter table public.instagram_post_insight_snapshots
  add column if not exists likes            bigint not null default 0,
  add column if not exists comments         bigint not null default 0,
  add column if not exists follows          bigint not null default 0,
  add column if not exists profile_visits   bigint not null default 0;

-- リール指標追加 (add-reel-insight-metrics.sql と同等)
alter table public.instagram_post_insight_snapshots
  add column if not exists ig_reels_avg_watch_time        numeric,
  add column if not exists ig_reels_video_view_total_time bigint;

-- クリップリプレイ数追加 (add-clips-replays-count.sql と同等)
alter table public.instagram_post_insight_snapshots
  add column if not exists clips_replays_count bigint;

-- =============================================
-- instagram_posts に media_product_type 追加
-- (add-media-product-type.sql と同等)
-- =============================================
alter table public.instagram_posts
  add column if not exists media_product_type text;

-- instagram_media は full-sync 専用テーブルなので存在する場合のみ追加
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'instagram_media') then
    alter table public.instagram_media
      add column if not exists media_product_type text;
  end if;
end $$;
