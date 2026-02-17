-- ============================================
-- Tribal Picks: Survivor Fantasy
-- Seed Data: Season 50
-- ============================================

-- Season 50
insert into seasons (number, name, premiere_date, is_active)
values (50, 'In the Hands of the Fans', '2026-02-25', true)
on conflict (number) do nothing;

-- Castaways — Cila Tribe (Orange)
insert into castaways (season_id, name, tribe, hometown, occupation) values
  ((select id from seasons where number = 50), 'Christian Hubicki', 'Cila', 'Tallahassee, FL', 'Robotics Scientist'),
  ((select id from seasons where number = 50), 'Cirie Fields', 'Cila', 'Jersey City, NJ', 'Nurse'),
  ((select id from seasons where number = 50), 'Emily Flippen', 'Cila', NULL, NULL),
  ((select id from seasons where number = 50), 'Jenna Lewis', 'Cila', NULL, NULL),
  ((select id from seasons where number = 50), 'Joe Hunter', 'Cila', NULL, NULL),
  ((select id from seasons where number = 50), 'Ozzy Lusth', 'Cila', 'Venice, CA', 'Challenge Beast'),
  ((select id from seasons where number = 50), 'Rick Devens', 'Cila', 'Macon, GA', 'News Anchor'),
  ((select id from seasons where number = 50), 'Savannah Louie', 'Cila', NULL, NULL);

-- Castaways — Kalo Tribe (Green)
insert into castaways (season_id, name, tribe, hometown, occupation) values
  ((select id from seasons where number = 50), 'Charlie Davis', 'Kalo', 'Boston, MA', NULL),
  ((select id from seasons where number = 50), 'Chrissy Hofbeck', 'Kalo', 'The Villages, FL', 'Actuary'),
  ((select id from seasons where number = 50), 'Coach Wade', 'Kalo', 'Susanville, CA', 'Soccer Coach'),
  ((select id from seasons where number = 50), 'Dee Valladares', 'Kalo', 'Miami, FL', NULL),
  ((select id from seasons where number = 50), 'Jonathan Young', 'Kalo', NULL, NULL),
  ((select id from seasons where number = 50), 'Kamilla Karthigesu', 'Kalo', NULL, NULL),
  ((select id from seasons where number = 50), 'Mike White', 'Kalo', NULL, 'TV Producer / Writer'),
  ((select id from seasons where number = 50), 'Tiffany Ervin', 'Kalo', NULL, NULL);

-- Castaways — Vatu Tribe (Pink)
insert into castaways (season_id, name, tribe, hometown, occupation) values
  ((select id from seasons where number = 50), 'Angelina Keeley', 'Vatu', 'San Diego, CA', NULL),
  ((select id from seasons where number = 50), 'Aubry Bracco', 'Vatu', 'Hampton Falls, NH', 'Marketing Director'),
  ((select id from seasons where number = 50), 'Colby Donaldson', 'Vatu', 'Austin, TX', NULL),
  ((select id from seasons where number = 50), 'Genevieve Mushaluk', 'Vatu', NULL, NULL),
  ((select id from seasons where number = 50), 'Kyle Fraser', 'Vatu', NULL, NULL),
  ((select id from seasons where number = 50), 'Q Burdette', 'Vatu', NULL, NULL),
  ((select id from seasons where number = 50), 'Rizo Velovic', 'Vatu', NULL, NULL),
  ((select id from seasons where number = 50), 'Stephenie LaGrossa', 'Vatu', NULL, NULL);

-- Episodes (placeholder — dates are Wednesdays at 8pm ET)
insert into episodes (season_id, number, air_date) values
  ((select id from seasons where number = 50), 1, '2026-02-25'),
  ((select id from seasons where number = 50), 2, '2026-03-04'),
  ((select id from seasons where number = 50), 3, '2026-03-11'),
  ((select id from seasons where number = 50), 4, '2026-03-18'),
  ((select id from seasons where number = 50), 5, '2026-03-25'),
  ((select id from seasons where number = 50), 6, '2026-04-01'),
  ((select id from seasons where number = 50), 7, '2026-04-08'),
  ((select id from seasons where number = 50), 8, '2026-04-15'),
  ((select id from seasons where number = 50), 9, '2026-04-22'),
  ((select id from seasons where number = 50), 10, '2026-04-29'),
  ((select id from seasons where number = 50), 11, '2026-05-06'),
  ((select id from seasons where number = 50), 12, '2026-05-13'),
  ((select id from seasons where number = 50), 13, '2026-05-20');
