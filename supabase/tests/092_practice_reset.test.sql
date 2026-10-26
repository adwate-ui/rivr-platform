-- Reset to seed (#104, decision 0117): a super admin of the practice venue sees each table's rows now and
-- in its seed, then types the venue's name, and the venue's play is back to its seed: its rows whole, its
-- ledger balanced, its setup and the audit log kept, the club untouched. 101 Owner (super admin), 104 Sana
-- (cashier), 301 Asha (practice member).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

-- Training happens at the practice venue: a tournament is added, a member's name changes, and a setting
-- (setup, which a reset keeps) is set. The club gets a tournament too.
insert into public.tournament (venue_id, name, starts_at, buy_in_paise, is_published) values
  ('00000000-0000-4000-8000-000000000002', 'Training turbo', now() + interval '1 day', 100000, true),
  ('00000000-0000-4000-8000-000000000001', 'Club turbo', now() + interval '1 day', 100000, true);
update public.member set full_name = 'Renamed in training' where id = '00000000-0000-4000-8000-000000000301';
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
values ('00000000-0000-4000-8000-000000000002', 'gst.config', '', (select value from public.setting
        where venue_id = '00000000-0000-4000-8000-000000000002' and key = 'gst.config' order by effective_from desc limit 1), now(), 'Set in training');
create temporary table before as select
  pg_sequence_last_value(pg_get_serial_sequence('public.ledger_entry', 'id')::regclass) as ledger_sequence,
  (select count(*) from public.setting where venue_id = '00000000-0000-4000-8000-000000000002') as practice_settings,
  (select count(*) from public.tournament where venue_id = '00000000-0000-4000-8000-000000000001') as club_tournaments,
  (select count(*) from public.staff where venue_id = '00000000-0000-4000-8000-000000000002') as practice_staff;
grant select on before to authenticated;

-- What resets is a decision for each venue table: a new one fails here until it is listed or kept.
select set_eq($$ select private.practice_reset_tables() $$,
  $$ select unnest(array['academy_batch', 'academy_booking', 'academy_utr_rejection', 'alert', 'bonus_grant', 'buy_in_request', 'cage_shift', 'cage_transaction', 'chip_inventory_count', 'chip_inventory_line', 'consent', 'credit_line', 'dealer_down', 'deposit_request', 'down_count', 'early_departure', 'eod_close', 'feedback', 'hand', 'high_hand_claim', 'incident', 'invoice', 'invoice_counter', 'jackpot_event', 'kyc_record', 'kyc_review', 'ledger_account', 'ledger_entry', 'ledger_transaction', 'marker', 'marker_settlement', 'member', 'member_feature_override', 'member_limit', 'member_preference', 'member_tier_change', 'membership_card', 'notification_preference', 'outbox_delivery', 'outbox_event', 'payout_account', 'points_earning', 'promotion', 'promotion_budget', 'promotion_grant', 'promotion_rule', 'seat_move', 'seat_session', 'second_approval', 'self_exclusion', 'sign_up_attribution', 'tds_withholding', 'tournament', 'visit', 'waitlist_entry', 'withdrawal_request']) $$,
  'the reset reloads these tables, and keeps every other venue table');

-- Only a super admin, and only at the practice venue.
select pg_temp.as_user('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select * from public.practice_reset_preview('00000000-0000-4000-8000-000000000002') $$, '42501', null,
  'a cashier sees no dry run');
select throws_ok($$ select * from public.reset_practice_venue('00000000-0000-4000-8000-000000000002', 'RIVR Practice') $$, '42501', null,
  'and resets nothing');
select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from public.practice_reset_preview('00000000-0000-4000-8000-000000000001') $$, 'RVPRA', null,
  'the club is never reset to a seed');

-- The dry run shows what training changed.
select results_eq($$ select current_rows - seed_rows from public.practice_reset_preview('00000000-0000-4000-8000-000000000002') where table_name = 'tournament' $$,
  $$ values (1::bigint) $$, 'the dry run counts each table now and in its seed');
select ok(not exists (select 1 from public.practice_reset_preview('00000000-0000-4000-8000-000000000002') where table_name in ('staff', 'setting', 'audit_log')),
  'and leaves out what a reset keeps');

select throws_ok($$ select * from public.reset_practice_venue('00000000-0000-4000-8000-000000000002', 'RIVR practice') $$, 'RVNAM', null,
  'the venue''s name must be typed exactly');

-- The reset.
select ok((select sum(restored_rows) from public.reset_practice_venue('00000000-0000-4000-8000-000000000002', 'RIVR Practice')) > 0,
  'typing the name resets the practice venue');
select is_empty($$ select * from public.practice_reset_preview('00000000-0000-4000-8000-000000000002') where current_rows <> seed_rows $$,
  'every table is back to its seed''s count');
reset role;
select is((select full_name from public.member where id = '00000000-0000-4000-8000-000000000301'),
  (select s.row_data ->> 'full_name' from private.practice_seed s where s.table_name = 'member' and s.row_data ->> 'id' = '00000000-0000-4000-8000-000000000301'),
  'a member is as seeded');
select is_empty($$ select 1 from public.tournament where name = 'Training turbo' $$, 'what training added is gone');
select results_eq($$ select (select count(*) from public.setting where venue_id = '00000000-0000-4000-8000-000000000002'),
                            (select count(*) from public.staff where venue_id = '00000000-0000-4000-8000-000000000002') $$,
  $$ select practice_settings, practice_staff from before $$, 'the venue''s setup is kept');
select is((select count(*) from public.tournament where venue_id = '00000000-0000-4000-8000-000000000001'), (select club_tournaments from before),
  'the club is untouched');
select is_empty($$ select 1 from public.ledger_entry e where e.venue_id = '00000000-0000-4000-8000-000000000002'
                   group by e.transaction_id having sum(e.amount) <> 0 $$, 'the practice ledger balances');
select is((select count(*)::integer from public.audit_log where venue_id = '00000000-0000-4000-8000-000000000002' and action = 'practice.reset'
           and actor_user_id = '00000000-0000-4000-8000-000000000101'), 1, 'the audit log keeps the reset, by whom');

select is(pg_sequence_last_value(pg_get_serial_sequence('public.ledger_entry', 'id')::regclass), (select ledger_sequence from before),
  'a shared sequence never goes back');
select ok(not coalesce(private.purging('00000000-0000-4000-8000-000000000002'), false), 'the purge ends with the reset');
select throws_ok($$ delete from public.ledger_entry where venue_id = '00000000-0000-4000-8000-000000000002' $$, '42501', null,
  'and the ledger is append-only again');

select pg_temp.as_user('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from public.reset_practice_venue('00000000-0000-4000-8000-000000000002', 'RIVR Practice') $$, 'RVRAT', null,
  'a second reset waits five minutes');
reset role;

select ok(not has_function_privilege('anon', 'public.reset_practice_venue(uuid, text)', 'execute')
          and not has_function_privilege('anon', 'public.practice_reset_preview(uuid)', 'execute'), 'nobody signed out can call them');

select * from finish();
rollback;
