-- Bonus given each session (#1062): the Door's Today's players and the Players report's visits show the Bonus given to
-- that member that club day, by hand or by a promotion once approved; Bonus waiting is not counted. Ritika (215) is
-- checked in today; 103 Aditya is an admin, 134 Kunal a super admin.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

create temporary table days on commit drop as
select (private.tonight_began(now()) at time zone 'Asia/Kolkata')::date as today;
grant select on days to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.check_in('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215') $$, 'Ritika is checked in today');
reset role;
-- Bonus given today: 500 by hand and 1,000 from a promotion, as credit_bonus keeps both; and one given yesterday.
select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 50000, 'Bonus by hand', null, 'bonus.hand:t528-a');
select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 100000, 'Play-time bonus', null, 'promotion:t528-b');
select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000215', 70000, 'Bonus by hand', null, 'bonus.hand:t528-c');
update public.bonus_grant set created_at = now() - interval '1 day' where idempotency_key = 'bonus.hand:t528-c';

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select bonus_paise from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}')
           where member_id = '00000000-0000-4000-8000-000000000215'), 150000::bigint,
  'the door shows the Bonus given to her today, not yesterday''s');
select is((select bonus_paise from public.player_visits_page('00000000-0000-4000-8000-000000000001',
             jsonb_build_object('scope', jsonb_build_object('from', (select today from days), 'to', (select today from days)), 'page_size', 1000))
           where member_id = '00000000-0000-4000-8000-000000000215'), 150000::bigint,
  'and so does her visit in the Players report');
select is((select bonus_paise from public.door_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1000}')
           where member_id <> '00000000-0000-4000-8000-000000000215' limit 1), 0::bigint, 'one given none shows nought');
select results_eq($$ select member_id from public.door_page('00000000-0000-4000-8000-000000000001',
                      '{"page_size": 1000, "sort": {"key": "bonus", "direction": "descending"}}') limit 1 $$,
  $$ values ('00000000-0000-4000-8000-000000000215'::uuid) $$, 'the column sorts on the server');
reset role;

select * from finish();
rollback;
