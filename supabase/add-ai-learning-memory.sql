create table if not exists public.ai_learning_memory (
  id uuid primary key default gen_random_uuid(),
  improvement_cycle_id uuid,
  title text not null,
  hypothesis text not null,
  action text not null,
  metric_name text not null,
  baseline_value numeric,
  target_value numeric,
  result_value numeric,
  improvement_rate numeric,
  outcome text not null
    check (outcome in ('success', 'partial', 'failure', 'unknown')),
  learning_summary text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_learning_memory_cycle_unique
  on public.ai_learning_memory (improvement_cycle_id)
  where improvement_cycle_id is not null;

create index if not exists ai_learning_memory_outcome_idx
  on public.ai_learning_memory (outcome);

create index if not exists ai_learning_memory_created_at_idx
  on public.ai_learning_memory (created_at desc);
