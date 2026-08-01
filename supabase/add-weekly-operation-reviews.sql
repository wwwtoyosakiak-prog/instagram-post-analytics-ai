create table if not exists public.ai_manager_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  week_end date not null,
  average_total_score numeric not null default 0,
  average_schedule_score numeric not null default 0,
  average_preparation_score numeric not null default 0,
  average_consistency_score numeric not null default 0,
  average_growth_score numeric not null default 0,
  average_completion_rate numeric not null default 0,
  completed_tasks integer not null default 0,
  total_tasks integer not null default 0,
  review jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_manager_weekly_reviews_week_start_idx
  on public.ai_manager_weekly_reviews (week_start desc);
