-- A staff member's console density (console v3, phase 1; decision 0442). Sana (104) is a cashier at the club and the
-- practice venue; Vikram (101) a super admin at both. Each reads and writes only their own rows, at the venue of the record;
-- nobody else, not even a super admin, reads them; and nothing about them leaves the database.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.staff_of(p_person text, p_venue text) returns uuid language sql as $$
  select id from public.staff where user_id = p_person::uuid and venue_id = p_venue::uuid;
$$;
create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.staff_of(text, text), pg_temp.as_person(text) to authenticated, anon;

create temp table ids as select
  pg_temp.staff_of('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001') as sana_club,
  pg_temp.staff_of('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000002') as sana_practice,
  pg_temp.staff_of('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001') as vikram_club,
  (select count(*) from public.outbox_event) as outbox_before;
grant select on ids to authenticated, anon;
select isnt((select sana_club from ids), null, 'the seed has Sana at the club');
select isnt((select sana_practice from ids), null, 'and at the practice venue');

-- Sana keeps compact rows at both venues, as the console writes them together.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select lives_ok($$ insert into public.staff_preference (staff_id, venue_id, density)
                   select sana_club, '00000000-0000-4000-8000-000000000001'::uuid, 'compact' from ids
                   union all select sana_practice, '00000000-0000-4000-8000-000000000002'::uuid, 'compact' from ids $$,
  'Sana keeps her density at the club and the practice venue');
select results_eq($$ select venue_id::text, density from public.staff_preference order by venue_id $$,
  $$ values ('00000000-0000-4000-8000-000000000001'::text, 'compact'::text), ('00000000-0000-4000-8000-000000000002', 'compact') $$,
  'and reads both back');
select lives_ok($$ insert into public.staff_preference (staff_id, venue_id, density)
                   select sana_club, '00000000-0000-4000-8000-000000000001', 'comfortable' from ids
                   on conflict (staff_id) do update set density = excluded.density $$, 'she changes it as the console does, by upsert');
select is((select density from public.staff_preference where venue_id = '00000000-0000-4000-8000-000000000001'), 'comfortable',
  'and the change holds');

-- Never anyone else's record, nor her own under another venue.
select throws_ok($$ insert into public.staff_preference (staff_id, venue_id, density)
                    select vikram_club, '00000000-0000-4000-8000-000000000001', 'compact' from ids $$,
  '42501', null, 'Sana cannot keep a density for Vikram');
select throws_ok($$ insert into public.staff_preference (staff_id, venue_id, density)
                    select sana_club, '00000000-0000-4000-8000-000000000002', 'compact' from ids $$,
  '42501', null, 'nor file her club record under the practice venue');
select throws_ok($$ update public.staff_preference set venue_id = '00000000-0000-4000-8000-000000000002'
                    where staff_id = (select sana_club from ids) $$,
  '42501', null, 'nor move it there');
select throws_ok($$ insert into public.staff_preference (staff_id, venue_id, density)
                    select sana_practice, '00000000-0000-4000-8000-000000000002', 'tiny' from ids
                    on conflict (staff_id) do update set density = excluded.density $$,
  '23514', null, 'a density other than comfortable or compact is refused');
select throws_ok($$ delete from public.staff_preference $$, '42501', null, 'and no one deletes a row from the console');

-- Vikram, a super admin, neither sees Sana's rows nor changes them.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is_empty($$ select 1 from public.staff_preference $$, 'a super admin reads no one else''s density');
update public.staff_preference set density = 'compact' where staff_id = (select sana_club from ids);
reset role;
select is((select density from public.staff_preference where staff_id = (select sana_club from ids)), 'comfortable',
  'nor changes it');

-- Vikram keeps his own; Sana's upsert of his record, the console's own statement, is refused before the conflict.
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
insert into public.staff_preference (staff_id, venue_id, density) select vikram_club, '00000000-0000-4000-8000-000000000001', 'compact' from ids;
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ insert into public.staff_preference (staff_id, venue_id, density)
                    select vikram_club, '00000000-0000-4000-8000-000000000001', 'comfortable' from ids
                    on conflict (staff_id) do update set density = excluded.density $$,
  '42501', null, 'Sana cannot upsert over Vikram''s row');
select throws_ok($$ update public.staff_preference set staff_id = (select vikram_club from ids) where staff_id = (select sana_club from ids) $$,
  '42501', null, 'nor point her row at his record');
reset role;
select is((select density from public.staff_preference where staff_id = (select vikram_club from ids)), 'compact', 'Vikram''s choice stands');

-- A member who is not staff reads and writes nothing.
select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select is_empty($$ select 1 from public.staff_preference $$, 'a member reads no staff density');
select throws_ok($$ insert into public.staff_preference (staff_id, venue_id, density)
                    select sana_club, '00000000-0000-4000-8000-000000000001', 'compact' from ids $$,
  '42501', null, 'nor writes one');
reset role;

-- Staff whose console access is revoked lose their row with it, reading and writing.
insert into public.control_state (venue_id, level, staff_id, reason)
select '00000000-0000-4000-8000-000000000001', 'access_revoke', sana_club, 'Test 297: lost phone' from ids;
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select venue_id::text from public.staff_preference $$, $$ values ('00000000-0000-4000-8000-000000000002'::text) $$,
  'revoked at the club, Sana reads only her practice venue''s row');
select throws_ok($$ insert into public.staff_preference (staff_id, venue_id, density)
                    select sana_club, '00000000-0000-4000-8000-000000000001', 'compact' from ids
                    on conflict (staff_id) do update set density = excluded.density $$,
  '42501', null, 'and cannot change the club''s');
reset role;
update public.control_state set released_at = now(), release_reason = 'Test 297: found', released_by_staff_id = (select vikram_club from ids)
where staff_id = (select sana_club from ids) and level = 'access_revoke' and released_at is null;

-- Someone signed out reads nothing; staff taken off the rota lose theirs with the console.
set local role anon;
select throws_ok($$ select 1 from public.staff_preference $$, '42501', null, 'the public cannot read the table at all');
select throws_ok($$ insert into public.staff_preference (staff_id, venue_id, density)
                    values ('00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-000000000001', 'compact') $$,
  '42501', null, 'nor write to it');
reset role;
update public.staff set is_active = false where id = (select sana_club from ids);
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select results_eq($$ select venue_id::text from public.staff_preference $$, $$ values ('00000000-0000-4000-8000-000000000002'::text) $$,
  'deactivated at the club, Sana reads only her practice venue''s row');
select throws_ok($$ insert into public.staff_preference (staff_id, venue_id, density)
                    select sana_club, '00000000-0000-4000-8000-000000000001', 'compact' from ids
                    on conflict (staff_id) do update set density = excluded.density $$,
  '42501', null, 'and cannot change the club''s');
reset role;

-- A practice reset and a live purge keep it, as they keep the staff record it belongs to (decision 0442).
select ok(not ('staff_preference' in (select private.practice_reset_tables())), 'the practice reset keeps the practice venue''s densities');
select ok(not ('staff_preference' in (select private.live_purge_tables())), 'and a live purge keeps the club''s');

-- A setting of the console only: nothing went to the outbox, from either venue.
select is((select count(*) from public.outbox_event), (select outbox_before from ids), 'no outbox event, so nothing reaches an external system');

select * from finish();
rollback;
