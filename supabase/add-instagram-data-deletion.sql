-- Run once before enabling Meta's data deletion callback.
create table if not exists public.instagram_data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique,
  instagram_user_id text,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists instagram_data_deletion_requests_code_idx
  on public.instagram_data_deletion_requests (confirmation_code);

alter table public.instagram_data_deletion_requests enable row level security;
