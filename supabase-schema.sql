-- Run this once in Supabase: SQL Editor -> New query -> Run.
-- It keeps every user’s actions separate and prevents two users claiming one quest.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  username text unique,
  university text,
  berries_earned integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quests (
  code text primary key,
  title text not null,
  bounty integer not null,
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz
);

-- Safe for projects that already ran an earlier version of this file.
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_unique on public.profiles (username) where username is not null;

insert into public.quests (code, title, bounty) values
  ('QUEST #1042', 'Need 1-on-1 Guidance with Linked Lists & Binary Trees', 300),
  ('QUEST #1043', 'Figma Auto-Layout & Component Variants Code Handoff', 350),
  ('QUEST #1044', 'Calculus III Multivariable Integration Prep for Midterms', 500),
  ('QUEST #1045', 'Conversational Japanese N5 Practice & Kanji Mnemonics', 250)
on conflict (code) do nothing;

create table if not exists public.skill_bookings (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_title text not null,
  guide_name text not null,
  rate text not null,
  session_time text,
  created_at timestamptz not null default now(),
  unique (user_id, skill_title)
);

alter table public.profiles enable row level security;
alter table public.quests enable row level security;
alter table public.skill_bookings enable row level security;

create policy "Users read public profiles" on public.profiles for select to authenticated using (true);
create policy "Users update own profile" on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users read quests" on public.quests for select to authenticated using (true);
create policy "Users read own bookings" on public.skill_bookings for select to authenticated using (auth.uid() = user_id);
create policy "Users create own bookings" on public.skill_bookings for insert to authenticated with check (auth.uid() = user_id);

-- Atomic claim: only one call can change an open quest. The second user receives false.
create or replace function public.claim_quest(quest_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quests
  set claimed_by = auth.uid(), claimed_at = now()
  where code = quest_code and claimed_by is null;
  return found;
end;
$$;

revoke all on function public.claim_quest(text) from public;
grant execute on function public.claim_quest(text) to authenticated;
