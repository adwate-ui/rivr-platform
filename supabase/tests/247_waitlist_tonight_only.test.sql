-- A waitlist place from an earlier night (decision 0300): it reads on no list and counts in no wait, and the every-minute
-- job closes it as night ended; tonight's place is untouched. Arjun (201) has a place left from last night; Kabir (202)
-- one from tonight.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

create temp table game as select id from public.table_type where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'nlh_100_200';
grant select on game to authenticated;
delete from public.waitlist_entry where member_id in ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202');
insert into public.waitlist_entry (venue_id, member_id, table_type_id, joined_at, approved_at, status, idempotency_key) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000201', (select id from game),
   private.tonight_began(now()) - interval '3 hours', private.tonight_began(now()) - interval '3 hours', 'waiting', gen_random_uuid()),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', (select id from game),
   now(), now(), 'waiting', gen_random_uuid());

select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select count(*)::integer from public.my_waitlist()), 0, 'last night''s place is not on Arjun''s Home');
create temp table tonight_wait as select waiting from public.waitlist_lengths() where table_type_id = (select id from game);
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select results_eq($$ select place is not null from public.my_waitlist() $$, $$ values (true) $$, 'tonight''s place has its number');

reset role;
select is((select count(*)::integer from public.waitlist_entry e where e.table_type_id = (select id from game) and e.status = 'waiting'
           and e.approved_at is not null and e.joined_at >= private.tonight_began(now())),
  (select waiting from tonight_wait), 'the wait counts tonight''s places only');

select private.expire_waitlist_holds();
select results_eq($$ select status, left_reason from public.waitlist_entry where member_id = '00000000-0000-4000-8000-000000000201' $$,
  $$ values ('left'::text, 'night_ended'::text) $$, 'the every-minute job closes last night''s place, as night ended');
select results_eq($$ select status from public.waitlist_entry where member_id = '00000000-0000-4000-8000-000000000202' $$,
  $$ values ('waiting'::text) $$, 'and leaves tonight''s alone');

select * from finish();
rollback;
