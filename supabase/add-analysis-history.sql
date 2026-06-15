create table if not exists public.instagram_post_analyses (
  id text primary key default gen_random_uuid()::text,
  post_id text not null references public.instagram_posts(id) on delete cascade,
  first_impression text not null,
  image_message text not null,
  caption_clarity text not null,
  strengths text not null,
  weaknesses text not null,
  reason text not null,
  improvements jsonb not null default '[]'::jsonb,
  next_ideas jsonb not null default '[]'::jsonb,
  hashtags jsonb not null default '[]'::jsonb,
  score integer not null default 0,
  score_delta integer,
  created_at timestamptz not null default now()
);

alter table public.instagram_post_analyses enable row level security;
