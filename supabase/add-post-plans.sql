create table if not exists public.ai_post_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'adopted', 'in_progress', 'posted', 'archived')),
  scheduled_date date,
  goal text not null,
  post_type text not null,
  theme text not null,
  audience text not null,
  key_message text not null,
  tone text,
  duration text,
  notes text,
  result jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_post_plans_status_idx
  on public.ai_post_plans (status);

create index if not exists ai_post_plans_scheduled_date_idx
  on public.ai_post_plans (scheduled_date);

create index if not exists ai_post_plans_created_at_idx
  on public.ai_post_plans (created_at desc);
