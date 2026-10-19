-- The tables of the design prompt, in both venues (#34; additions, "Six tables in the seed"):
-- Table 1 at 50/100 with a ₹5,000 buy-in and a ₹3,000 cap; Tables 2 to 5 at 100/200 with the
-- variation button, ₹10,000 and a ₹6,000 cap (Table 4 closed, Table 5 opening empty); the Private
-- Room at 100/200 with a compulsory ₹500 straddle, ₹20,000 and a ₹12,000 cap. Rake 5% everywhere,
-- and the ₹100 jackpot drop above ₹5,000. Amounts in paise.

insert into public.table_type (venue_id, code, name, game, has_variation, small_blind_paise, big_blind_paise,
                               buy_in_min_paise, buy_in_max_paise, straddle_paise)
select v.venue_id, t.code, t.name, 'nlh', t.has_variation, t.small_blind, t.big_blind, t.buy_in, t.buy_in, t.straddle
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
cross join (values
  ('nlh_50_100', 'NLH 50/100', false, 5000::bigint, 10000::bigint, 500000::bigint, null::bigint),
  ('nlh_100_200', 'NLH 100/200', true, 10000::bigint, 20000::bigint, 1000000::bigint, null::bigint),
  ('private_room', 'Private Room', false, 10000::bigint, 20000::bigint, 2000000::bigint, 50000::bigint)
) as t (code, name, has_variation, small_blind, big_blind, buy_in, straddle)
on conflict (venue_id, code) do nothing;

insert into public.game_table (venue_id, table_type_id, name, position, is_open)
select tt.venue_id, tt.id, t.name, t.position, t.is_open
from (values
  ('Table 1', 1, 'nlh_50_100', true),
  ('Table 2', 2, 'nlh_100_200', true),
  ('Table 3', 3, 'nlh_100_200', true),
  ('Table 4', 4, 'nlh_100_200', false),
  ('Table 5', 5, 'nlh_100_200', true),
  ('Private Room', 6, 'private_room', true)
) as t (name, position, code, is_open)
join public.table_type tt on tt.code = t.code
on conflict (venue_id, name) do nothing;

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.venue_id, 'rake.config', r.code, jsonb_build_object('rate_basis_points', 500, 'cap_paise', r.cap), '-infinity', 'Seed'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
cross join (values ('nlh_50_100', 300000), ('nlh_100_200', 600000), ('private_room', 1200000)) as r (code, cap)
on conflict (venue_id, key, subject, effective_from) do nothing;

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select v.venue_id, 'jackpot.drop', '', '{"drop_paise": 10000, "above_paise": 500000}', '-infinity', 'Seed'
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid)) as v (venue_id)
on conflict (venue_id, key, subject, effective_from) do nothing;
