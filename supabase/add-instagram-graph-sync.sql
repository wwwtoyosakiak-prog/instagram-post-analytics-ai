create extension if not exists "pgcrypto";

-- instagram_posts is shared with the existing manual-entry feature.
-- These columns add the raw Instagram Graph API fields without removing existing data.
create table if not exists public.instagram_posts (
  id text primary key,
  account_id text,
  date date not null,
  recorded_date date not null,
  url text,
  caption text not null default '',
  hashtags text,
  type text not null default 'image' check (type in ('image', 'video', 'reel', 'carousel')),
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

alter table public.instagram_posts add column if not exists media_type text;
alter table public.instagram_posts add column if not exists media_url text;
alter table public.instagram_posts add column if not exists thumbnail_url text;
alter table public.instagram_posts add column if not exists permalink text;
alter table public.instagram_posts add column if not exists "timestamp" timestamptz;
alter table public.instagram_posts add column if not exists username text;
alter table public.instagram_posts add column if not exists like_count bigint not null default 0;
alter table public.instagram_posts add column if not exists comments_count bigint not null default 0;

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

create index if not exists instagram_post_insight_snapshots_post_captured_idx
  on public.instagram_post_insight_snapshots (post_id, captured_at desc);

alter table public.instagram_post_insight_snapshots enable row level security;

comment on table public.instagram_post_insight_snapshots is
  'Point-in-time Instagram Graph API insight values. Written only by server-side service role requests.';
