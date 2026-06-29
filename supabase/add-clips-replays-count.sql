-- =============================================
-- リール限定指標 clips_replays_count を追加
-- Supabase SQL Editor で実行してください
-- =============================================

alter table public.instagram_post_insight_snapshots
  add column if not exists clips_replays_count bigint;
