create table if not exists public.growth_strategy_snapshots (
  id uuid primary key default gen_random_uuid(),
  score integer not null,
  post_count integer not null,
  posts_per_week numeric not null,
  average_views numeric not null,
  average_engagement_rate numeric not null,
  average_save_rate numeric not null,
  average_share_rate numeric not null,
  period_from date,
  period_to date,
  strategy jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists growth_strategy_snapshots_created_at_idx
  on public.growth_strategy_snapshots (created_at desc);
