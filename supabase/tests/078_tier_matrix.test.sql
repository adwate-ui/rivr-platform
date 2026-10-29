-- The console's Tiers screen (#32, decision 0100): tier managers read the tier x feature matrix with how
-- each feature shows to a tier, and save cells from now or later; members' access follows at once (flow
-- 21's database half). 103 is an admin (tiers.manage), 104 a cashier; 202 Kabir is a Member, 201 Arjun
-- a Black card.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Learn, the Academy and Events are off since #637 (decision 0284): this test of them turns them back on for every tier.
insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
select t.venue_id, t.id, k.key, true, 'locked', now() - interval '1 second'
from public.tier t cross join (values ('learn.library'), ('academy.booking'), ('events.book')) as k (key);

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table ids on commit drop as
select (select id from public.tier where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Member') as member_tier,
       (select id from public.tier where venue_id = '00000000-0000-4000-8000-000000000002' and name = 'Member') as practice_member_tier;
grant select on ids to authenticated;
-- One cell of the club's matrix as the screen reads it.
create function pg_temp.cell(p_tier text, p_key text) returns table (shows_as text, tiers_with_it text[], next_is_enabled boolean)
language sql as $$
  select m.shows_as, m.tiers_with_it, m.next_is_enabled from public.tier_matrix('00000000-0000-4000-8000-000000000001') m
  where m.tier_name = p_tier and m.feature_key = p_key;
$$;
grant execute on function pg_temp.cell(text, text) to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.tier_matrix('00000000-0000-4000-8000-000000000001')),
  (select count(*)::integer from public.tier t cross join public.feature f
   where t.venue_id = '00000000-0000-4000-8000-000000000001' and not t.is_retired and f.is_gateable),
  'an admin reads one cell per tier and gateable feature');
select is_empty($$ select 1 from public.tier_matrix('00000000-0000-4000-8000-000000000001') where feature_key = 'core.profile' $$,
  'core features are never in the matrix');
select results_eq($$ select * from pg_temp.cell('Member', 'learn.library') $$,
  $$ values ('enabled'::text, array['Member', 'Academy graduate', 'Founders'' Circle', 'Black card'], null::boolean) $$,
  'Learn is on for every tier at first');

-- Flow 21: Learn off for Member, locked.
select is(public.schedule_tier_cells('00000000-0000-4000-8000-000000000001',
  jsonb_build_array(jsonb_build_object('tier_id', (select member_tier from ids), 'feature_key', 'learn.library', 'is_enabled', false, 'display_mode', 'locked'))),
  1, 'an admin takes Learn from the Member tier, now');
select results_eq($$ select shows_as, tiers_with_it from pg_temp.cell('Member', 'learn.library') $$,
  $$ values ('locked'::text, array['Academy graduate', 'Founders'' Circle', 'Black card']) $$,
  'Member now sees Learn locked, naming the tiers that have it');
reset role;
select is(private.has_feature('00000000-0000-4000-8000-000000000202', 'learn.library'), false, 'so Kabir, a Member, is refused Learn');
select is(private.has_feature('00000000-0000-4000-8000-000000000201', 'learn.library'), true, 'and Arjun, a Black card, keeps it');
select ok(exists (select 1 from public.audit_log a where a.entity = 'tier_feature' and a.action = 'insert'
                  and a.after ->> 'feature_key' = 'learn.library' and a.after ->> 'is_enabled' = 'false'), 'the change is in the audit log');

-- Hidden, and a change scheduled for later.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select public.schedule_tier_cells('00000000-0000-4000-8000-000000000001',
  jsonb_build_array(jsonb_build_object('tier_id', (select member_tier from ids), 'feature_key', 'league.standings', 'is_enabled', false, 'display_mode', 'hidden')));
select is((select shows_as from pg_temp.cell('Member', 'league.standings')), 'hidden', 'a feature off and hidden shows not at all');
select public.schedule_tier_cells('00000000-0000-4000-8000-000000000001',
  jsonb_build_array(jsonb_build_object('tier_id', (select member_tier from ids), 'feature_key', 'learn.library', 'is_enabled', true, 'display_mode', 'locked')),
  now() + interval '1 day');
select results_eq($$ select shows_as, next_is_enabled from pg_temp.cell('Member', 'learn.library') $$,
  $$ values ('locked'::text, true) $$, 'a change for tomorrow waits, and the screen sees it coming');
create temporary table tomorrow on commit drop as
select next_from from public.tier_matrix('00000000-0000-4000-8000-000000000001') where tier_name = 'Member' and feature_key = 'learn.library';
select lives_ok($$ select public.schedule_tier_cells('00000000-0000-4000-8000-000000000001',
  jsonb_build_array(jsonb_build_object('tier_id', (select member_tier from ids), 'feature_key', 'learn.library', 'is_enabled', false, 'display_mode', 'hidden')),
  (select next_from from tomorrow)) $$, 'choosing again for the same day');
select is((select next_is_enabled from pg_temp.cell('Member', 'learn.library')), false, 'replaces that day''s change');
select lives_ok($$ delete from public.tier_feature where id = (select next_cell_id from public.tier_matrix('00000000-0000-4000-8000-000000000001')
                                                             where tier_name = 'Member' and feature_key = 'learn.library') $$,
  'an admin withdraws a change not yet in force');
select is((select next_is_enabled from pg_temp.cell('Member', 'learn.library')), null, 'and it is gone');

select throws_ok($$ select public.schedule_tier_cells('00000000-0000-4000-8000-000000000001',
  jsonb_build_array(jsonb_build_object('tier_id', (select member_tier from ids), 'feature_key', 'learn.library', 'is_enabled', true, 'display_mode', 'locked')),
  now() - interval '1 hour') $$, 'RVPST', null, 'never in the past');
select throws_ok($$ select public.schedule_tier_cells('00000000-0000-4000-8000-000000000001', '[]') $$, '22023', null, 'and never nothing');
select throws_ok($$ select public.schedule_tier_cells('00000000-0000-4000-8000-000000000001',
  jsonb_build_array(jsonb_build_object('tier_id', (select practice_member_tier from ids), 'feature_key', 'learn.library', 'is_enabled', false, 'display_mode', 'locked'))) $$,
  '22023', null, 'nor another venue''s tier');
select throws_ok($$ select public.schedule_tier_cells('00000000-0000-4000-8000-000000000001',
  jsonb_build_array(jsonb_build_object('tier_id', (select member_tier from ids), 'feature_key', 'core.profile', 'is_enabled', false, 'display_mode', 'locked'))) $$,
  null, null, 'nor a core feature, which is never gated');
-- The practice venue's matrix is its own.
select lives_ok($$ select public.schedule_tier_cells('00000000-0000-4000-8000-000000000002',
  jsonb_build_array(jsonb_build_object('tier_id', (select practice_member_tier from ids), 'feature_key', 'learn.drills', 'is_enabled', false, 'display_mode', 'locked'))) $$,
  'the practice venue''s matrix changes on its own');
select is((select shows_as from pg_temp.cell('Member', 'learn.drills')), 'enabled', 'leaving the club''s');

-- Nobody else.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is_empty($$ select * from public.tier_matrix('00000000-0000-4000-8000-000000000001') $$, 'a cashier reads no matrix');
select throws_ok($$ select public.schedule_tier_cells('00000000-0000-4000-8000-000000000001',
  jsonb_build_array(jsonb_build_object('tier_id', (select member_tier from ids), 'feature_key', 'learn.library', 'is_enabled', true, 'display_mode', 'locked'))) $$,
  '42501', 'Only tier managers change the matrix', 'and changes none');
reset role;
set local role anon;
select throws_ok($$ select * from public.tier_matrix('00000000-0000-4000-8000-000000000001') $$, '42501', null, 'a signed-out caller is refused');
reset role;

select * from finish();
rollback;
