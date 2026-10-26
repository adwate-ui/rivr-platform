-- The tournament calendar (#35): RIVR Sunday on opening day, from the design prompt (₹10,000
-- buy-in, ₹5,00,000 guaranteed), and a weeknight turbo a week from each seeding (staging seeds on
-- every deploy), so the calendar always has a coming tournament. The practice venue's never reaches
-- the website. Each comes from a template (#115, decision 0200): RIVR Sunday's is the design prompt's
-- (₹9,000 to the pool and a ₹1,000 fee, a 30,000 stack, 20-minute levels, re-entry to the end of level 9,
-- top 8 paid); the turbo is a freezeout of 10-minute levels; the rebuy has an add-on (#116). Both venues
-- get the same structures and templates, the practice venue with ids of its own.

-- The blind structures, each from its rows: a level's small blind, big blind, ante and minutes, or a
-- break's minutes alone.
create temporary table seed_blind_level (structure text, n integer, small_blind integer, big_blind integer, ante integer, minutes integer)
on commit drop;
insert into seed_blind_level values
  ('sunday', 1, 100, 100, 100, 20), ('sunday', 2, 100, 200, 200, 20), ('sunday', 3, 150, 300, 300, 20), ('sunday', 4, 200, 400, 400, 20),
  ('sunday', 5, null, null, null, 10),
  ('sunday', 6, 250, 500, 500, 20), ('sunday', 7, 300, 600, 600, 20), ('sunday', 8, 400, 800, 800, 20), ('sunday', 9, 500, 1000, 1000, 20),
  ('sunday', 10, 600, 1200, 1200, 20),
  ('sunday', 11, null, null, null, 15),
  ('sunday', 12, 800, 1600, 1600, 20), ('sunday', 13, 1000, 2000, 2000, 20), ('sunday', 14, 1200, 2400, 2400, 20),
  ('sunday', 15, 1500, 3000, 3000, 20),
  ('sunday', 16, null, null, null, 10),
  ('sunday', 17, 2000, 4000, 4000, 20), ('sunday', 18, 2500, 5000, 5000, 20), ('sunday', 19, 3000, 6000, 6000, 20),
  ('sunday', 20, 4000, 8000, 8000, 20),
  ('sunday', 21, null, null, null, 10),
  ('sunday', 22, 5000, 10000, 10000, 20), ('sunday', 23, 6000, 12000, 12000, 20), ('sunday', 24, 8000, 16000, 16000, 20),
  ('sunday', 25, 10000, 20000, 20000, 20),
  ('sunday', 26, null, null, null, 10),
  ('sunday', 27, 12000, 24000, 24000, 20), ('sunday', 28, 15000, 30000, 30000, 20), ('sunday', 29, 20000, 40000, 40000, 20),
  ('sunday', 30, 25000, 50000, 50000, 20),
  ('turbo', 1, 100, 200, 200, 10), ('turbo', 2, 150, 300, 300, 10), ('turbo', 3, 200, 400, 400, 10), ('turbo', 4, 300, 600, 600, 10),
  ('turbo', 5, null, null, null, 10),
  ('turbo', 6, 400, 800, 800, 10), ('turbo', 7, 500, 1000, 1000, 10), ('turbo', 8, 600, 1200, 1200, 10), ('turbo', 9, 800, 1600, 1600, 10),
  ('turbo', 10, 1000, 2000, 2000, 10), ('turbo', 11, 1500, 3000, 3000, 10), ('turbo', 12, 2000, 4000, 4000, 10),
  ('turbo', 13, 3000, 6000, 6000, 10), ('turbo', 14, 4000, 8000, 8000, 10), ('turbo', 15, 5000, 10000, 10000, 10),
  ('turbo', 16, 6000, 12000, 12000, 10);

insert into public.blind_structure (id, venue_id, name, levels)
select s.id, s.venue_id, s.name,
       (select jsonb_agg(case when l.big_blind is null then jsonb_build_object('kind', 'break', 'minutes', l.minutes)
                              else jsonb_build_object('kind', 'level', 'small_blind', l.small_blind, 'big_blind', l.big_blind, 'ante', l.ante,
                                                      'minutes', l.minutes) end order by l.n)
        from seed_blind_level l where l.structure = s.structure)
from (values
  ('00000000-0000-4000-8000-0000000007b1'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, 'sunday', 'Deep, 20-minute levels'),
  ('00000000-0000-4000-8000-0000000007b2', '00000000-0000-4000-8000-000000000001', 'turbo', 'Turbo, 10-minute levels'),
  ('00000000-0000-4000-8000-0000000007b3', '00000000-0000-4000-8000-000000000002', 'sunday', 'Deep, 20-minute levels'),
  ('00000000-0000-4000-8000-0000000007b4', '00000000-0000-4000-8000-000000000002', 'turbo', 'Turbo, 10-minute levels')
) as s (id, venue_id, structure, name)
on conflict (id) do nothing;

insert into public.tournament_template (id, venue_id, name, format, buy_in_paise, fee_paise, starting_stack, blind_structure_id,
                                        last_registration_level, max_buys, add_on_paise, add_on_fee_paise, add_on_chips, places_paid, guarantee_paise)
select t.id, v.venue_id, t.name, t.format, t.buy_in_paise, t.fee_paise, t.starting_stack,
       case when t.structure = 'sunday' then v.sunday else v.turbo end,
       t.last_registration_level, t.max_buys, t.add_on_paise, t.add_on_fee_paise, t.add_on_chips, t.places_paid, t.guarantee_paise
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 0, '00000000-0000-4000-8000-0000000007b1'::uuid, '00000000-0000-4000-8000-0000000007b2'::uuid),
  ('00000000-0000-4000-8000-000000000002', 3, '00000000-0000-4000-8000-0000000007b3', '00000000-0000-4000-8000-0000000007b4')
) as v (venue_id, offset_id, sunday, turbo)
cross join lateral (values
  (('00000000-0000-4000-8000-0000000007c' || (1 + v.offset_id))::uuid, 'RIVR Sunday', 're_entry', 1000000::bigint, 100000::bigint, 30000,
   'sunday', 9, null::integer, null::bigint, null::bigint, null::integer, 8, 50000000::bigint),
  (('00000000-0000-4000-8000-0000000007c' || (2 + v.offset_id))::uuid, 'Weeknight Turbo', 'freezeout', 300000, 30000, 15000,
   'turbo', 4, null, null, null, null, 3, null),
  (('00000000-0000-4000-8000-0000000007c' || (3 + v.offset_id))::uuid, 'Rebuy Wednesday', 'rebuy', 200000, 20000, 10000,
   'turbo', 6, 4, 200000, 0, 15000, 5, null)
) as t (id, name, format, buy_in_paise, fee_paise, starting_stack, structure, last_registration_level, max_buys, add_on_paise,
        add_on_fee_paise, add_on_chips, places_paid, guarantee_paise)
on conflict (id) do nothing;

insert into public.tournament_template (id, venue_id, name, format, buy_in_paise, fee_paise, starting_stack, blind_structure_id,
                                        last_registration_level, places_paid)
values ('00000000-0000-4000-8000-0000000007c7', '00000000-0000-4000-8000-000000000002', 'Practice Sit and Go', 'freezeout', 100000, 10000,
        10000, '00000000-0000-4000-8000-0000000007b4', 2, 2)
on conflict (id) do nothing;

insert into public.tournament (id, venue_id, name, starts_at, buy_in_paise, guarantee_paise, is_published) values
  ('00000000-0000-4000-8000-0000000007a1', '00000000-0000-4000-8000-000000000001', 'RIVR Sunday', '2026-11-15 16:00:00+05:30',
   1000000, 50000000, true),
  ('00000000-0000-4000-8000-0000000007a3', '00000000-0000-4000-8000-000000000002', 'Practice Sit and Go', '2026-11-14 15:00:00+05:30',
   100000, null, true)
on conflict (id) do nothing;

insert into public.tournament (id, venue_id, name, starts_at, buy_in_paise, guarantee_paise, is_published) values
  ('00000000-0000-4000-8000-0000000007a2', '00000000-0000-4000-8000-000000000001', 'Weeknight Turbo',
   ((now() at time zone 'Asia/Kolkata')::date + 7 + time '20:00') at time zone 'Asia/Kolkata', 300000, null, true)
on conflict (id) do update set starts_at = excluded.starts_at;

-- Each seeded tournament takes what its template sets, while its clock has not started.
update public.tournament t
set template_id = p.id, format = p.format, fee_paise = p.fee_paise, starting_stack = p.starting_stack, levels = s.levels,
    last_registration_level = p.last_registration_level, max_buys = p.max_buys, add_on_paise = p.add_on_paise,
    add_on_fee_paise = p.add_on_fee_paise, add_on_chips = p.add_on_chips, places_paid = p.places_paid
from (values
  ('00000000-0000-4000-8000-0000000007a1'::uuid, '00000000-0000-4000-8000-0000000007c1'::uuid),
  ('00000000-0000-4000-8000-0000000007a2', '00000000-0000-4000-8000-0000000007c2'),
  ('00000000-0000-4000-8000-0000000007a3', '00000000-0000-4000-8000-0000000007c7')
) as seeded (tournament_id, template_id)
join public.tournament_template p on p.id = seeded.template_id
join public.blind_structure s on s.id = p.blind_structure_id
where t.id = seeded.tournament_id and t.clock_started_at is null and t.template_id is null;

-- The front page shows tonight's games and this calendar, live: 40_site.sql places them (#441).
