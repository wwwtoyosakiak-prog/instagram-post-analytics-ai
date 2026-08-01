create table if not exists public.ai_weekly_review_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null default 'cron'
    check (trigger_type in ('cron', 'manual')),
  status text not null
    check (status in ('running', 'success', 'failed', 'skipped')),
  target_week_start date,
  target_week_end date,
  ai_model text,
  message text,
  details jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists ai_weekly_review_runs_started_at_idx
  on public.ai_weekly_review_runs (started_at desc);
