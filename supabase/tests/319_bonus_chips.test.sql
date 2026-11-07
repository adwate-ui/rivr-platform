-- Bonus chips (decision 0504): chips never expire; the sign-up promotion pays when a member let in by their selfie
-- reaches Home, only while it is live, and once; staff who open member records redeem chips with the buy-in as they
-- seat the player. 101 Vikram (super admin), 103 Aditya (admin, the floor), 106 Pema (dealer). Ishaan (211) and
-- Kabir (202, waiting on 100/200) have finished the check; Tables 2 and 5 are open at 100/200.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- This test's club night began twelve hours before it (#716), as 246's.
create temp table night_shift on commit drop as select now() - private.tonight_began(now()) - interval '12 hours' as shift;
grant select on night_shift to authenticated, anon, service_role;
create or replace function private.tonight_began(p_at timestamptz) returns timestamptz language sql stable set search_path = '' as $$
  select ((date_trunc('day', ((p_at - s.shift) at time zone 'Asia/Kolkata') - interval '6 hours') + interval '6 hours') at time zone 'Asia/Kolkata')
         + s.shift
  from pg_temp.night_shift s;
$$;

-- The seed's live promotions back to drafts (decision 0491): only this test's own give.
update public.promotion_version set status = 'draft' where status = 'live';
select private.sync_promotion(id) from public.promotion where current_version is not null;
update public.promotion set status = 'draft' where status = 'live';

create function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated',
    'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
end;
$$;
create function pg_temp.table_id(p_name text) returns uuid language sql as $$
  select id from public.game_table where name = p_name and venue_id = '00000000-0000-4000-8000-000000000001';
$$;
create function pg_temp.chips(p_member uuid) returns bigint language sql as $$
  select private.bonus_in_force(p_member, now()) / 100;
$$;
-- A sign-up promotion of so many chips, live from yesterday, every day all day, for everyone.
create function pg_temp.welcome(p_chips integer) returns uuid language plpgsql as $$
declare
  v_promotion uuid;
begin
  insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'Welcome') returning id into v_promotion;
  insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
  values ('00000000-0000-4000-8000-000000000001', v_promotion, 1, 'live', 'Welcome', jsonb_build_object('kind', 'bonus_chips', 'chips', p_chips, 'on', 'signup'),
          '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
          jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 1)::text,
                             'timezone', 'Asia/Kolkata'),
          '{"perMember": "once"}', '{"playerApp": true, "tv": false, "website": false, "whatsapp": false}');
  perform private.sync_promotion(v_promotion);
  return v_promotion;
end;
$$;
-- A new member who signs up and stores their selfie, as the kyc Edge Function does; then takes it at the club.
create function pg_temp.join_by_selfie(p_user uuid, p_name text) returns uuid language plpgsql as $$
declare
  v_member uuid;
begin
  perform pg_temp.as_user(p_user);
  v_member := public.sign_up(p_name, '{}');
  perform set_config('role', 'postgres', true);
  insert into storage.objects (bucket_id, name) values ('kyc', '00000000-0000-4000-8000-000000000001/' || v_member || '/photo.jpg');
  perform pg_temp.as_user(p_user);
  perform public.take_kyc_at_the_club();
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  return v_member;
end;
$$;
create temp table ids (name text primary key, id uuid);
grant select, insert on ids to authenticated;
grant execute on function pg_temp.as_user(uuid), pg_temp.table_id(text), pg_temp.chips(uuid) to authenticated;

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000b101', 'authenticated', 'authenticated', '919000006101', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000b102', 'authenticated', 'authenticated', '919000006102', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000b103', 'authenticated', 'authenticated', '919000006103', now(), now(), now());

-- 1. No expiry ---------------------------------------------------------------------------------------------------------

select is_empty($$ select 1 from public.bonus_grant where expired_at is null and expires_at > now() $$,
  'no open grant has an end still to come');
-- A grant a freeze held past its end keeps it (the migration ended nothing), and the sweep closes it once released.
insert into ids select 'held', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', 20000,
  'Frozen past its end', now() + interval '1 day', 'test:319:held');
update public.bonus_grant set expires_at = now() - interval '1 hour' where id = (select id from ids where name = 'held');
select lives_ok($$ select private.expire_bonus() $$, 'the sweep, which still runs every minute');
select isnt((select expired_at from public.bonus_grant where id = (select id from ids where name = 'held')), null, 'closes a grant past its end');
insert into ids select 'ishaan_grant', private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 150000,
  'Welcome back', null, 'test:319:ishaan');
select is((select expires_at from public.bonus_grant where id = (select id from ids where name = 'ishaan_grant')), null,
  'a grant is given with no end');
select is(private.bonus_in_force('00000000-0000-4000-8000-000000000211', now() + interval '10 years'), 150000::bigint,
  'and is still in force ten years on');
select lives_ok($$ select private.expire_bonus() $$, 'the old sweep, run by hand');
select is(pg_temp.chips('00000000-0000-4000-8000-000000000211'), 1500::bigint, 'ends nothing of it');
select throws_ok($$ select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', 5000, 'Too late',
                                             now() - interval '1 day', 'test:319:late') $$, '22023', null, 'an end already past is still refused');
select results_eq($$ select payload ->> 'member_id', (payload ->> 'amount_paise')::bigint, payload ->> 'reason' from public.outbox_event
                     where event_type = 'bonus.credited' and payload ->> 'bonus_grant_id' = (select id::text from ids where name = 'ishaan_grant') $$,
  $$ values ('00000000-0000-4000-8000-000000000211'::text, 150000::bigint, 'Welcome back'::text) $$, 'a grant tells the member: bonus.credited');

-- 2. The sign-up promotion at Home -------------------------------------------------------------------------------------

insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'kyc.at_the_club', '', '{"enabled": true}', now() - interval '1 minute', 'Cashfree is not live');

-- Before the promotion is live, Tara is let in: she gets nothing, then or at her desk check.
insert into ids select 'tara', pg_temp.join_by_selfie('00000000-0000-4000-8000-00000000b101', 'Tara Dutta');
select is(pg_temp.chips((select id from ids where name = 'tara')), 0::bigint, 'let in with no sign-up promotion live, a member gets nothing');
insert into ids select 'welcome', pg_temp.welcome(500);
update public.kyc_record set status = 'verified', method = 'manual', verified_at = now(), date_of_birth = '1990-01-01', pan = 'ABCPT6101T',
  photo_path = venue_id || '/' || member_id || '/selfie.jpg'
where member_id = (select id from ids where name = 'tara');
select is(pg_temp.chips((select id from ids where name = 'tara')), 0::bigint, 'nor at her desk check, with the promotion live since');

-- With it live, Uma is let in by her selfie: she has it at once, on reaching Home, and the desk check gives nothing more.
insert into ids select 'uma', pg_temp.join_by_selfie('00000000-0000-4000-8000-00000000b102', 'Uma Sethi');
select is(pg_temp.chips((select id from ids where name = 'uma')), 500::bigint, 'let in by her selfie, a member has the sign-up bonus at once');
select is((select status from public.kyc_record where member_id = (select id from ids where name = 'uma')), 'started', 'before her desk check');
select is((select count(*)::integer from public.outbox_event where event_type = 'bonus.credited'
           and payload ->> 'member_id' = (select id::text from ids where name = 'uma')), 1, 'and is told');
update public.kyc_record set status = 'verified', method = 'manual', verified_at = now(), date_of_birth = '1990-01-01', pan = 'ABCPU6102U',
  photo_path = venue_id || '/' || member_id || '/selfie.jpg'
where member_id = (select id from ids where name = 'uma');
select is(pg_temp.chips((select id from ids where name = 'uma')), 500::bigint, 'her desk check gives nothing more');

-- A check the vendor held two days ago, reopened for the desk as reopen_kyc_check does: stamped with the day it began,
-- not now, so no sign-up bonus.
select pg_temp.as_user('00000000-0000-4000-8000-00000000b103');
insert into ids select 'vir', public.sign_up('Vir Kapoor', '{}');
reset role;
insert into public.kyc_record (venue_id, member_id, status, created_at)
select '00000000-0000-4000-8000-000000000001', id, 'needs_review', now() - interval '2 days' from ids where name = 'vir'
on conflict (member_id) do update set status = 'needs_review', created_at = excluded.created_at, at_club_from = null;
update public.kyc_record set status = 'started', at_club_from = coalesce(at_club_from, created_at)
where member_id = (select id from ids where name = 'vir');
select is(pg_temp.chips((select id from ids where name = 'vir')), 0::bigint, 'a check reopened for the desk gives no sign-up bonus');

-- Once the promotion ends, a member let in gets nothing.
update public.promotion_version set status = 'ended' where promotion_id = (select id from ids where name = 'welcome');
select private.sync_promotion((select id from ids where name = 'welcome'));
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000b104', 'authenticated', 'authenticated', '919000006104', now(), now(), now());
insert into ids select 'wasim', pg_temp.join_by_selfie('00000000-0000-4000-8000-00000000b104', 'Wasim Khan');
select is(pg_temp.chips((select id from ids where name = 'wasim')), 0::bigint, 'once the promotion has ended, a member let in gets nothing');

-- 3. Redeeming while seating -------------------------------------------------------------------------------------------

-- A buy-in promotion live, which pays a cash buy-in: a redemption still earns nothing (decision 0472).
with made as (insert into public.promotion (venue_id, name) values ('00000000-0000-4000-8000-000000000001', 'Buy-in 100') returning id)
insert into public.promotion_version (venue_id, promotion_id, version, status, name, reward, eligibility, schedule, limits, channels)
select '00000000-0000-4000-8000-000000000001', made.id, 1, 'live', 'Buy-in 100', '{"kind": "buyin_bonus", "mode": "fixed", "chips": 100}',
       '{"stakes": "all", "tiers": "all", "audience": "everyone"}',
       jsonb_build_object('days', '[1, 2, 3, 4, 5, 6, 7]'::jsonb, 'from', '06:00', 'to', '06:00', 'startsOn', (private.club_day_of(now()) - 1)::text,
                          'timezone', 'Asia/Kolkata'),
       '{"perMember": "none"}', '{"playerApp": false, "tv": false, "website": false, "whatsapp": false}'
from made;
select private.sync_promotion(v.promotion_id) from public.promotion_version v where v.name = 'Buy-in 100';
select is((select count(*)::integer from private.evaluate_promotions('00000000-0000-4000-8000-000000000001', 'buy_in',
            jsonb_build_object('member_id', '00000000-0000-4000-8000-000000000213', 'key', 'buy_in:test-319', 'amount_paise', 1000000,
                               'method', 'cash', 'table_id', pg_temp.table_id('Table 5')))), 1,
  'a buy-in promotion is live, and pays a cash buy-in');

create temp table opening as
  select (select count(*) from public.promotion_grant where member_id = '00000000-0000-4000-8000-000000000211') as grants;

-- Not whole 50s, or more than he has: refused, and he is not seated.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 2, p_member_number => (select member_number from public.member
                     where id = '00000000-0000-4000-8000-000000000211'), p_bonus_chips => 1020) $$, 'RVCHP', null,
  'bonus chips are redeemed in whole 50s');
select throws_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 2, p_member_number => (select member_number from public.member
                     where id = '00000000-0000-4000-8000-000000000211'), p_bonus_chips => 2000) $$, 'RVBON', null,
  'and never more than the member has');
reset role;
select is_empty($$ select 1 from public.seat_session where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null $$,
  'a refused redemption seats no one');
select is(pg_temp.chips('00000000-0000-4000-8000-000000000211'), 1500::bigint, 'and takes nothing');

-- 1,000 of his 1,500 with his buy-in, as the floor seats him.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 2, p_member_number => (select member_number from public.member
                     where id = '00000000-0000-4000-8000-000000000211'), p_bonus_chips => 1000) $$,
  'the floor seats Ishaan, redeeming 1,000 bonus chips');
reset role;
select is(pg_temp.chips('00000000-0000-4000-8000-000000000211'), 500::bigint, 'he has 500 left');
select results_eq($$ select r.amount_paise, t.name, s.full_name, r.session_id = (select id from public.seat_session where member_id = r.member_id and ended_at is null)
                     from public.bonus_redemption r join public.game_table t on t.id = r.table_id left join public.staff s on s.id = r.staff_id
                     where r.member_id = '00000000-0000-4000-8000-000000000211' $$,
  $$ values (100000::bigint, 'Table 5'::text, 'Aditya Malhotra'::text, true) $$, 'recorded with the seat, the table and who seated him');
select results_eq($$ select a.code, e.amount from public.bonus_redemption r join public.ledger_entry e on e.transaction_id = r.ledger_transaction_id
                     join public.ledger_account a on a.id = e.account_id join public.ledger_transaction x on x.id = r.ledger_transaction_id
                     where r.member_id = '00000000-0000-4000-8000-000000000211' and x.kind = 'bonus_buy_in' order by a.code $$,
  $$ values ('member.bonus'::text, 100000::bigint), ('venue.chips_outstanding', -100000) $$,
  'posted as a bonus buy-in: from his bonus to chips outstanding');
select results_eq($$ select (payload ->> 'amount_paise')::bigint, payload ->> 'table_name' from public.outbox_event where event_type = 'bonus.redeemed'
                     and payload ->> 'member_id' = '00000000-0000-4000-8000-000000000211' $$,
  $$ values (100000::bigint, 'Table 5'::text) $$, 'he is told: bonus.redeemed, with the table');
select is((select count(*) from public.promotion_grant where member_id = '00000000-0000-4000-8000-000000000211'), (select grants from opening),
  'bonus never earns a buy-in promotion');
select throws_ok($$ select private.undo_seat((select id from public.seat_session where member_id = '00000000-0000-4000-8000-000000000211'
                                              and ended_at is null)) $$, '22023', 'Something was already recorded at that seat',
  'a seat with chips redeemed is not undone: the redemption holds it');

-- Kabir is assigned from the waitlist with 500 of his chips.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 'verified', 'digilocker', '1990-01-01', 'ABCPK2022K',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000202/selfie.jpg', now())
on conflict (member_id) do nothing;
select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202', 50000, 'Welcome back', null, 'test:319:kabir');
create temp table kabir_entry as
  select e.id from public.waitlist_entry e join public.table_type t on t.id = e.table_type_id
  where e.member_id = '00000000-0000-4000-8000-000000000202' and t.code = 'nlh_100_200' and e.status = 'waiting';
grant select on kabir_entry to authenticated;
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select lives_ok($$ select public.assign_from_waitlist((select id from kabir_entry), pg_temp.table_id('Table 2'), 9, 240, 500) $$,
  'the floor assigns Kabir to Table 2, redeeming all 500 of his bonus chips');
reset role;
select is(pg_temp.chips('00000000-0000-4000-8000-000000000202'), 0::bigint, 'he has none left');
select is((select t.name from public.bonus_redemption r join public.game_table t on t.id = r.table_id
           where r.member_id = '00000000-0000-4000-8000-000000000202'), 'Table 2', 'redeemed at his new table');

-- Staff who do not open member records redeem nothing; nor does anyone on their own record.
select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-000000000106', 'role', 'authenticated')::text, true);
select throws_ok($$ select private.redeem_bonus_at_seat((select id from public.seat_session where member_id = '00000000-0000-4000-8000-000000000211'
                                                         and ended_at is null), 100) $$, '42501', null, 'a dealer redeems no bonus chips');
select set_config('request.jwt.claims', '', true);
with made as (insert into public.member (venue_id, full_name, phone) values ('00000000-0000-4000-8000-000000000001', 'Aditya M.', '+919000000103')
              returning id)
insert into ids select 'aditya_member', id from made;
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
select '00000000-0000-4000-8000-000000000001', id, 'verified', 'digilocker', '1990-01-01', 'ABCPA1033A',
       '00000000-0000-4000-8000-000000000001/' || id || '/selfie.jpg', now() from ids where name = 'aditya_member';
select private.credit_bonus('00000000-0000-4000-8000-000000000001', id, 50000, 'Welcome back', null, 'test:319:aditya') from ids where name = 'aditya_member';
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 4, '9000000103', p_bonus_chips => 500) $$, 'RVOWN', null,
  'staff never redeem bonus chips on their own member record');
reset role;
select is(pg_temp.chips((select id from ids where name = 'aditya_member')), 500::bigint, 'which keeps them');

-- As the cage's buy-ins, at most 30 redemptions a minute for each staff member: past it, refused and not seated.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 'verified', 'digilocker', '1990-01-01', 'ABCPV2122V',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000212/selfie.jpg', now())
on conflict (member_id) do nothing;
select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 50000, 'Welcome back', null, 'test:319:vihaan');
insert into private.rate_hit (venue_id, actor, action)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', 'bonus.redeem' from generate_series(1, 30);
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 6, p_member_number => (select member_number from public.member
                     where id = '00000000-0000-4000-8000-000000000212'), p_bonus_chips => 100) $$, 'RVRAT', null,
  'the 31st redemption in a minute is refused');
reset role;
select is_empty($$ select 1 from public.seat_session where member_id = '00000000-0000-4000-8000-000000000212' and ended_at is null $$,
  'and seats no one');
delete from private.rate_hit where actor = '00000000-0000-4000-8000-000000000103' and action = 'bonus.redeem';

-- Reads ----------------------------------------------------------------------------------------------------------------

-- Ishaan's grant came the day before (in this test everything is now).
update public.bonus_grant set created_at = now() - interval '1 day' where id = (select id from ids where name = 'ishaan_grant');

select pg_temp.as_user('00000000-0000-4000-8000-000000000211');
select results_eq($$ select bonus_paise from public.my_bonus() $$, $$ values (50000::bigint) $$, 'Ishaan reads his 500 bonus chips');
select results_eq($$ select kind, amount_paise, reason, table_name from public.my_bonus_history(20) $$,
  $$ values ('redeemed'::text, 100000::bigint, null::text, 'Table 5'::text), ('credited', 150000, 'Welcome back', null) $$,
  'and his history, the newest first, without who seated him');
select is((select count(*)::integer from public.my_bonus_history(1)), 1, 'as many lines as he asks for');
select is_empty($$ select 1 from public.bonus_redemption where member_id <> '00000000-0000-4000-8000-000000000211' $$,
  'he sees his own redemptions only');
select is_empty($$ select 1 from public.member_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000202') $$,
  'and no other member''s bonus');
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select results_eq($$ select bonus_paise from public.member_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211') $$,
  $$ values (50000::bigint) $$, 'staff who open member records read his bonus');
select results_eq($$ select kind, amount_paise, staff_name from public.member_bonus_history('00000000-0000-4000-8000-000000000001',
                     '00000000-0000-4000-8000-000000000211') $$,
  $$ values ('redeemed'::text, 100000::bigint, 'Aditya Malhotra'::text), ('credited', 150000, null) $$, 'and his history, with who seated him');
select is((select count(*)::integer from public.bonus_redemption), 2, 'and every redemption of the venue');
select pg_temp.as_user('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.member_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211') $$,
  'a dealer reads no member''s bonus');
select is_empty($$ select 1 from public.member_bonus_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211') $$,
  'nor its history');
select is_empty($$ select 1 from public.bonus_redemption $$, 'nor any redemption');
select is_empty($$ select 1 from public.member_bonus('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000211') $$,
  'and a member is read only at their own venue');
reset role;

-- The practice venue's bonus events never leave: the push consumer claims Ishaan's, never a practice member's.
insert into ids select 'practice_grant', private.credit_bonus(m.venue_id, m.id, 50000, 'Welcome back', null, 'test:319:practice')
from public.member m join public.venue v on v.id = m.venue_id and v.is_practice order by m.created_at limit 1;
create temp table claimed as select * from public.claim_outbox_deliveries('push', array['bonus.credited', 'bonus.redeemed'], true, 200);
select ok(exists (select 1 from claimed where payload ->> 'bonus_grant_id' = (select id::text from ids where name = 'ishaan_grant')),
  'the push consumer claims a bonus event');
select is_empty($$ select 1 from claimed c join public.venue v on v.id = c.venue_id where v.is_practice $$,
  'but none of the practice venue''s');

-- Staff of another venue, who open member records there, read nothing of this one.
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000b105', 'authenticated', 'authenticated', '919000006105', now(), now(), now());
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
values ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-00000000b105', 'Pia Host', 'Host', 'host', '+919000006105');
select pg_temp.as_user('00000000-0000-4000-8000-00000000b105');
select ok(private.has_permission('00000000-0000-4000-8000-000000000002', 'members.read'), 'a host at the other venue opens member records there');
select is_empty($$ select 1 from public.member_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211') $$,
  'but reads no member''s bonus here');
select is_empty($$ select 1 from public.member_bonus_history('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211') $$,
  'nor its history');
select is_empty($$ select 1 from public.bonus_redemption $$, 'nor any redemption here');
reset role;

-- Promotions switched off at the kill switch: chips given wrongly cannot be taken back, so none are redeemed; a seat
-- without chips still goes.
insert into public.control_state (venue_id, level, feature, reason, engaged_by_staff_id)
select '00000000-0000-4000-8000-000000000001', 'feature_kill', 'promotions', 'Wrong chips given', s.id
from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 6, p_member_number => (select member_number from public.member
                     where id = '00000000-0000-4000-8000-000000000212'), p_bonus_chips => 100) $$, 'RVKIL', null,
  'with promotions switched off, no bonus chips are redeemed');
select lives_ok($$ select public.seat_member(pg_temp.table_id('Table 5'), 6, p_member_number => (select member_number from public.member
                     where id = '00000000-0000-4000-8000-000000000212')) $$, 'and a seat without them still goes');
reset role;
select is(pg_temp.chips('00000000-0000-4000-8000-000000000212'), 500::bigint, 'his chips untouched');

select * from finish();
rollback;
