-- "Your usual" (decision 0320): the member's two most-ordered items over 90 days, only theirs, nothing without history.
-- Kabir (202) has three orders; Ishaan (211) none.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
select '00000000-0000-4000-8000-000000000001', m, 'fnb.table_side', true, 'test 274'
from unnest(array['00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000211']::uuid[]) m;
insert into public.visit (venue_id, member_id) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202');

-- Chai on three orders, the sandwich on two, beer on one; one old order of fries, past 90 days.
insert into public.fnb_order (venue_id, visit_id, member_id, table_id, seat, club_day, lines, source, kot_number, created_at)
select '00000000-0000-4000-8000-000000000001',
       (select id from public.visit where member_id = '00000000-0000-4000-8000-000000000202' order by opened_at desc limit 1),
       '00000000-0000-4000-8000-000000000202', g.id, 3, current_date - o.days_ago, o.lines::jsonb, 'app', 9740 + o.n, now() - make_interval(days => o.days_ago)
from public.game_table g
cross join (values
  (1, 1, '[{"item_id": "00000000-0000-4000-8000-0000000c4a10", "name": "Masala chai", "kind": "soft_drink", "quantity": 1, "note": null},
           {"item_id": "00000000-0000-4000-8000-0000000c4a11", "name": "Club sandwich", "kind": "food", "quantity": 1, "note": null}]'),
  (2, 3, '[{"item_id": "00000000-0000-4000-8000-0000000c4a10", "name": "Masala chai", "kind": "soft_drink", "quantity": 2, "note": null},
           {"item_id": "00000000-0000-4000-8000-0000000c4a11", "name": "Club sandwich", "kind": "food", "quantity": 1, "note": null}]'),
  (3, 5, '[{"item_id": "00000000-0000-4000-8000-0000000c4a10", "name": "Masala chai", "kind": "soft_drink", "quantity": 1, "note": null},
           {"item_id": "00000000-0000-4000-8000-0000000c4a12", "name": "Beer", "kind": "bar", "quantity": 1, "note": null}]'),
  (4, 120, '[{"item_id": "00000000-0000-4000-8000-0000000c4a13", "name": "French fries", "kind": "food", "quantity": 4, "note": null},
             {"item_id": "00000000-0000-4000-8000-0000000c4a13", "name": "French fries", "kind": "food", "quantity": 4, "note": null},
             {"item_id": "00000000-0000-4000-8000-0000000c4a13", "name": "French fries", "kind": "food", "quantity": 4, "note": null},
             {"item_id": "00000000-0000-4000-8000-0000000c4a13", "name": "French fries", "kind": "food", "quantity": 4, "note": null}]')
) as o (n, days_ago, lines)
where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2';

-- Two orders of beer staff voided (decision 0302): they would make beer his usual, but a void order does not count.
insert into public.fnb_order (venue_id, visit_id, member_id, table_id, seat, club_day, lines, source, kot_number, created_at, cancelled_at, cancel_reason)
select o.venue_id, o.visit_id, o.member_id, o.table_id, o.seat, o.club_day,
       '[{"item_id": "00000000-0000-4000-8000-0000000c4a12", "name": "Beer", "kind": "bar", "quantity": 1, "note": null}]'::jsonb,
       'app', 9750 + n, now(), now(), 'Out of beer'
from public.fnb_order o cross join generate_series(1, 2) n where o.kot_number = 9741;

select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select results_eq($$ select item_id, times from public.my_usual_fnb_items() $$,
  $$ values ('00000000-0000-4000-8000-0000000c4a10'::uuid, 3), ('00000000-0000-4000-8000-0000000c4a11'::uuid, 2) $$,
  'Kabir''s usual is chai and the club sandwich: the two he ordered most in 90 days');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select is_empty($$ select * from public.my_usual_fnb_items() $$, 'Ishaan, with no orders, has no usual and reads nobody else''s');
reset role;
select throws_ok($$ set local role anon; select * from public.my_usual_fnb_items() $$, '42501', null, 'anon may not ask');

select * from finish();
rollback;
