-- Bonus chips that expire, and a cap on what one visit redeems (the owner, 12 Nov; decision 0579; #908). 101 Vikram (super
-- admin), 103 Aditya (admin, the floor). Ishaan (211) has finished the check; Table 5 is open at 100/200.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

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
create function pg_temp.give(p_chips integer, p_key text) returns uuid language sql as $$
  select private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', p_chips::bigint * 100,
                              'Test 408', null, p_key);
$$;
create function pg_temp.ends(p_grant uuid) returns timestamptz language sql as $$ select expires_at from public.bonus_grant where id = p_grant; $$;
create function pg_temp.expiry(p_days integer, p_from timestamptz) returns void language sql as $$
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values ('00000000-0000-4000-8000-000000000001', 'bonus.expiry_days', '', jsonb_build_object('days', p_days), p_from, 'Test 408');
$$;
grant execute on function pg_temp.table_id(text) to authenticated;
delete from public.setting where key in ('bonus.expiry_days', 'bonus.visit_cap');

-- Only a super admin changes either.
select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'bonus.expiry_days', '', '{"days": 30}', now() + interval '2 minutes', 'Admin') $$,
  '42501', null, 'an admin cannot switch expiry on');
select throws_ok($$ insert into public.setting (venue_id, key, subject, value, effective_from, reason)
                    values ('00000000-0000-4000-8000-000000000001', 'bonus.visit_cap', '', '{"basis_points": 5000}', now() + interval '2 minutes', 'Admin') $$,
  '42501', null, 'nor set a visit''s cap');
reset role;
select set_config('request.jwt.claims', '', true);

-- None set: a grant never ends, as before.
create temp table g as select pg_temp.give(1000, 'test-408-old') as old;
select is(pg_temp.ends((select old from g)), null, 'with no expiry set, bonus chips never end');
update public.bonus_grant set created_at = now() - interval '40 days' where id = (select old from g);

-- Switched on 31 days ago at 30 days: chips held then end 30 days from the switch-on, yesterday, and the sweep ends them.
select pg_temp.expiry(30, now() - interval '31 days');
alter table g add column fresh uuid;
update g set fresh = pg_temp.give(2000, 'test-408-fresh');
select is(pg_temp.ends((select fresh from g)), now() + interval '720 hours', 'a grant given now ends 30 days from now');
select private.expire_bonus();
select is(pg_temp.ends((select old from g)), now() - interval '31 days' + interval '720 hours',
  'chips held at the switch-on end 30 days from it, not from when they were given');
select results_eq($$ select remaining_paise, expired_at is not null from public.bonus_grant where id = (select old from g) $$,
  $$ values (0::bigint, true) $$, 'and, that end past, the sweep ends them');
select results_eq($$ select x.kind, e.amount from public.ledger_transaction x join public.ledger_entry e on e.transaction_id = x.id
                     join public.ledger_account a on a.id = e.account_id
                     where x.idempotency_key = 'bonus_expiry:' || (select old from g) and a.code = 'member.bonus' $$,
  $$ values ('bonus_expiry'::text, 100000::bigint) $$, 'logged as a bonus expiry of all 1,000 left');
select is(pg_temp.ends((select fresh from g)), now() + interval '720 hours', 'the fresh grant keeps its end');

-- A new number of days: only grants given after it.
select pg_temp.expiry(7, now() - interval '1 minute');
alter table g add column later uuid;
update g set later = pg_temp.give(500, 'test-408-later');
select private.expire_bonus();
select is(pg_temp.ends((select later from g)), now() + interval '168 hours', 'a grant given after the change ends 7 days on');
select is(pg_temp.ends((select fresh from g)), now() + interval '720 hours', 'one given before keeps its 30');

-- Switched off (0 days): chips not yet ended lose their end; ended ones stay ended.
select pg_temp.expiry(0, now() - interval '30 seconds');
select private.expire_bonus();
select is(pg_temp.ends((select fresh from g)), null, 'switched off, the fresh grant never ends');
select is(pg_temp.ends((select later from g)), null, 'nor the later one');
select is((select expired_at is not null from public.bonus_grant where id = (select old from g)), true, 'the ended one stays ended');
select is(pg_temp.ends(pg_temp.give(50, 'test-408-off')), null, 'and a grant given now has no end');

-- The visit's cap: half the bonus held at its first seat, in whole 50s.
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000001', 'bonus.visit_cap', '', '{"basis_points": 5000}', '-infinity', 'Test 408');
create temp table held as select private.bonus_in_force('00000000-0000-4000-8000-000000000211', now()) as paise;
create temp table cap as select private.visit_bonus_cap((select paise from held), 5000) as paise;
grant select on held, cap to authenticated;
select ok((select paise from cap) between 50000 and (select paise from held), 'Ishaan holds enough for a cap of at least 500');

select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select is((select left_paise from public.member_bonus_visit_left('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211')),
  (select paise from cap), 'before he sits, the seat sheet shows half of what he holds');
select throws_ok(format($$ select public.seat_member(pg_temp.table_id('Table 5'), 2, p_member_number => (select member_number from public.member
                     where id = '00000000-0000-4000-8000-000000000211'), p_bonus_chips => %s) $$, (select paise from cap) / 100 + 50), 'RVVCP', null,
  'more than half is refused');
reset role;
select is_empty($$ select 1 from public.seat_session where member_id = '00000000-0000-4000-8000-000000000211' and ended_at is null $$,
  'and seats no one');

select pg_temp.as_user('00000000-0000-4000-8000-000000000103');
select lives_ok(format($$ select public.seat_member(pg_temp.table_id('Table 5'), 2, p_member_number => (select member_number from public.member
                     where id = '00000000-0000-4000-8000-000000000211'), p_bonus_chips => %s) $$, (select paise from cap) / 100),
  'the floor seats him with all of his cap');
select is((select left_paise from public.member_bonus_visit_left('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211')),
  0::bigint, 'none left this visit');
reset role;
select is((select v.bonus_at_first_seat_paise from public.visit v where v.member_id = '00000000-0000-4000-8000-000000000211' and v.closed_at is null),
  (select paise from held), 'the visit noted what he held at its first seat');

select set_config('request.jwt.claims', jsonb_build_object('sub', '00000000-0000-4000-8000-000000000103', 'role', 'authenticated',
  'amr', jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
select throws_ok($$ select private.redeem_bonus_at_seat((select id from public.seat_session where member_id = '00000000-0000-4000-8000-000000000211'
                     and ended_at is null), 50) $$, 'RVVCP', null, 'not 50 more in the same visit');
select set_config('request.jwt.claims', '', true);

delete from public.setting where key = 'bonus.visit_cap';
select is(private.bonus_visit_left('00000000-0000-4000-8000-000000000211'), null, 'with no cap set, nothing holds a visit back');

select * from finish();
rollback;
