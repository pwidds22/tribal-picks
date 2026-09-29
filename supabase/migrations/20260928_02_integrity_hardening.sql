-- Integrity hardening (audit 2026-09-28).
-- Before this, the DB enforced none of the game rules: no pick locks, no
-- season checks, and the "protect_*" triggers were no-ops because they read the
-- legacy `request.jwt.claim.role` GUC that current PostgREST no longer sets.
--
-- "Client request" = current_user is anon/authenticated (PostgREST switches to
-- these roles). The service role (sync-results), migrations and SECURITY
-- DEFINER functions run as other roles and are trusted.

-- ============================================================
-- Helpers
-- ============================================================

create or replace function public.is_client_request()
returns boolean language sql stable set search_path = '' as $$
  select current_user in ('anon', 'authenticated')
$$;

-- Picks lock at 8:00 PM America/New_York on the air date (matches src/core/locks.ts).
create or replace function public.episode_lock_at(p_air_date date)
returns timestamptz language sql stable set search_path = '' as $$
  select (p_air_date + time '20:00') at time zone 'America/New_York'
$$;

-- When a league's season-long picks (bracket) lock: air time of its start episode.
create or replace function public.league_lock_at(p_league_id uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select public.episode_lock_at(e.air_date)
  from leagues l
  join episodes e on e.season_id = l.season_id and e.number = l.start_episode
  where l.id = p_league_id
$$;

-- ============================================================
-- survivor_pool_picks: validate every client write
-- ============================================================

create or replace function public.validate_pool_pick()
returns trigger language plpgsql set search_path = public as $$
declare
  v_league leagues%rowtype;
  v_ep episodes%rowtype;
  v_old_ep episodes%rowtype;
  v_castaway castaways%rowtype;
begin
  if not public.is_client_request() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Ownership and scoring fields are never client-editable.
    new.user_id := old.user_id;
    new.league_id := old.league_id;
    new.is_alive := old.is_alive;
    select * into v_old_ep from episodes where id = old.episode_id;
    if now() >= public.episode_lock_at(v_old_ep.air_date) then
      raise exception 'Picks for episode % are locked', v_old_ep.number using errcode = 'P0001';
    end if;
  else
    new.is_alive := true;
  end if;

  select * into v_league from leagues where id = new.league_id;
  if v_league.game_type is distinct from 'survivor_pool' then
    raise exception 'This league is not a survivor pool' using errcode = 'P0001';
  end if;

  select * into v_ep from episodes where id = new.episode_id;
  if v_ep.id is null or v_ep.season_id <> v_league.season_id then
    raise exception 'That episode is not part of this league''s season' using errcode = 'P0001';
  end if;
  if v_ep.number < v_league.start_episode then
    raise exception 'This league starts at episode %', v_league.start_episode using errcode = 'P0001';
  end if;
  if v_ep.air_date is null or now() >= public.episode_lock_at(v_ep.air_date) then
    raise exception 'Picks for episode % are locked', v_ep.number using errcode = 'P0001';
  end if;

  select * into v_castaway from castaways where id = new.picked_castaway_id;
  if v_castaway.id is null or v_castaway.season_id <> v_league.season_id then
    raise exception 'That castaway is not in this season' using errcode = 'P0001';
  end if;
  if v_castaway.is_eliminated and v_castaway.elimination_episode < v_ep.number then
    raise exception '% has already been eliminated', v_castaway.name using errcode = 'P0001';
  end if;

  if new.winner_pick_id is not null and not exists (
    select 1 from castaways where id = new.winner_pick_id and season_id = v_league.season_id
  ) then
    raise exception 'Winner pick is not in this season' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_pool_system_fields_trigger on public.survivor_pool_picks;
drop function if exists public.protect_pool_system_fields();
drop trigger if exists validate_pool_pick_trigger on public.survivor_pool_picks;
create trigger validate_pool_pick_trigger
  before insert or update on public.survivor_pool_picks
  for each row execute function public.validate_pool_pick();

-- ============================================================
-- bracket_picks: validate every client write
-- ============================================================

create or replace function public.validate_bracket_pick()
returns trigger language plpgsql set search_path = public as $$
declare
  v_league leagues%rowtype;
  v_castaway castaways%rowtype;
  v_cast_size int;
begin
  if not public.is_client_request() then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.league_id := old.league_id;
    new.points := old.points;
    new.actual_position := old.actual_position;
  else
    new.points := 0;
    new.actual_position := null;
  end if;

  select * into v_league from leagues where id = new.league_id;
  if v_league.game_type is distinct from 'bracket' then
    raise exception 'This league is not a bracket league' using errcode = 'P0001';
  end if;
  if coalesce(now() >= public.league_lock_at(v_league.id), true) then
    raise exception 'Brackets for this league are locked' using errcode = 'P0001';
  end if;

  select * into v_castaway from castaways where id = new.castaway_id;
  if v_castaway.id is null or v_castaway.season_id <> v_league.season_id then
    raise exception 'That castaway is not in this season' using errcode = 'P0001';
  end if;
  if v_castaway.is_eliminated and v_castaway.elimination_episode < v_league.start_episode then
    raise exception '% was eliminated before this league started', v_castaway.name using errcode = 'P0001';
  end if;

  select count(*) into v_cast_size from castaways where season_id = v_league.season_id;
  if new.predicted_position < 1 or new.predicted_position > v_cast_size then
    raise exception 'Invalid bracket position %', new.predicted_position using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_bracket_system_fields_trigger on public.bracket_picks;
drop function if exists public.protect_bracket_system_fields();
drop trigger if exists validate_bracket_pick_trigger on public.bracket_picks;
create trigger validate_bracket_pick_trigger
  before insert or update on public.bracket_picks
  for each row execute function public.validate_bracket_pick();

-- One castaway per slot. Deferred so a reorder upsert can pass through
-- transient duplicates within the statement.
alter table public.bracket_picks drop constraint if exists bracket_picks_unique_position;
alter table public.bracket_picks
  add constraint bracket_picks_unique_position
  unique (league_id, user_id, predicted_position) deferrable initially deferred;

-- ============================================================
-- Hide other players' picks until they lock
-- ============================================================

drop policy if exists "Users can view pool picks in their leagues" on public.survivor_pool_picks;
drop policy if exists "View own pool picks, others after lock" on public.survivor_pool_picks;
create policy "View own pool picks, others after lock" on public.survivor_pool_picks
  for select using (
    (select auth.uid()) = user_id
    or (
      public.is_league_member(league_id)
      and exists (
        select 1 from public.episodes e
        where e.id = episode_id and now() >= public.episode_lock_at(e.air_date)
      )
    )
  );

drop policy if exists "Users can view bracket picks in their leagues" on public.bracket_picks;
drop policy if exists "View own bracket picks, others after lock" on public.bracket_picks;
create policy "View own bracket picks, others after lock" on public.bracket_picks
  for select using (
    (select auth.uid()) = user_id
    or (public.is_league_member(league_id) and now() >= public.league_lock_at(league_id))
  );

-- Who has submitted (no castaway info) — safe to show before lock.
create or replace function public.get_pool_submissions(p_league_id uuid, p_episode_id int)
returns setof uuid language sql stable security definer set search_path = public as $$
  select spp.user_id from survivor_pool_picks spp
  where spp.league_id = p_league_id
    and spp.episode_id = p_episode_id
    and public.is_league_member(p_league_id)
$$;

-- ============================================================
-- Pool standings: scope to the league's season + start episode.
-- Verified read-only 2026-09-28: identical results for all 113 existing S50
-- pool players. Without this, scoring S51 ep 1 would have marked every S50
-- pool player eliminated for "missing" an S51 episode.
-- ============================================================

create or replace function public.get_survivor_pool_standings(p_league_id uuid)
returns table(user_id uuid, username text, display_name text, is_alive boolean, eliminated_in_episode integer)
language sql stable set search_path = public as $$
  with lg as (
    select season_id, start_episode from leagues where id = p_league_id
  ),
  scored_episodes as (
    select e.id, e.number, e.air_date
    from episodes e, lg
    where e.season_id = lg.season_id and e.is_scored and e.number >= lg.start_episode
  ),
  missed_picks as (
    -- earliest scored episode a member missed (only episodes aired on/after joining)
    select lm.user_id, min(se.number) as first_missed_episode_number
    from league_members lm
    cross join scored_episodes se
    left join survivor_pool_picks spp
      on spp.league_id = p_league_id and spp.user_id = lm.user_id and spp.episode_id = se.id
    where lm.league_id = p_league_id
      and se.air_date >= lm.joined_at::date
      and spp.id is null
    group by lm.user_id
  ),
  failed_picks as (
    select spp.user_id, min(e.number) as first_failed_episode_number
    from survivor_pool_picks spp
    join episodes e on e.id = spp.episode_id
    join lg on e.season_id = lg.season_id
    where spp.league_id = p_league_id and spp.is_alive = false
    group by spp.user_id
  )
  select
    lm.user_id, p.username, p.display_name,
    (fp.first_failed_episode_number is null and mp.first_missed_episode_number is null) as is_alive,
    least(fp.first_failed_episode_number, mp.first_missed_episode_number) as eliminated_in_episode
  from league_members lm
  join profiles p on p.id = lm.user_id
  left join failed_picks fp on fp.user_id = lm.user_id
  left join missed_picks mp on mp.user_id = lm.user_id
  where lm.league_id = p_league_id
  order by is_alive desc, eliminated_in_episode desc nulls last, lm.joined_at asc;
$$;

-- Bracket standings: members only.
create or replace function public.get_bracket_standings(p_league_id uuid)
returns table(user_id uuid, username text, display_name text, total_points bigint)
language sql stable security definer set search_path = public as $$
  select lm.user_id, p.username, p.display_name, coalesce(sum(bes.episode_score), 0) as total_points
  from league_members lm
  join profiles p on p.id = lm.user_id
  left join bracket_episode_scores bes
    on bes.league_id = lm.league_id
    and bes.user_id = lm.user_id
    and bes.episode_number >= (select start_episode from leagues where id = p_league_id)
  where lm.league_id = p_league_id
    and public.is_league_member(p_league_id)
  group by lm.user_id, p.username, p.display_name, lm.joined_at
  order by total_points desc, lm.joined_at asc;
$$;

-- ============================================================
-- leagues / league_members
-- ============================================================

-- The app never updates leagues; an open UPDATE policy let commissioners
-- change season_id / game_type / start_episode mid-season.
drop policy if exists "Commissioners can update own leagues" on public.leagues;

create or replace function public.validate_new_league()
returns trigger language plpgsql set search_path = public as $$
declare
  v_ep episodes%rowtype;
begin
  if not public.is_client_request() then
    return new;
  end if;
  if not exists (select 1 from seasons where id = new.season_id and is_active) then
    raise exception 'Leagues can only be created for the current season' using errcode = 'P0001';
  end if;
  select * into v_ep from episodes where season_id = new.season_id and number = new.start_episode;
  if v_ep.id is null then
    raise exception 'Episode % does not exist', new.start_episode using errcode = 'P0001';
  end if;
  if now() >= public.episode_lock_at(v_ep.air_date) then
    raise exception 'Episode % has already aired — choose a later start episode', new.start_episode
      using errcode = 'P0001';
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists validate_new_league_trigger on public.leagues;
create trigger validate_new_league_trigger
  before insert on public.leagues
  for each row execute function public.validate_new_league();

-- joined_at drives missed-pick elimination; never trust a client value.
create or replace function public.stamp_league_member()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_client_request() then
    new.joined_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_league_member_trigger on public.league_members;
create trigger stamp_league_member_trigger
  before insert on public.league_members
  for each row execute function public.stamp_league_member();

-- ============================================================
-- profiles: premium flag / created_at not client-editable (old check was a no-op)
-- ============================================================

create or replace function public.protect_premium_status()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_client_request() then
    new.is_premium := old.is_premium;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

-- ============================================================
-- Account deletion: hand leagues to another member instead of deleting
-- everyone else's league. Only leagues with no other members are deleted.
-- ============================================================

create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  r record;
  v_heir uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  for r in select id from leagues where commissioner_id = uid loop
    select lm.user_id into v_heir
    from league_members lm
    where lm.league_id = r.id and lm.user_id <> uid
    order by lm.joined_at asc
    limit 1;

    if v_heir is not null then
      update leagues set commissioner_id = v_heir where id = r.id;
    else
      delete from bracket_episode_scores where league_id = r.id;
      delete from bracket_picks where league_id = r.id;
      delete from survivor_pool_picks where league_id = r.id;
      delete from weekly_picks where league_id = r.id;
      delete from draft_picks where league_id = r.id;
      delete from league_members where league_id = r.id;
      delete from leagues where id = r.id;
    end if;
  end loop;

  delete from bracket_episode_scores where user_id = uid;
  delete from bracket_picks where user_id = uid;
  delete from survivor_pool_picks where user_id = uid;
  delete from weekly_picks where user_id = uid;
  delete from draft_picks where user_id = uid;
  delete from league_members where user_id = uid;
  delete from profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

-- ============================================================
-- Function hygiene
-- ============================================================

alter function public.handle_new_user() set search_path = public;
alter function public.check_alias_unique_per_season() set search_path = public;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_league_member_limit() from public, anon, authenticated;
revoke execute on function public.delete_own_account() from public, anon;
revoke execute on function public.get_bracket_standings(uuid) from public, anon;
revoke execute on function public.get_pool_submissions(uuid, int) from public, anon;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.get_bracket_standings(uuid) to authenticated;
grant execute on function public.get_pool_submissions(uuid, int) to authenticated;

-- Service role bypasses RLS; this policy only added per-row overhead.
drop policy if exists "Service role can manage episode scores" on public.bracket_episode_scores;

revoke truncate on all tables in schema public from anon, authenticated;

-- ============================================================
-- Indexes for hot foreign keys
-- ============================================================

create index if not exists survivor_pool_picks_episode_id_idx on public.survivor_pool_picks (episode_id);
create index if not exists league_members_user_id_idx on public.league_members (user_id);
create index if not exists leagues_season_id_idx on public.leagues (season_id);
create index if not exists castaways_season_id_idx on public.castaways (season_id);
