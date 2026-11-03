-- A seat held for a waitlist call names its place (decision 0302), so the live floor seats the member there in one press.
-- 103 Aditya (admin) calls 212 Vihaan to Table 2, seat 7.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temp table entry as select gen_random_uuid() as id;
grant select on entry to authenticated;
insert into public.waitlist_entry (id, venue_id, member_id, table_type_id, table_id, joined_at, approved_at, status, idempotency_key)
select (select id from entry), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', g.table_type_id, g.id, now(), now(), 'waiting', gen_random_uuid()
from public.game_table g where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 2';

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.call_from_waitlist((select id from entry),
  (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 2'), 7);
select results_eq($$ select seat, full_name, entry_id from public.held_seats('00000000-0000-4000-8000-000000000001') where entry_id = (select id from entry) $$,
  $$ values (7, 'Vihaan Kapoor'::text, (select id from entry)) $$, 'the held seat names Vihaan''s place on the list');
select lives_ok($$ select public.seat_from_waitlist((select id from entry)) $$, 'so the floor seats him from it');
select is_empty($$ select 1 from public.held_seats('00000000-0000-4000-8000-000000000001') where entry_id = (select id from entry) $$,
  'and the seat is held no more');
reset role;

select * from finish();
rollback;
