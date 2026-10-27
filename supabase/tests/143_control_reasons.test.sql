-- Who sees a control's reason and whom it names (#497; question #493 P5). The club is frozen, and Kabir (202) is frozen
-- as a member. Rahul (106, a dealer), Aditya (103, an admin) and a dealer tablet see that the club is frozen, and its
-- level, but not Kabir's freeze, and no reason. Priya (109, an investor) sees neither the controls' audit rows nor their
-- outbox events. Kunal (134, a super admin) sees both controls, with their reasons, in all three places. Kabir still
-- sees his own freeze.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;

insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e143', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000001431');
insert into public.device (id, venue_id, kind, name, auth_user_id) values
  ('00000000-0000-4000-8000-00000000d143', '00000000-0000-4000-8000-000000000001', 'dealer_tablet', 'Tablet 143', '00000000-0000-4000-8000-00000000e143');

-- Engaged by a super admin, so the events and audit rows are as they are in use.
select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
reset role;
insert into public.control_state (venue_id, level, reason)
values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Police inspection');
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000202', 'Suspected chip dumping');
select private.emit('00000000-0000-4000-8000-000000000001', 'control.engaged',
                    jsonb_build_object('level', 'member_freeze', 'member_id', '00000000-0000-4000-8000-000000000202'), 'control-143');

select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select results_eq($$ select level::text, member_id from public.control_state where released_at is null and venue_id = '00000000-0000-4000-8000-000000000001' $$,
  $$ values ('venue_freeze'::text, null::uuid) $$, 'a dealer sees the club is frozen, and only that');
select is_empty($$ select * from public.control_state_detail $$, 'and reads no reason');

select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select results_eq($$ select level::text from public.control_state where released_at is null and venue_id = '00000000-0000-4000-8000-000000000001' $$,
  $$ values ('venue_freeze'::text) $$, 'an admin, who engages no control, sees the same');
select is_empty($$ select * from public.control_state_detail $$, 'and no reason either');
select is_empty($$ select * from public.outbox_event where event_type like 'control.%' $$, 'nor the control events, though he reads the outbox');

select pg_temp.as_person('00000000-0000-4000-8000-00000000e143');
select results_eq($$ select level::text from public.control_state where released_at is null and venue_id = '00000000-0000-4000-8000-000000000001' $$,
  $$ values ('venue_freeze'::text) $$, 'a dealer tablet sees the club is frozen');

select pg_temp.as_person('00000000-0000-4000-8000-000000000109');
select is_empty($$ select * from public.audit_log where entity = 'control_state' $$, 'an investor reads no audit row of a control');
select is_empty($$ select * from public.outbox_event where event_type like 'control.%' $$, 'nor its events');

select pg_temp.as_person('00000000-0000-4000-8000-000000000134');
select results_eq($$ select level::text, member_id, reason from public.control_state_detail
                     where released_at is null and venue_id = '00000000-0000-4000-8000-000000000001' order by level::text $$,
  $$ values ('member_freeze'::text, '00000000-0000-4000-8000-000000000202'::uuid, 'Suspected chip dumping'::text),
            ('venue_freeze', null::uuid, 'Police inspection') $$,
  'a super admin sees both, whom the freeze names, and why');
select is((select count(*)::integer from public.control_state where released_at is null and venue_id = '00000000-0000-4000-8000-000000000001'), 2,
  'in the table too');
select ok(exists (select 1 from public.audit_log where entity = 'control_state' and after ->> 'reason' = 'Suspected chip dumping'), 'and in the audit log');
select ok(exists (select 1 from public.outbox_event where event_type = 'control.engaged'), 'and the events');

select pg_temp.as_person('00000000-0000-4000-8000-000000000202');
select results_eq($$ select level::text from public.control_state where released_at is null order by level::text $$,
  $$ values ('member_freeze'::text), ('venue_freeze') $$, 'Kabir still sees the club frozen and his own freeze');

select * from finish();
rollback;
