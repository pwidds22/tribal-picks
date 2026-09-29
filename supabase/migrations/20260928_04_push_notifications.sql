-- Push notifications via Expo's push service (https://exp.host).
-- Devices register through register_push_token(); sending happens in SQL via
-- pg_net so no edge-function secret is needed. Senders are not callable by clients.

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;

drop policy if exists "Users delete own push tokens" on public.push_tokens;
create policy "Users delete own push tokens" on public.push_tokens
  for delete using ((select auth.uid()) = user_id);

-- Upsert that also reassigns a token when a different user signs in on the
-- same device (a plain upsert would fail RLS on the other user's row).
create or replace function public.register_push_token(p_token text, p_platform text)
returns void language sql security definer set search_path = public as $$
  insert into push_tokens (token, user_id, platform, updated_at)
  select p_token, auth.uid(), p_platform, now()
  where auth.uid() is not null
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
$$;
revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- Send one notification to the given users (null = everyone), 100 per request.
create or replace function public.send_push(
  p_user_ids uuid[], p_title text, p_body text, p_route text default null
) returns int language plpgsql security definer set search_path = public as $$
declare
  b record;
  v_sent int := 0;
begin
  for b in
    select jsonb_agg(jsonb_build_object(
             'to', token, 'title', p_title, 'body', p_body, 'sound', 'default',
             'data', jsonb_build_object('route', p_route))) as msgs,
           count(*) as n
    from (
      select token, (row_number() over (order by token) - 1) / 100 as grp
      from push_tokens
      where p_user_ids is null or user_id = any (p_user_ids)
    ) t
    group by grp
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := b.msgs,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
    v_sent := v_sent + b.n;
  end loop;
  return v_sent;
end;
$$;
revoke execute on function public.send_push(uuid[], text, text, text) from public, anon, authenticated;

-- Air-day reminder: players in current-season leagues who still need to act
-- on tonight's episode (alive pool players without a pick; bracket leagues
-- starting tonight without a bracket).
create or replace function public.send_pick_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_ep episodes%rowtype;
  v_users uuid[];
begin
  select e.* into v_ep
  from episodes e join seasons s on s.id = e.season_id and s.is_active
  where e.air_date = (now() at time zone 'America/New_York')::date and not e.is_scored
  limit 1;
  if v_ep.id is null then
    return 0;
  end if;

  select array_agg(distinct lm.user_id) into v_users
  from league_members lm
  join leagues l on l.id = lm.league_id and l.season_id = v_ep.season_id
  where (
    l.game_type = 'survivor_pool'
    and l.start_episode <= v_ep.number
    and not exists (
      select 1 from survivor_pool_picks p
      where p.league_id = l.id and p.user_id = lm.user_id and p.episode_id = v_ep.id
    )
    and exists (
      select 1 from get_survivor_pool_standings(l.id) st
      where st.user_id = lm.user_id and st.is_alive
    )
  ) or (
    l.game_type = 'bracket'
    and l.start_episode = v_ep.number
    and not exists (
      select 1 from bracket_picks bp where bp.league_id = l.id and bp.user_id = lm.user_id
    )
  );

  if v_users is null then
    return 0;
  end if;

  return send_push(
    v_users,
    'Picks lock at 8 PM ET',
    format('Episode %s airs tonight — make your pick before it locks.', v_ep.number),
    '/picks'
  );
end;
$$;
revoke execute on function public.send_pick_reminders() from public, anon, authenticated;

-- Wednesdays 20:00 UTC = 4 PM EDT / 3 PM EST.
select cron.unschedule('pick-reminders') where exists (select 1 from cron.job where jobname = 'pick-reminders');
select cron.schedule('pick-reminders', '0 20 * * 3', 'select public.send_pick_reminders()');
