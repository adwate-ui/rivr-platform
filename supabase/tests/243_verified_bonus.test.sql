-- The pre-registration bonus (decision 0298): a member whose identity check is verified gets points.verified_bonus once,
-- whichever way they are verified; none set gives none; the 0 set from 15 November ends it at launch; never at the
-- practice venue. Kabir (202), Naina (203) and Rohan (204) have no check yet in the seed.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.points(p_member uuid) returns bigint language sql as $$
  select -private.account_balance(a.id) from public.ledger_account a where a.member_id = p_member and a.code = 'member.points';
$$;
create function pg_temp.verify(p_member uuid) returns void language sql as $$
  insert into public.kyc_record (venue_id, member_id, status, verified_at, date_of_birth, photo_path)
  values ('00000000-0000-4000-8000-000000000001', p_member, 'verified', now(), '1990-01-01',
          '00000000-0000-4000-8000-000000000001/' || p_member || '/selfie.jpg')
  on conflict (member_id) do update set status = 'verified', verified_at = now();
$$;

select is(private.setting_at('00000000-0000-4000-8000-000000000001', 'points.verified_bonus', '', '2026-11-15T00:00:00+05:30'),
  '{"points": 0}'::jsonb, 'the bonus is 0 from launch');
-- From here the test runs as before launch, whatever the day it runs on.
delete from public.setting where key = 'points.verified_bonus';

-- None set: Kabir is verified and gets nothing.
select pg_temp.verify('00000000-0000-4000-8000-000000000202');
select is(pg_temp.points('00000000-0000-4000-8000-000000000202'), 0::bigint, 'no bonus while none is set');

-- The club sets 500. Naina starts a check and is verified later; she gets 500, as points she can spend.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'points.verified_bonus', '', '{"points": 500}', '-infinity', 'Bonus test');
insert into public.kyc_record (venue_id, member_id, date_of_birth, photo_path)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000203', '1990-01-01',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000203/selfie.jpg');
select is(pg_temp.points('00000000-0000-4000-8000-000000000203'), 0::bigint, 'a check started gives nothing yet');
update public.kyc_record set status = 'verified', verified_at = now() where member_id = '00000000-0000-4000-8000-000000000203';
select is(pg_temp.points('00000000-0000-4000-8000-000000000203'), 500::bigint, 'verified, she has the 500');
select is((select count(*)::integer from public.outbox_event e where e.event_type = 'points.earned'
           and e.payload ->> 'member_id' = '00000000-0000-4000-8000-000000000203'), 1, 'and points.earned says so');

-- A recheck sends her back to started; verified again, after the club raised the bonus, she gets nothing more.
update public.kyc_record set status = 'started', verified_at = null where member_id = '00000000-0000-4000-8000-000000000203';
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'points.verified_bonus', '', '{"points": 900}', now() - interval '1 second', 'Bonus test');
select lives_ok($$ select pg_temp.verify('00000000-0000-4000-8000-000000000203') $$, 'verified again after a recheck');
select is(pg_temp.points('00000000-0000-4000-8000-000000000203'), 500::bigint, 'the bonus is given once a member');

-- Kabir, verified before any bonus, has his PAN rechecked: the result is recorded with him still verified. No one was
-- verified, so no bonus, and a freeze on him does not block the recheck.
insert into public.control_state (venue_id, level, member_id, reason)
values ('00000000-0000-4000-8000-000000000001', 'member_freeze', '00000000-0000-4000-8000-000000000202', 'Bonus test');
select lives_ok($$ update public.kyc_record set status = status where member_id = '00000000-0000-4000-8000-000000000202' $$,
  'a recheck recorded on a verified member, even a frozen one');
select is(pg_temp.points('00000000-0000-4000-8000-000000000202'), 0::bigint, 'gives no bonus');

-- Rohan, verified by the same raised bonus, gets 900.
select pg_temp.verify('00000000-0000-4000-8000-000000000204');
select is(pg_temp.points('00000000-0000-4000-8000-000000000204'), 900::bigint, 'the bonus in force when verified');

-- A practice member gets none, even with a bonus set at the practice venue.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000002', 'points.verified_bonus', '', '{"points": 500}', '-infinity', 'Bonus test');
select is((select count(*)::integer from public.ledger_transaction t
           where t.venue_id = '00000000-0000-4000-8000-000000000002' and t.idempotency_key like 'verified_bonus:%'), 0,
  'none at the practice venue before');
insert into public.kyc_record (venue_id, member_id, status, verified_at, date_of_birth, photo_path)
select m.venue_id, m.id, 'verified', now(), '1990-01-01', m.venue_id || '/' || m.id || '/selfie.jpg' from public.member m
where m.venue_id = '00000000-0000-4000-8000-000000000002' and not exists (select 1 from public.kyc_record k where k.member_id = m.id)
limit 1;
select is((select count(*)::integer from public.ledger_transaction t
           where t.venue_id = '00000000-0000-4000-8000-000000000002' and t.idempotency_key like 'verified_bonus:%'), 0,
  'and none after its members are verified');

-- Members cannot call the trigger's function.
select ok(not has_function_privilege('authenticated', 'private.give_verified_bonus()', 'execute'), 'members cannot run it');

select * from finish();
rollback;
