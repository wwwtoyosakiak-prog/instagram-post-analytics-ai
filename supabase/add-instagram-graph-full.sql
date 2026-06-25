-- =============================================
-- Instagram Graph API フル対応 スキーマ拡張
-- Supabase SQL Editor で実行してください
-- =============================================

-- 1. instagram_accounts テーブルに Graph API カラムを追加
alter table public.instagram_accounts
  add column if not exists ig_user_id text,
  add column if not exists access_token text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists biography text,
  add column if not exists profile_picture_url text,
  add column if not exists followers_count bigint,
  add column if not exists follows_count bigint,
  add column if not exists media_count bigint,
  add column if not exists website text,
  add column if not exists account_type text,
  add column if not exists last_synced_at timestamptz;

-- 2. instagram_media テーブル（Graph APIから取得した投稿データ）
create table if not exists public.instagram_media (
  id text primary key,                          -- Instagram media_id
  account_id text references public.instagram_accounts(id) on delete cascade,
  ig_user_id text,
  caption text,
  media_type text,                              -- IMAGE / VIDEO / CAROUSEL_ALBUM
  media_url text,
  thumbnail_url text,
  permalink text,
  timestamp timestamptz,
  like_count bigint default 0,
  comments_count bigint default 0,
  is_published boolean default true,
  children jsonb,                               -- カルーセルの子メディア
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. instagram_media_insights テーブル（投稿インサイト）
create table if not exists public.instagram_media_insights (
  id text primary key default gen_random_uuid()::text,
  media_id text not null references public.instagram_media(id) on delete cascade,
  account_id text references public.instagram_accounts(id) on delete cascade,
  captured_at timestamptz not null default now(),
  -- 共通
  impressions bigint,
  reach bigint,
  likes bigint,
  comments bigint,
  saved bigint,
  shares bigint,
  total_interactions bigint,
  follows bigint,
  profile_visits bigint,
  -- リール・動画専用
  views bigint,
  plays bigint,
  ig_reels_avg_watch_time numeric,
  ig_reels_video_view_total_time bigint,
  video_view_total_time bigint,
  avg_watch_time numeric,
  -- ナビゲーション
  navigation bigint,
  replies bigint,
  -- 取得不可・null許容
  raw_response jsonb                            -- デバッグ用生レスポンス
);

-- 4. instagram_account_insights テーブル（アカウント全体インサイト）
create table if not exists public.instagram_account_insights (
  id text primary key default gen_random_uuid()::text,
  account_id text not null references public.instagram_accounts(id) on delete cascade,
  date date not null,
  reach bigint,
  impressions bigint,
  profile_views bigint,
  website_clicks bigint,
  follower_count bigint,
  online_followers jsonb,                       -- 時間帯別オンラインフォロワー
  audience_city jsonb,                          -- 都市別
  audience_country jsonb,                       -- 国別
  audience_gender_age jsonb,                    -- 性別年齢別
  email_contacts bigint,
  get_directions_clicks bigint,
  phone_call_clicks bigint,
  text_message_clicks bigint,
  created_at timestamptz not null default now(),
  unique (account_id, date)
);

-- 5. instagram_daily_snapshots テーブル（フォロワー推移など時系列）
create table if not exists public.instagram_daily_snapshots (
  id text primary key default gen_random_uuid()::text,
  account_id text not null references public.instagram_accounts(id) on delete cascade,
  date date not null,
  followers_count bigint,
  follows_count bigint,
  media_count bigint,
  created_at timestamptz not null default now(),
  unique (account_id, date)
);

-- 6. インデックス
create index if not exists idx_instagram_media_account_id on public.instagram_media(account_id);
create index if not exists idx_instagram_media_timestamp on public.instagram_media(timestamp desc);
create index if not exists idx_instagram_media_insights_media_id on public.instagram_media_insights(media_id);
create index if not exists idx_instagram_media_insights_captured_at on public.instagram_media_insights(captured_at desc);
create index if not exists idx_instagram_account_insights_date on public.instagram_account_insights(account_id, date desc);
create index if not exists idx_instagram_daily_snapshots_date on public.instagram_daily_snapshots(account_id, date desc);

-- 7. updated_at トリガー
drop trigger if exists set_instagram_media_updated_at on public.instagram_media;
create trigger set_instagram_media_updated_at
before update on public.instagram_media
for each row execute function public.set_updated_at();

-- 8. RLS（サービスロールキーで操作するためポリシー不要・有効化のみ）
alter table public.instagram_media enable row level security;
alter table public.instagram_media_insights enable row level security;
alter table public.instagram_account_insights enable row level security;
alter table public.instagram_daily_snapshots enable row level security;
