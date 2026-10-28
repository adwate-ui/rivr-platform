-- Erasing one member's personal data on request (#424; decision 0207). Tara (0797) signs in, has a KYC check
-- with TDS taken on a cash-out, points, bonus, a payout account a deposit names and one nothing names, feedback
-- and preferences; she is erased by Vikram (101), a super admin. Dev (0798) is on a break for a month: he is
-- erased too, and a block stands on his number and identity until the break ends. Uma (0799) is a practice
-- venue member. Aditya (103) is an admin, who erases no one.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_owner() returns void language sql as $$
  select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
$$;
grant execute on function pg_temp.as_person(text), pg_temp.as_owner() to authenticated;
-- Who said what about whom, before and after: a row of the audit log is about a member by id or member_id.
create function pg_temp.audit_about(p_member uuid) returns setof public.audit_log language sql as $$
  select * from public.audit_log a
  where p_member::text in (a.entity_id, a.before ->> 'member_id', a.after ->> 'member_id');
$$;

-- ---------------------------------------------------------------------------------------------------
-- Every table that names a member is classified: erasure deletes its rows, anonymises them, or keeps them.
select set_eq(
  $$ select distinct c.relname::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'member'
       and (exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'f' and k.confrelid = 'public.member'::regclass)
            or exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname ~ '(^|_)member_ids?$' and not a.attisdropped)) $$,
  $$ values
     -- Deleted.
     ('feedback'), ('kyc_review'), ('member_feature_override'), ('member_limit'), ('member_preference'), ('membership_card'),
     ('notification_preference'), ('review_request'), ('sign_up_attribution'), ('cab_request'), ('club_event_booking'),
     -- Changed: consent withdrawn, the KYC record kept with the PAN alone when TDS was taken (else deleted), a payout
     -- account a money record names kept and marked removed (others deleted), bonus grants closed by the forfeit.
     ('consent'), ('kyc_record'), ('payout_account'), ('bonus_grant'),
     -- Kept, naming only the member's id: money, tax, play and safer-gambling records.
     ('academy_attendance'), ('academy_booking'), ('buy_in_request'), ('cage_transaction'), ('control_state'), ('credit_line'), ('deposit_request'),
     ('early_departure'), ('fnb_order'), ('invoice'), ('jackpot_event'), ('league_finish'), ('ledger_account'), ('marker'), ('member_tier_change'),
     ('points_earning'), ('promotion_grant'), ('redemption'), ('referral'), ('sar_entry'), ('seat_session'), ('self_exclusion'), ('tds_withholding'),
     ('tournament_entry'), ('tournament_payout'), ('tournament_purchase'), ('tournament_ticket'), ('visit'), ('waitlist_entry'),
     ('withdrawal_request') $$,
  'every table naming a member is classified for erasure (a new one is a decision: delete, anonymise or keep)'
);

-- ---------------------------------------------------------------------------------------------------
-- The permission: super admin only, at the admin computer where a venue keeps such work to its computers.
select is((select array_agg(role::text) from public.role_permission where permission = 'members.erase'), array['super_admin'],
  'only the super admin holds members.erase');
select throws_ok($$ insert into public.role_permission (role, permission) values ('admin', 'members.erase') $$, '23514', null,
  'and no other role can be given it');
select is(private.computer_kind_for('members.erase'), 'console'::public.device_kind, 'erasing is admin-computer work');

-- ---------------------------------------------------------------------------------------------------
-- The people.
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000d0797', 'authenticated', 'authenticated',
        '919000000797', now(), now(), now());
insert into auth.audit_log_entries (instance_id, id, payload, created_at)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
        json_build_object('action', 'login', 'actor_id', '00000000-0000-4000-8000-0000000d0797', 'actor_username', '919000000797'), now());
insert into public.member (id, venue_id, user_id, full_name, phone) values
  ('00000000-0000-4000-8000-0000000d0797', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797', 'Tara Mehta', '+919000000797'),
  ('00000000-0000-4000-8000-0000000d0798', '00000000-0000-4000-8000-000000000001', null, 'Dev Khanna', '+919000000798'),
  -- Uma signs in with a login a staff record also uses (Sana, 104's), which her erasure leaves alone.
  ('00000000-0000-4000-8000-0000000d0799', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000104', 'Uma Rao', '+919000000799');
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, address, masked_aadhaar, photo_path, identity_key, verified_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797', 'verified', 'digilocker', '1991-02-03', 'ABCPM7971K',
        '12 Park Road, Gurugram', 'XXXX XXXX 7971', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000d0797/selfie.jpg',
        'tara-identity', now()),
       ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0798', 'verified', 'digilocker', '1989-05-06', 'ABCPK7981L',
        null, 'XXXX XXXX 7981', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000d0798/selfie.jpg', 'dev-identity', now());
insert into public.kyc_review (venue_id, member_id, decision, reason, outcome, reviewed_by_staff_id)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797', 'approved', 'Face matched the selfie', 'verified',
        (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000101' and venue_id = '00000000-0000-4000-8000-000000000001'));
insert into public.member_preference (member_id, venue_id, name_on_tvs)
values ('00000000-0000-4000-8000-0000000d0797', '00000000-0000-4000-8000-000000000001', true);
insert into public.notification_preference (member_id, venue_id, push_type, is_on)
values ('00000000-0000-4000-8000-0000000d0797', '00000000-0000-4000-8000-000000000001', 'push.seat_ready', false);
insert into public.member_limit (member_id, venue_id, session_reminder_hours)
values ('00000000-0000-4000-8000-0000000d0797', '00000000-0000-4000-8000-000000000001', 4);
insert into public.member_feature_override (venue_id, member_id, feature_key, is_granted, reason)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797', 'learn.drills', true, 'Asked for it by Tara Mehta');
insert into public.sign_up_attribution (member_id, venue_id, referral_code)
values ('00000000-0000-4000-8000-0000000d0797', '00000000-0000-4000-8000-000000000001', 'FRIEND10');
insert into public.membership_card (venue_id, member_id) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797');
insert into public.feedback (venue_id, member_id, note)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797', 'Tara Mehta here: the chairs are hard');
insert into public.consent (venue_id, member_id, purpose) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797', 'marketing');
insert into public.payout_account (id, venue_id, member_id, kind, bank_name, vpa) values
  ('00000000-0000-4000-8000-0000000e0797', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797', 'upi', 'HDFC Bank', 'tara@okhdfc'),
  ('00000000-0000-4000-8000-0000000f0797', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797', 'upi', 'SBI', 'tara@oksbi');
insert into public.deposit_request (venue_id, member_id, amount_paise, utr, payout_account_id, status, decided_at, idempotency_key)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797', 100000, '797979797979', '00000000-0000-4000-8000-0000000e0797',
        'not_found', now(), gen_random_uuid());
insert into storage.objects (bucket_id, name)
values ('kyc', '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000d0797/selfie.jpg');
insert into public.outbox_event (venue_id, event_type, payload)
values ('00000000-0000-4000-8000-000000000001', 'kyc.completed', jsonb_build_object('member_id', '00000000-0000-4000-8000-0000000d0797'));
-- A cash-out with TDS taken, as the cage records it (its ledger side is not this test's).
insert into public.cage_transaction (id, venue_id, member_id, kind, method, amount_paise, ledger_transaction_id, cashier_staff_id, idempotency_key)
values ('00000000-0000-4000-8000-0000000c0797', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797', 'cash_out', 'cash',
        1000000,
        private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'erasure_test', 'erasure-test:cash-out', jsonb_build_array(
          jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.cash_drawer'), 'amount', '-1000000'),
          jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.chips_outstanding'), 'amount', '1000000')), null),
        (select id from public.staff where user_id = '00000000-0000-4000-8000-000000000104' and venue_id = '00000000-0000-4000-8000-000000000001'),
        gen_random_uuid());
insert into public.tds_withholding (venue_id, member_id, cage_transaction_id, section, basis, period_start, winnings_paise, already_paise, has_pan,
                                    rate_basis_points, due_paise, amount_paise, is_shadow)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797', '00000000-0000-4000-8000-0000000c0797', '194B', 'session', now(),
        1000000, 0, true, 3000, 300000, 300000, false);
select isnt(private.post_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797', 1200, 'points_earned', 'Erasure test',
  'erasure-test:points'), null, 'Tara holds 1,200 points');
select isnt(private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797', 50000, 'Welcome bonus',
  now() + interval '30 days', 'erasure-test:bonus'), null, 'and ₹500 of bonus');
select isnt(private.post_nights('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797', 1250, 'nights_earned', 'Erasure test',
  'erasure-test:nights'), null, 'and a night and a quarter at the partner hotel (#146)');
-- A break Tara took last month, over; and Dev's, a month from now.
insert into public.self_exclusion (venue_id, member_id, starts_at, ends_at) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0797', now() - interval '40 days', now() - interval '10 days'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0798', now() - interval '1 day', now() + interval '30 days');
-- Dev is in the club, his wallet holds ₹1,000 and a deposit of his waits.
insert into public.visit (id, venue_id, member_id)
values ('00000000-0000-4000-8000-0000000b0798', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0798');
select isnt(private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'opening_balance', 'erasure-test:dev-cash', jsonb_build_array(
  jsonb_build_object('account_id', (select id from public.ledger_account where member_id = '00000000-0000-4000-8000-0000000d0798' and code = 'member.cash'), 'amount', '-100000'),
  jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.opening_balance'), 'amount', '100000')),
  null), null, 'Dev holds ₹1,000');
insert into public.payout_account (id, venue_id, member_id, kind, bank_name, vpa)
values ('00000000-0000-4000-8000-0000000e0798', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0798', 'upi', 'HDFC Bank', 'dev@okhdfc');
insert into public.deposit_request (id, venue_id, member_id, amount_paise, utr, payout_account_id, idempotency_key)
values ('00000000-0000-4000-8000-0000000a0798', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0798', 100000, '798798798798',
        '00000000-0000-4000-8000-0000000e0798', gen_random_uuid());

-- ---------------------------------------------------------------------------------------------------
-- Who may, and what must be settled first.
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select * from public.member_erasure_preview('00000000-0000-4000-8000-0000000d0797') $$, 'an admin sees no erasure preview');
select throws_ok($$ select * from public.erase_member('00000000-0000-4000-8000-0000000d0797', 'Tara Mehta', 'Asked by email') $$, '42501', null,
  'and erases no one');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select is_erased, blockers, points, bonus_paise, nights, blocked_until is null from public.member_erasure_preview('00000000-0000-4000-8000-0000000d0797') $$,
  $$ values (false, '{}'::text[], 1200::bigint, 50000::bigint, 1250::bigint, true) $$,
  'Vikram sees Tara has nothing open, and the points, bonus and hotel nights she will forfeit');
select results_eq($$ select blockers, blocked_until > now() + interval '29 days' from public.member_erasure_preview('00000000-0000-4000-8000-0000000d0798') $$,
  $$ values (array['cash', 'chips', 'requests'], true) $$,
  'and that Dev''s wallet, his visit and his waiting deposit must be settled first, and his break will be kept');
select throws_ok($$ select * from public.erase_member('00000000-0000-4000-8000-0000000d0798', 'Dev Khanna', 'Asked at the desk') $$, 'RVERA', null,
  'so Dev is not erased yet');
select throws_ok($$ select * from public.erase_member('00000000-0000-4000-8000-0000000d0797', 'Tara', 'Asked by email') $$, 'RVNAM', null,
  'the member''s full name is typed exactly');
select throws_ok($$ select * from public.erase_member('00000000-0000-4000-8000-0000000d0797', 'Tara Mehta', 'no') $$, '22023', null,
  'a reason is three characters or more');
select throws_ok($$ select * from public.erase_member('00000000-0000-4000-8000-0000000d0797', 'Tara Mehta', 'PAN ABCPM7971K on file') $$, '22023', null,
  'with no PAN in it');
select throws_ok($$ select * from public.erase_member('00000000-0000-4000-8000-0000000d0797', 'Tara Mehta', 'Aadhaar 1234 5678 9012') $$, '22023', null,
  'nor an Aadhaar number');
select throws_ok($$ select * from public.erase_member('00000000-0000-4000-8000-0000000d0797', 'Tara Mehta', 'She called from 98765-43210') $$, '22023', null,
  'nor a phone number');
select throws_ok($$ select * from public.erase_member('00000000-0000-4000-8000-0000000d0797', 'Tara Mehta', 'Asked by mehta herself') $$, '22023', null,
  'nor her name, which the audit log would keep');
select pg_temp.as_owner();
select is(private.is_safe_erasure_reason('Asked by email in October 2026, on 25-10-2026', 'Tara Mehta'), true, 'a date is fine');
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');

-- ---------------------------------------------------------------------------------------------------
-- Tara is erased.
select results_eq($$ select forfeited_points, forfeited_bonus_paise, forfeited_nights, blocked_until is null
                     from public.erase_member('00000000-0000-4000-8000-0000000d0797', ' Tara Mehta ', 'Asked by email on 25 Oct') $$,
  $$ values (1200::bigint, 50000::bigint, 1250::bigint, true) $$, 'Vikram erases Tara, who forfeits her points, bonus and nights, with no break to keep');
select throws_ok($$ select * from public.erase_member('00000000-0000-4000-8000-0000000d0797', 'Erased member', 'Asked by email on 25 Oct') $$, 'RVERD', null,
  'once only');
select results_eq($$ select is_erased, kyc_files from public.member_erasure_preview('00000000-0000-4000-8000-0000000d0797') $$,
  $$ values (true, 1) $$, 'her record shows her erased, with one KYC file in Storage still to remove');
select is(public.erased_member_kyc_folder('00000000-0000-4000-8000-0000000d0797'),
  '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000d0797/', 'her folder, kyc/<venue>/<member>/, for the Edge Function to remove');
select is(public.erased_member_kyc_folder('00000000-0000-4000-8000-0000000d0798'), null, 'none for a member not erased');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is(public.erased_member_kyc_folder('00000000-0000-4000-8000-0000000d0797'), null,
  'and none for anyone but a super admin of her venue, who learns nothing of who was erased');
select pg_temp.as_owner();

select results_eq($$ select full_name, phone, user_id, qualifying_small_blind, erased_at is not null, member_number is not null
                     from public.member where id = '00000000-0000-4000-8000-0000000d0797' $$,
  $$ values ('Erased member'::text, null::text, null::uuid, null::bigint, true, true) $$,
  'her member record stays, by number, with no name, number or login');
select throws_ok($$ update public.member set full_name = 'Tara Mehta' where id = '00000000-0000-4000-8000-0000000d0797' $$, '23514', null,
  'and is never named again');
select is_empty($$ select 1 from auth.users where id = '00000000-0000-4000-8000-0000000d0797' $$, 'her login is gone');
select is_empty($$ select 1 from auth.audit_log_entries where payload ->> 'actor_id' = '00000000-0000-4000-8000-0000000d0797' $$,
  'with what the sign-in service recorded of her');
select is((select count(*)::int from public.member_preference where member_id = '00000000-0000-4000-8000-0000000d0797')
          + (select count(*)::int from public.notification_preference where member_id = '00000000-0000-4000-8000-0000000d0797')
          + (select count(*)::int from public.member_limit where member_id = '00000000-0000-4000-8000-0000000d0797')
          + (select count(*)::int from public.member_feature_override where member_id = '00000000-0000-4000-8000-0000000d0797')
          + (select count(*)::int from public.sign_up_attribution where member_id = '00000000-0000-4000-8000-0000000d0797')
          + (select count(*)::int from public.membership_card where member_id = '00000000-0000-4000-8000-0000000d0797')
          + (select count(*)::int from public.feedback where member_id = '00000000-0000-4000-8000-0000000d0797')
          + (select count(*)::int from public.kyc_review where member_id = '00000000-0000-4000-8000-0000000d0797'), 0,
  'her preferences, limits, overrides, attribution, card, feedback and KYC reviews are deleted');
select results_eq($$ select status, pan, date_of_birth, address, masked_aadhaar, photo_path, identity_key, verified_at
                     from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000d0797' $$,
  $$ values ('erased'::text, 'ABCPM7971K'::text, null::date, null::text, null::text, null::text, null::text, null::timestamptz) $$,
  'her KYC record keeps the PAN alone, for the TDS taken from her');
select is((select count(*)::int from public.tds_withholding where member_id = '00000000-0000-4000-8000-0000000d0797'), 1, 'which is kept');
insert into public.member (id, venue_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000d0795', '00000000-0000-4000-8000-000000000001', 'Tara M', '+919000000795');
insert into public.kyc_record (venue_id, member_id, status, method, pan)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0795', 'needs_review', 'pan', 'ABCPM7971K');
select is(private.kyc_clashes('00000000-0000-4000-8000-0000000d0795'), false, 'a new check with the same PAN is not held as her duplicate');
select results_eq($$ select id, removed_at is not null from public.payout_account where member_id = '00000000-0000-4000-8000-0000000d0797' $$,
  $$ values ('00000000-0000-4000-8000-0000000e0797'::uuid, true) $$,
  'the payout account her deposit names is kept, removed; the other is deleted');
select is((select withdrawn_at is not null from public.consent where member_id = '00000000-0000-4000-8000-0000000d0797'), true, 'her consent is withdrawn');
select is_empty($$ select 1 from public.outbox_event where payload ->> 'member_id' = '00000000-0000-4000-8000-0000000d0797' $$,
  'no message about her waits to go out');

-- The forfeit: points to the club's points issued, bonus to its bonus expense, balanced, and the grants closed.
select results_eq($$ select a.code, sum(e.amount)::bigint from public.ledger_transaction t join public.ledger_entry e on e.transaction_id = t.id
                     join public.ledger_account a on a.id = e.account_id
                     where t.kind = 'member_erasure_forfeit' and t.idempotency_key like '%0d0797' group by a.code order by a.code $$,
  $$ values ('member.bonus'::text, 50000::bigint), ('member.nights', 1250), ('member.points', 1200), ('venue.bonus_expense', -50000),
            ('venue.nights_issued', -1250), ('venue.points_issued', -1200) $$,
  'the forfeit posts her points, bonus and nights back to the club');
select is((select count(*)::int from public.ledger_account a where a.member_id = '00000000-0000-4000-8000-0000000d0797'
           and private.account_balance(a.id) <> 0), 0, 'and every account of hers is at zero');
select results_eq($$ select g.remaining_paise, g.expired_at is not null, g.expiry_transaction_id = t.id
                     from public.bonus_grant g, public.ledger_transaction t
                     where g.member_id = '00000000-0000-4000-8000-0000000d0797' and t.idempotency_key = 'member_erasure_forfeit:bonus:00000000-0000-4000-8000-0000000d0797' $$,
  $$ values (0::bigint, true, true) $$, 'her bonus grant is closed by the bonus forfeit');
update public.bonus_grant set expires_at = now() - interval '1 second' where member_id = '00000000-0000-4000-8000-0000000d0797';
select private.expire_bonus();
select is_empty($$ select 1 from public.ledger_transaction t where t.kind = 'bonus_expiry'
                   and t.idempotency_key in (select 'bonus_expiry:' || g.id from public.bonus_grant g where g.member_id = '00000000-0000-4000-8000-0000000d0797') $$,
  'so the expiry job never takes it twice');

-- The audit log: personal fields stripped from the rows about her, and the erasure recorded without them.
select is_empty($$ select 1 from pg_temp.audit_about('00000000-0000-4000-8000-0000000d0797')
                   where concat(before::text, after::text) ~ '(Tara|9000000797|chairs|tara@)' $$,
  'no audit row about her holds her name, number, words or payout address');
select isnt_empty($$ select 1 from pg_temp.audit_about('00000000-0000-4000-8000-0000000d0797') where entity = 'feedback' $$,
  'though the rows themselves are kept');
select results_eq($$ select entity, before, reason, (after ->> 'points')::bigint from public.audit_log
                     where action = 'member.erase' and entity_id = '00000000-0000-4000-8000-0000000d0797' $$,
  $$ values ('member'::text, null::jsonb, 'Asked by email on 25 Oct'::text, 1200::bigint) $$, 'the erasure is in the audit log, with its reason');
select isnt_empty($$ select 1 from pg_temp.audit_about('00000000-0000-4000-8000-0000000d0798') where after ->> 'full_name' = 'Dev Khanna' $$,
  'the rows about others are untouched');

-- The audit log's guard gives way only to an erasure's own stripping of the rows about its member.
select throws_ok($$ update public.audit_log set after = after - 'full_name' where entity_id = '00000000-0000-4000-8000-0000000d0798' $$,
  '42501', null, 'outside an erasure the audit log is append-only');
select set_config('rivr.erase', 'on', true), set_config('rivr.erase_member', '00000000-0000-4000-8000-0000000d0797', true);
select throws_ok($$ update public.audit_log set after = after - 'full_name' where entity_id = '00000000-0000-4000-8000-0000000d0798' $$,
  '42501', null, 'an erasure touches no row about another member');
select set_config('rivr.erase_member', '00000000-0000-4000-8000-0000000d0798', true);
select throws_ok($$ update public.audit_log set after = after || '{"full_name": "Someone"}' where entity_id = '00000000-0000-4000-8000-0000000d0798' $$,
  '42501', null, 'adds nothing');
select throws_ok($$ update public.audit_log set reason = 'Changed' where entity_id = '00000000-0000-4000-8000-0000000d0798' $$,
  '42501', null, 'changes no other column');
select throws_ok($$ update public.audit_log set after = after - 'tier_id' where entity_id = '00000000-0000-4000-8000-0000000d0798' and after ? 'tier_id' $$,
  '42501', null, 'and takes away no field but the personal ones');
select lives_ok($$ update public.audit_log set before = private.strip_erased_fields(before), after = private.strip_erased_fields(after)
                   where entity_id = '00000000-0000-4000-8000-0000000d0798' $$, 'which alone it strips');
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select set_config('rivr.erase', 'on', true), set_config('rivr.erase_member', '00000000-0000-4000-8000-0000000d0798', true);
select throws_ok($$ update public.audit_log set after = private.strip_erased_fields(after) where entity_id = '00000000-0000-4000-8000-0000000d0798' $$,
  '42501', null, 'a signed-in user cannot, even claiming to erase');
select pg_temp.as_owner();
select set_config('rivr.erase', 'off', true), set_config('rivr.erase_member', '', true);

-- ---------------------------------------------------------------------------------------------------
-- Dev, on a break: once settled, erased, with a block on his number and identity until the break ends.
select isnt(private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'opening_balance', 'erasure-test:dev-cash-back', jsonb_build_array(
  jsonb_build_object('account_id', (select id from public.ledger_account where member_id = '00000000-0000-4000-8000-0000000d0798' and code = 'member.cash'), 'amount', '100000'),
  jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.opening_balance'), 'amount', '-100000')),
  null), null, 'Dev''s wallet is paid out');
update public.deposit_request set status = 'not_found', decided_at = now() where id = '00000000-0000-4000-8000-0000000a0798';
update public.visit set closed_at = now(), close_reason = 'door' where id = '00000000-0000-4000-8000-0000000b0798';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select forfeited_points, forfeited_bonus_paise, blocked_until > now() + interval '29 days'
                     from public.erase_member('00000000-0000-4000-8000-0000000d0798', 'Dev Khanna', 'Asked at the desk') $$,
  $$ values (0::bigint, 0::bigint, true) $$, 'Vikram erases Dev, and his break stands');
select pg_temp.as_owner();
select is_empty($$ select 1 from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000d0798' $$,
  'with no TDS taken, his KYC record is deleted');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000101", "role": "authenticated"}', true);
select throws_ok($$ insert into public.kyc_record (venue_id, member_id, status, method)
                    values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0798', 'started', 'pan') $$,
  'RVERD', null, 'and an erased member is never checked again');
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select throws_ok($$ insert into public.kyc_record (venue_id, member_id, status, method)
                    values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0798', 'started', 'pan') $$,
  'RVERD', null, 'not by a service either');
select pg_temp.as_owner();
insert into public.kyc_record (venue_id, member_id, status, method)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0798', 'started', 'pan') on conflict do nothing;
select is_empty($$ select 1 from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000d0798' $$,
  'a seed run again on staging skips his old KYC row instead of failing');
select results_eq($$ select phone_hash = private.kyc_reference('phone:+919000000798'), identity_keys @> array['dev-identity'], cardinality(identity_keys),
                            ends_at > now() + interval '29 days'
                     from private.member_erasure_block where venue_id = '00000000-0000-4000-8000-000000000001' $$,
  $$ values (true, true, 3, true) $$,
  'the block holds keyed hashes of his number, identity key, PAN, and Aadhaar digits with birth date; never a name');
select throws_ok($$ insert into public.member (venue_id, full_name, phone) values ('00000000-0000-4000-8000-000000000001', 'Dev K', '+919000000798') $$,
  'RVBRK', null, 'while it stands, his number does not join the club');
select lives_ok($$ insert into public.member (venue_id, full_name, phone) values ('00000000-0000-4000-8000-000000000002', 'Dev K', '+919000000798') $$,
  'a block is the venue''s own');
insert into public.member (id, venue_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000d0796', '00000000-0000-4000-8000-000000000001', 'Dev K', '+919000000796');
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, identity_key, photo_path)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0796', 'started', 'digilocker', '1989-05-06', 'dev-identity',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000d0796/selfie.jpg');
select is(private.settle_kyc('00000000-0000-4000-8000-0000000d0796', 'verified'), 'refused', 'a KYC check with his identity is refused');
select is((select refusal from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000d0796'), 'on_break', 'for the break');
select throws_ok($$ update public.member set phone = '+919000000798' where id = '00000000-0000-4000-8000-0000000d0796' $$, 'RVBRK', null,
  'nor does a member''s number change to his');
insert into public.member (id, venue_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000d0794', '00000000-0000-4000-8000-000000000001', 'D Khanna', '+919000000794');
insert into public.kyc_record (venue_id, member_id, status, method, pan)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0794', 'needs_review', 'pan', 'ABCPK7981L');
select is(private.settle_kyc('00000000-0000-4000-8000-0000000d0794', 'verified', true), 'refused',
  'a check by his PAN alone, without DigiLocker, is refused too');
insert into public.member (id, venue_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000d0792', '00000000-0000-4000-8000-000000000001', 'D K', '+919000000792');
insert into public.kyc_record (venue_id, member_id, status, method, masked_aadhaar, date_of_birth)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0792', 'needs_review', 'manual', 'XXXX XXXX 7981', '1989-05-06');
select is(private.settle_kyc('00000000-0000-4000-8000-0000000d0792', 'verified', true), 'refused',
  'and an in-person check by his Aadhaar''s last four digits and birth date');
update private.member_erasure_block set ends_at = now() - interval '1 second';
select private.lapse_erasure_blocks();
select is_empty($$ select 1 from private.member_erasure_block $$, 'when the break ends, the block goes');
select isnt_empty($$ select 1 from cron.job where jobname = 'erasure-blocks-lapse' and command = 'select private.lapse_erasure_blocks()' $$,
  'each night');
select lives_ok($$ insert into public.member (venue_id, full_name, phone) values ('00000000-0000-4000-8000-000000000001', 'Dev K', '+919000000798') $$,
  'and his number may join again');

-- ---------------------------------------------------------------------------------------------------
-- The practice venue erases as the club does, its seed taken again so a reset cannot bring Uma back, and nothing
-- leaves for an outside system.
create temp table outbox_before as select count(*) as n from public.outbox_event;
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select forfeited_points from public.erase_member('00000000-0000-4000-8000-0000000d0799', 'Uma Rao', 'Practice erasure') $$,
  $$ values (0::bigint) $$, 'Vikram erases Uma at the practice venue');
select pg_temp.as_owner();
select is((select row_data ->> 'full_name' from private.practice_seed
           where venue_id = '00000000-0000-4000-8000-000000000002' and table_name = 'member' and row_data ->> 'id' = '00000000-0000-4000-8000-0000000d0799'),
  'Erased member', 'the practice seed holds her erased');
select is_empty($$ select 1 from private.practice_seed where row_data::text like '%Uma Rao%' $$, 'and nowhere her name');
select is((select count(*) from public.outbox_event), (select n from outbox_before), 'an erasure sends nothing out');
select isnt_empty($$ select 1 from auth.users where id = '00000000-0000-4000-8000-000000000104' $$,
  'and a login a staff record uses stays');

-- ---------------------------------------------------------------------------------------------------
-- After a restore: the erasures recorded since a time, or named, are made again; twice changes nothing.
create temp table audit_before as select count(*) as n from public.audit_log;
select results_eq($$ select member_id, outcome from private.reapply_member_erasures(null, array['00000000-0000-4000-8000-0000000d0797'::uuid]) $$,
  $$ values ('00000000-0000-4000-8000-0000000d0797'::uuid, 'erased'::text) $$, 're-applying an erasure already made succeeds');
select is((select count(*) from public.audit_log), (select n from audit_before), 'and writes nothing');
select is((select count(*)::int from public.ledger_transaction where kind = 'member_erasure_forfeit' and idempotency_key like '%0d0797'), 3,
  'nor forfeits again: still her one transaction each for points, bonus and nights');
-- A restore from before the erasure brings her back.
update public.member set full_name = 'Tara Mehta', phone = '+919000000797', erased_at = null where id = '00000000-0000-4000-8000-0000000d0797';
insert into public.member_preference (member_id, venue_id, name_on_tvs)
values ('00000000-0000-4000-8000-0000000d0797', '00000000-0000-4000-8000-000000000001', true);
select set_eq($$ select member_id, outcome from private.reapply_member_erasures(now() - interval '1 hour', null) $$,
  $$ values ('00000000-0000-4000-8000-0000000d0797'::uuid, 'erased'::text), ('00000000-0000-4000-8000-0000000d0798', 'erased'),
            ('00000000-0000-4000-8000-0000000d0799', 'erased') $$,
  'the erasures recorded since a time are made again');
select results_eq($$ select full_name, phone from public.member where id = '00000000-0000-4000-8000-0000000d0797' $$,
  $$ values ('Erased member'::text, null::text) $$, 'Tara is erased again');
select is_empty($$ select 1 from public.member_preference where member_id = '00000000-0000-4000-8000-0000000d0797' $$, 'with what came back of hers');
select is_empty($$ select 1 from pg_temp.audit_about('00000000-0000-4000-8000-0000000d0797') where concat(before::text, after::text) ~ 'Tara' $$,
  'and the audit rows the restore wrote');
select is((select count(*)::int from public.audit_log where action = 'member.erase' and entity_id = '00000000-0000-4000-8000-0000000d0797'), 1,
  'still one erasure in the log');

select is((select count(*)::int from public.ledger_transaction where kind = 'member_erasure_forfeit' and idempotency_key like '%0d0797'), 3,
  'and forfeits nothing again: still three');

-- ---------------------------------------------------------------------------------------------------
-- Isha (0793) owes the club 100 points, busted from the Weeknight Turbo (not finished) with TDS on a prize, and
-- played ₹300 of a ₹500 grant; a ₹400 grant of hers expired on its own.
insert into public.member (id, venue_id, full_name, phone)
values ('00000000-0000-4000-8000-0000000d0793', '00000000-0000-4000-8000-000000000001', 'Isha Rao', '+919000000793');
insert into public.kyc_record (venue_id, member_id, status, method, pan, date_of_birth, photo_path, verified_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0793', 'verified', 'pan', 'ABCPR7931M', '1990-01-01',
        '00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-0000000d0793/selfie.jpg', now());
select isnt(private.post_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0793', -100, 'erasure_test', 'Erasure test',
  'erasure-test:isha-owes'), null, 'Isha owes 100 points');
insert into public.tournament_entry (id, venue_id, tournament_id, member_id, entry_number, status, busted_at, bust_order)
values ('00000000-0000-4000-8000-0000000c0793', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000007a2',
        '00000000-0000-4000-8000-0000000d0793', 9793, 'busted', now(), 9793);
insert into public.tournament_payout (venue_id, tournament_id, entry_id, member_id, kind, place, prize_paise, bounty_paise, tds_paise, is_tds_shadow,
                                      ledger_transaction_id)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000007a2', '00000000-0000-4000-8000-0000000c0793',
        '00000000-0000-4000-8000-0000000d0793', 'prize', 9, 100000, 0, 30000, false,
        (select id from public.ledger_transaction where idempotency_key = 'erasure-test:cash-out'));
create temp table isha_grants as select
  private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0793', 50000, 'Welcome bonus',
    now() + interval '30 days', 'erasure-test:isha-bonus') as played,
  private.credit_bonus('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0793', 40000, 'Welcome bonus',
    now() + interval '30 days', 'erasure-test:isha-bonus-2') as expired;
-- ₹300 of the first played at a buy-in, as the cage draws it.
update public.bonus_grant set remaining_paise = 20000 where id = (select played from isha_grants);
select isnt(private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'erasure_test', 'erasure-test:isha-play', jsonb_build_array(
  jsonb_build_object('account_id', (select id from public.ledger_account where member_id = '00000000-0000-4000-8000-0000000d0793' and code = 'member.bonus'), 'amount', '30000'),
  jsonb_build_object('account_id', (select id from public.ledger_account where venue_id = '00000000-0000-4000-8000-000000000001' and code = 'venue.chips_outstanding'), 'amount', '-30000')),
  null), null, 'she plays ₹300 of it');
update public.bonus_grant set expires_at = now() - interval '1 second' where id = (select expired from isha_grants);
select private.expire_bonus();
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select blockers, points, bonus_paise from public.member_erasure_preview('00000000-0000-4000-8000-0000000d0793') $$,
  $$ values (array['rewards', 'tournament'], 0::bigint, 20000::bigint) $$,
  'the points she owes and her run in a tournament not finished must be settled first');
select pg_temp.as_owner();
select isnt(private.post_points('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000d0793', 100, 'erasure_test', 'Erasure test',
  'erasure-test:isha-repays'), null, 'she pays the points back');
update public.tournament_entry set status = 'refunded', busted_at = null, bust_order = null where id = '00000000-0000-4000-8000-0000000c0793';
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select results_eq($$ select forfeited_points, forfeited_bonus_paise from public.erase_member('00000000-0000-4000-8000-0000000d0793', 'Isha Rao', 'Asked by email') $$,
  $$ values (0::bigint, 20000::bigint) $$, 'Vikram erases her: the ₹200 left is forfeited, no more');
select pg_temp.as_owner();
select results_eq($$ select g.id = (select played from isha_grants),
                            g.expiry_transaction_id = (select id from public.ledger_transaction where idempotency_key = 'member_erasure_forfeit:bonus:00000000-0000-4000-8000-0000000d0793'),
                            coalesce(g.expiry_transaction_id = (select id from public.ledger_transaction where idempotency_key = 'bonus_expiry:' || g.id), false)
                     from public.bonus_grant g where g.member_id = '00000000-0000-4000-8000-0000000d0793' order by g.amount_paise $$,
  $$ values (false, false, true), (true, true, false) $$,
  'the grant she played closes on the forfeit; the one that expired keeps its expiry');
select is((select private.account_balance(id) from public.ledger_account where member_id = '00000000-0000-4000-8000-0000000d0793' and code = 'member.bonus'),
  0::bigint, 'her bonus ends at zero');
select results_eq($$ select status, pan from public.kyc_record where member_id = '00000000-0000-4000-8000-0000000d0793' $$,
  $$ values ('erased'::text, 'ABCPR7931M'::text) $$, 'TDS on a tournament prize keeps her PAN too');

-- At most ten erasures a venue in an hour.
select private.audit('00000000-0000-4000-8000-000000000001', 'member.erase', 'member', gen_random_uuid()::text, null, null, 'Rate test')
from generate_series(1, 8);
select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
select throws_ok($$ select * from public.erase_member('00000000-0000-4000-8000-0000000d0795', 'Tara M', 'Asked at the desk') $$, 'RVRAT', null,
  'an eleventh erasure in the hour waits');
select pg_temp.as_owner();

select * from finish();
rollback;
