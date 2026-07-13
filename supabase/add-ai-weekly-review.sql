alter table public.ai_manager_weekly_reviews
  add column if not exists ai_review jsonb,
  add column if not exists ai_model text,
  add column if not exists ai_generated_at timestamptz;
