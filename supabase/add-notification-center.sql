create table if not exists public.operation_notifications (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id uuid,
  notification_type text not null,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text not null,
  action_url text,
  dedupe_key text not null unique,
  is_read boolean not null default false,
  occurred_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists operation_notifications_is_read_idx
  on public.operation_notifications (is_read, occurred_at desc);

create index if not exists operation_notifications_source_idx
  on public.operation_notifications (source_type, source_id);
