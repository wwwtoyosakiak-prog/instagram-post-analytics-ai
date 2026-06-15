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

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_instagram_monthly_reports_updated_at on public.instagram_monthly_reports;
create trigger set_instagram_monthly_reports_updated_at
before update on public.instagram_monthly_reports
for each row execute function public.set_updated_at();

alter table public.instagram_monthly_reports enable row level security;
