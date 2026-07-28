create table if not exists public.resume_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.resume_workspaces enable row level security;

drop policy if exists "Users can read their own resume workspace"
  on public.resume_workspaces;
create policy "Users can read their own resume workspace"
  on public.resume_workspaces for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own resume workspace"
  on public.resume_workspaces;
create policy "Users can create their own resume workspace"
  on public.resume_workspaces for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own resume workspace"
  on public.resume_workspaces;
create policy "Users can update their own resume workspace"
  on public.resume_workspaces for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

