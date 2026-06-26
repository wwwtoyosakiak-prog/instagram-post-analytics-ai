create table if not exists public.instagram_access_tokens (
  provider text primary key,
  access_token text not null,
  issued_at timestamptz,
  expires_at timestamptz,
  last_refreshed_at timestamptz,
  next_refresh_at timestamptz,
  status text not null default 'active'
    check (status in ('missing', 'environment_only', 'active', 'expiring_soon', 'expired', 'refresh_failed')),
  last_error text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists instagram_access_tokens_expires_idx
  on public.instagram_access_tokens (expires_at asc);

create index if not exists instagram_access_tokens_next_refresh_idx
  on public.instagram_access_tokens (next_refresh_at asc);

alter table public.instagram_access_tokens enable row level security;
