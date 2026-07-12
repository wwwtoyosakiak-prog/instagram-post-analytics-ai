create table if not exists public.notification_generation_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null
    check (trigger_type in ('cron', 'manual')),
  status text not null
    check (status in ('running', 'success', 'failed')),
  candidate_count integer not null default 0,
  inserted_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists notification_generation_runs_started_at_idx
  on public.notification_generation_runs (started_at desc);
