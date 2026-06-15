create table if not exists public.instagram_improvement_tasks (
  id text primary key default gen_random_uuid()::text,
  post_id text references public.instagram_posts(id) on delete cascade,
  analysis_id text references public.instagram_post_analyses(id) on delete set null,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  assignee text,
  due_date date,
  memo text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_instagram_improvement_tasks_updated_at on public.instagram_improvement_tasks;
create trigger set_instagram_improvement_tasks_updated_at
before update on public.instagram_improvement_tasks
for each row execute function public.set_updated_at();

alter table public.instagram_improvement_tasks enable row level security;
