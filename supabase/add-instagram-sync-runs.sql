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

alter table public.instagram_sync_runs enable row level security;
