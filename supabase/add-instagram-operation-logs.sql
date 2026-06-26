create extension if not exists pgcrypto;

create table if not exists public.instagram_operation_logs (
  id text primary key default gen_random_uuid()::text,
  domain text not null
    check (domain in ('token_management', 'data_sync')),
  operation_type text not null,
  result text not null
    check (result in ('success', 'failed', 'skipped')),
  message text,
  error_detail text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists instagram_operation_logs_domain_created_idx
  on public.instagram_operation_logs (domain, created_at desc);

create index if not exists instagram_operation_logs_type_created_idx
  on public.instagram_operation_logs (operation_type, created_at desc);

alter table public.instagram_operation_logs enable row level security;
