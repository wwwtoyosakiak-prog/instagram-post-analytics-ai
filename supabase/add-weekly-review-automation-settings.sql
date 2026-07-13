create table if not exists public.ai_weekly_review_settings (
  id integer primary key default 1
    check (id = 1),
  enabled boolean not null default true,
  manual_only boolean not null default false,
  minimum_recorded_days integer not null default 1
    check (minimum_recorded_days between 0 and 7),
  skip_ai_when_insufficient boolean not null default true,
  ai_model text not null default 'gpt-4.1-mini',
  updated_at timestamptz not null default now()
);

insert into public.ai_weekly_review_settings (
  id,
  enabled,
  manual_only,
  minimum_recorded_days,
  skip_ai_when_insufficient,
  ai_model
)
values (
  1,
  true,
  false,
  1,
  true,
  'gpt-4.1-mini'
)
on conflict (id) do nothing;
