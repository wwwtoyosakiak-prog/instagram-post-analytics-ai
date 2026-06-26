create extension if not exists "pgcrypto";

create table if not exists public.instagram_accounts (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  username text not null,
  instagram_api_username text,
  profile_url text,
  industry text,
  target_audience text,
  goal text,
  openai_api_key_env_name text,
  openai_model text,
  analysis_instructions text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instagram_posts (
  id text primary key default gen_random_uuid()::text,
  account_id text references public.instagram_accounts(id) on delete set null,
  date date not null,
  recorded_date date not null,
  url text,
  caption text not null,
  hashtags text,
  type text not null check (type in ('image', 'video', 'reel', 'carousel')),
  media_count integer not null default 1,
  likes integer not null default 0,
  comments integer not null default 0,
  saves integer not null default 0,
  shares integer not null default 0,
  views integer not null default 0,
  memo text,
  screenshot text,
  media_type text,
  media_url text,
  thumbnail_url text,
  permalink text,
  "timestamp" timestamptz,
  username text,
  like_count bigint not null default 0,
  comments_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instagram_post_insight_snapshots (
  id text primary key default gen_random_uuid()::text,
  post_id text not null references public.instagram_posts(id) on delete cascade,
  captured_at timestamptz not null default now(),
  views bigint not null default 0,
  reach bigint not null default 0,
  saved bigint not null default 0,
  shares bigint not null default 0,
  total_interactions bigint not null default 0,
  like_count bigint not null default 0,
  comments_count bigint not null default 0
);

create table if not exists public.instagram_sync_runs (
  id text primary key default gen_random_uuid()::text,
  trigger_type text not null check (trigger_type in ('manual', 'scheduled')),
  status text not null check (status in ('success', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  fetched_posts integer not null default 0,
  saved_posts integer not null default 0,
  saved_snapshots integer not null default 0,
  failed_posts integer not null default 0,
  api_mode text not null default 'unknown',
  account_id text references public.instagram_accounts(id) on delete set null,
  account_name text,
  account_username text,
  error_summary text,
  errors jsonb not null default '[]'::jsonb
);

create index if not exists instagram_sync_runs_finished_idx
  on public.instagram_sync_runs (finished_at desc);

create index if not exists instagram_post_insight_snapshots_post_captured_idx
  on public.instagram_post_insight_snapshots (post_id, captured_at desc);

create table if not exists public.instagram_post_analyses (
  id text primary key default gen_random_uuid()::text,
  post_id text not null references public.instagram_posts(id) on delete cascade,
  first_impression text not null,
  image_message text not null,
  caption_clarity text not null,
  strengths text not null,
  weaknesses text not null,
  reason text not null,
  improvements jsonb not null default '[]'::jsonb,
  next_ideas jsonb not null default '[]'::jsonb,
  hashtags jsonb not null default '[]'::jsonb,
  score integer not null default 0,
  score_delta integer,
  created_at timestamptz not null default now()
);

create table if not exists public.instagram_monthly_reports (
  id text primary key default gen_random_uuid()::text,
  month text not null,
  account_id text references public.instagram_accounts(id) on delete set null,
  account_name text not null default 'すべて',
  total_views integer not null default 0,
  average_likes numeric not null default 0,
  average_saves numeric not null default 0,
  average_engagement_rate numeric not null default 0,
  top_posts jsonb not null default '[]'::jsonb,
  needs_work_posts jsonb not null default '[]'::jsonb,
  summary text not null,
  next_month_policy jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instagram_improvement_tasks (
  id text primary key default gen_random_uuid()::text,
  post_id text references public.instagram_posts(id) on delete cascade,
  analysis_id text references public.instagram_post_analyses(id) on delete set null,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  assignee text,
  due_date date,
  memo text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instagram_monthly_goals (
  id text primary key default gen_random_uuid()::text,
  account_id text references public.instagram_accounts(id) on delete set null,
  month text not null,
  target_posts integer not null default 0,
  target_views integer not null default 0,
  target_saves integer not null default 0,
  target_save_rate numeric not null default 0,
  target_engagement_rate numeric not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_instagram_accounts_updated_at on public.instagram_accounts;
create trigger set_instagram_accounts_updated_at
before update on public.instagram_accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_instagram_posts_updated_at on public.instagram_posts;
create trigger set_instagram_posts_updated_at
before update on public.instagram_posts
for each row execute function public.set_updated_at();

drop trigger if exists set_instagram_monthly_reports_updated_at on public.instagram_monthly_reports;
create trigger set_instagram_monthly_reports_updated_at
before update on public.instagram_monthly_reports
for each row execute function public.set_updated_at();

drop trigger if exists set_instagram_improvement_tasks_updated_at on public.instagram_improvement_tasks;
create trigger set_instagram_improvement_tasks_updated_at
before update on public.instagram_improvement_tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_instagram_monthly_goals_updated_at on public.instagram_monthly_goals;
create trigger set_instagram_monthly_goals_updated_at
before update on public.instagram_monthly_goals
for each row execute function public.set_updated_at();

alter table public.instagram_accounts enable row level security;
alter table public.instagram_posts enable row level security;
alter table public.instagram_post_insight_snapshots enable row level security;
alter table public.instagram_sync_runs enable row level security;
alter table public.instagram_post_analyses enable row level security;
alter table public.instagram_monthly_reports enable row level security;
alter table public.instagram_improvement_tasks enable row level security;
alter table public.instagram_monthly_goals enable row level security;
