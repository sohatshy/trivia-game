-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- It creates the table that remembers which questions each signed-in player has already seen.

create table if not exists public.played_questions (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  question_id text        not null,
  played_at   timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- Row-level security: every player can only see and change THEIR OWN rows.
alter table public.played_questions enable row level security;

create policy "players read own history" on public.played_questions
  for select using (auth.uid() = user_id);

create policy "players add own history" on public.played_questions
  for insert with check (auth.uid() = user_id);

create policy "players update own history" on public.played_questions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "players delete own history" on public.played_questions
  for delete using (auth.uid() = user_id);
