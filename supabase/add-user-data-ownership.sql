-- Run once before enabling APP_ACCESS_USERS.
-- Existing records stay with the current primary user (`owner`).

alter table public.instagram_accounts add column if not exists owner_id text not null default 'owner';
alter table public.instagram_posts add column if not exists owner_id text not null default 'owner';
alter table public.instagram_post_insight_snapshots add column if not exists owner_id text not null default 'owner';
alter table public.instagram_sync_runs add column if not exists owner_id text not null default 'owner';
alter table public.instagram_post_analyses add column if not exists owner_id text not null default 'owner';
alter table public.instagram_monthly_reports add column if not exists owner_id text not null default 'owner';
alter table if exists public.ai_score_history add column if not exists owner_id text not null default 'owner';

create index if not exists instagram_accounts_owner_idx on public.instagram_accounts (owner_id, created_at desc);
create index if not exists instagram_posts_owner_date_idx on public.instagram_posts (owner_id, date desc);
create index if not exists instagram_insights_owner_captured_idx on public.instagram_post_insight_snapshots (owner_id, captured_at desc);
create index if not exists instagram_sync_runs_owner_finished_idx on public.instagram_sync_runs (owner_id, finished_at desc);
create index if not exists instagram_analyses_owner_created_idx on public.instagram_post_analyses (owner_id, created_at desc);
create index if not exists instagram_reports_owner_created_idx on public.instagram_monthly_reports (owner_id, created_at desc);
do $$
begin
  if to_regclass('public.ai_score_history') is not null then
    execute 'create index if not exists ai_score_history_owner_created_idx on public.ai_score_history (owner_id, created_at asc)';
  end if;
end $$;
