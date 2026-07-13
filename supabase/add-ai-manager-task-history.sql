create table if not exists public.ai_manager_task_states (
  id uuid primary key default gen_random_uuid(),
  task_date date not null,
  task_key text not null,
  title text not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(task_date, task_key)
);

create table if not exists public.ai_manager_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  total_score integer not null,
  schedule_score integer not null,
  preparation_score integer not null,
  consistency_score integer not null,
  growth_score integer not null,
  total_tasks integer not null default 0,
  completed_tasks integer not null default 0,
  completion_rate numeric not null default 0,
  summary jsonb not null,
  warnings jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_manager_task_states_date_idx
  on public.ai_manager_task_states (task_date, is_completed);

create index if not exists ai_manager_daily_snapshots_date_idx
  on public.ai_manager_daily_snapshots (snapshot_date desc);
