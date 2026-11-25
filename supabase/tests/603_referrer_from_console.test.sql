-- A member's referrer set from the console (the owner, 25 Nov; #1133): the floor and up set it as if the code had been
-- typed at sign-up; one who never sat is paid at their first seat, one who sat is paid now on both sides, once; a paid
-- referral keeps its referrer. A host becomes the Floor member here, as the seed has none; 104 is a cashier, 108 a host.
-- The members are picked from the seed, none of them referred nor sat; sat1 is given a seat three days ago.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

update public.staff s set role = 'floor'
where s.id = (select h.id from public.staff h where h.venue_id = '00000000-0000-4000-8000-000000000001' and h.role = 'host' and h.user_id is not null
                and h.user_id <> '00000000-0000-4000-8000-000000000108' order by h.user_id limit 1);
create temp table who on commit drop as
select 'floor'::text as name, (select min(s.user_id::text) from public.staff s
  where s.venue_id = '00000000-0000-4000-8000-000000000001' and s.role = 'floor' and s.user_id is not null)::uuid as id;
create temp table plain on commit drop as
select m.id, row_number() over (order by m.member_number) as n
from public.member m
where m.venue_id = '00000000-0000-4000-8000-000000000001' and m.erased_at is null
  and not exists (select 1 from public.referral r where r.member_id = m.id or r.referrer_member_id = m.id)
  and not exists (select 1 from public.sign_up_attribution a where a.member_id = m.id and a.referral_code is not null)
  and not exists (select 1 from public.staff s where s.phone = m.phone)
  and not exists (select 1 from public.seat_session s where s.member_id = m.id);
insert into who
select (array['new1', 'new2', 'sat1', 'ref1', 'ref2', 'ref3'])[n], id from plain where n <= 6
union all (select 'other', id from public.member where venue_id <> '00000000-0000-4000-8000-000000000001' and erased_at is null limit 1);
-- sat1 sat at Table 5 three days ago, long past Undo.
with v as (
  insert into public.visit (venue_id, member_id, opened_at, closed_at, close_reason)
  select '00000000-0000-4000-8000-000000000001', id, now() - interval '3 days', now() - interval '3 days' + interval '3 hours', 'door' from who where name = 'sat1'
  returning id, member_id, opened_at)
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason)
select '00000000-0000-4000-8000-000000000001', v.member_id, v.id,
       (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 5'), 4,
       v.opened_at, v.opened_at, v.opened_at + interval '2 hours', 'left'
from v;
grant select on who to authenticated;
create function pg_temp.w(p_name text) returns uuid language sql as $$ select id from who where name = p_name $$;
create function pg_temp.as_person(p_person uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.w(text), pg_temp.as_person(uuid) to authenticated;
select is((select count(*)::integer from who where id is not null), 8, 'the seed gives the members this test needs');

-- The referrers may refer, but ref3's tier has no referrals; ref2 is self-excluded later.
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
select '00000000-0000-4000-8000-000000000001', pg_temp.w(n), 'referral.share_cards', n <> 'ref3', 'test 603'
from unnest(array['ref1', 'ref2', 'ref3']) as n;

-- Only the floor and up.
select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok(format('select public.set_member_referrer(%L, %L)', pg_temp.w('new1'), pg_temp.w('ref1')), '42501', null, 'a cashier sets no referrer');
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select throws_ok(format('select public.set_member_referrer(%L, %L)', pg_temp.w('new1'), pg_temp.w('ref1')), '42501', null, 'nor a host');

-- Never sat: the code is kept as sign-up keeps it, and pays at the first seat; until then it may change.
select pg_temp.as_person(pg_temp.w('floor'));
select is(public.set_member_referrer(pg_temp.w('new1'), pg_temp.w('ref1')), 'at_first_seat', 'the floor sets a referrer for a member who never sat');
select is((select referrer_member_id from public.member_sign_up('00000000-0000-4000-8000-000000000001', pg_temp.w('new1'))), pg_temp.w('ref1'),
  'their record says who referred them');
select is((select has_sat from public.member_sign_up('00000000-0000-4000-8000-000000000001', pg_temp.w('new1'))), false, 'and that they have not sat');
select is(public.set_member_referrer(pg_temp.w('new1'), pg_temp.w('ref2')), 'at_first_seat', 'until it is paid, the referrer may change');
reset role;
select is((select referral_code from public.sign_up_attribution where member_id = pg_temp.w('new1')),
  (select referral_code from public.member where id = pg_temp.w('ref2'))::public.attribution_code, 'the sign-up holds the new referrer''s code');
select ok(not exists (select 1 from public.referral where member_id = pg_temp.w('new1')), 'and nothing is paid yet');
select is((select count(*)::integer from public.audit_log where action = 'member.referrer_set' and entity_id = pg_temp.w('new1')::text), 2,
  'each change is kept in Activity');

-- Sat long ago: paid now, on both sides, once; then the referrer stays.
select pg_temp.as_person(pg_temp.w('floor'));
select is(public.set_member_referrer(pg_temp.w('sat1'), pg_temp.w('ref1')), 'paid', 'a member who has sat is paid at once');
select is(public.set_member_referrer(pg_temp.w('sat1'), pg_temp.w('ref1')), 'paid', 'the same referrer again is no change, and safe to retry');
select throws_ok(format('select public.set_member_referrer(%L, %L)', pg_temp.w('sat1'), pg_temp.w('ref2')), 'RVRFL', null,
  'a paid referral keeps its referrer');
reset role;
select is((select referrer_member_id from public.referral where member_id = pg_temp.w('sat1')), pg_temp.w('ref1'), 'the referral is complete');
select is((select count(*)::integer from public.outbox_event where event_type = 'referral.completed' and payload ->> 'member_id' = pg_temp.w('sat1')::text), 1,
  'referral.completed goes out once');
select isnt((select referral_completed_at from public.member_sign_up('00000000-0000-4000-8000-000000000001', pg_temp.w('sat1'))), null,
  'and the record says when');

-- Refusals, each with its reason.
insert into public.self_exclusion (venue_id, member_id, ends_at)
values ('00000000-0000-4000-8000-000000000001', pg_temp.w('ref2'), now() + interval '30 days');
select pg_temp.as_person(pg_temp.w('floor'));
select throws_ok(format('select public.set_member_referrer(%L, %L)', pg_temp.w('new2'), pg_temp.w('new2')), 'RVRFS', null, 'never themselves');
select throws_ok(format('select public.set_member_referrer(%L, %L)', pg_temp.w('new2'), pg_temp.w('ref3')), 'RVRFT', null,
  'never a referrer whose tier has no referrals');
select throws_ok(format('select public.set_member_referrer(%L, %L)', pg_temp.w('new2'), pg_temp.w('ref2')), 'RVRFX', null,
  'never a self-excluded referrer');
select throws_ok(format('select public.set_member_referrer(%L, %L)', pg_temp.w('new2'), pg_temp.w('other')), 'RVNOM', null,
  'never a member of another venue');
-- Never the staff member's own record, on either side: ref3's number made the floor member's.
reset role;
update public.member set phone = (select s.phone from public.staff s where s.user_id = pg_temp.w('floor')
                                    and s.venue_id = '00000000-0000-4000-8000-000000000001')
where id = pg_temp.w('ref3');
select pg_temp.as_person(pg_temp.w('floor'));
select throws_ok(format('select public.set_member_referrer(%L, %L)', pg_temp.w('new2'), pg_temp.w('ref3')), 'RVOWN', null,
  'never themselves as the referrer');
select throws_ok(format('select public.set_member_referrer(%L, %L)', pg_temp.w('ref3'), pg_temp.w('ref1')), 'RVOWN', null,
  'nor on their own record');
reset role;

select * from finish();
rollback;
