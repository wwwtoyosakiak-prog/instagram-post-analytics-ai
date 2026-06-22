create extension if not exists "pgcrypto";

alter table public.instagram_posts
  drop constraint if exists instagram_posts_category_check;

create table if not exists public.instagram_post_categories (
  id text primary key default gen_random_uuid()::text,
  value text not null unique,
  label text not null,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.instagram_post_categories (value, label, sort_order, is_system)
values
  ('product', '商品紹介', 0, true),
  ('howto', 'ノウハウ', 1, true),
  ('campaign', 'キャンペーン', 2, true),
  ('voice', 'お客様の声', 3, true),
  ('recruit', '採用', 4, true),
  ('store', '店舗紹介', 5, true),
  ('sale', 'セール告知', 6, true),
  ('brand', 'ブランド世界観', 7, true),
  ('other', '未分類', 8, true)
on conflict (value) do update set label = excluded.label, sort_order = excluded.sort_order, is_system = true;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_instagram_post_categories_updated_at on public.instagram_post_categories;
create trigger set_instagram_post_categories_updated_at
before update on public.instagram_post_categories
for each row execute function public.set_updated_at();

alter table public.instagram_post_categories enable row level security;
