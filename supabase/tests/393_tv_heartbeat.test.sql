-- A TV reports in (audit F-083): only a TV's own session, only for itself; the venue's staff read it, no other venue's do;
-- an unpaired TV reports nothing; and a report writes no audit row.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', person, 'role', 'authenticated')::text, true);
$$;

insert into auth.users (id, instance_id, aud, role, phone, raw_app_meta_data) values
  ('00000000-0000-4000-8000-00000000f301', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '919000093301', '{}'),
  ('00000000-0000-4000-8000-00000000f302', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '919000093302', '{}');
insert into public.device (id, venue_id, kind, name, auth_user_id)
select tv.id, v.id, 'tv', tv.name, tv.login
from public.venue v
cross join (values ('00000000-0000-4000-8000-00000000f311'::uuid, 'Report TV', '00000000-0000-4000-8000-00000000f301'::uuid),
                   ('00000000-0000-4000-8000-00000000f312'::uuid, 'Other TV', '00000000-0000-4000-8000-00000000f302'::uuid)) as tv(id, name, login)
where not v.is_practice
limit 2;

create temporary table audit_before on commit drop as select count(*) as n from public.audit_log where entity = 'tv_heartbeat';
grant select on audit_before to authenticated;

select pg_temp.as_person('00000000-0000-4000-8000-00000000f301');
select lives_ok($$ select public.tv_report_in() $$, 'a TV reports in');
reset role;
select is((select count(*)::integer from public.tv_heartbeat where device_id = '00000000-0000-4000-8000-00000000f311'), 1, 'its report is kept');
select is((select count(*)::integer from public.tv_heartbeat where device_id = '00000000-0000-4000-8000-00000000f312'), 0, 'and no other TV is marked');

update public.tv_heartbeat set last_seen_at = now() - interval '1 hour' where device_id = '00000000-0000-4000-8000-00000000f311';
select pg_temp.as_person('00000000-0000-4000-8000-00000000f301');
select public.tv_report_in();
reset role;
select ok((select last_seen_at > now() - interval '1 minute' from public.tv_heartbeat where device_id = '00000000-0000-4000-8000-00000000f311'), 'a later report moves the time on');
select is((select count(*)::integer from public.tv_heartbeat where device_id = '00000000-0000-4000-8000-00000000f311'), 1, 'and stays one row');
select is((select count(*) from public.audit_log where entity = 'tv_heartbeat'), (select n from audit_before), 'a report writes no audit row');

-- Staff: the seed's floor manager sees it, and reporting in as staff marks nothing.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.tv_heartbeat where device_id = '00000000-0000-4000-8000-00000000f311'), 1, 'the venue''s staff read it');
select lives_ok($$ select public.tv_report_in() $$, 'reporting in as staff does nothing, quietly');
reset role;
select is((select count(*)::integer from public.tv_heartbeat), 1, 'and marks no device');

-- Another venue's TV: this venue's staff read nothing of it. Operations create venues signed out.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000f5', 'Far room', 'far-room-393', false, 'Far room', 'Elsewhere', 'FAR');
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000f303', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '919000093303');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000f313', '00000000-0000-4000-8000-0000000000f5', 'tv', 'Far TV', '00000000-0000-4000-8000-00000000f303');
insert into public.tv_heartbeat (device_id, venue_id) values ('00000000-0000-4000-8000-00000000f313', '00000000-0000-4000-8000-0000000000f5');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is((select count(*)::integer from public.tv_heartbeat where device_id = '00000000-0000-4000-8000-00000000f313'), 0, 'another venue''s staff read nothing of it');
reset role;
delete from public.tv_heartbeat where device_id = '00000000-0000-4000-8000-00000000f313';

-- A member reads nothing of it.
select pg_temp.as_person('00000000-0000-4000-8000-000000000201');
select is((select count(*)::integer from public.tv_heartbeat), 0, 'a member reads no report');
reset role;

-- Unpaired: nothing further is recorded.
update public.tv_heartbeat set last_seen_at = now() - interval '1 hour' where device_id = '00000000-0000-4000-8000-00000000f311';
update public.device set revoked_at = now(), revoked_reason = 'test' where id = '00000000-0000-4000-8000-00000000f311';
select pg_temp.as_person('00000000-0000-4000-8000-00000000f301');
select public.tv_report_in();
reset role;
select ok((select last_seen_at < now() - interval '30 minutes' from public.tv_heartbeat where device_id = '00000000-0000-4000-8000-00000000f311'), 'an unpaired TV reports nothing');

set local role anon;
select throws_ok($$ select public.tv_report_in() $$, '42501', null, 'nobody signed in may call it');
reset role;

select * from finish();
rollback;
