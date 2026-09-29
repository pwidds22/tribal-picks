-- Leagues created after the S50 finale (2026-05-20) were meant for Season 51:
-- while S50 was still the active season, the app silently attached them to
-- the finished season. Move them to S51 starting at Episode 2 (Episode 1
-- already aired). Same league, members and invite code. Approved by the
-- owner 2026-09-29. Verified beforehand: 123 leagues, 177 members, zero
-- picks or scores — the guards below keep it that way if anything changed.

update leagues l
set season_id = (select id from seasons where number = 51),
    start_episode = 2
where l.season_id = (select id from seasons where number = 50)
  and l.created_at >= '2026-05-21'
  and not exists (select 1 from bracket_picks bp where bp.league_id = l.id)
  and not exists (select 1 from survivor_pool_picks p where p.league_id = l.id)
  and not exists (select 1 from bracket_episode_scores s where s.league_id = l.id);
