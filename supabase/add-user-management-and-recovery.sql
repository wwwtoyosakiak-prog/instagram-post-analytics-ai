-- Run once before using screen-based user management, Instagram OAuth, and automatic recovery backups.
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9_-]{2,31}$'),
  password_hash text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.instagram_user_connections (
  owner_id text primary key,
  access_token text not null,
  instagram_user_id text,
  username text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_data_backups (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  backup_date date not null,
  kind text not null check (kind in ('daily', 'pre_restore')),
  encrypted_payload text not null,
  row_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, backup_date, kind)
);

create index if not exists app_users_active_idx on public.app_users (active, created_at);
create index if not exists app_data_backups_owner_idx on public.app_data_backups (owner_id, created_at desc);
alter table public.app_users enable row level security;
alter table public.instagram_user_connections enable row level security;
alter table public.app_data_backups enable row level security;
