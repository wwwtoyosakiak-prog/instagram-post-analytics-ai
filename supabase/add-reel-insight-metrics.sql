-- =============================================
-- instagram_post_insight_snapshots にリール限定指標を追加
-- Supabase SQL Editor で実行してください
-- =============================================

alter table public.instagram_post_insight_snapshots
  add column if not exists ig_reels_avg_watch_time numeric,
  add column if not exists ig_reels_video_view_total_time bigint;
