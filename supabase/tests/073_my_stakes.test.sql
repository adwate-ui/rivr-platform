-- The stakes for a member's waitlist alerts (#206, decision 0069): their own club's, each once, smallest
-- first, whatever their tier; never another venue's, even for a login that is staff there. 202 Kabir is
-- a Member at the club; 301 Asha a member of the practice venue.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

-- A 50/400 training table type at the practice venue only, and the Member tier without the live floor.
insert into public.table_type (venue_id, code, name, game, small_blind_paise, big_blind_paise, buy_in_min_paise, buy_in_max_paise)
values ('00000000-0000-4000-8000-000000000002', 'nlh_50_400', 'Training', 'nlh', 5000, 40000, 100000, 500000);
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select venue_id, id, 'floor.live_view', false, 'locked', now() - interval '1 second' from public.tier
where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Member';

create temp table club_stakes as select distinct small_blind_paise, big_blind_paise from public.table_type
where venue_id = '00000000-0000-4000-8000-000000000001';
grant select on club_stakes to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select results_eq($$ select small_blind_paise, big_blind_paise from public.my_stakes() $$,
  $$ select * from club_stakes order by small_blind_paise, big_blind_paise $$, 'Kabir gets his club''s stakes, each once, smallest first');
select ok((select count(*) from public.my_stakes()) > 0, 'though his tier does not show the floor');
select is_empty($$ select * from public.my_stakes() where big_blind_paise = 40000 and small_blind_paise = 5000 $$, 'and never the practice venue''s');
reset role;

-- Staff at the practice venue too: still only his club's.
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000202', 'Kabir Sethi', 'Cashier', 'cashier', '+919000000202');
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select is_empty($$ select * from public.my_stakes() where big_blind_paise = 40000 and small_blind_paise = 5000 $$,
  'a login that is staff at the practice venue still gets only the club''s');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000301');
select ok(exists (select 1 from public.my_stakes() where small_blind_paise = 5000 and big_blind_paise = 40000), 'the practice venue''s member gets its own');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.my_stakes() $$, 'staff who are not members get none');
reset role;

select * from finish();
rollback;
