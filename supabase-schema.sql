-- Run this entire script in Supabase Dashboard -> SQL Editor.
create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  target_role text not null default 'Software Engineer',
  overall_score integer not null default 0,
  evaluation jsonb not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, session_id)
);

create index if not exists interviews_user_id_completed_at_idx
  on public.interviews (user_id, completed_at desc);

alter table public.interviews enable row level security;

drop policy if exists "Users can read their own interviews" on public.interviews;
create policy "Users can read their own interviews"
  on public.interviews for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own interviews" on public.interviews;
create policy "Users can insert their own interviews"
  on public.interviews for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own interviews" on public.interviews;
create policy "Users can update their own interviews"
  on public.interviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
