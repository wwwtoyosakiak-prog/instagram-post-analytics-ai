alter table public.ai_post_plans
  add column if not exists pipeline_stage text not null default 'idea',
  add column if not exists assignee text,
  add column if not exists due_date date,
  add column if not exists priority text not null default 'medium';

alter table public.ai_post_plans
  drop constraint if exists ai_post_plans_pipeline_stage_check;

alter table public.ai_post_plans
  add constraint ai_post_plans_pipeline_stage_check
  check (
    pipeline_stage in (
      'idea',
      'planning',
      'script',
      'shooting',
      'editing',
      'review',
      'scheduled',
      'posted'
    )
  );

alter table public.ai_post_plans
  drop constraint if exists ai_post_plans_priority_check;

alter table public.ai_post_plans
  add constraint ai_post_plans_priority_check
  check (priority in ('high', 'medium', 'low'));

create index if not exists ai_post_plans_pipeline_stage_idx
  on public.ai_post_plans (pipeline_stage);

create index if not exists ai_post_plans_due_date_idx
  on public.ai_post_plans (due_date);
