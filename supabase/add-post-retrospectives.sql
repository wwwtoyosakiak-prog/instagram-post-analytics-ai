create table if not exists public.post_retrospectives (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.ai_post_plans(id) on delete cascade,
  linked_post_id text,
  summary text not null default '',
  positives text[] not null default '{}',
  negatives text[] not null default '{}',
  next_actions text[] not null default '{}',
  hypotheses text[] not null default '{}',
  continue_actions text[] not null default '{}',
  stop_actions text[] not null default '{}',
  confidence text not null default 'medium'
    check (confidence in ('high', 'medium', 'low')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id)
);

create index if not exists post_retrospectives_plan_id_idx
  on public.post_retrospectives (plan_id);

create index if not exists post_retrospectives_updated_at_idx
  on public.post_retrospectives (updated_at desc);
