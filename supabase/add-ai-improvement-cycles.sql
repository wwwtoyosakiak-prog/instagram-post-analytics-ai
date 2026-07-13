create table if not exists public.ai_improvement_cycles (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  week_end date not null,
  title text not null,
  hypothesis text not null,
  action text not null,
  metric_name text not null,
  baseline_value numeric,
  target_value numeric,
  result_value numeric,
  status text not null default 'planned'
    check (
      status in (
        'planned',
        'in_progress',
        'completed',
        'continue',
        'adjust',
        'stop'
      )
    ),
  evaluation text,
  source_weekly_review_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_improvement_cycles_week_start_idx
  on public.ai_improvement_cycles (week_start desc);

create index if not exists ai_improvement_cycles_status_idx
  on public.ai_improvement_cycles (status);
