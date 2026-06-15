alter table public.instagram_posts
add column if not exists category text not null default 'other'
check (category in ('product', 'howto', 'campaign', 'voice', 'recruit', 'store', 'sale', 'brand', 'other'));
