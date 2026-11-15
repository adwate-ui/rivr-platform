-- The membership card, Social, the kill switch and purge, the cage with its markers, TDS, shifts, accounts, withdrawals,
-- expenses and Tally, and what else the older console screens used, all go (redesign of 15 Nov 2026; issues 948, 950, 951,
-- 953 and 954; docs/spec/redesign-2026-11-15.md slice 1; decision 0587). Every function below is as the newest migration
-- before this one left it, less what named the removed things.
--
-- What stays on purpose:
--   * the ledger, with every account Bonus and promotions post to, and its rows as they are;
--   * control_state and the checks that refuse a write in a frozen room (the owner, 15 Nov): with no way to freeze, they
--     never refuse;
--   * member erasure and the export archive, with the helpers they share with what went;
--   * the tournament tables, for RD-26; what ran the old tournament screens goes, as it sold entries through the cage;
--   * the enum labels of what went (a TV mode, the door kiosk's device kind): Postgres drops a label only by rebuilding
--     every column, policy and index that uses the type, so each is left with nothing able to use it;
--   * the storage buckets of winner cards, social media and expense receipts, which no one can read or write now.

-- A record of a real payout or tax deduction stops the migration: such a record carries a duty to keep it, and a person
-- decides what becomes of it. Production and staging have none (read 15 Nov 2026). So does a freeze in force, which
-- nothing could lift once the Kill switch is gone.
do $$
begin
  if exists (select 1 from public.cage_transaction c join public.venue v on v.id = c.venue_id where not v.is_practice)
     or exists (select 1 from public.tds_withholding t join public.venue v on v.id = t.venue_id where not v.is_practice)
     or exists (select 1 from public.withdrawal_request r join public.venue v on v.id = r.venue_id where not v.is_practice and r.status <> 'waiting') then
    raise exception 'The club holds a cage transaction, a tax deduction or a withdrawal that was decided: decide what becomes of the record before the cage goes';
  end if;
  if exists (select 1 from public.control_state c where c.released_at is null) then
    raise exception 'A freeze, a stop or a switched-off feature is in force: release it before the Kill switch goes';
  end if;
end;
$$;

-- What ran on a table that stays, for a function that goes; and the jobs of the consumers whose Edge Functions went,
-- which a hosted project schedules by hand (production ran outbox-social-wall and outbox-channel-analytics on 15 Nov).
select cron.unschedule(j.jobid) from cron.job j
where j.jobname in ('host-queue', 'outbox-social-wall', 'outbox-social-publish', 'outbox-social-inbox', 'outbox-channel-analytics',
                    'outbox-withdrawal-payout', 'outbox-payout-name-check');
drop trigger ledger_account_payment_account on public.ledger_account;
drop trigger ledger_entry_needs_open_shift on public.ledger_entry;
drop trigger ledger_entry_tv_signal on public.ledger_entry;
drop trigger member_link_leads on public.member;
drop trigger make_winner_cards on public.outbox_event;
drop trigger self_exclusion_closes_host_item on public.self_exclusion;
drop trigger tournament_payout_tds on public.tournament_payout;
drop trigger tournament_purchase_structuring on public.tournament_purchase;
drop trigger venue_config_guard_staff_networks on public.venue_config;
drop trigger visit_wins_back_host_item on public.visit;
drop policy "players see their winner cards, and staff who publish marketing" on storage.objects;
drop policy "staff who publish marketing upload social media" on storage.objects;
drop policy "the cage and treasury managers read expense receipts" on storage.objects;
drop policy "the cage and treasury managers upload expense receipts" on storage.objects;

-- Activity is read by a permission of its own, held by the roles that held the kill switch's; the rows about controls
-- in the audit log and the outbox are theirs to see as before.
insert into public.role_permission (role, permission)
select 'super_admin', permission from unnest(array['activity.read']) as permission;
alter policy "auditors read their venue's log; AML rows, controls and persona" on public.audit_log
  using (((venue_id IN ( SELECT private.venues_where('audit.read'::text) AS venues_where)) AND (((action !~~ 'aml.%'::text) AND (entity <> ALL (ARRAY['sar_entry'::text, 'sar_entry_transaction'::text])) AND (NOT ((entity = 'alert'::text) AND ((COALESCE(after, before) ->> 'kind'::text) ~~ 'aml.%'::text))) AND (NOT ((entity = 'setting'::text) AND ((COALESCE(after, before) ->> 'key'::text) ~~ 'aml.%'::text)))) OR (venue_id IN ( SELECT private.venues_where('aml.review'::text) AS venues_where))) AND ((entity <> 'control_state'::text) OR (venue_id IN ( SELECT private.venues_where('activity.read'::text) AS venues_where))) AND (private.is_shareable_audit_row(entity, before, after) OR (venue_id IN ( SELECT private.venues_where('members.read'::text) AS venues_where)))));
alter policy "staff who engage controls see every control, and whom it names" on public.control_state
  using ((venue_id IN ( SELECT private.venues_where('activity.read'::text) AS venues_where)));
alter policy "reports staff see the venue's events; AML alerts and controls o" on public.outbox_event
  using (((venue_id IN ( SELECT private.venues_where('reports.read'::text) AS venues_where)) AND ((NOT ((event_type = 'alert.raised'::text) AND ((payload ->> 'kind'::text) ~~ 'aml.%'::text))) OR (venue_id IN ( SELECT private.venues_where('aml.review'::text) AS venues_where))) AND ((event_type !~~ 'control.%'::text) OR (venue_id IN ( SELECT private.venues_where('activity.read'::text) AS venues_where)))));

-- Their settings, features and permissions.
delete from public.setting s where s.key in ('aml.structuring', 'card.qr_rotation_seconds', 'dealer.rotation_minutes', 'high_hand.payouts', 'host.lapse', 'markers.due_days', 'social.connected_channels');
delete from public.setting_key where key in ('aml.structuring', 'card.qr_rotation_seconds', 'dealer.rotation_minutes', 'high_hand.payouts', 'host.lapse', 'markers.due_days', 'social.connected_channels');
delete from public.tier_feature t where t.feature_key in ('balance.deposits', 'core.balance_view', 'core.kill_switch_banner', 'core.membership_card', 'core.withdrawals', 'events.book', 'push.withdrawal_sent', 'social.winner_cards');
delete from public.member_feature_override o where o.feature_key in ('balance.deposits', 'core.balance_view', 'core.kill_switch_banner', 'core.membership_card', 'core.withdrawals', 'events.book', 'push.withdrawal_sent', 'social.winner_cards');
delete from public.notification_preference n where n.push_type in ('balance.deposits', 'core.balance_view', 'core.kill_switch_banner', 'core.membership_card', 'core.withdrawals', 'events.book', 'push.withdrawal_sent', 'social.winner_cards');
delete from public.feature where key in ('balance.deposits', 'core.balance_view', 'core.kill_switch_banner', 'core.membership_card', 'core.withdrawals', 'events.book', 'push.withdrawal_sent', 'social.winner_cards');
alter table public.role_permission drop constraint super_admin_only_permissions;
delete from public.role_permission where permission in ('control.engage', 'purge.run', 'marketing.publish', 'eod.review', 'incidents.log', 'jackpots.approve', 'markers.issue', 'markers.manage_limits', 'pot_data.read', 'shareholding.manage', 'sops.acknowledge', 'withdrawals.approve');
alter table public.role_permission add constraint super_admin_only_permissions check (
  role = 'super_admin'
  or permission not in ('exports.full', 'activity.read', 'members.override_features', 'venue.configure', 'members.erase', 'promotions.approve', 'members.change_phone')
);

-- The guards on settings name the keys that stay (as 20261117100200_bonus_by_hand_cap.sql and 20261028010000_aml.sql,
-- less high_hand.payouts and aml.structuring).
drop trigger setting_control_set on public.setting;
drop trigger setting_control_removed on public.setting;
create trigger setting_control_set before insert on public.setting
  for each row when (new.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'jackpot.payout', 'gst.config', 'rakeback.rate',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap', 'auth.store_reviewer', 'bonus.expiry_days', 'bonus.visit_cap',
                                 'bonus.by_hand_cap'))
  execute function private.guard_control_settings();
create trigger setting_control_removed before delete on public.setting
  for each row when (old.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'jackpot.payout', 'gst.config', 'rakeback.rate',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap', 'auth.store_reviewer', 'bonus.expiry_days', 'bonus.visit_cap',
                                 'bonus.by_hand_cap'))
  execute function private.guard_control_settings();
drop trigger setting_aml_set on public.setting;
drop trigger setting_aml_removed on public.setting;
create trigger setting_aml_set before insert on public.setting
  for each row when (new.key in ('cage.cash_buy_in_limit')) execute function private.guard_aml_settings();
create trigger setting_aml_removed before delete on public.setting
  for each row when (old.key in ('cage.cash_buy_in_limit')) execute function private.guard_aml_settings();

-- The TVs: a board that went leaves a rotation, and a TV whose main board it was shows the waitlist.
update public.tv_screen set rotation = (select coalesce(array_agg(m order by n), '{}') from unnest(rotation) with ordinality as r (m, n)
                                        where m::text <> all (array['jackpot', 'tournament_clock', 'social_wall']))
where rotation::text[] && array['jackpot', 'tournament_clock', 'social_wall'];
update public.tv_screen set mode = 'waitlist', rotation = array_remove(rotation, 'waitlist') where mode::text in ('jackpot', 'tournament_clock', 'social_wall');
alter table public.tv_screen add constraint tv_screen_boards_in_use
  check (mode::text <> all (array['jackpot', 'tournament_clock', 'social_wall']) and not rotation::text[] && array['jackpot', 'tournament_clock', 'social_wall']);

-- The door kiosk: no device is one, and none can be made one.
update public.device set revoked_at = now(), revoked_reason = 'The door kiosk went with the membership card' where kind = 'door' and revoked_at is null;
alter table public.device add constraint device_kind_in_use check (kind <> 'door' or revoked_at is not null);

-- The website: the social wall's and the jackpot's blocks go, from the pages and from every saved version of them.
delete from public.site_block where kind in ('social_wall', 'jackpot');
update public.site_revision r
set blocks = (select coalesce(jsonb_agg(x.block order by x.place), '[]'::jsonb)
              from jsonb_array_elements(r.blocks) with ordinality as x (block, place)
              where x.block ->> 'kind' is distinct from 'social_wall' and x.block ->> 'kind' is distinct from 'jackpot')
where jsonb_typeof(r.blocks) = 'array' and (r.blocks @> '[{"kind": "social_wall"}]' or r.blocks @> '[{"kind": "jackpot"}]');
alter table public.site_block drop constraint site_block_kind_check;
alter table public.site_block add constraint site_block_kind_check check (kind = any (array['hero', 'statement', 'gallery', 'feature', 'text', 'rules', 'faq', 'careers', 'map', 'games', 'calendar', 'links', 'story', 'cards', 'marquee', 'timeline', 'table', 'promotions', 'rewards', 'outstation']));

-- The views over what goes, then the functions that take or return a row of a table that goes, then the tables with
-- their policies and triggers, then what only they used.
drop view public.control_state_detail;
drop view public.public_wall_posts;
drop view public.public_jackpot;
drop view public.public_high_hand;
drop view public.my_wallet_movement;
drop function public.venue_expenses(p_venue_id uuid);
drop function private.assert_payable(p_request withdrawal_request, p_staff uuid);
drop function private.check_shift_opening(p_shift_id uuid, p_last eod_close, p_chips_paise bigint);
drop function private.mark_withdrawal_sent(p_request withdrawal_request, p_txn uuid, p_staff uuid);
drop function private.post_withdrawal_paid(p_request withdrawal_request, p_account_code text, p_key text, p_memo text, p_feature killable_feature);
drop function private.sop_version_in_force(p_sop_id uuid);
drop function private.venue_expenses(p_venue_id uuid);
drop function private.waiting_deposit(p_request_id uuid, p_permission text);
drop function private.waiting_withdrawal(p_request_id uuid, p_permission text, p_feature killable_feature);
drop table public.membership_card, public.wall_post, public.social_post, public.social_post_channel, public.lead, public.inbox_message, public.winner_card, public.channel_metric, public.purge_request, private.venue_purge, public.cage_transaction, public.buy_in_request, public.cage_shift, public.chip_denomination, public.chip_inventory_count, public.chip_inventory_line, public.eod_close, public.second_approval, public.marker, public.marker_settlement, public.credit_line, public.tds_withholding, public.payment_account, public.account_transfer, public.withdrawal_request, public.payout_account, public.deposit_request, private.withdrawal_payout_check, private.payout_name_check_claim, public.expense, public.expense_category, public.tally_ledger_map, public.staff_shift, public.staff_attendance, public.jackpot_event, public.high_hand_claim, public.club_event, public.club_event_booking, public.creator, public.shareholder, public.shareholding, public.sar_entry, public.sar_entry_transaction, public.quiz, public.quiz_attempt, public.drill, public.sop, public.sop_version, public.sop_ack, public.incident, public.host_queue_item, private.practice_seed;
delete from private.member_export_column where table_name in ('membership_card', 'wall_post', 'social_post', 'social_post_channel', 'lead', 'inbox_message', 'winner_card', 'channel_metric', 'purge_request', 'venue_purge', 'cage_transaction', 'buy_in_request', 'cage_shift', 'chip_denomination', 'chip_inventory_count', 'chip_inventory_line', 'eod_close', 'second_approval', 'marker', 'marker_settlement', 'credit_line', 'tds_withholding', 'payment_account', 'account_transfer', 'withdrawal_request', 'payout_account', 'deposit_request', 'withdrawal_payout_check', 'payout_name_check_claim', 'expense', 'expense_category', 'tally_ledger_map', 'staff_shift', 'staff_attendance', 'jackpot_event', 'high_hand_claim', 'club_event', 'club_event_booking', 'creator', 'shareholder', 'shareholding', 'sar_entry', 'sar_entry_transaction', 'quiz', 'quiz_attempt', 'drill', 'sop', 'sop_version', 'sop_ack', 'incident', 'host_queue_item', 'practice_seed');
delete from private.member_export_column where table_name = 'venue_config' and column_name = 'staff_ip_allowlist';

drop function public.account_statement(p_payment_account_id uuid, p_from timestamp with time zone, p_to timestamp with time zone);
drop function public.acknowledge_sop(p_version_id uuid);
drop function public.add_expense_category(p_venue_id uuid, p_name text);
drop function public.add_payment_account(p_venue_id uuid, p_kind text, p_name text, p_details text);
drop function public.add_payout_account(p_kind text, p_bank_name text, p_vpa text, p_account_number text, p_ifsc text, p_holder_name text);
drop function public.add_shareholder(p_venue_id uuid, p_name text, p_kind text);
drop function public.add_shifts(p_venue_id uuid, p_staff_ids uuid[], p_days date[], p_starts text, p_ends text);
drop function public.add_sop(p_venue_id uuid, p_title text, p_owner text, p_ack_roles staff_role[], p_effective_on date, p_body text);
drop function public.aml_register(p_venue_id uuid);
drop function public.approve_high_hand(p_claim_id uuid, p_expected_paise bigint);
drop function public.ask_live_purge(p_venue_id uuid, p_reason text);
drop function public.bag_tournament_flight(p_flight_id uuid, p_stacks jsonb);
drop function public.begin_withdrawal_payout(p_request_id uuid, p_payout_key uuid);
drop function public.book_club_event(p_event_id uuid, p_is_booking boolean);
drop function public.bust_tournament_entry(p_entry_id uuid, p_eliminator_id uuid);
drop function public.cage_buy_in(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_method text, p_idempotency_key uuid, p_utr text, p_buy_in_request_id uuid);
drop function public.cage_cash_out(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_to text, p_idempotency_key uuid, p_is_final boolean);
drop function public.cage_members(p_venue_id uuid, p_query text);
drop function public.cage_queue(p_venue_id uuid);
drop function public.cage_tournament_entry(p_tournament_id uuid, p_member_id uuid, p_purchase text, p_idempotency_key uuid);
drop function public.channel_funnel(p_venue_id uuid);
drop function public.check_in_by_card(p_venue_id uuid, p_code text);
drop function public.chip_inventory(p_venue_id uuid);
drop function public.claim_high_hand(p_hand_id uuid, p_seat integer, p_category high_hand_category, p_rank text);
drop function public.claim_payout_name_checks(p_with_provider boolean);
drop function public.claim_withdrawal_payouts();
drop function public.close_cage_shift(p_venue_id uuid, p_cash_paise bigint, p_counts jsonb, p_receipts_paise bigint, p_markers_paise bigint, p_idempotency_key uuid);
drop function public.close_host_item(p_item_id uuid);
drop function public.confirm_deposit(p_request_id uuid, p_bank_amount_paise bigint);
drop function public.copy_roster_week(p_venue_id uuid, p_from date, p_to date);
drop function public.correct_high_hand(p_claim_id uuid, p_seat integer, p_category high_hand_category, p_rank text);
drop function public.count_chips(p_venue_id uuid, p_counts jsonb, p_idempotency_key uuid);
drop function public.create_club_event(p_venue_id uuid, p_kind text, p_title text, p_starts_at timestamp with time zone, p_seats integer, p_details text);
drop function public.create_tournament(p_template_id uuid, p_name text, p_starts_at timestamp with time zone, p_is_published boolean);
drop function public.creator_dashboard(p_venue_id uuid);
drop function public.credit_lines(p_venue_id uuid);
drop function public.credit_report(p_venue_id uuid, p_at timestamp with time zone);
drop function public.credit_room(p_venue_id uuid);
drop function public.dealer_nights(p_venue_id uuid, p_from timestamp with time zone, p_until timestamp with time zone);
drop function public.dealer_rotation(p_venue_id uuid);
drop function public.decide_credit_limit(p_line_id uuid, p_is_approved boolean, p_expected_limit_paise bigint);
drop function public.decide_expense(p_expense_id uuid, p_is_approved boolean, p_note text);
drop function public.decide_payout_account(p_account_id uuid, p_is_verified boolean, p_reason text);
drop function public.decline_buy_in_request(p_request_id uuid);
drop function public.decline_withdrawal(p_request_id uuid, p_reason text);
drop function public.deposit_details();
drop function public.door_scan(p_code text);
drop function public.engage_control(p_venue_id uuid, p_level control_level, p_reason text, p_feature killable_feature, p_member_id uuid, p_staff_id uuid);
drop function public.engaged_controls(p_venue_id uuid);
drop function public.eod_closes(p_venue_id uuid);
drop function public.finish_tournament(p_tournament_id uuid, p_method text, p_stacks jsonb);
drop function public.high_hands(p_venue_id uuid);
drop function public.hold_drill(p_drill_id uuid, p_notes text);
drop function public.host_queue(p_venue_id uuid);
drop function public.issue_marker(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_signature_svg text, p_idempotency_key uuid);
drop function public.jackpot_history(p_venue_id uuid);
drop function public.jackpot_pools(p_venue_id uuid);
drop function public.live_purge_preview(p_venue_id uuid);
drop function public.member_id_for_phone(p_venue_id uuid, p_phone text);
drop function public.moderate_wall_post(p_venue_id uuid, p_post_id uuid, p_is_approved boolean);
drop function public.move_tournament_entry(p_entry_id uuid, p_table integer);
drop function public.move_tournament_level(p_tournament_id uuid, p_step integer);
drop function public.my_club_events();
drop function public.my_deposits();
drop function public.my_membership_card();
drop function public.my_payout_accounts();
drop function public.my_tds_certificates();
drop function public.my_tournament();
drop function public.my_tournament_tickets();
drop function public.my_wallet();
drop function public.my_winner_cards();
drop function public.my_withdrawals();
drop function public.note_withdrawal_payout_trouble(p_request_id uuid);
drop function public.onboarding_checklists(p_venue_id uuid);
drop function public.open_cage_shift(p_venue_id uuid, p_float_paise bigint, p_counts jsonb, p_idempotency_key uuid);
drop function public.open_host_offers(p_venue_id uuid);
drop function public.open_markers(p_venue_id uuid);
drop function public.open_purge_request(p_venue_id uuid);
drop function public.owner_snapshot(p_venue_id uuid);
drop function public.past_controls(p_venue_id uuid);
drop function public.pause_tournament_clock(p_tournament_id uuid, p_is_paused boolean);
drop function public.pay_bad_beat(p_venue_id uuid, p_table_id uuid, p_loser_phone text, p_winner_phone text, p_table_phones text[], p_expected_total bigint, p_expected_rule jsonb, p_idempotency_key text);
drop function public.pay_withdrawal_in_cash(p_request_id uuid);
drop function public.pay_withdrawal_through_cashfree(p_request_id uuid);
drop function public.payment_accounts(p_venue_id uuid);
drop function public.payout_accounts_to_verify(p_venue_id uuid);
drop function public.pot_data(p_venue_id uuid, p_from timestamp with time zone, p_until timestamp with time zone);
drop function public.practice_reset_preview(p_venue_id uuid);
drop function public.promotion_replay(p_venue_id uuid, p_trigger text, p_conditions jsonb);
drop function public.publish_social_post(p_venue_id uuid, p_caption text, p_image_path text, p_channels text[]);
drop function public.publish_sop_version(p_sop_id uuid, p_owner text, p_ack_roles staff_role[], p_effective_on date, p_body text);
drop function public.purge_files_done(p_venue_id uuid, p_removed text[], p_failed integer);
drop function public.purge_files_due(p_venue_id uuid);
drop function public.purge_files_left_count(p_venue_id uuid);
drop function public.purge_live_venue(p_venue_id uuid, p_venue_name text);
drop function public.record_attendance(p_shift_id uuid, p_status text, p_note text);
drop function public.record_channel_followers(p_venue_id uuid, p_counts jsonb);
drop function public.record_holding(p_venue_id uuid, p_shareholder_id uuid, p_basis_points integer, p_effective_from date, p_note text);
drop function public.record_host_contact(p_item_id uuid, p_churn_reason text, p_offer jsonb, p_note text);
drop function public.record_inbox_messages(p_venue_id uuid, p_messages jsonb);
drop function public.record_payout_name_check(p_account_id uuid, p_outcome text, p_holder_name text);
drop function public.record_social_post_channel(p_post_id uuid, p_channel text, p_post_url text);
drop function public.record_wall_posts(p_venue_id uuid, p_posts jsonb);
drop function public.record_winner_card_image(p_card_id uuid);
drop function public.record_withdrawal_payout(p_request_id uuid, p_payout_key uuid, p_status text, p_payout_id text, p_utr text, p_failure text);
drop function public.refund_tournament_alternate(p_entry_id uuid);
drop function public.register_tournament_entry(p_tournament_id uuid, p_purchase text, p_idempotency_key uuid);
drop function public.reject_deposit(p_request_id uuid);
drop function public.reject_high_hand(p_claim_id uuid, p_reason text);
drop function public.release_control(p_control_id uuid, p_reason text);
drop function public.remove_payout_account(p_account_id uuid);
drop function public.remove_shift(p_shift_id uuid);
drop function public.remove_tournament(p_tournament_id uuid);
drop function public.repay_markers(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_method text, p_utr text, p_idempotency_key uuid);
drop function public.request_buy_in(p_session_id uuid, p_amount_paise bigint, p_idempotency_key uuid);
drop function public.request_deposit(p_amount_paise bigint, p_utr text, p_payout_account_id uuid, p_idempotency_key uuid);
drop function public.request_expense(p_venue_id uuid, p_expense_id uuid, p_category_id uuid, p_payment_account_id uuid, p_amount_paise bigint, p_payee text, p_note text, p_receipt_path text);
drop function public.request_withdrawal(p_amount_paise bigint, p_payout_account_id uuid, p_idempotency_key uuid);
drop function public.reset_practice_venue(p_venue_id uuid, p_venue_name text);
drop function public.reverse_high_hand(p_claim_id uuid, p_reason text);
drop function public.reverse_jackpot_event(p_event_id uuid, p_reason text, p_idempotency_key text);
drop function public.review_eod_close(p_close_id uuid, p_reason text);
drop function public.review_sar_entry(p_entry_id uuid, p_outcome text, p_note text);
drop function public.review_shift_opening(p_shift_id uuid, p_reason text);
drop function public.roster_week(p_venue_id uuid, p_week date);
drop function public.satellite_tickets(p_tournament_id uuid);
drop function public.save_blind_structure(p_venue_id uuid, p_name text, p_levels jsonb, p_structure_id uuid);
drop function public.save_creator(p_venue_id uuid, p_name text, p_code text, p_basis text, p_commission_paise bigint);
drop function public.save_tournament_template(p_venue_id uuid, p_template jsonb, p_template_id uuid);
drop function public.schedule_drills(p_venue_id uuid, p_title text, p_first_on date, p_sop_id uuid);
drop function public.second_approve_deposit(p_request_id uuid);
drop function public.second_approve_withdrawal(p_request_id uuid);
drop function public.send_withdrawal(p_request_id uuid, p_utr text);
drop function public.set_credit_limit(p_venue_id uuid, p_phone text, p_limit_paise bigint, p_reason text);
drop function public.set_tally_ledger(p_venue_id uuid, p_account_code text, p_tally_ledger text);
drop function public.set_tournament_flight(p_flight_id uuid, p_day_two_id uuid);
drop function public.set_tournament_listing(p_tournament_id uuid, p_name text, p_starts_at timestamp with time zone, p_is_published boolean);
drop function public.set_tournament_payouts(p_tournament_id uuid, p_shares integer[]);
drop function public.set_tournament_room(p_tournament_id uuid, p_tables integer, p_seats_per_table integer);
drop function public.set_tournament_satellite(p_tournament_id uuid, p_target_id uuid);
drop function public.share_winner_card(p_card_id uuid, p_is_shared boolean);
drop function public.shareholding_history(p_venue_id uuid);
drop function public.shareholding_register(p_venue_id uuid, p_on date);
drop function public.shift_openings(p_venue_id uuid);
drop function public.social_post_to_send(p_post_id uuid);
drop function public.sop_acknowledgements(p_version_id uuid);
drop function public.sop_library(p_venue_id uuid);
drop function public.staff_id_for_phone(p_venue_id uuid, p_phone text);
drop function public.start_tournament_clock(p_tournament_id uuid);
drop function public.submit_quiz(p_quiz_id uuid, p_answers integer[]);
drop function public.tally_accounts(p_venue_id uuid);
drop function public.tally_day(p_venue_id uuid, p_day date);
drop function public.tds_ledger(p_venue_id uuid, p_from date, p_to date);
drop function public.tds_return_extract(p_venue_id uuid, p_quarter_start date);
drop function public.tournament_balance(p_tournament_id uuid);
drop function public.tournament_payouts(p_tournament_id uuid);
drop function public.tournament_seating(p_tournament_id uuid);
drop function public.transfer_between_accounts(p_venue_id uuid, p_from_id uuid, p_to_id uuid, p_amount_paise bigint, p_note text, p_idempotency_key uuid);
drop function public.treasury(p_venue_id uuid);
drop function public.tv_jackpot();
drop function public.tv_social_wall();
drop function public.tv_tournament_clock();
drop function public.use_tournament_ticket(p_tournament_id uuid, p_member_id uuid, p_idempotency_key uuid);
drop function public.venue_club_events(p_venue_id uuid);
drop function public.venue_leads(p_venue_id uuid);
drop function public.venue_tournaments(p_venue_id uuid);
drop function public.waiting_deposits(p_venue_id uuid);
drop function public.waiting_withdrawals(p_venue_id uuid);
drop function public.winner_card_images_to_remove();
drop function public.winner_cards_to_draw();
drop function public.winner_cards_to_post(p_venue_id uuid);
drop function private.account_statement(p_payment_account_id uuid, p_from timestamp with time zone, p_to timestamp with time zone);
drop function private.acknowledge_sop(p_version_id uuid);
drop function private.add_certification_quizzes(p_venue_id uuid);
drop function private.add_expense_category(p_venue_id uuid, p_name text);
drop function private.add_payment_account(p_venue_id uuid, p_kind text, p_name text, p_details text);
drop function private.add_payout_account(p_kind text, p_bank_name text, p_vpa text, p_account_number text, p_ifsc text, p_holder_name text);
drop function private.add_shareholder(p_venue_id uuid, p_name text, p_kind text);
drop function private.add_shifts(p_venue_id uuid, p_staff_ids uuid[], p_days date[], p_starts text, p_ends text);
drop function private.add_sop(p_venue_id uuid, p_title text, p_owner text, p_ack_roles staff_role[], p_effective_on date, p_body text);
drop function private.add_training_sops(p_venue_id uuid);
drop function private.aml_register(p_venue_id uuid);
drop function private.approve_high_hand(p_claim_id uuid, p_expected_paise bigint);
drop function private.ask_live_purge(p_venue_id uuid, p_reason text);
drop function private.assert_kyc_for_cage(p_member_id uuid);
drop function private.assert_live_purge(p_venue_id uuid);
drop function private.assert_practice_reset(p_venue_id uuid);
drop function private.assert_read_committed();
drop function private.assert_rosters(p_venue_id uuid);
drop function private.assert_second_approved(p_venue_id uuid, p_subject text, p_subject_id uuid, p_amount_paise bigint, p_at timestamp with time zone, p_first_staff_id uuid);
drop function private.assert_tournament_player(p_venue_id uuid, p_member_id uuid);
drop function private.audit_payout_account_change();
drop function private.bad_beat_payout(p_pool bigint, p_pool_basis_points integer, p_loser_basis_points integer, p_winner_basis_points integer, p_table_basis_points integer, p_others integer);
drop function private.bag_tournament_flight(p_flight_id uuid, p_stacks jsonb);
drop function private.begin_withdrawal_payout(p_request_id uuid, p_payout_key uuid);
drop function private.blind_level_count(p_levels jsonb);
drop function private.book_club_event(p_event_id uuid, p_is_booking boolean);
drop function private.bust_tournament_entry(p_entry_id uuid, p_eliminator_id uuid);
drop function private.buy_in_check(p_method text, p_amount_paise bigint, p_minimum_paise bigint, p_wallet_paise bigint, p_bonus_paise bigint);
drop function private.buy_in_promotions();
drop function private.cage_buy_in(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_method text, p_idempotency_key uuid, p_utr text, p_buy_in_request_id uuid);
drop function private.cage_cash_out(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_to text, p_idempotency_key uuid, p_is_final boolean);
drop function private.cage_check(p_venue_id uuid, p_member_id uuid);
drop function private.cage_members(p_venue_id uuid, p_query text);
drop function private.cage_queue(p_venue_id uuid);
drop function private.cage_tournament_entry(p_tournament_id uuid, p_member_id uuid, p_purchase text, p_idempotency_key uuid);
drop function private.capture_practice_seed(p_venue_id uuid);
drop function private.card_code(p_card_id uuid, p_start bigint);
drop function private.card_member(p_venue_id uuid, p_code text, p_at timestamp with time zone);
drop function private.card_window(p_venue_id uuid, p_at timestamp with time zone);
drop function private.cash_out_outcome(p_cage_transaction_id uuid);
drop function private.cash_out_replay(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_to text, p_idempotency_key uuid, p_is_final boolean);
drop function private.cash_out_split(p_chips_paise bigint, p_outstanding_paise bigint[]);
drop function private.channel_funnel(p_venue_id uuid);
drop function private.check_in_by_card(p_venue_id uuid, p_code text);
drop function private.chip_inventory(p_venue_id uuid);
drop function private.claim_high_hand(p_hand_id uuid, p_seat integer, p_category high_hand_category, p_rank text);
drop function private.claim_payout_name_checks(p_with_provider boolean);
drop function private.claim_withdrawal_payouts();
drop function private.close_cage_shift(p_venue_id uuid, p_cash_paise bigint, p_counts jsonb, p_receipts_paise bigint, p_markers_paise bigint, p_idempotency_key uuid);
drop function private.close_host_item(p_item_id uuid);
drop function private.close_host_item_on_break();
drop function private.confirm_deposit(p_request_id uuid, p_bank_amount_paise bigint);
drop function private.control_state_detail_rows();
drop function private.copy_roster_week(p_venue_id uuid, p_from date, p_to date);
drop function private.correct_high_hand(p_claim_id uuid, p_seat integer, p_category high_hand_category, p_rank text);
drop function private.count_chips(p_venue_id uuid, p_counts jsonb, p_idempotency_key uuid);
drop function private.create_club_event(p_venue_id uuid, p_kind text, p_title text, p_starts_at timestamp with time zone, p_seats integer, p_details text);
drop function private.create_tournament(p_template_id uuid, p_name text, p_starts_at timestamp with time zone, p_is_published boolean);
drop function private.creator_dashboard(p_venue_id uuid);
drop function private.credit_age_bucket(p_issued_at timestamp with time zone, p_at timestamp with time zone);
drop function private.credit_config(p_venue_id uuid);
drop function private.credit_limit_check(p_limit_paise bigint, p_threshold_paise bigint, p_current_paise bigint);
drop function private.credit_lines(p_venue_id uuid);
drop function private.credit_report(p_venue_id uuid, p_at timestamp with time zone);
drop function private.credit_room(p_venue_id uuid);
drop function private.dealer_nights(p_venue_id uuid, p_from timestamp with time zone, p_until timestamp with time zone);
drop function private.dealer_rotation(p_venue_id uuid);
drop function private.debit_wallet(p_venue_id uuid, p_member_id uuid, p_amount bigint, p_reason text, p_idempotency_key text, p_to jsonb);
drop function private.decide_credit_limit(p_line_id uuid, p_is_approved boolean, p_expected_limit_paise bigint);
drop function private.decide_expense(p_expense_id uuid, p_is_approved boolean, p_note text);
drop function private.decide_payout_account(p_account_id uuid, p_is_verified boolean, p_reason text);
drop function private.decline_buy_in_request(p_request_id uuid);
drop function private.decline_withdrawal(p_request_id uuid, p_reason text);
drop function private.deposit_details();
drop function private.detect_structuring();
drop function private.door_scan(p_code text);
drop function private.door_venue_id();
drop function private.emit_incident_logged();
drop function private.engage_control(p_venue_id uuid, p_level control_level, p_reason text, p_feature killable_feature, p_member_id uuid, p_staff_id uuid);
drop function private.engaged_controls(p_venue_id uuid);
drop function private.entry_for_floor(p_entry_id uuid);
drop function private.eod_closes(p_venue_id uuid);
drop function private.finish_tournament(p_tournament_id uuid, p_method text, p_stacks jsonb);
drop function private.flag_structuring(p_venue_id uuid, p_member_id uuid, p_cash_id uuid, p_kind text, p_limit bigint, p_rule jsonb);
drop function private.flight_runs(p_runs uuid[]);
drop function private.guard_high_hand_claim();
drop function private.guard_incident();
drop function private.guard_staff_networks();
drop function private.has_past_due_marker(p_member_id uuid, p_at timestamp with time zone);
drop function private.high_hand_payout(p_venue_id uuid, p_category high_hand_category, p_at timestamp with time zone);
drop function private.high_hands(p_venue_id uuid);
drop function private.hold_drill(p_drill_id uuid, p_notes text);
drop function private.holdings_on(p_venue_id uuid, p_on date);
drop function private.host_may_call(p_member_id uuid);
drop function private.host_queue(p_venue_id uuid);
drop function private.is_near_limit(p_total bigint, p_limit bigint, p_margin_basis_points integer);
drop function private.is_same_chip_count(p_count_id uuid, p_counts jsonb);
drop function private.issue_marker(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_signature_svg text, p_idempotency_key uuid);
drop function private.issue_tournament_tickets(p_satellite tournament);
drop function private.jackpot_history(p_venue_id uuid);
drop function private.jackpot_pools(p_venue_id uuid);
drop function private.leave_on_cash_out(p_member_id uuid);
drop function private.limit_cage_rate();
drop function private.link_member_leads();
drop function private.live_purge_count(p_venue_id uuid, p_table text);
drop function private.live_purge_keeps();
drop function private.live_purge_logs();
drop function private.live_purge_preview(p_venue_id uuid);
drop function private.live_purge_tables();
drop function private.make_winner_cards();
drop function private.mark_shift_open();
drop function private.marker_check(p_amount_paise bigint, p_outstanding_paise bigint, p_limit_paise bigint, p_exposure_paise bigint, p_cap_paise bigint, p_is_past_due boolean);
drop function private.may_handle_receipts(p_name text);
drop function private.may_pay_out(p_venue_id uuid, p_member_id uuid);
drop function private.may_remove_purge_files(p_venue_id uuid);
drop function private.may_review_eod(p_close_id uuid);
drop function private.may_see_winner_card(p_name text);
drop function private.may_upload_receipt(p_name text);
drop function private.may_upload_social_media(p_name text);
drop function private.member_id_for_phone(p_venue_id uuid, p_phone text);
drop function private.member_owes(p_member_id uuid);
drop function private.members_by_phone(p_venue_id uuid, p_phones text[]);
drop function private.moderate_wall_post(p_venue_id uuid, p_post_id uuid, p_is_approved boolean);
drop function private.move_tournament_entry(p_entry_id uuid, p_table integer);
drop function private.move_tournament_level(p_tournament_id uuid, p_step integer);
drop function private.movement_table_name(p_ledger_transaction_id uuid);
drop function private.my_club_events();
drop function private.my_membership_card();
drop function private.my_tds_certificates();
drop function private.my_tournament();
drop function private.my_tournament_tickets();
drop function private.my_wallet();
drop function private.my_winner_cards();
drop function private.new_ledger_code(p_prefix text);
drop function private.note_withdrawal_payout_trouble(p_request_id uuid);
drop function private.onboarding_checklists(p_venue_id uuid);
drop function private.open_cage_shift(p_venue_id uuid, p_float_paise bigint, p_counts jsonb, p_idempotency_key uuid);
drop function private.open_host_offers(p_venue_id uuid);
drop function private.open_markers(p_venue_id uuid);
drop function private.open_purge_request(p_venue_id uuid);
drop function private.owner_snapshot(p_venue_id uuid);
drop function private.past_controls(p_venue_id uuid);
drop function private.pause_tournament_clock(p_tournament_id uuid, p_is_paused boolean);
drop function private.pay_bad_beat(p_venue_id uuid, p_table_id uuid, p_loser_phone text, p_winner_phone text, p_table_phones text[], p_expected_total bigint, p_expected_rule jsonb, p_idempotency_key text);
drop function private.pay_tournament_run(p_entry_id uuid, p_place integer, p_prize bigint, p_bounty bigint, p_head bigint, p_busted_id uuid);
drop function private.pay_withdrawal_in_cash(p_request_id uuid);
drop function private.pay_withdrawal_through_cashfree(p_request_id uuid);
drop function private.payment_account_for_ledger_account();
drop function private.payment_accounts(p_venue_id uuid);
drop function private.payout_accounts_to_verify(p_venue_id uuid);
drop function private.post_tournament_buy(p_tournament tournament, p_member_id uuid, p_paid_by text, p_price bigint, p_fee bigint, p_key text);
drop function private.pot_data(p_venue_id uuid, p_from timestamp with time zone, p_until timestamp with time zone);
drop function private.practice_reset_keeps();
drop function private.practice_reset_preview(p_venue_id uuid);
drop function private.practice_reset_tables();
drop function private.promotion_replay(p_venue_id uuid, p_trigger text, p_conditions jsonb);
drop function private.public_high_hand_rows();
drop function private.public_jackpot_rows();
drop function private.public_wall_post_rows();
drop function private.publish_social_post(p_venue_id uuid, p_caption text, p_image_path text, p_channels text[]);
drop function private.publish_sop_version(p_sop_id uuid, p_owner text, p_ack_roles staff_role[], p_effective_on date, p_body text);
drop function private.purge_files_done(p_venue_id uuid, p_removed text[], p_failed integer);
drop function private.purge_files_due(p_venue_id uuid);
drop function private.purge_files_left(p_venue_id uuid);
drop function private.purge_files_left_count(p_venue_id uuid);
drop function private.purge_live_venue(p_venue_id uuid, p_venue_name text);
drop function private.queue_lapsed_players();
drop function private.record_attendance(p_shift_id uuid, p_status text, p_note text);
drop function private.record_channel_followers(p_venue_id uuid, p_counts jsonb);
drop function private.record_chip_count(p_venue_id uuid, p_shift_id uuid, p_counts jsonb, p_idempotency_key uuid);
drop function private.record_holding(p_venue_id uuid, p_shareholder_id uuid, p_basis_points integer, p_effective_from date, p_note text);
drop function private.record_host_contact(p_item_id uuid, p_churn_reason text, p_offer jsonb, p_note text);
drop function private.record_inbox_messages(p_venue_id uuid, p_messages jsonb);
drop function private.record_payout_name_check(p_account_id uuid, p_outcome text, p_holder_name text);
drop function private.record_second_approval(p_venue_id uuid, p_subject text, p_subject_id uuid, p_amount_paise bigint);
drop function private.record_social_post_channel(p_post_id uuid, p_channel text, p_post_url text);
drop function private.record_tournament_payout_tds(p_payout_id uuid);
drop function private.record_tournament_tds();
drop function private.record_wall_posts(p_venue_id uuid, p_posts jsonb);
drop function private.record_winner_card_image(p_card_id uuid);
drop function private.record_withdrawal_payout(p_request_id uuid, p_payout_key uuid, p_status text, p_payout_id text, p_utr text, p_failure text);
drop function private.refund_tournament_alternate(p_entry_id uuid);
drop function private.refuse_own_cage_record();
drop function private.refuse_used_utr();
drop function private.register_tournament_entry(p_tournament_id uuid, p_purchase text, p_idempotency_key uuid);
drop function private.reject_deposit(p_request_id uuid);
drop function private.reject_high_hand(p_claim_id uuid, p_reason text);
drop function private.release_control(p_control_id uuid, p_reason text);
drop function private.remove_payout_account(p_account_id uuid);
drop function private.remove_shift(p_shift_id uuid);
drop function private.remove_tournament(p_tournament_id uuid);
drop function private.repay_markers(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_method text, p_utr text, p_idempotency_key uuid);
drop function private.repayment_split(p_amount_paise bigint, p_outstanding_paise bigint[]);
drop function private.replay_buy_ins(p_venue_id uuid, p_from timestamp with time zone, p_to timestamp with time zone);
drop function private.replayed_high_hand_claim(p_hand_id uuid, p_seat integer, p_category high_hand_category, p_rank text);
drop function private.replayed_jackpot_event(p_venue_id uuid, p_idempotency_key text, p_kind jackpot_event_kind, p_table_id uuid, p_players uuid[], p_reverses_id uuid);
drop function private.request_buy_in(p_session_id uuid, p_amount_paise bigint, p_idempotency_key uuid);
drop function private.request_deposit(p_amount_paise bigint, p_utr text, p_payout_account_id uuid, p_idempotency_key uuid);
drop function private.request_expense(p_venue_id uuid, p_expense_id uuid, p_category_id uuid, p_payment_account_id uuid, p_amount_paise bigint, p_payee text, p_note text, p_receipt_path text);
drop function private.request_withdrawal(p_amount_paise bigint, p_payout_account_id uuid, p_idempotency_key uuid);
drop function private.require_open_shift();
drop function private.reset_practice_venue(p_venue_id uuid, p_venue_name text);
drop function private.reverse_high_hand(p_claim_id uuid, p_reason text);
drop function private.reverse_jackpot_event(p_event_id uuid, p_reason text, p_idempotency_key text);
drop function private.reverse_ledger_transaction(p_transaction_id uuid, p_idempotency_key text, p_reason text);
drop function private.review_eod_close(p_close_id uuid, p_reason text);
drop function private.review_sar_entry(p_entry_id uuid, p_outcome text, p_note text);
drop function private.review_shift_opening(p_shift_id uuid, p_reason text);
drop function private.room_exposure(p_venue_id uuid);
drop function private.roster_week(p_venue_id uuid, p_week date);
drop function private.running_tournament(p_venue_id uuid);
drop function private.satellite_tickets(p_tournament_id uuid);
drop function private.save_blind_structure(p_venue_id uuid, p_name text, p_levels jsonb, p_structure_id uuid);
drop function private.save_creator(p_venue_id uuid, p_name text, p_code text, p_basis text, p_commission_paise bigint);
drop function private.save_tournament_template(p_venue_id uuid, p_template jsonb, p_template_id uuid);
drop function private.schedule_drills(p_venue_id uuid, p_title text, p_first_on date, p_sop_id uuid);
drop function private.seat_day_two(p_day_two tournament);
drop function private.seat_tournament_entry(p_entry_id uuid);
drop function private.second_approve_deposit(p_request_id uuid);
drop function private.second_approve_withdrawal(p_request_id uuid);
drop function private.second_approver_needed(p_venue_id uuid, p_amount_paise bigint, p_at timestamp with time zone);
drop function private.send_withdrawal(p_request_id uuid, p_utr text);
drop function private.set_cage_camera();
drop function private.set_credit_limit(p_venue_id uuid, p_phone text, p_limit_paise bigint, p_reason text);
drop function private.set_tally_ledger(p_venue_id uuid, p_account_code text, p_tally_ledger text);
drop function private.set_tournament_flight(p_flight_id uuid, p_day_two_id uuid);
drop function private.set_tournament_listing(p_tournament_id uuid, p_name text, p_starts_at timestamp with time zone, p_is_published boolean);
drop function private.set_tournament_payouts(p_tournament_id uuid, p_shares integer[]);
drop function private.set_tournament_room(p_tournament_id uuid, p_tables integer, p_seats_per_table integer);
drop function private.set_tournament_satellite(p_tournament_id uuid, p_target_id uuid);
drop function private.share_winner_card(p_card_id uuid, p_is_shared boolean);
drop function private.shareholding_history(p_venue_id uuid);
drop function private.shareholding_register(p_venue_id uuid, p_on date);
drop function private.shift_close(p_counted_cash bigint, p_expected_cash bigint, p_counted_chips bigint, p_expected_chips bigint, p_counted_receipts bigint, p_expected_receipts bigint, p_counted_markers bigint, p_expected_markers bigint);
drop function private.shift_expected(p_shift_id uuid);
drop function private.shift_openings(p_venue_id uuid);
drop function private.shift_times(p_club_day date, p_starts text, p_ends text);
drop function private.signal_high_hand_change();
drop function private.signal_jackpot_postings();
drop function private.signal_social_wall();
drop function private.social_post_to_send(p_post_id uuid);
drop function private.sop_acknowledgements(p_version_id uuid);
drop function private.sop_library(p_venue_id uuid);
drop function private.staff_id_for_phone(p_venue_id uuid, p_phone text);
drop function private.start_tournament_clock(p_tournament_id uuid);
drop function private.submit_quiz(p_quiz_id uuid, p_answers integer[]);
drop function private.tally_accounts(p_venue_id uuid);
drop function private.tally_day(p_venue_id uuid, p_day date);
drop function private.tds_amount(p_winnings bigint, p_already bigint, p_payout bigint, p_has_pan boolean, p_rate integer, p_threshold bigint, p_pan_required boolean, p_no_pan_rate integer);
drop function private.tds_for(p_venue_id uuid, p_member_id uuid, p_winnings_paise bigint, p_at timestamp with time zone);
drop function private.tds_ledger(p_venue_id uuid, p_from date, p_to date);
drop function private.tds_on_cash_out(p_venue_id uuid, p_member_id uuid, p_amount_paise bigint, p_payout_paise bigint);
drop function private.tds_period_start(p_venue_id uuid, p_member_id uuid, p_basis text, p_at timestamp with time zone);
drop function private.tds_quarter_start(p_at timestamp with time zone);
drop function private.tds_return_extract(p_venue_id uuid, p_quarter_start date);
drop function private.tds_taxed_winnings(p_winnings_paise bigint, p_taxed_before_paise bigint);
drop function private.today_ist();
drop function private.tonight_high_hand(p_venue_id uuid);
drop function private.tournament_balance(p_tournament_id uuid);
drop function private.tournament_balancing_moves(p_counts integer[]);
drop function private.tournament_bounty_on(p_entry_id uuid);
drop function private.tournament_bounty_split(p_bounty_paise bigint, p_kind text);
drop function private.tournament_buy(p_tournament_id uuid, p_member_id uuid, p_purchase text, p_paid_by text, p_idempotency_key uuid);
drop function private.tournament_buy_entry(p_tournament tournament, p_member_id uuid, p_purchase text);
drop function private.tournament_buy_refusal(p_tournament tournament, p_member_id uuid, p_purchase text);
drop function private.tournament_buy_replay(p_tournament_id uuid, p_member_id uuid, p_purchase text, p_paid_by text, p_idempotency_key uuid);
drop function private.tournament_buy_terms(p_tournament tournament, p_purchase text);
drop function private.tournament_chip_chop(p_stacks bigint[], p_prizes bigint[]);
drop function private.tournament_counts(p_tournament_id uuid);
drop function private.tournament_day_two_field(p_runs jsonb);
drop function private.tournament_deal_check(p_stacks bigint[], p_prizes bigint[]);
drop function private.tournament_deal_settle(p_shares numeric[], p_stacks bigint[], p_prizes bigint[]);
drop function private.tournament_eligible_seats(p_occupied jsonb, p_tables integer, p_seats_per_table integer);
drop function private.tournament_finish_place(p_runs integer, p_bust_rank integer);
drop function private.tournament_finishers(p_tournament tournament, p_method text, p_stacks jsonb);
drop function private.tournament_for_clock(p_tournament_id uuid);
drop function private.tournament_icm(p_stacks bigint[], p_prizes bigint[]);
drop function private.tournament_payout_table(p_pool_paise bigint, p_shares integer[], p_runs integer);
drop function private.tournament_payouts(p_tournament_id uuid);
drop function private.tournament_places(p_tournament_id uuid);
drop function private.tournament_pool_share(p_price_paise bigint, p_fee_paise bigint);
drop function private.tournament_prize_pool(p_collected_paise bigint, p_guarantee_paise bigint);
drop function private.tournament_prize_tds(p_venue_id uuid, p_member_id uuid, p_winnings_paise bigint);
drop function private.tournament_purchase_refusal(p_purchase text, p_format text, p_last_registration_level integer, p_max_buys integer, p_has_add_on boolean, p_level integer, p_buys integer, p_is_alive boolean, p_has_taken_add_on boolean);
drop function private.tournament_satellite_result(p_tournament tournament);
drop function private.tournament_satellite_seats(p_pool bigint, p_buy_in bigint, p_runs integer);
drop function private.tournament_seating(p_tournament_id uuid);
drop function private.tournament_stage_start(p_levels jsonb, p_stage integer);
drop function private.tournament_winnings(p_tournament tournament, p_method text, p_stacks jsonb, p_left uuid[]);
drop function private.transfer_between_accounts(p_venue_id uuid, p_from_id uuid, p_to_id uuid, p_amount_paise bigint, p_note text, p_idempotency_key uuid);
drop function private.treasury(p_venue_id uuid);
drop function private.tv_jackpot();
drop function private.tv_social_wall();
drop function private.tv_tournament_clock();
drop function private.use_tournament_ticket(p_tournament_id uuid, p_member_id uuid, p_idempotency_key uuid);
drop function private.venue_changed_since(p_venue_id uuid, p_table text, p_since timestamp with time zone);
drop function private.venue_club_events(p_venue_id uuid);
drop function private.venue_leads(p_venue_id uuid);
drop function private.venue_row_count(p_venue_id uuid, p_table text);
drop function private.venue_tournaments(p_venue_id uuid);
drop function private.waiting_deposits(p_venue_id uuid);
drop function private.waiting_withdrawals(p_venue_id uuid);
drop function private.wallet_cash(p_member_id uuid);
drop function private.win_back_host_item();
drop function private.winner_card_images_to_remove();
drop function private.winner_cards_to_draw();
drop function private.winner_cards_to_post(p_venue_id uuid);
drop function private.withdrawal_check(p_amount_paise bigint, p_cash_paise bigint);
drop function private.withdrawal_refusal(p_member member, p_amount_paise bigint, p_payout_account_id uuid);
drop type public.high_hand_category, public.high_hand_status, public.incident_severity, public.jackpot_event_kind;

-- The cage and admin networks (the owner, 15 Nov). The staff view lists its columns, so it is made again.
drop view public.venue_config_detail;
alter table public.venue_config drop column staff_ip_allowlist;
create view public.venue_config_detail with (security_invoker = true) as
  select venue_id, legal_name, gstin, address, upi_payee_name, upi_vpa, bank_name, bank_account_name, bank_account_number, bank_ifsc, invoice_prefix, logo_path, alert_whatsapp, created_at, updated_at, tan, sac_club_services, signatory_name, signatory_designation, tv_pairing_window_only, tv_pairing_window_at, contact_phone, contact_whatsapp
  from private.venue_config_detail_rows();
revoke all on public.venue_config_detail from public, anon, authenticated, service_role;
grant select on public.venue_config_detail to authenticated;

drop function public.growth_funnel(p_venue_id uuid);
drop function public.tablet_seats();
drop function private.growth_funnel(p_venue_id uuid);
drop function private.tablet_seats();

CREATE OR REPLACE FUNCTION private.leave_by_door(p_venue_id uuid, p_member_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_owed record;
begin
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  -- One at a time per member, with the cage's cash-out (which takes the same lock).
  perform 1 from public.member m where m.id = p_member_id for update;
  -- A close is a write (decision 0161), refused while the venue or the member is frozen.
  perform private.assert_writable(p_venue_id, null, p_member_id);
  if private.current_visit(p_member_id) is null then
    raise exception 'Not checked in: there is no visit to close' using errcode = 'RVOUT';
  end if;
  if exists (select 1 from public.seat_session s where s.member_id = p_member_id and s.ended_at is null) then
    raise exception 'Still seated: the floor ends the seat first' using errcode = 'RVSTD';
  end if;
  select * into v_owed from private.call_time_owed(p_member_id, now());
  if coalesce(v_owed.o_seconds, 0) > 0 and not exists (select 1 from public.early_departure e where e.session_id = v_owed.o_session_id) then
    raise exception 'Call time not complete: % seconds owed', v_owed.o_seconds
      using errcode = 'RVCTS', detail = v_owed.o_seconds::text;
  end if;
  return private.close_visit(p_member_id, now(), 'door');
end;
$function$;

CREATE OR REPLACE FUNCTION private.open_visit(p_venue_id uuid, p_member_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.member m where m.id = p_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  -- One at a time per member: two taps open one visit, and a break that starts meanwhile is seen.
  perform 1 from public.member m where m.id = p_member_id for update;
  perform private.assert_writable(p_venue_id, null, p_member_id);
  if (select r.break_until from private.member_restrictions(p_member_id, now()) r) is not null then
    raise exception 'On a break: the member cannot be checked in until it ends' using errcode = 'RVBRK';
  end if;
  perform private.close_stale_visit(p_member_id);
  v_id := private.current_visit(p_member_id);
  if v_id is not null then return v_id; end if;
  insert into public.visit (venue_id, member_id, opened_by_staff_id)
  values (p_venue_id, p_member_id, private.current_staff_id(p_venue_id))
  returning id into v_id;
  perform private.emit(p_venue_id, 'visit.opened', jsonb_build_object('visit_id', v_id, 'member_id', p_member_id), 'visit.opened:' || v_id);
  -- Once a club day, however often a member scans in and out (keyed by the day, not the visit).
  perform private.evaluate_promotions(p_venue_id, 'check_in', jsonb_build_object('member_id', p_member_id,
    'key', 'check_in:' || p_member_id || ':' || (private.tonight_began(now()) at time zone 'Asia/Kolkata')::date));
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.start_device_pairing(p_device_id uuid)
 RETURNS TABLE(code text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_venue_id uuid := private.manageable_device(p_device_id, array['dealer_tablet']::public.device_kind[]);
  v_code text;
  v_expires_at timestamptz := now() + interval '10 minutes';
begin
  perform private.assert_writable(v_venue_id);
  update public.device_pairing p set expires_at = now()
  where p.device_id = p_device_id and p.redeemed_at is null and p.expires_at > now();
  loop
    v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    exit when not exists (select 1 from public.device_pairing p
                          where p.code_hash = private.pairing_hash(v_code) and p.redeemed_at is null and p.expires_at > now());
  end loop;
  insert into public.device_pairing (venue_id, device_id, code_hash, expires_at, created_by_staff_id)
  values (v_venue_id, p_device_id, private.pairing_hash(v_code), v_expires_at, private.current_staff_id(v_venue_id));
  perform private.audit(v_venue_id, 'device.pairing_started', 'device', p_device_id::text, null,
                        jsonb_build_object('expires_at', v_expires_at));
  return query select v_code, v_expires_at;
end;
$function$;

CREATE OR REPLACE FUNCTION private.staff_queue_counts(p_venue_id uuid)
 RETURNS TABLE(queue text, waiting integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select q.queue, q.waiting::integer
  from (values
    ('waitlist', (select count(*) from private.waitlist_requests(p_venue_id))),
    ('topUps', (select count(*) from private.top_ups_tonight(p_venue_id) t where t.status in ('requested', 'in_progress'))),
    ('timeRequests', (select count(*) from private.floor_seats(p_venue_id) s where s.time_request_id is not null)),
    ('fnb', (select count(*) from private.fnb_orders_tonight(p_venue_id) o where o.delivered_at is null and o.cancelled_at is null)),
    -- A member's own cancellation, for a minute, so the console chimes: the bar may already hold its KOT.
    ('fnbCancelled', (select count(*) from private.fnb_orders_tonight(p_venue_id) o
                      where o.cancel_reason = 'Cancelled by the member' and o.cancelled_at > now() - interval '1 minute')),
    ('liveFloor', (select count(*) from private.floor_seats(p_venue_id) s where s.leaving_at is not null)),
    -- Approved players the floor can seat now (the owner, 8 Nov).
    ('seating', (select count(*) from private.seating_alerts(p_venue_id) a where a.state = 'ready')),
    ('kycReview', (select count(*) from private.kyc_review_queue(p_venue_id) k where k.status = 'needs_review')),
    ('feedback', (select count(*) from private.venue_feedback(p_venue_id) f where f.is_ticket and f.resolved_at is null)),
    -- Waiting for an approver: a marketer who asked sees the list, but only a super admin decides.
    ('promotions', (select count(*) from private.promotions_awaiting_approval(p_venue_id)
                    where private.has_permission(p_venue_id, 'promotions.approve'))),
    ('tournamentInterest', (select count(*) from private.tournament_interest_list(p_venue_id) i
                            join public.tournament t on t.id = i.tournament_id
                            where i.registered_at is null and t.is_published)),
    -- Members who asked to delete their account, for those who erase.
    ('erasureRequests', (select count(*) from private.member_erasure_requests(p_venue_id)))
  ) as q (queue, waiting)
  where q.waiting > 0;
$function$;

CREATE OR REPLACE FUNCTION private.site_block_public_keys(p_kind text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case p_kind
    when 'hero' then array['eyebrow', 'heading', 'text', 'action', 'video', 'note']
    when 'statement' then array['eyebrow', 'lines', 'text', 'action', 'image', 'note']
    when 'gallery' then array['eyebrow', 'heading', 'intro', 'items', 'note']
    when 'feature' then array['eyebrow', 'heading', 'text', 'points', 'action', 'image', 'alt']
    when 'text' then array['heading', 'body']
    when 'rules' then array['heading', 'rules']
    when 'faq' then array['heading', 'questions']
    when 'careers' then array['heading', 'roles', 'apply']
    when 'map' then array['heading', 'address', 'hours', 'directionsUrl', 'phone', 'email']
    when 'games' then array['heading']
    when 'calendar' then array['heading']
    when 'links' then array['heading', 'links']
    when 'story' then array['eyebrow', 'heading', 'paragraphs', 'figures', 'action', 'image', 'alt']
    when 'cards' then array['eyebrow', 'heading', 'intro', 'cards', 'quote', 'action']
    when 'marquee' then array['phrases']
    when 'timeline' then array['eyebrow', 'heading', 'intro', 'items']
    when 'table' then array['heading', 'intro', 'columns', 'rows', 'note']
    when 'promotions' then array['eyebrow', 'heading', 'only']
    when 'rewards' then array['heading']
    when 'outstation' then array['eyebrow', 'heading']
    else array[]::text[]
  end;
$function$;

CREATE OR REPLACE FUNCTION private.add_website_with_wall(p_venue_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.add_website_pages(p_venue_id);
end;
$function$;

CREATE OR REPLACE FUNCTION private.add_website_parity(p_venue_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_page uuid;
  v_after integer;
begin
  if not exists (select 1 from public.venue v where v.id = p_venue_id and not v.is_practice) then return; end if;


  perform private.add_site_page(p_venue_id, $j${"slug": "journal-cash-game-tips", "title": "Cash game tips for the live table", "is_published": true,
    "description": "Habits that save chips at a live cash game, from the first hand to the last.",
    "blocks": [
      {"kind": "hero", "content": {"eyebrow": "Strategy", "heading": "Cash game tips for the live table", "text": "Habits that save chips at a live cash game, from the first hand to the last."}},
      {"kind": "text", "content": {"body": "Play fewer hands, and play them harder. Most chips at a live table are lost by calling with hands that were never good enough to start with. Fold more before the flop, and raise the hands you do play rather than limping in.\n\nPosition is worth more than cards. Acting last lets you see what everyone else does first. Open more hands on the button and in the cut-off, and fewer from the blinds and the first seats after them.\n\nWatch the table while you are not in a hand. Who calls too much, who only bets when they have it, who tilts after losing a pot: the next hour is decided by what you notice now.\n\nSize your bets for a reason. Bet bigger for value against players who call too much, and smaller when you only want to take the pot down. A bet with no reason behind it costs chips either way.\n\nDo not pay off the big bet on the river without a plan. Live players bluff the river less than you think. If the story does not hold together, a fold is fine.\n\nKeep your stack in line with your bankroll, and leave when you are tired or tilted. A long session is only worth it while you are playing your best.\n\nPoker is a game of skill, and you can still lose money at it. Play with money you can afford to lose."}}
    ]}$j$::jsonb);

  perform private.add_site_page(p_venue_id, $j${"slug": "journal-tournaments-gurugram", "title": "Poker tournaments in Gurugram", "is_published": true,
    "description": "How a live tournament runs at RIVR, from the buy-in to the final table.",
    "blocks": [
      {"kind": "hero", "content": {"eyebrow": "Tournaments", "heading": "Poker tournaments in Gurugram", "text": "How a live tournament runs at RIVR, from the buy-in to the final table."}},
      {"kind": "text", "content": {"body": "A tournament is one buy-in for a stack of chips. The blinds rise on a clock, players drop out as they lose their chips, and the prize pool is paid to the places at the top.\n\nThe calendar on the Tournaments page lists every event with its start, its buy-in and any guarantee. Register in the RIVR app or at the front desk, and be seated before the first level starts.\n\nThe clock runs on the TVs and on every table's tablet, so everyone sees the same level, the same blinds and the same time to the break. A late registration window, where an event has one, is shown on the clock too.\n\nEarly on, the blinds are small next to the stacks: play patiently and pick your spots. As the blinds rise, every pot matters more, and a short stack has to push or fold. At the final table, the pay jumps make every decision count.\n\nEvery finish earns RIVR League points, more for the final table and the top three. The standings are on the Leaderboard page.\n\nPoker is a game of skill, and you can still lose money at it. Play with money you can afford to lose."}}
    ]}$j$::jsonb);

  -- General information drafted from the rulings and Haryana's Act, a draft until the owner's lawyer has read it.
  perform private.add_site_page(p_venue_id, $j${"slug": "journal-poker-legal-gurugram", "title": "Is poker legal in Gurugram?", "is_published": false,
    "description": "What India's courts and Haryana's law say about poker as a game of skill.",
    "blocks": [
      {"kind": "hero", "content": {"eyebrow": "The law", "heading": "Is poker legal in Gurugram?", "text": "What India's courts and Haryana's law say about poker as a game of skill."}},
      {"kind": "text", "content": {"body": "India's gambling laws are written by each state, and every one of them treats a game of skill differently from a game of chance.\n\nThe Supreme Court drew that line in 1968, when it held in State of Andhra Pradesh v. K. Satyanarayana that rummy is mainly and preponderantly a game of skill. In 1996, in K.R. Lakshmanan v. State of Tamil Nadu, it set the test courts still apply: whether skill predominates over chance.\n\nPoker has been tested against it. In 2013 the Karnataka High Court held, in Indian Poker Association v. State of Karnataka, that poker played as a game of skill needs no gaming licence.\n\nIn Haryana, the Haryana Prevention of Public Gambling Act, 2025 keeps games of skill outside gambling: a game of skill is one where skill predominates over chance, and the state government may notify games as games of skill. In September 2026 the state notified poker and rummy as games of skill under the Act. Clubs that host them must follow the conditions the state sets for them.\n\nAt RIVR every member is 18 or over and has had their identity checked, every table runs as a game of skill, and TDS is deducted on winnings as the law requires.\n\nThis is general information, not legal advice."}}
    ]}$j$::jsonb);

  -- Membership: the rules in force in place of the example rates, the cab and hotel nights after them, and the welcome
  -- offer after the steps to join.
  select id into v_page from public.site_page where venue_id = p_venue_id and slug = 'membership';
  if v_page is not null then
    update public.site_block set kind = 'rewards', content = '{"heading": "Points for every hour"}'::jsonb
    where page_id = v_page and kind = 'table' and content = $j${"note": "Example rates: the club confirms its rates before launch. Only time seated at a table counts, not time away from it.", "rows": [["NLH 50/100", "5"], ["NLH 100/200", "10"], ["Private Room", "20"]], "intro": "Every hour you play earns points, more at the higher stakes. Points never turn into cash: they are for rewards.", "columns": ["Stake", "Points an hour"], "heading": "Points for every hour"}$j$::jsonb;
    if not exists (select 1 from public.site_block where page_id = v_page and kind = 'rewards') then
      select coalesce((select position from public.site_block where page_id = v_page and content ->> 'eyebrow' = 'Tiers'),
                      (select max(position) from public.site_block where page_id = v_page), 0) into v_after;
      perform private.place_site_block(v_page, v_after, 'rewards', '{"heading": "Points for every hour"}'::jsonb);
    end if;
    if not exists (select 1 from public.site_block where page_id = v_page and kind = 'outstation') then
      select position into v_after from public.site_block where page_id = v_page and kind = 'rewards';
      perform private.place_site_block(v_page, v_after, 'outstation', '{"eyebrow": "Outstation", "heading": "Getting here, and staying over."}'::jsonb);
    end if;
    if not exists (select 1 from public.site_block where page_id = v_page and kind = 'promotions') then
      select coalesce((select position from public.site_block where page_id = v_page and content ->> 'eyebrow' = 'How to join'),
                      (select max(position) from public.site_block where page_id = v_page)) into v_after;
      perform private.place_site_block(v_page, v_after, 'promotions', '{"eyebrow": "Welcome offer", "heading": "Your first visit.", "only": "welcome"}'::jsonb);
    end if;
  end if;

  -- The front page: the room's hours and amenities, and the questions grandpokerarena.com answers.
  select id into v_page from public.site_page where venue_id = p_venue_id and slug = 'home';
  update public.site_block set content = jsonb_set(content, '{cards}', private.with_more(content -> 'cards', $j$[
      {"label": "Hours", "title": "Open every night", "text": "14:00 to 08:00, from Sunday 15 November."},
      {"title": "Smoking terrace", "text": "Details to follow."},
      {"title": "Parking", "text": "Details to follow."}]$j$::jsonb, 'title'))
  where page_id = v_page and kind = 'cards' and content ->> 'eyebrow' = 'The room' and jsonb_array_length(content -> 'cards') <= 9;
  update public.site_block set content = jsonb_set(content, '{questions}', private.with_more(content -> 'questions', $j$[
      {"question": "Is poker a game of skill?", "answer": "India's Supreme Court treats a game where skill predominates over chance as a game of skill, not gambling, and courts have applied that test to poker. The rulings are listed under On the record."},
      {"question": "What are the house rules?", "answer": "Members only, 18 and over. One player to a hand, chips stay in the club until you cash out at the cage, and the floor's decision on a hand is final. The full list is on the House rules page."},
      {"question": "What is the RIVR League?", "answer": "The club's leaderboard, month by month and season by season. Cash game hours and tournament finishes earn League points, and the standings and prizes are on the Leaderboard page."}]$j$::jsonb, 'question'))
  where page_id = v_page and kind = 'faq' and jsonb_array_length(content -> 'questions') <= 37;

  update public.site_block set content = jsonb_set(content, '{cards}', private.with_more(content -> 'cards', $j$[
      {"title": "Valet and parking", "text": "Details to follow."}]$j$::jsonb, 'title'))
  where page_id = v_page and kind = 'cards' and content ->> 'eyebrow' = 'Hospitality' and jsonb_array_length(content -> 'cards') <= 11;

  -- Rules the pages wrote in words now come from the settings and promotions (decision 0283), so the words that named
  -- them say so without the figures, each only while it still reads as first written.
  update public.site_block b set content = replace(replace(replace(replace(b.content::text,
      '"Chauffeured rides for regulars, and a cab home from your fourth visit in a month."',
      '"Chauffeured rides for regulars, and a cab home for members who play often. Membership has the details."'),
      '"For members who finish RIVR Academy: ₹1,000 on your first buy-in after you graduate."',
      '"For members who finish RIVR Academy: a bonus on their first buy-in after they graduate."'),
      '"RIVR Rewards: 5% of your rake back as points"', '"RIVR Rewards: a share of your rake back as points"'),
      '"₹1,000 on your first buy-in after you graduate"', '"A bonus on your first buy-in after you graduate"')::jsonb
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug in ('home', 'membership') and b.kind = 'cards';

  -- On the record, on the front page and About: every ruling linked to its judgment.
  update public.site_block b set content = jsonb_set(b.content, '{items}', private.with_rulings(b.content -> 'items'))
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug in ('home', 'about') and b.kind = 'timeline'
    and b.content ->> 'eyebrow' in ('On the record', 'Legal and compliance') and jsonb_array_length(b.content -> 'items') <= 6;

  -- The journal lists the new published articles.
  update public.site_block b set content = jsonb_set(b.content, '{cards}', b.content -> 'cards' || coalesce((
      select jsonb_agg(c order by n) from jsonb_array_elements($j$[
        {"label": "Strategy", "title": "Cash game tips for the live table", "text": "Habits that save chips at a live cash game, from the first hand to the last.", "link": {"page": "journal-cash-game-tips", "label": "Read"}},
        {"label": "Tournaments", "title": "Poker tournaments in Gurugram", "text": "How a live tournament runs at RIVR, from the buy-in to the final table.", "link": {"page": "journal-tournaments-gurugram", "label": "Read"}}
      ]$j$::jsonb) with ordinality t(c, n)
      where not exists (select 1 from jsonb_array_elements(b.content -> 'cards') e where e #>> '{link,page}' = c #>> '{link,page}')), '[]'::jsonb))
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug = 'journal' and b.kind = 'cards' and b.content ->> 'heading' = 'Articles'
    and jsonb_array_length(b.content -> 'cards') <= 10;
end;
$function$;

CREATE OR REPLACE FUNCTION private.public_club_rule_rows()
 RETURNS TABLE(venue_slug text, key text, subject text, subject_name text, subject_order bigint, value jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with in_force as (
    select distinct on (s.venue_id, s.key, s.subject) s.venue_id, s.key, s.subject, s.value
    from public.setting s
    where s.key = 'rakeback.rate'
      and s.effective_from <= now()
    order by s.venue_id, s.key, s.subject, s.effective_from desc
  ), cab_tiers as (
    select distinct on (f.venue_id, f.tier_id) f.venue_id, f.is_enabled
    from public.tier_feature f
    where f.feature_key = 'cab.requests' and f.effective_from <= now()
    order by f.venue_id, f.tier_id, f.effective_from desc
  )
  -- Rakeback shows its rate alone: its cap and how long its bonus lasts are not the website's to show.
  select v.slug, r.key, r.subject, t.name, t.big_blind_paise,
         case when r.key = 'rakeback.rate' then jsonb_build_object('basis_points', r.value -> 'basis_points') else r.value end
  from in_force r
  join public.venue v on v.id = r.venue_id and not v.is_practice
  left join public.table_type t on t.venue_id = r.venue_id and t.code = r.subject
  where (r.subject = '' or t.id is not null)
  union all
  select v.slug, 'cab.minimum_visits', '', null, null, jsonb_build_object('visits', private.cab_minimum_visits(v.id))
  from public.venue v
  where not v.is_practice and exists (select 1 from cab_tiers c where c.venue_id = v.id and c.is_enabled);
$function$;

CREATE OR REPLACE FUNCTION private.activity_log(p_venue_id uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_who text DEFAULT NULL::text, p_kind text DEFAULT NULL::text, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id bigint DEFAULT NULL::bigint, p_limit integer DEFAULT 50)
 RETURNS TABLE(id bigint, occurred_at timestamp with time zone, who text, is_system boolean, action text, entity text, kind text, about text, reason text, amount bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select l.id, l.occurred_at, w.name, l.actor_user_id is null, l.action, l.entity,
         private.activity_kind(l.action, l.entity),
         coalesce(case when rm.erased_at is null then rm.full_name end, rs.full_name, case when l.entity = 'table' then l.entity_id end),
         -- A reason can name the person, so an erased member's go; the erasure keeps its own.
         case when rm.erased_at is null or l.action = 'member.erase' then l.reason end,
         -- How many bonus chips were given by hand.
         case when l.action = 'bonus.give' then (l.after ->> 'chips')::bigint end
  from public.audit_log l
  left join public.staff s on s.user_id = l.actor_user_id and s.venue_id = l.venue_id
  left join public.member a on a.user_id = l.actor_user_id and a.venue_id = l.venue_id
  -- By the device the row names, as a revoked device has lost its login.
  left join public.device d on d.id = l.device_id and d.venue_id = l.venue_id
  cross join lateral (select coalesce(s.full_name, case when a.erased_at is null then a.full_name end, d.name) as name) w
  left join lateral (
    select coalesce(case when l.entity = 'member' then l.entity_id end, l.after ->> 'member_id', l.before ->> 'member_id') as member_id,
           coalesce(case when l.entity = 'staff' then l.entity_id end, l.after ->> 'staff_id', l.before ->> 'staff_id') as staff_id
  ) t on true
  left join public.member rm on rm.id = private.uuid_or_null(t.member_id) and rm.venue_id = l.venue_id
  left join public.staff rs on rs.id = private.uuid_or_null(t.staff_id) and rs.venue_id = l.venue_id
  where l.venue_id = p_venue_id and private.has_permission(p_venue_id, 'activity.read')
    and (p_from is null or l.occurred_at >= (p_from::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
    and (p_to is null or l.occurred_at < ((p_to + 1)::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
    and (p_who is null or position(lower(p_who) in lower(coalesce(w.name, ''))) > 0)
    and (p_kind is null or private.activity_kind(l.action, l.entity) = p_kind)
    and (p_before is null or (l.occurred_at, l.id) < (p_before, p_before_id))
  order by l.occurred_at desc, l.id desc
  limit greatest(least(coalesce(p_limit, 50), 200), 1);
$function$;

CREATE OR REPLACE FUNCTION private.member_account_statuses(p_venue_id uuid)
 RETURNS TABLE(member_id uuid, status text, until timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.id,
         case when m.erased_at is not null then 'erased' when f.is_frozen then 'frozen' else 'on_break' end,
         case when m.erased_at is null and not f.is_frozen then b.ends_at end
  from public.member m
  cross join lateral (select coalesce(private.has_permission(p_venue_id, 'activity.read'), false)
                             and exists (select 1 from public.control_state c
                                         where c.member_id = m.id and c.venue_id = m.venue_id and c.level = 'member_freeze' and c.released_at is null) as is_frozen) f
  cross join lateral (select max(s.ends_at) as ends_at from public.self_exclusion s where s.member_id = m.id and s.starts_at <= now() and s.ends_at > now()) b
  where m.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read')
    and (m.erased_at is not null or f.is_frozen or b.ends_at is not null);
$function$;

CREATE OR REPLACE FUNCTION private.engagers(p_venue_id uuid, p_except uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*)::integer from public.staff s
  join public.role_permission rp on rp.role = s.role and rp.permission = 'activity.read'
  where s.venue_id = p_venue_id and s.is_active and s.user_id is not null and s.id is distinct from p_except
    and not exists (select 1 from public.control_state c where c.level = 'access_revoke' and c.staff_id = s.id and c.released_at is null);
$function$;

CREATE OR REPLACE FUNCTION private.alert_dual_control_grant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is not null and new.is_active
     and (tg_op = 'INSERT' or old.role is distinct from new.role or not old.is_active or old.phone is distinct from new.phone)
     and exists (select 1 from public.role_permission rp where rp.role = new.role
                 and rp.permission in ('treasury.manage', 'cage.second_approve', 'promotions.manage', 'bonus.give')) then
    perform private.raise_alert(new.venue_id, 'staff.role_granted',
                                jsonb_build_object('staff_id', new.id, 'role', new.role, 'by_staff_id', private.current_staff_id(new.venue_id)));
  end if;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.can_grant_role(p_venue_id uuid, p_role staff_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with mine as (
    select rp.permission from public.staff s join public.role_permission rp on rp.role = s.role
    where s.user_id = (select auth.uid()) and s.venue_id = p_venue_id and s.is_active
      and not exists (select 1 from public.control_state c
                      where c.level = 'access_revoke' and c.staff_id = s.id and c.released_at is null)
  )
  select exists (select 1 from mine where permission = 'venue.configure')
    or (not exists (select 1 from public.role_permission rp where rp.role = p_role and rp.permission not in (select permission from mine))
        and not exists (select 1 from public.role_permission rp where rp.role = p_role
                        and rp.permission in ('treasury.manage', 'cage.second_approve')));
$function$;

CREATE OR REPLACE FUNCTION private.computer_kind_for(p_permission text)
 RETURNS device_kind
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_permission in ('cage.transact', 'cage.second_approve') then 'cage'::public.device_kind
    when p_permission in ('settings.manage', 'staff.manage', 'devices.manage', 'tiers.manage', 'venue.configure', 'activity.read',
                          'exports.full', 'treasury.manage', 'exports.table', 'members.erase', 'members.change_phone')
      then 'console'::public.device_kind
  end;
$function$;

CREATE OR REPLACE FUNCTION private.ledger_append_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'DELETE'
     and current_setting('rivr.purge', true) = 'on'
     and current_user = 'postgres'
     and session_user = 'postgres' then
    return old;
  end if;
  raise exception '% is append-only; post a reversing transaction instead', tg_table_name
    using errcode = 'insufficient_privilege';
end;
$function$;

CREATE OR REPLACE FUNCTION private.aml_cash_in(p_venue_id uuid, p_member_id uuid, p_since timestamp with time zone)
 RETURNS TABLE(id uuid, source text, amount_paise bigint, created_at timestamp with time zone, visit_id uuid, visit_opened_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.id, 'tournament', p.price_paise, p.created_at, v.id, v.opened_at
  from public.tournament_purchase p
  left join lateral (select x.id, x.opened_at from public.visit x
                     where x.member_id = p.member_id and x.venue_id = p.venue_id and x.opened_at <= p.created_at
                       and (x.closed_at is null or x.closed_at >= p.created_at)
                     order by x.opened_at desc limit 1) v on true
  where p.venue_id = p_venue_id and p.member_id = p_member_id and p.paid_by = 'cash' and p.created_at >= p_since;
$function$;

CREATE OR REPLACE FUNCTION private.anonymise_member(p_member member)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.consent c set withdrawn_at = now() where c.member_id = p_member.id and c.withdrawn_at is null;
  if exists (select 1 from public.tournament_payout t where t.member_id = p_member.id and t.tds_paise > 0) then
    update public.kyc_record k
    set status = 'erased', refusal = null, verified_at = null, digilocker_session_id = null, date_of_birth = null, masked_aadhaar = null,
        address = null, vendor_reference = null, photo_path = null, liveness_score = null, face_match_score = null,
        aadhaar_reference = null, same_face_as = null, selfie_claimed_at = null, identity_key = null,
        vendor_failure = null, vendor_failed_at = null, aadhaar_name = null
    where k.member_id = p_member.id and k.status <> 'erased';
  else
    delete from public.kyc_record k where k.member_id = p_member.id;
  end if;
  update public.member m
  set full_name = 'Erased member', known_as = null, phone = null, user_id = null, qualifying_small_blind = null,
      qualifying_big_blind = null, erased_at = coalesce(m.erased_at, now())
  where m.id = p_member.id
    and (m.full_name <> 'Erased member' or m.known_as is not null or m.phone is not null or m.user_id is not null
         or m.qualifying_small_blind is not null or m.erased_at is null);
end;
$function$;

CREATE OR REPLACE FUNCTION private.bonus_history(p_member_id uuid, p_limit integer)
 RETURNS TABLE(line_id uuid, at timestamp with time zone, kind text, amount_paise bigint, reason text, table_name text, staff_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select h.line_id, h.at, h.kind, h.amount_paise, h.reason, h.table_name, h.staff_name from (
    select g.id as line_id, g.created_at as at, 'credited' as kind, g.amount_paise, g.reason, null::text as table_name,
           null::text as staff_name
    from public.bonus_grant g where g.member_id = p_member_id
    union all
    select g.id, g.expired_at, 'expired', e.amount, g.reason, null, null
    from public.bonus_grant g
    -- The sweep's own entry: an erasure's forfeit closes grants too, but is no expiry.
    join public.ledger_transaction t on t.id = g.expiry_transaction_id and t.kind = 'bonus_expiry'
    join public.ledger_entry e on e.transaction_id = t.id
    join public.ledger_account a on a.id = e.account_id and a.code = 'member.bonus'
    where g.member_id = p_member_id
    union all
    select r.id, r.created_at, 'redeemed', r.amount_paise, null, t.name, s.full_name
    from public.bonus_redemption r
    join public.game_table t on t.id = r.table_id
    left join public.staff s on s.id = r.staff_id
    where r.member_id = p_member_id
  ) h
  order by h.at desc, h.line_id
  limit greatest(least(coalesce(p_limit, 20), 500), 1);
$function$;

CREATE OR REPLACE FUNCTION private.bonus_visit_left(p_member_id uuid)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with share as (
    select (private.setting_at(m.venue_id, 'bonus.visit_cap', '', now()) ->> 'basis_points')::integer as basis_points
    from public.member m where m.id = p_member_id
  ), open_visit as (
    select v.id, v.bonus_at_first_seat_paise from public.visit v where v.member_id = p_member_id and v.closed_at is null
  )
  select case when s.basis_points is null then null else
    private.visit_bonus_left(
      private.visit_bonus_cap(coalesce((select o.bonus_at_first_seat_paise from open_visit o), private.bonus_in_force(p_member_id, now())), s.basis_points),
      coalesce((select sum(r.amount_paise) from public.bonus_redemption r join public.seat_session ss on ss.id = r.session_id
                where ss.visit_id = (select o.id from open_visit o)), 0)::bigint)
  end
  from share s;
$function$;

CREATE OR REPLACE FUNCTION private.conversion_for(p_venue_id uuid, p_event_type text, p_payload jsonb)
 RETURNS TABLE(conversion text, member_id uuid, phone text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.conversion, m.id, m.phone
  from public.member m
  join public.venue v on v.id = m.venue_id and not v.is_practice
  cross join lateral (select case p_event_type
    when 'kyc.completed' then 'kyc_complete'
    when 'tournament.entered' then 'tournament_entry'
    -- A visit is the member's first unless they opened one before it (the id breaks a tie).
    when 'visit.opened' then case when exists (
        select 1 from public.visit x join public.visit this on this.id = (p_payload ->> 'visit_id')::uuid
        where x.member_id = m.id and (x.opened_at, x.id) < (this.opened_at, this.id)) then 'repeat_visit' else 'first_visit' end
  end as conversion) c
  where m.id = (p_payload ->> 'member_id')::uuid and m.venue_id = p_venue_id and m.erased_at is null
    and c.conversion is not null and private.has_consent(m.id, 'marketing')
    and not exists (select 1 from public.control_state s
                    where s.venue_id = p_venue_id and s.level = 'venue_freeze' and s.released_at is null);
$function$;

CREATE OR REPLACE FUNCTION private.delete_member_records(p_member member)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  delete from public.member_preference x where x.member_id = p_member.id;
  delete from public.notification_preference x where x.member_id = p_member.id;
  delete from public.member_limit x where x.member_id = p_member.id;
  delete from public.member_feature_override x where x.member_id = p_member.id;
  delete from public.sign_up_attribution x where x.member_id = p_member.id;
  delete from public.feedback x where x.member_id = p_member.id;
  delete from public.review_request x where x.member_id = p_member.id;
  delete from public.cab_request x where x.member_id = p_member.id;
  delete from public.push_subscription x where x.member_id = p_member.id;
  delete from public.live_status_device x where x.member_id = p_member.id;
  delete from public.tournament_interest x where x.member_id = p_member.id;
  delete from public.kyc_review x where x.member_id = p_member.id;
  delete from public.outbox_event x where x.venue_id = p_member.venue_id and x.payload ->> 'member_id' = p_member.id::text;
end;
$function$;

CREATE OR REPLACE FUNCTION private.end_seat(p_session_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.seat_session;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id for update;
  if v_session.id is null or not private.may_change_seats(v_session.table_id) then
    raise exception 'Only the floor or the table''s tablet lets a player leave' using errcode = '42501';
  end if;
  if v_session.ended_at is not null then return; end if;
  if p_reason is null or p_reason not in ('left', 'away') then
    raise exception 'A player leaves, or is away for good' using errcode = '22023';
  end if;
  perform private.assert_writable(v_session.venue_id);
  update public.seat_session set ended_at = private.seat_end_stamp(v_session.seated_here_at, now()), end_reason = p_reason, away_since = null
  where id = v_session.id;
  perform private.emit(v_session.venue_id, 'seat.left',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat, 'reason', p_reason), 'seat.left:' || v_session.id || ':' || clock_timestamp());
end;
$function$;

CREATE OR REPLACE FUNCTION private.leave_my_seat()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.seat_session := private.my_open_seat();
begin
  if not private.has_feature(v_session.member_id, 'table.leave') then
    raise exception 'Leaving from the app is not open to you' using errcode = '42501';
  end if;
  if coalesce(private.session_call_time(v_session, now()), 0) > 0 then
    update public.seat_session set leaving_at = coalesce(leaving_at, now()) where id = v_session.id;
    return 'leaving';
  end if;
  update public.seat_session set ended_at = private.seat_end_stamp(v_session.seated_here_at, now()), end_reason = 'left', away_since = null where id = v_session.id;
  perform private.emit(v_session.venue_id, 'seat.left',
                       jsonb_build_object('session_id', v_session.id, 'member_id', v_session.member_id, 'table_id', v_session.table_id,
                                          'seat', v_session.seat, 'reason', 'left'), 'seat.left:' || v_session.id);
  return 'left';
end;
$function$;

CREATE OR REPLACE FUNCTION private.growth_funnel(p_venue_id uuid)
 RETURNS TABLE(source_kind text, source_code text, signed_up integer, kyc_done integer, visited integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.assert_reports(p_venue_id);
  return query
  with sourced as (
    select m.id,
           case when a.referral_code is not null then 'referral' when a.creator_code is not null then 'creator'
                when a.utm_source is not null then 'link' else 'direct' end as kind,
           case when a.referral_code is null then coalesce(a.creator_code::text, a.utm_source::text) end as code
    from public.member m
    left join public.sign_up_attribution a on a.member_id = m.id
    where m.venue_id = p_venue_id and m.erased_at is null
  )
  select s.kind, s.code, count(*)::integer,
         (count(*) filter (where exists (select 1 from public.kyc_record k where k.member_id = s.id and k.status = 'verified')))::integer,
         (count(*) filter (where exists (select 1 from public.visit v where v.member_id = s.id)))::integer
  from sourced s
  group by s.kind, s.code
  order by count(*) desc, s.kind, s.code;
end;
$function$;
revoke all on function private.growth_funnel(p_venue_id uuid) from public, anon, authenticated, service_role;
grant execute on function private.growth_funnel(p_venue_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION private.member_erasure_blockers(p_member_id uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with balance as (
    select a.code, private.account_balance(a.id) as amount from public.ledger_account a where a.member_id = p_member_id
  )
  select array_remove(array[
    case when exists (select 1 from public.control_state c where c.venue_id = m.venue_id and c.released_at is null
                      and (c.level = 'venue_freeze' or (c.level = 'member_freeze' and c.member_id = m.id))) then 'frozen' end,
    case when exists (select 1 from balance b where b.code = 'member.cash' and b.amount <> 0) then 'cash' end,
    case when exists (select 1 from public.visit v where v.member_id = m.id and v.closed_at is null)
           or exists (select 1 from public.seat_session s where s.member_id = m.id and s.ended_at is null) then 'chips' end,
    case when exists (select 1 from balance b where b.code = 'member.receivable' and b.amount <> 0) then 'markers' end,
    -- Bonus owed to the club (a liability above zero): never forfeited, so set right first.
    case when exists (select 1 from balance b where b.code = 'member.bonus' and b.amount > 0) then 'bonus' end,
    case when exists (select 1 from public.waitlist_entry w where w.member_id = m.id and w.status = 'waiting') then 'waitlist' end,
    case when exists (select 1 from public.tournament_entry e join public.tournament t on t.id = e.tournament_id
                      where e.member_id = m.id and e.status <> 'refunded' and t.finished_at is null)
           or exists (select 1 from public.tournament_ticket k where k.member_id = m.id and k.status = 'held') then 'tournament' end
  ], null)
  from public.member m
  where m.id = p_member_id;
$function$;

CREATE OR REPLACE FUNCTION private.my_sessions()
 RETURNS TABLE(session_id uuid, visit_id uuid, opened_at timestamp with time zone, closed_at timestamp with time zone, table_name text, small_blind_paise bigint, big_blind_paise bigint, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint, cash_out_paise bigint, tds_paise bigint, paid_paise bigint, net_paise bigint, receipt text, month date, month_sessions integer, month_played_seconds bigint, month_net_paise bigint, tds_basis text, kind text, place integer, entrants integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with mine as (
    select v.id, v.member_id, v.opened_at, v.closed_at
    from public.visit v
    where v.member_id = private.current_member_id() and v.closed_at is not null
      and private.has_feature(v.member_id, 'sessions.history')
  ),
  played as (
    select m.id as visit_id, t.o_table_id as table_id, sum(t.o_played)::bigint as seconds
    from mine m
    cross join lateral private.visit_table_time(m.id) t
    group by m.id, t.o_table_id
  ),
  -- When the member sat at each table that visit: from their first seat there to the last time they left it (a move
  -- keeps one seat session across tables; private.session_tables splits it).
  stints as (
    select m.id as visit_id, t.o_table_id as table_id, min(greatest(t.o_from, m.opened_at)) as opened_at,
           max(least(t.o_to, m.closed_at)) as closed_at
    from mine m
    join public.seat_session s on s.visit_id = m.id
    cross join lateral private.session_tables(s.id) t
    where t.o_from < m.closed_at
    group by m.id, t.o_table_id
  ),
  -- Each table a session of its own (the owner, 9 Nov). A table sat at for under a minute in a visit of more than one
  -- (a move made by mistake and undone) is none, but a visit always keeps the table it was played at longest.
  kept as (
    select st.visit_id, st.table_id, st.opened_at, st.closed_at, coalesce(p.seconds, 0)::bigint as seconds,
           row_number() over (partition by st.visit_id order by coalesce(p.seconds, 0) desc, st.opened_at) = 1 as is_longest
    from stints st
    left join played p on p.visit_id = st.visit_id and p.table_id = st.table_id
  ),
  tabled as (
    select k.visit_id, k.table_id, k.opened_at, k.closed_at, g.name, tt.small_blind_paise, tt.big_blind_paise, k.seconds
    from kept k
    join public.game_table g on g.id = k.table_id
    join public.table_type tt on tt.id = g.table_type_id
    where k.seconds >= 60 or k.is_longest
  ),
  me as (
    select private.current_member_id() as member_id
    where private.has_feature(private.current_member_id(), 'sessions.history')
  ),
  -- Each finished tournament the member played (an entry that sat, or a payout), from the later of the clock's start and
  -- their first buy (a Day 2 has none of its own) to their last bust, or the finish if they were still in. In: every buy
  -- of an entry not refunded, an entry paid with a satellite's ticket at its value. Won: prizes, bounties, and the
  -- tickets a satellite gave, which the target's buy or the ticket's refund then spends. And the TDS withheld.
  tournaments as (
    select t.id, t.name,
           greatest((select min(p.created_at) from public.tournament_purchase p where p.tournament_id = t.id and p.member_id = me.member_id),
                    t.clock_started_at) as opened_at,
           coalesce((select max(e.busted_at) from public.tournament_entry e where e.tournament_id = t.id and e.member_id = me.member_id
                       and e.status <> 'refunded' having bool_and(e.status = 'busted')), t.finished_at) as closed_at,
           (select coalesce(sum(p.price_paise), 0) from public.tournament_purchase p join public.tournament_entry e on e.id = p.entry_id
            where p.tournament_id = t.id and p.member_id = me.member_id and e.status <> 'refunded')::bigint as bought,
           (select coalesce(sum(o.prize_paise + o.bounty_paise), 0) from public.tournament_payout o
            where o.tournament_id = t.id and o.member_id = me.member_id)::bigint
           + (select coalesce(sum(k.value_paise), 0) from public.tournament_ticket k
              where k.satellite_id = t.id and k.member_id = me.member_id)::bigint as won,
           (select coalesce(sum(o.tds_paise) filter (where not o.is_tds_shadow), 0) from public.tournament_payout o
            where o.tournament_id = t.id and o.member_id = me.member_id)::bigint as tds,
           coalesce((select min(e.place) from public.tournament_entry e where e.tournament_id = t.id and e.member_id = me.member_id and e.status <> 'refunded'),
                    (select min(o.place) from public.tournament_payout o where o.tournament_id = t.id and o.member_id = me.member_id and o.kind = 'prize')) as place,
           -- The field as places count it: every run, each entry not refunded.
           (select count(*) from public.tournament_entry e where e.tournament_id = t.id and e.status <> 'refunded')::integer as entrants
    from me
    join public.tournament t on t.finished_at is not null
      and (exists (select 1 from public.tournament_entry e where e.tournament_id = t.id and e.member_id = me.member_id and e.status in ('seated', 'busted'))
           or exists (select 1 from public.tournament_payout o where o.tournament_id = t.id and o.member_id = me.member_id))
  ),
  sessions as (
    select md5(m.id::text || ':' || l.table_id::text)::uuid as session_id, m.id as visit_id, l.opened_at, l.closed_at, l.name,
           l.small_blind_paise, l.big_blind_paise, l.seconds,
           0::bigint as buy_in, 0::bigint as bonus, 0::bigint as cashed, 0::bigint as tds,
           0::bigint as paid, 0::bigint as net,
           null::text as receipt, private.club_month(l.opened_at) as month,
           null::text as tds_basis, 'cash'::text as kind, null::integer as place,
           null::integer as entrants
    from mine m
    join tabled l on l.visit_id = m.id
    union all
    select t.id, t.id, t.opened_at, t.closed_at, t.name, 0::bigint, 0::bigint, greatest(0, extract(epoch from t.closed_at - t.opened_at))::bigint,
           t.bought, 0::bigint, t.won, t.tds, t.won - t.tds, t.won - t.tds - t.bought, null::text, private.club_month(t.opened_at), null::text,
           'tournament'::text, t.place, t.entrants
    from tournaments t
  )
  select s.session_id, s.visit_id, s.opened_at, s.closed_at, s.name, s.small_blind_paise, s.big_blind_paise, s.seconds, s.buy_in, s.bonus,
         s.cashed, s.tds, s.paid, s.net, s.receipt, s.month, (count(*) over w)::integer, (sum(s.seconds) over w)::bigint,
         (sum(s.net) over w)::bigint, s.tds_basis, s.kind, s.place, s.entrants
  from sessions s
  window w as (partition by s.month)
  order by s.opened_at desc;
$function$;

CREATE OR REPLACE FUNCTION private.offline_pack(p_venue_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_venue public.venue;
  v_pack jsonb;
begin
  select * into v_venue from public.venue v where v.id = p_venue_id;
  if v_venue.id is null then
    raise exception 'No such venue' using errcode = '22023';
  end if;
  if v_venue.is_practice then
    raise exception 'The practice venue has no offline pack' using errcode = 'RVPRA';
  end if;
  with ledger as (
    select a.code, a.member_id, sum(e.amount)::bigint as paise
    from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
    where a.venue_id = p_venue_id and a.unit = 'paise' and a.code in ('member.cash', 'member.receivable', 'venue.chips_outstanding')
    group by a.code, a.member_id
  ),
  -- A wallet is a liability, so it is the negative of its entries; what a member owes on markers is their receivable,
  -- as the cage, the Treasury and end of day read it.
  balance as (
    select m.full_name, m.member_number, coalesce(-w.paise, 0) as wallet, coalesce(o.paise, 0) as markers
    from public.member m
    left join ledger w on w.code = 'member.cash' and w.member_id = m.id
    left join ledger o on o.code = 'member.receivable' and o.member_id = m.id
    where m.venue_id = p_venue_id and (coalesce(w.paise, 0) <> 0 or coalesce(o.paise, 0) <> 0)
  )
  select jsonb_build_object(
    'issuer', (select jsonb_build_object('legal_name', c.legal_name, 'address', c.address, 'gstin', c.gstin)
               from public.venue_config c where c.venue_id = p_venue_id),
    'venue_name', v_venue.name,
    'generated_at', now(),
    'contacts', coalesce((select jsonb_agg(jsonb_build_object('kind', c.kind, 'name', c.name, 'role', nullif(c.role, ''),
                                                             'phone', c.phone, 'note', nullif(c.notes, ''))
                                           order by c.kind, c.position, c.name)
                          from public.contact c where c.venue_id = p_venue_id), '[]'::jsonb),
    'balances', coalesce((select jsonb_agg(jsonb_build_object('name', b.full_name, 'member_number', b.member_number::text,
                                                             'wallet_paise', b.wallet, 'markers_paise', b.markers) order by b.full_name)
                          from balance b), '[]'::jsonb),
    'wallets_paise', (select coalesce(sum(b.wallet), 0)::bigint from balance b),
    'markers_paise', (select coalesce(sum(b.markers), 0)::bigint from balance b),
    'chips_in_play_paise', coalesce((select -l.paise from ledger l where l.code = 'venue.chips_outstanding' and l.member_id is null), 0),
    'tables', coalesce((select jsonb_agg(jsonb_build_object(
                          'name', g.name, 'game', tt.name,
                          'seats', coalesce((select jsonb_agg(jsonb_build_object('seat', s.seat, 'name', m.full_name, 'member_number', m.member_number::text)
                                                              order by s.seat)
                                             from public.seat_session s join public.member m on m.id = s.member_id
                                             where s.table_id = g.id and s.ended_at is null), '[]'::jsonb))
                          order by g.position)
                        from public.game_table g join public.table_type tt on tt.id = g.table_type_id
                        where g.venue_id = p_venue_id and g.is_open), '[]'::jsonb),
    'waitlist', coalesce((select jsonb_agg(jsonb_build_object('table', g.name, 'game', tt.name, 'place', r.place, 'name', m.full_name,
                                                             'member_number', m.member_number::text) order by g.position, g.name, r.place)
                          from private.ranked_waitlist(array(select t.id from public.table_type t where t.venue_id = p_venue_id)) r
                          join public.game_table g on g.id = r.table_id
                          join public.table_type tt on tt.id = r.table_type_id
                          join public.member m on m.id = r.member_id), '[]'::jsonb))
  into v_pack;
  return v_pack;
end;
$function$;

CREATE OR REPLACE FUNCTION private.promotion_event(p_kind text, p_version promotion_version, p_context jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member uuid := (p_context ->> 'member_id')::uuid;
  v_table uuid := (p_context ->> 'table_id')::uuid;
  v_visit uuid := coalesce((p_context ->> 'visit_id')::uuid, private.current_visit(v_member));
  v_base jsonb;
  v_time record;
begin
  v_base := jsonb_build_object('kind', p_kind, 'key', p_context ->> 'key', 'at', now(), 'memberId', v_member, 'visitId', v_visit,
    'tableId', v_table,
    'stake', (select tt.code from public.game_table g join public.table_type tt on tt.id = g.table_type_id where g.id = v_table));
  if p_kind = 'buy_in' then
    return v_base || jsonb_build_object(
      'ownChips', case when p_context ->> 'method' = 'bonus' then 0 else coalesce((p_context ->> 'amount_paise')::bigint, 0) / 100 end,
      'isFirstOfVisit', true);
  elsif p_kind = 'seated' then
    -- At the moment they sat; the first of the visit unless an earlier seat of it remains (one undone is gone).
    return v_base || jsonb_build_object('at', least((p_context ->> 'at')::timestamptz, now()),
      'isFirstOfVisit', not exists (select 1 from public.seat_session s where s.visit_id = v_visit and s.member_id = v_member
                                      and s.started_at < (p_context ->> 'at')::timestamptz));
  elsif p_kind = 'time_played' then
    select * into v_time from private.visit_schedule_time(v_visit, p_version.schedule, p_version.eligibility);
    return v_base || jsonb_build_object('minutes', v_time.o_seconds / 60);
  elsif p_kind = 'hours_step' then
    select * into v_time from private.visit_schedule_time_at(v_visit, p_version.schedule, p_version.eligibility,
                                                             least(coalesce((p_context ->> 'at')::timestamptz, now()), now()));
    return v_base || jsonb_build_object('minutes', v_time.o_seconds / 60, 'stepMinutes', (p_context ->> 'step_minutes')::integer);
  elsif p_kind = 'visit' then
    return v_base || jsonb_build_object('tableId', null, 'stake', null,
      'visitInMonth', (select count(*) from public.visit v where v.member_id = v_member and v.opened_at <= now()
                         and v.opened_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'));
  end if;
  return v_base || jsonb_build_object('visitId', null, 'tableId', null, 'stake', null);
end;
$function$;

CREATE OR REPLACE FUNCTION private.replay_version_events(p_version promotion_version, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with seats as (
    select s.id, s.started_at as at, s.member_id, s.visit_id, s.table_id, tt.code as stake,
           row_number() over (partition by s.visit_id order by s.started_at, s.id) as nth
    from public.seat_session s
    left join public.game_table g on g.id = s.table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where private.promotion_event_kind(p_version.reward) = 'seated'
      and s.venue_id = p_version.venue_id and s.started_at >= p_from and s.started_at < p_to
  ),
  played as (
    select v.id, v.closed_at as at, v.member_id, w.o_seconds, lt.table_id, tt.code as stake
    from public.visit v
    cross join lateral private.visit_schedule_time(v.id, p_version.schedule, p_version.eligibility) w
    left join lateral (select e.o_table_id as table_id from private.visit_table_time(v.id) e
                       group by e.o_table_id order by sum(e.o_played) desc, e.o_table_id limit 1) lt on true
    left join public.game_table g on g.id = lt.table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where private.promotion_event_kind(p_version.reward) in ('time_played', 'hours_step')
      and v.venue_id = p_version.venue_id and v.closed_at >= p_from and v.closed_at < p_to and w.o_seconds > 0
  ),
  visits as (
    select v.id, v.opened_at as at, v.member_id,
           (select count(*) from public.visit x where x.member_id = v.member_id and x.opened_at <= v.opened_at
              and x.opened_at >= date_trunc('month', v.opened_at at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as in_month
    from public.visit v
    where private.promotion_event_kind(p_version.reward) = 'visit'
      and v.venue_id = p_version.venue_id and v.opened_at >= p_from and v.opened_at < p_to
  ),
  others as (
    select r.id, r.completed_at as at, side.member_id
    from public.referral r cross join lateral (values (r.member_id), (r.referrer_member_id)) side (member_id)
    where private.promotion_event_kind(p_version.reward) = 'referral'
      and r.venue_id = p_version.venue_id and r.completed_at >= p_from and r.completed_at < p_to
    union all
    select k.id, k.verified_at, k.member_id from public.kyc_record k
    where private.promotion_event_kind(p_version.reward) = 'signup'
      and k.venue_id = p_version.venue_id and k.status = 'verified' and k.verified_at >= p_from and k.verified_at < p_to
  ),
  entries as (
    select s.at, s.id::text as id, s.member_id, 'seated' as kind,
           jsonb_build_object('tableId', s.table_id, 'stake', s.stake, 'isFirstOfVisit', s.nth = 1, 'visitId', 'v' || dense_rank() over (order by s.visit_id)) as more
    from seats s
    union all
    select p.at, p.id::text, p.member_id, 'time_played',
           jsonb_build_object('tableId', p.table_id, 'stake', p.stake, 'minutes', p.o_seconds / 60,
                              'visitId', 'v' || dense_rank() over (order by p.id))
    from played p
    union all
    select v.at, v.id::text, v.member_id, 'visit', jsonb_build_object('visitInMonth', v.in_month, 'visitId', 'v' || dense_rank() over (order by v.id))
    from visits v
    union all
    select o.at, o.id::text || o.member_id::text, o.member_id, private.promotion_event_kind(p_version.reward), '{}'::jsonb
    from others o
  )
  select coalesce(jsonb_agg(private.replay_entry(e.kind, e.n, e.at, e.member_id, e.member_n, e.more) order by e.at, e.n), '[]'::jsonb)
  from (select x.*, row_number() over (order by x.at, x.id) as n, dense_rank() over (order by x.member_id) as member_n from entries x) e;
$function$;

CREATE OR REPLACE FUNCTION private.tablet_seats()
 RETURNS TABLE(seat integer, session_id uuid, member_id uuid, full_name text, away_since timestamp with time zone, minimum_paise bigint, call_time_left integer, leaving_at timestamp with time zone, small_blind_paise bigint, big_blind_paise bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select n.seat, s.id, m.id, m.full_name, s.away_since, g.min_buy_in_paise,
         case when s.id is not null then private.session_call_time(s, now()) end,
         s.leaving_at, tt.small_blind_paise, tt.big_blind_paise
  from private.my_tablet_table() t
  join public.game_table g on g.id = t.o_table_id
  join public.table_type tt on tt.id = g.table_type_id
  cross join generate_series(1, g.seats) as n (seat)
  left join public.seat_session s on s.table_id = g.id and s.seat = n.seat and s.ended_at is null
  left join public.member m on m.id = s.member_id
  order by n.seat;
$function$;
revoke all on function private.tablet_seats() from public, anon, authenticated, service_role;
grant execute on function private.tablet_seats() to authenticated;

CREATE OR REPLACE FUNCTION private.enforces_computers(p_venue_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- No venue lists networks now (the owner, 15 Nov), so none enforces its computers.
  select false;
$function$;

CREATE OR REPLACE FUNCTION private.on_staff_network(p_venue_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- No venue lists networks now (the owner, 15 Nov).
  select false;
$function$;

CREATE OR REPLACE FUNCTION private.alert_venue_config_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_alert_id uuid;
  v_fields text[] := array_remove(array[
    case when new.upi_vpa is distinct from old.upi_vpa then 'upi_vpa' end,
    case when new.upi_payee_name is distinct from old.upi_payee_name then 'upi_payee_name' end,
    case when new.bank_name is distinct from old.bank_name then 'bank_name' end,
    case when new.bank_account_name is distinct from old.bank_account_name then 'bank_account_name' end,
    case when new.bank_account_number is distinct from old.bank_account_number then 'bank_account_number' end,
    case when new.bank_ifsc is distinct from old.bank_ifsc then 'bank_ifsc' end,
    case when new.alert_whatsapp is distinct from old.alert_whatsapp then 'alert_whatsapp' end,
    case when new.contact_phone is distinct from old.contact_phone then 'contact_phone' end,
    case when new.contact_whatsapp is distinct from old.contact_whatsapp then 'contact_whatsapp' end
  ], null);
begin
  if cardinality(v_fields) > 0 and (select auth.uid()) is not null then
    v_alert_id := private.raise_alert(new.venue_id, 'venue.config_changed', jsonb_build_object('fields', to_jsonb(v_fields)));
    if 'alert_whatsapp' = any (v_fields) and old.alert_whatsapp is not null then
      insert into private.alert_previous_number (alert_id, alert_whatsapp) values (v_alert_id, old.alert_whatsapp);
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.carry_out_erasure(p_member_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member public.member;
  v_blockers text[];
  v_summary jsonb;
begin
  select * into v_member from public.member m where m.id = p_member_id for update;
  if not found then
    raise exception 'No such member' using errcode = 'RVNOM';
  end if;
  v_blockers := private.member_erasure_blockers(p_member_id);
  if cardinality(v_blockers) > 0 then
    raise exception 'Settle these before erasing the member: %', array_to_string(v_blockers, ', ')
      using errcode = 'RVERA', detail = array_to_string(v_blockers, ',');
  end if;
  v_summary := private.forfeit_member_bonus(v_member) || jsonb_build_object('blocked_until', private.block_erased_member(v_member));
  perform private.delete_member_records(v_member);
  perform private.anonymise_member(v_member);
  perform private.remove_member_login(v_member);
  perform private.scrub_member_audit(v_member);
  if not exists (select 1 from public.audit_log a where a.entity = 'member' and a.entity_id = p_member_id::text and a.action = 'member.erase') then
    perform private.audit(v_member.venue_id, 'member.erase', 'member', p_member_id::text, null, v_summary, p_reason);
  end if;
  return v_summary || jsonb_build_object('venue_id', v_member.venue_id);
end;
$function$;

CREATE OR REPLACE FUNCTION private.bootstrap_venue(p_venue_id uuid, p_name text, p_slug text, p_is_practice boolean, p_legal_name text, p_address text, p_invoice_prefix text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  member_tier_id uuid;
begin
  if exists (select 1 from public.venue v where v.id = p_venue_id) then
    return p_venue_id;
  end if;

  insert into public.venue (id, name, slug, is_practice) values (p_venue_id, p_name, p_slug, p_is_practice);
  insert into public.venue_config (venue_id, legal_name, address, invoice_prefix)
  values (p_venue_id, p_legal_name, p_address, p_invoice_prefix);
  insert into public.invoice_series (venue_id, code, name) values (p_venue_id, 'S', 'Club services');

  insert into public.tier (venue_id, name, rank) values
    (p_venue_id, 'Member', 1),
    (p_venue_id, 'Founders'' Circle', 3), (p_venue_id, 'Black card', 4);
  select t.id into member_tier_id from public.tier t where t.venue_id = p_venue_id and t.name = 'Member';

  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tier.default', '', jsonb_build_object('tier_id', member_tier_id), '-infinity', 'Venue created');
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tds.config', '',
          '{"enabled": false, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 1000000, "basis": "financial_year", "pan_required": true, "no_pan_rate_basis_points": 3000}',
          '-infinity', 'Switched off until the owner sets TDS (#22)');
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'gst.config', '', '{"rate_basis_points": 1800, "basis": "rake"}', '-infinity', 'A placeholder until the owner sets GST (#23)');
  -- The most Bonus one staff member adds by hand in a club day, as the venues of 10 Nov were given (20261110647000;
  -- the owner, 15 Nov, issue 995). The practice venue has none, as then.
  if not p_is_practice then
    insert into public.setting (venue_id, key, subject, value, effective_from, reason)
    values (p_venue_id, 'bonus.daily_staff_cap', '', '{"chips": 10000}', '-infinity', 'Venue created');
  end if;

  -- Every gateable feature for every tier, but cab requests and hourly rakeback, which start off and hidden.
  insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
  select p_venue_id, t.id, f.key, not o.is_off, case when o.is_off then 'hidden' else 'locked' end::public.feature_display_mode, '-infinity'
  from public.tier t cross join public.feature f
  cross join lateral (select f.key in ('cab.requests', 'rewards.rakeback') as is_off) o
  where t.venue_id = p_venue_id and f.is_gateable;

  insert into public.ledger_account (venue_id, code, name, kind, unit, is_players_money) values
    (p_venue_id, 'venue.cash_drawer', 'Cash drawer', 'asset', 'paise', false),
    (p_venue_id, 'venue.bank', 'Bank and UPI', 'asset', 'paise', false),
    (p_venue_id, 'venue.chips_outstanding', 'Chips in play', 'liability', 'paise', true),
    (p_venue_id, 'venue.rake', 'Rake', 'revenue', 'paise', false),
    (p_venue_id, 'venue.jackpot.main', 'Bad-beat jackpot', 'liability', 'paise', true),
    (p_venue_id, 'venue.jackpot.season', 'Season jackpot pool', 'liability', 'paise', true),
    (p_venue_id, 'venue.jackpot.freeroll', 'Freeroll jackpot pool', 'liability', 'paise', true),
    (p_venue_id, 'venue.bonus_expense', 'Bonus issued', 'expense', 'paise', false),
    (p_venue_id, 'venue.high_hand_expense', 'High hands paid', 'expense', 'paise', false),
    (p_venue_id, 'venue.withdrawals_pending', 'Withdrawals waiting to be paid', 'liability', 'paise', true),
    (p_venue_id, 'venue.tds_payable', 'TDS withheld, to be paid to the government', 'liability', 'paise', false),
    (p_venue_id, 'venue.tournament_pool', 'Tournament prize pools', 'liability', 'paise', true),
    (p_venue_id, 'venue.tournament_fees', 'Tournament fees', 'revenue', 'paise', false),
    (p_venue_id, 'venue.tournament_overlay', 'Tournament overlay', 'expense', 'paise', false),
    (p_venue_id, 'venue.tournament_tickets', 'Satellite tickets held', 'liability', 'paise', true),
    (p_venue_id, 'venue.cashfree', 'Cashfree payout balance', 'asset', 'paise', false),
    (p_venue_id, 'venue.opening_balance', 'Opening balances', 'equity', 'paise', false);

  perform private.add_promotion_templates(p_venue_id);
  if not p_is_practice and not exists (select 1 from public.venue v where not v.is_practice and v.id <> p_venue_id) then
    perform private.add_website(p_venue_id);
  end if;

  return p_venue_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.refuse_hidden_modules()
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if current_user in ('anon', 'authenticated') and current_setting('request.path', true) = any (array['/rpc/mis_report_for', '/rpc/rake_tonight', '/rpc/unclaimed_balances']) then
    raise exception 'That part of RIVR is not in use' using errcode = '42501';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cctv_reference(p_kind text, p_id uuid)
 RETURNS TABLE(channel text, camera_name text, at timestamp with time zone, is_practice boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select c.channel, c.name, r.at, v.is_practice
  from (
    select h.camera_id, h.played_at as at, h.venue_id from public.hand h where p_kind = 'hand' and h.id = p_id
  ) r
  join public.camera c on c.id = r.camera_id
  join public.venue v on v.id = r.venue_id;
$function$;

CREATE OR REPLACE FUNCTION public.growth_funnel(p_venue_id uuid)
 RETURNS TABLE(source_kind text, source_code text, signed_up integer, kyc_done integer, visited integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.growth_funnel(p_venue_id); $function$;
revoke all on function public.growth_funnel(p_venue_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.growth_funnel(p_venue_id uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.tablet_seats()
 RETURNS TABLE(seat integer, session_id uuid, member_id uuid, full_name text, away_since timestamp with time zone, minimum_paise bigint, call_time_left integer, leaving_at timestamp with time zone, small_blind_paise bigint, big_blind_paise bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.tablet_seats(); $function$;
revoke all on function public.tablet_seats() from public, anon, authenticated, service_role;
grant execute on function public.tablet_seats() to authenticated;

-- Nothing may be left holding what went.
do $$
begin
  if exists (select 1 from public.role_permission where permission in ('control.engage', 'purge.run', 'marketing.publish', 'eod.review', 'incidents.log', 'jackpots.approve', 'markers.issue', 'markers.manage_limits', 'pot_data.read', 'shareholding.manage', 'sops.acknowledge', 'withdrawals.approve')) then
    raise exception 'A role still holds a permission that went';
  end if;
  if exists (select 1 from public.setting where key in ('aml.structuring', 'card.qr_rotation_seconds', 'dealer.rotation_minutes', 'high_hand.payouts', 'host.lapse', 'markers.due_days', 'social.connected_channels')) or exists (select 1 from public.tier_feature where feature_key in ('balance.deposits', 'core.balance_view', 'core.kill_switch_banner', 'core.membership_card', 'core.withdrawals', 'events.book', 'push.withdrawal_sent', 'social.winner_cards')) then
    raise exception 'A setting or a tier still names something that went';
  end if;
end;
$$;
