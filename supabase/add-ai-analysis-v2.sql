alter table public.instagram_post_analyses
  add column if not exists analysis_v2 jsonb;

comment on column public.instagram_post_analyses.analysis_v2 is
  'Phase 2 AI analysis details';
