alter table public.ai_post_plans
  add column if not exists scheduled_time time,
  add column if not exists schedule_status text not null default 'unscheduled',
  add column if not exists timezone text not null default 'Asia/Tokyo',
  add column if not exists reminder_enabled boolean not null default true;

alter table public.ai_post_plans
  drop constraint if exists ai_post_plans_schedule_status_check;

alter table public.ai_post_plans
  add constraint ai_post_plans_schedule_status_check
  check (
    schedule_status in (
      'unscheduled',
      'preparing',
      'scheduled',
      'published',
      'cancelled'
    )
  );

create index if not exists ai_post_plans_schedule_status_idx
  on public.ai_post_plans (schedule_status);

create index if not exists ai_post_plans_schedule_datetime_idx
  on public.ai_post_plans (scheduled_date, scheduled_time);
