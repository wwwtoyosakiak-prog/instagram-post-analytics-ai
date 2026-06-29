-- =============================================
-- instagram_post_insight_snapshots に不足メトリクス列を追加
-- Supabase SQL Editor で実行してください
-- =============================================

alter table public.instagram_post_insight_snapshots
  add column if not exists likes bigint not null default 0,
  add column if not exists comments bigint not null default 0,
  add column if not exists follows bigint not null default 0,
  add column if not exists profile_visits bigint not null default 0;
