-- ============================================
-- Tribal Picks: Survivor Fantasy
-- Database Schema (Supabase/PostgreSQL)
-- ============================================

-- Users (extends Supabase auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  is_premium boolean default false,
  created_at timestamptz default now()
);

-- Enable RLS
alter table profiles enable row level security;
create policy "Public profiles are viewable by everyone" on profiles
  for select using (true);
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles
  for insert with check (auth.uid() = id);

-- Seasons
create table if not exists seasons (
  id serial primary key,
  number integer unique not null,
  name text,
  premiere_date date,
  finale_date date,
  is_active boolean default false
);

alter table seasons enable row level security;
create policy "Seasons are viewable by everyone" on seasons
  for select using (true);

-- Castaways
create table if not exists castaways (
  id serial primary key,
  season_id integer references seasons(id) on delete cascade,
  name text not null,
  age integer,
  hometown text,
  occupation text,
  tribe text,
  photo_url text,
  is_eliminated boolean default false,
  elimination_episode integer,
  elimination_order integer
);

alter table castaways enable row level security;
create policy "Castaways are viewable by everyone" on castaways
  for select using (true);

-- Leagues
create table if not exists leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  game_type text not null check (game_type in ('bracket', 'draft', 'weekly', 'survivor_pool')),
  season_id integer references seasons(id),
  commissioner_id uuid references profiles(id),
  is_public boolean default false,
  max_members integer default 50,
  created_at timestamptz default now()
);

alter table leagues enable row level security;
create policy "Leagues are viewable by members" on leagues
  for select using (
    is_public = true
    or id in (select league_id from league_members where user_id = auth.uid())
  );
create policy "Authenticated users can create leagues" on leagues
  for insert with check (auth.uid() = commissioner_id);

-- League Members
create table if not exists league_members (
  league_id uuid references leagues(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (league_id, user_id)
);

alter table league_members enable row level security;
create policy "League members viewable by other members" on league_members
  for select using (
    league_id in (select league_id from league_members where user_id = auth.uid())
  );
create policy "Users can join leagues" on league_members
  for insert with check (auth.uid() = user_id);

-- Episodes
create table if not exists episodes (
  id serial primary key,
  season_id integer references seasons(id) on delete cascade,
  number integer not null,
  air_date date,
  title text,
  immunity_winner_id integer references castaways(id),
  eliminated_id integer references castaways(id),
  is_scored boolean default false,
  unique (season_id, number)
);

alter table episodes enable row level security;
create policy "Episodes are viewable by everyone" on episodes
  for select using (true);

-- Bracket Picks (season-long game 1)
create table if not exists bracket_picks (
  id serial primary key,
  league_id uuid references leagues(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  castaway_id integer references castaways(id),
  predicted_position integer not null,
  actual_position integer,
  points integer default 0,
  unique (league_id, user_id, castaway_id)
);

alter table bracket_picks enable row level security;
create policy "Users can view bracket picks in their leagues" on bracket_picks
  for select using (
    league_id in (select league_id from league_members where user_id = auth.uid())
  );
create policy "Users can insert own bracket picks" on bracket_picks
  for insert with check (auth.uid() = user_id);
create policy "Users can update own bracket picks" on bracket_picks
  for update using (auth.uid() = user_id);

-- Draft Picks (season-long game 2 — post-MVP)
create table if not exists draft_picks (
  id serial primary key,
  league_id uuid references leagues(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  castaway_id integer references castaways(id),
  draft_order integer,
  total_points integer default 0,
  unique (league_id, castaway_id)
);

alter table draft_picks enable row level security;
create policy "Users can view draft picks in their leagues" on draft_picks
  for select using (
    league_id in (select league_id from league_members where user_id = auth.uid())
  );

-- Weekly Picks (weekly game 1 — post-MVP)
create table if not exists weekly_picks (
  id serial primary key,
  league_id uuid references leagues(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  episode_id integer references episodes(id),
  picked_eliminated_id integer references castaways(id),
  picked_immunity_id integer references castaways(id),
  points integer default 0,
  unique (league_id, user_id, episode_id)
);

alter table weekly_picks enable row level security;
create policy "Users can view weekly picks in their leagues" on weekly_picks
  for select using (
    league_id in (select league_id from league_members where user_id = auth.uid())
  );

-- Survivor Pool (weekly game 2)
create table if not exists survivor_pool_picks (
  id serial primary key,
  league_id uuid references leagues(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  episode_id integer references episodes(id),
  picked_castaway_id integer references castaways(id),
  is_alive boolean default true,
  unique (league_id, user_id, episode_id),
  unique (league_id, user_id, picked_castaway_id)
);

alter table survivor_pool_picks enable row level security;
create policy "Users can view pool picks in their leagues" on survivor_pool_picks
  for select using (
    league_id in (select league_id from league_members where user_id = auth.uid())
  );
create policy "Users can insert own pool picks" on survivor_pool_picks
  for insert with check (auth.uid() = user_id);
create policy "Users can update own pool picks" on survivor_pool_picks
  for update using (auth.uid() = user_id);

-- ============================================
-- Account Deletion (Apple App Store 5.1.1(v))
-- ============================================
-- SECURITY DEFINER runs as the postgres owner,
-- which has permission to delete from auth.users.
-- Cascading FKs clean up profiles, picks, etc.
create or replace function delete_own_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;
