alter table public.ai_post_plans
  add column if not exists predicted_views integer,
  add column if not exists predicted_likes integer,
  add column if not exists predicted_comments integer,
  add column if not exists predicted_saves integer,
  add column if not exists predicted_shares integer,
  add column if not exists actual_views integer,
  add column if not exists actual_likes integer,
  add column if not exists actual_comments integer,
  add column if not exists actual_saves integer,
  add column if not exists actual_shares integer,
  add column if not exists linked_post_id text,
  add column if not exists evaluated_at timestamptz;

create index if not exists ai_post_plans_linked_post_id_idx
  on public.ai_post_plans (linked_post_id);

create index if not exists ai_post_plans_evaluated_at_idx
  on public.ai_post_plans (evaluated_at desc);
