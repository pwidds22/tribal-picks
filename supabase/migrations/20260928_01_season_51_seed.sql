-- Season 51 seed (inserted INACTIVE; activation is a separate migration).
-- Source: https://survivor.fandom.com/wiki/Survivor_51 (fetched 2026-09-28)
-- Air dates: eps 1-2 confirmed by the wiki; eps 3-13 are PROJECTED weekly
-- Wednesdays (S49/S50 pattern, 13 episodes, 26-day game). Re-verify as CBS
-- announces them — survivor pool locks key off episodes.air_date.

insert into seasons (number, name, premiere_date, finale_date, is_active)
values (51, null, '2026-09-23', '2026-12-16', false)
on conflict (number) do nothing;

with s as (select id from seasons where number = 51)
insert into castaways (season_id, name, age, hometown, occupation, tribe, photo_url)
select s.id, v.name, v.age, v.hometown, v.occupation, v.tribe, v.photo_url
from s, (values
  ('Aaliyah Puglia',     24, 'Providence, RI',     'Chef',                      'Toka', 'https://static.wikia.nocookie.net/survivor/images/5/57/S51_aaliyah_t.png/revision/latest?cb=20260904163427'),
  ('Alexis Levine',      34, 'Atlanta, GA',        'Criminal Defense Attorney', 'Savu', 'https://static.wikia.nocookie.net/survivor/images/1/17/S51_alexis_t.png/revision/latest?cb=20260904163600'),
  ('Ana Sani',           34, 'Toronto, ON',        'Voice Actress',             'Savu', 'https://static.wikia.nocookie.net/survivor/images/f/fc/S51_ana_t.png/revision/latest?cb=20260904163625'),
  ('Brady Booker',       27, 'Knoxville, TN',      'Pro Wrestler',              'Toka', 'https://static.wikia.nocookie.net/survivor/images/5/5b/S51_brady_t.png/revision/latest?cb=20260904163649'),
  ('Carter Krull',       24, 'Sioux Falls, SD',    'Livestock Farmer',          'Savu', 'https://static.wikia.nocookie.net/survivor/images/e/e0/S51_carter_t.png/revision/latest?cb=20260904163714'),
  ('Cristian Chavez',    25, 'Salt Lake City, UT', 'Head of HR',                'Savu', 'https://static.wikia.nocookie.net/survivor/images/4/45/S51_cristian_t.png/revision/latest?cb=20260904163859'),
  ('Danny Kilby',        30, 'London, ON',         'Game Designer',             'Toka', 'https://static.wikia.nocookie.net/survivor/images/9/90/S51_kilby_t.png/revision/latest?cb=20260904163958'),
  ('Devin Way',          33, 'Los Angeles, CA',    'Actor',                     'Toka', 'https://static.wikia.nocookie.net/survivor/images/4/4d/S51_devin_t.png/revision/latest?cb=20260904164029'),
  ('Eric Macksoud',      34, 'Windsor Locks, CT',  'Mental Health Counselor',   'Savu', 'https://static.wikia.nocookie.net/survivor/images/4/49/S51_eric_t.png/revision/latest?cb=20260904164057'),
  ('Jelly Loblack',      29, 'Bloomington, IN',    'Sociology Professor',       'Toka', 'https://static.wikia.nocookie.net/survivor/images/8/83/S51_jelly_t.png/revision/latest?cb=20260904164125'),
  ('Jenna Doore',        30, 'Toledo, OH',         'Wedding Photographer',      'Toka', 'https://static.wikia.nocookie.net/survivor/images/8/8f/S51_jenna_t.png/revision/latest?cb=20260904164259'),
  ('Kristin Flickinger', 49, 'Santa Barbara, CA',  'Crisis Management',         'Savu', 'https://static.wikia.nocookie.net/survivor/images/d/d2/S51_kristin_t.png/revision/latest?cb=20260904164328'),
  ('Lewis Kelly',        28, 'Corozal, PR',        'Farmer',                    'Toka', 'https://static.wikia.nocookie.net/survivor/images/d/dc/S51_lewis_t.png/revision/latest?cb=20260904164418'),
  ('Linnea Capobianco',  25, 'Jersey City, NJ',    'Entrepreneur',              'Savu', 'https://static.wikia.nocookie.net/survivor/images/7/7a/S51_linnea_t.png/revision/latest?cb=20260904164448'),
  ('Maggie Nestor',      40, 'Charles Town, WV',   'Farmer',                    'Toka', 'https://static.wikia.nocookie.net/survivor/images/7/76/S51_maggie_t.png/revision/latest?cb=20260904164519'),
  ('Mike Pinsky',        32, 'New York City, NY',  'Baseball Executive',        'Toka', 'https://static.wikia.nocookie.net/survivor/images/d/d6/S51_mike_t.png/revision/latest?cb=20260904164652'),
  ('Ori Jean-Charles',   27, 'Spring Valley, NY',  'Personal Trainer',          'Savu', 'https://static.wikia.nocookie.net/survivor/images/4/4c/S51_ori_t.png/revision/latest?cb=20260904164718'),
  ('Patt Cannaday',      33, 'Washington, DC',     'Federal Prosecutor',        'Toka', 'https://static.wikia.nocookie.net/survivor/images/0/01/S51_patt_t.png/revision/latest?cb=20260904164750'),
  ('Rob Antonson',       40, 'Cumberland, RI',     'Airline Gate Agent',        'Savu', 'https://static.wikia.nocookie.net/survivor/images/b/ba/S51_rob_t.png/revision/latest?cb=20260904164815'),
  ('Sharonda Cox',       34, 'Richmond, KY',       'Resident, OBGYN',           'Savu', 'https://static.wikia.nocookie.net/survivor/images/3/34/S51_sharonda_t.png/revision/latest?cb=20260904164838'),
  ('Thien An Nguyen',    24, 'Fort Worth, TX',     'Medical Student',           'Toka', 'https://static.wikia.nocookie.net/survivor/images/9/93/S51_thienan_t.png/revision/latest?cb=20260904164904')
) as v(name, age, hometown, occupation, tribe, photo_url)
where not exists (select 1 from castaways c where c.season_id = s.id);

-- Aliases: full name, first name, and the wiki's short name (the sync-results
-- edge function resolves names from the wiki episode guide through this table).
with s as (select id from seasons where number = 51)
insert into name_aliases (castaway_id, alias)
select c.id, a.alias
from castaways c
join s on c.season_id = s.id
cross join lateral (
  select c.name as alias
  union select split_part(c.name, ' ', 1)
  union select 'Kilby' where c.name = 'Danny Kilby'
  union select 'Thien An' where c.name = 'Thien An Nguyen'
) a
on conflict (castaway_id, alias) do nothing;

with s as (select id from seasons where number = 51)
insert into episodes (season_id, number, air_date, title)
select s.id, v.number, v.air_date::date, v.title
from s, (values
  (1,  '2026-09-23', 'Permanent Uncertainty'),
  (2,  '2026-09-30', 'Weaponized Honesty'),
  (3,  '2026-10-07', null),
  (4,  '2026-10-14', null),
  (5,  '2026-10-21', null),
  (6,  '2026-10-28', null),
  (7,  '2026-11-04', null),
  (8,  '2026-11-11', null),
  (9,  '2026-11-18', null),
  (10, '2026-11-25', null),
  (11, '2026-12-02', null),
  (12, '2026-12-09', null),
  (13, '2026-12-16', null)
) as v(number, air_date, title)
on conflict (season_id, number) do nothing;
