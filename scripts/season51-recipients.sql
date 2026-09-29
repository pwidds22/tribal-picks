-- Recipients for scripts/send-announcement.mjs (Season 51 launch email).
-- Run in the Supabase SQL editor; save the single JSON value as
-- scripts/s51.recipients.json (gitignored — it contains user emails).
--
-- Segments (first match wins):
--   moved     — in a league created for S51 before launch (moved from S50 on 2026-09-29)
--   (skipped) — only in S51 leagues created after launch: already playing
--   returning — played Season 50
--   new       — never joined a league
with seg as (
  select
    au.email,
    au.created_at,
    case
      when exists (select 1 from league_members lm join leagues l on l.id = lm.league_id
                   where lm.user_id = au.id and l.season_id = 2 and l.created_at < '2026-09-28') then 'moved'
      when exists (select 1 from league_members lm join leagues l on l.id = lm.league_id
                   where lm.user_id = au.id and l.season_id = 2) then 'skip'
      when exists (select 1 from league_members lm join leagues l on l.id = lm.league_id
                   where lm.user_id = au.id and l.season_id = 1) then 'returning'
      else 'new'
    end as segment,
    (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'code', l.invite_code, 'game_type', l.game_type)
                               order by l.created_at), '[]'::jsonb)
     from league_members lm join leagues l on l.id = lm.league_id
     where lm.user_id = au.id and l.season_id = 2 and l.created_at < '2026-09-28') as leagues
  from auth.users au
  where au.email is not null
)
select jsonb_agg(jsonb_build_object('email', lower(email), 'segment', segment, 'leagues', leagues)
                 order by created_at desc)
from seg
where segment <> 'skip';
