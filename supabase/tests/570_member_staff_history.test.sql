-- A member's History of changes by staff (the owner, 19 Nov): floor and up read every change staff made about a member,
-- newest first, each with who, what, the fields before and after, and the reason; never the member's own changes, the
-- system's, reads, another venue's or the practice venue's. 101 Vikram is a super admin of both venues, 103 Aditya an
-- admin, 108 Karan a host, 104 Sana a cashier (made floor here for the floor's case). 211 Ishaan plays; 201 is a member.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

create temp table before_test on commit drop as select coalesce(max(id), 0) as last_id from public.audit_log;
grant select on before_test to authenticated;

-- Changes about Ishaan, oldest first: his own (left out), the system's (left out), an ID photo viewed (left out), the
-- ID check's PAN and status by the admin, a tier by the super admin, and his hours reset by the super admin (a named
-- action and its row, one change).
insert into public.audit_log (venue_id, occurred_at, actor_user_id, action, entity, entity_id, before, after, reason) values
  ('00000000-0000-4000-8000-000000000001', now() - interval '6 hours', '00000000-0000-4000-8000-000000000211', 'update', 'member',
   '00000000-0000-4000-8000-000000000211', '{"known_as": null}', '{"known_as": "Ish"}', null),
  ('00000000-0000-4000-8000-000000000001', now() - interval '5 hours', null, 'update', 'member',
   '00000000-0000-4000-8000-000000000211', '{"known_as": "Ish"}', '{"known_as": null}', null),
  ('00000000-0000-4000-8000-000000000001', now() - interval '4 hours', '00000000-0000-4000-8000-000000000103', 'kyc_image.view', 'kyc_image',
   null, null, '{"member_id": "00000000-0000-4000-8000-000000000211"}', null),
  ('00000000-0000-4000-8000-000000000001', now() - interval '3 hours', '00000000-0000-4000-8000-000000000103', 'update', 'kyc_record', null,
   '{"member_id": "00000000-0000-4000-8000-000000000211", "status": "needs_review", "pan": "ABCDE1234F", "updated_at": "2026-11-18"}',
   '{"member_id": "00000000-0000-4000-8000-000000000211", "status": "verified", "pan": "ABCDE1234G", "updated_at": "2026-11-19"}', 'Checked at the desk'),
  ('00000000-0000-4000-8000-000000000001', now() - interval '2 hours', '00000000-0000-4000-8000-000000000101', 'insert', 'member_tier_change', null,
   null, jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000211',
                            'to_tier_id', (select t.id from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' order by t.rank desc limit 1)),
   'Regular'),
  ('00000000-0000-4000-8000-000000000001', now() - interval '1 hour', '00000000-0000-4000-8000-000000000101', 'member.hours_reset', 'member',
   '00000000-0000-4000-8000-000000000211', '{"hours_counted_from": "2026-11-01T00:00:00+00:00"}',
   '{"hours_counted_from": "2026-11-19T00:00:00+00:00", "request_id": "00000000-0000-4000-8000-00000000e570"}', 'New month'),
  ('00000000-0000-4000-8000-000000000001', now() - interval '1 hour', '00000000-0000-4000-8000-000000000101', 'update', 'member',
   '00000000-0000-4000-8000-000000000211', '{"hours_counted_from": "2026-11-01T00:00:00+00:00"}',
   '{"hours_counted_from": "2026-11-19T00:00:00+00:00"}', null);

-- A line of the practice venue about its own member, by the super admin of both.
insert into public.audit_log (venue_id, occurred_at, actor_user_id, action, entity, entity_id, before, after)
select v.id, now() - interval '1 hour', '00000000-0000-4000-8000-000000000101', 'update', 'member', m.id::text, '{"known_as": null}', '{"known_as": "P"}'
from public.venue v join public.member m on m.venue_id = v.id where v.is_practice limit 1;
create temp table practice on commit drop as
select v.id as venue_id, (select a.entity_id::uuid from public.audit_log a where a.venue_id = v.id order by a.id desc limit 1) as member_id
from public.venue v where v.is_practice limit 1;
grant select on practice to authenticated;

create temp view his_changes as
select h.* from public.member_staff_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 20) h
where h.id > (select last_id from before_test);
grant select on his_changes to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select who, action, entity, reason from his_changes $$,
  $$ values ('Vikram Rao'::text, 'member.hours_reset'::text, 'member'::text, 'New month'::text),
            ('Vikram Rao', 'insert', 'member_tier_change', 'Regular'),
            ('Aditya Malhotra', 'update', 'kyc_record', 'Checked at the desk') $$,
  'an admin reads the changes staff made, newest first, with who and why; never the member''s own, the system''s or a photo viewed');
select is((select changes from his_changes where action = 'member.hours_reset'),
  '[{"entity": "member", "field": "hours_counted_from", "before": "2026-11-01T00:00:00+00:00", "after": "2026-11-19T00:00:00+00:00"}]'::jsonb,
  'one action and the row it changed are one change, its field once, before and after');
select is((select changes from his_changes where entity = 'kyc_record'),
  '[{"entity": "kyc_record", "field": "pan", "hidden": true}, {"entity": "kyc_record", "field": "status", "before": "needs_review", "after": "verified"}]'::jsonb,
  'an identity number says only that it changed; bookkeeping is left out');
select is((select changes -> 0 ->> 'after' from his_changes where entity = 'member_tier_change'),
  (select t.name from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' order by t.rank desc limit 1),
  'a tier is named, not its id');
select is((select count(*)::integer from public.member_staff_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 1)
           where id > (select last_id from before_test) and action = 'member.hours_reset'), 1, 'Show earlier asks for more; one asked for is the newest');

select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is((select count(*)::integer from his_changes), 0, 'a host reads none');
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select isnt((select count(*)::integer from his_changes), 0, 'a cashier reads them, as floor and up do (the owner, 22 Nov)');
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select count(*)::integer from his_changes), 0, 'nor a member');
reset role;
update public.staff set role = 'floor' where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from his_changes), 3, 'a floor manager reads them, as on the Door''s History');

-- A freeze of Ishaan by the super admin, and a face match found by the admin.
reset role;
insert into public.audit_log (venue_id, occurred_at, actor_user_id, action, entity, entity_id, before, after, reason) values
  ('00000000-0000-4000-8000-000000000001', now() - interval '30 minutes', '00000000-0000-4000-8000-000000000101', 'insert', 'control_state',
   null, null, '{"member_id": "00000000-0000-4000-8000-000000000211", "level": "member_freeze"}', 'A dispute'),
  ('00000000-0000-4000-8000-000000000001', now() - interval '20 minutes', '00000000-0000-4000-8000-000000000103', 'update', 'kyc_record', null,
   '{"member_id": "00000000-0000-4000-8000-000000000211", "same_face_as": null}',
   '{"member_id": "00000000-0000-4000-8000-000000000211", "same_face_as": "00000000-0000-4000-8000-000000000201"}', null);
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select is((select count(*)::integer from his_changes where entity = 'control_state'), 0, 'a floor manager reads no freeze, who or why');
select is((select changes from his_changes where entity = 'kyc_record' and changes -> 0 ->> 'field' = 'same_face_as'),
  '[{"entity": "kyc_record", "field": "same_face_as", "hidden": true}]'::jsonb, 'a face match says only that it changed, never whose face');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from his_changes where entity = 'control_state'), 0, 'nor does an admin');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select count(*)::integer from his_changes where entity = 'control_state'), 1, 'a super admin reads the freeze');
reset role;

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select is((select count(*)::integer from practice p, public.member_staff_history('00000000-0000-4000-8000-000000000001', p.member_id, 20) h), 0,
  'the practice venue''s member is never read through the club, even by a super admin of both');
select is((select count(*)::integer from practice p, public.member_staff_history(p.venue_id, '00000000-0000-4000-8000-000000000211', 20) h), 0,
  'nor the club''s member through the practice venue');
select ok((select count(*)::integer from practice p, public.member_staff_history(p.venue_id, p.member_id, 20) h) >= 1,
  'the practice venue''s own staff read its member there');
reset role;

set local role anon;
select throws_ok($$ select * from public.member_staff_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 20) $$,
  '42501', null, 'anonymous callers cannot run it');
reset role;
select ok(not has_function_privilege('authenticated', 'private.staff_history_changes(uuid, text, jsonb, jsonb)', 'execute'),
  'its helpers are not for callers');

select * from finish();
rollback;
