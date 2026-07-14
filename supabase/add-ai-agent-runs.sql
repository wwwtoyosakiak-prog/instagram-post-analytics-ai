create table if not exists public.ai_agent_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null default 'manual'
    check (trigger_type in ('manual', 'cron')),
  status text not null
    check (status in ('running', 'success', 'partial', 'failed')),
  current_step text,
  completed_steps integer not null default 0,
  failed_steps integer not null default 0,
  skipped_steps integer not null default 0,
  total_steps integer not null default 0,
  duration_ms integer,
  message text,
  steps jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists ai_agent_runs_started_at_idx
  on public.ai_agent_runs (started_at desc);
