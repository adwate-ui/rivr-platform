-- Food and drink's orders and the top-ups, tonight and past, carry the id of the member each is for (owner, 19 Nov), so
-- the console's names open their account; what they read before stays. 101 Vikram is a super admin, 103 an admin,
-- 202 and 211 members at the club.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table today as select private.club_day_of(now()) as day;
grant select on today to authenticated;

-- An order tonight at Table 2, seat 3, for member 202.
insert into public.visit (venue_id, member_id)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202'
where not exists (select 1 from public.visit where member_id = '00000000-0000-4000-8000-000000000202' and closed_at is null);
insert into public.fnb_order (venue_id, visit_id, member_id, table_id, seat, club_day, lines, source, kot_number, idempotency_key)
select '00000000-0000-4000-8000-000000000001',
       (select id from public.visit where member_id = '00000000-0000-4000-8000-000000000202' order by opened_at desc limit 1),
       '00000000-0000-4000-8000-000000000202', g.id, 3, private.club_day_now(),
       '[{"item_id": "00000000-0000-4000-8000-000000000999", "name": "Masala chai", "kind": "soft_drink", "quantity": 1, "note": null}]'::jsonb,
       'app', 9581, '00000000-0000-4000-8000-00000000f581'
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2';

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select member_id, member_number, state from public.fnb_orders_page('00000000-0000-4000-8000-000000000001', '{}') where kot_number = 9581 $$,
  $$ values ('00000000-0000-4000-8000-000000000202'::uuid, (select member_number from public.member where id = '00000000-0000-4000-8000-000000000202'), 'to_accept') $$,
  'an order names its member by id, beside the name and number it gave');
reset role;

-- Member 211 seated at Table 3 asks for a top-up.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select isnt(public.seat_member((select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), 1, '9000000211'),
  null, 'the floor seats member 211');
select pg_temp.as_person('00000000-0000-4000-8000-000000000211');
select lives_ok($$ select public.request_top_up() $$, 'who asks for a top-up');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select member_id, status from public.top_ups_tonight('00000000-0000-4000-8000-000000000001') where seat = 1 and table_name = 'Table 3' $$,
  $$ values ('00000000-0000-4000-8000-000000000211'::uuid, 'requested') $$, 'tonight''s top-up names its member by id');
select results_eq($$ select member_id, total > 0 from public.top_up_history('00000000-0000-4000-8000-000000000001', (select day from today), 1, 50)
                    where table_name = 'Table 3' and seat = 1 $$,
  $$ values ('00000000-0000-4000-8000-000000000211'::uuid, true) $$, 'and so does the day''s list, still with its count');
reset role;

-- An erased member is named by no id.
update public.member set erased_at = now(), phone = null, user_id = null, full_name = 'Erased member', qualifying_small_blind = null, known_as = null
where id = '00000000-0000-4000-8000-000000000202';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select member_id from public.fnb_orders_page('00000000-0000-4000-8000-000000000001', '{}') where kot_number = 9581), null::uuid,
  'an order for an erased member names no id');
reset role;

select * from finish();
rollback;
