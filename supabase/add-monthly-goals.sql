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

drop trigger if exists set_instagram_monthly_goals_updated_at on public.instagram_monthly_goals;
create trigger set_instagram_monthly_goals_updated_at
before update on public.instagram_monthly_goals
for each row execute function public.set_updated_at();

alter table public.instagram_monthly_goals enable row level security;
