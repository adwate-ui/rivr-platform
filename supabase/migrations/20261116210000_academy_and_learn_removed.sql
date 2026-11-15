-- The Academy and Learn go (redesign of 15 Nov 2026, issue 947; docs/spec/redesign-2026-11-15.md slice 1): batches, bookings and
-- their payments, attendance and graduation, the drill sessions, lessons and licensed sources, with their settings, features and
-- permission. A new venue starts with three tiers and no graduate promotions. Every function below is as the newest
-- migration before this one left it, less what named the removed things.
--
-- What stays on purpose (decision 0586): the Academy graduate tier's row at a venue that had one, retired and held by no
-- member, because members' tier history names it; tax invoices already issued in the Academy's series, and its ledger
-- entries; the promotion engine's graduation trigger, which nothing fires; the `learn-sources` storage bucket, which no
-- one can read now.

-- A graduate promotion that ever gave something stops the migration: its grants count against limits a person should
-- decide on. Production and staging have none (read 15 Nov 2026).
do $$
begin
  if exists (select 1 from public.promotion p join public.promotion_grant g on g.promotion_id = p.id where p.template_key in ('graduate_first_buy_in', 'graduate_freeroll')) then
    raise exception 'A graduate promotion has grants: decide what becomes of them before the Academy goes';
  end if;
  -- A booking the cage confirmed is money taken: its bank reference would no longer be known as used, and its record
  -- of who bought which seat would go with the table. Production and staging have none.
  if exists (select 1 from public.academy_booking b where b.status = 'paid') then
    raise exception 'An Academy booking was paid: decide what becomes of its record before the Academy goes';
  end if;
end;
$$;

-- The Academy graduate tier, at every venue that still offers it: its members become Members, with a line in their tier
-- history, and the tier is retired (as 20261110645000 did for the venues of that day).
select private.retire_academy_tier(v.id) from public.venue v;
-- That leaves alone a tier already retired: a member still on one becomes a Member the same way.
insert into public.member_tier_change (venue_id, member_id, from_tier_id, to_tier_id, reason, is_expiry)
select m.venue_id, m.id, g.id, d.id, 'The Academy is no longer offered', true
from public.member m
join public.tier g on g.id = m.tier_id and g.name = 'Academy graduate'
join public.tier d on d.venue_id = g.venue_id and d.name = 'Member';
update public.member m set tier_id = d.id
from public.tier g join public.tier d on d.venue_id = g.venue_id and d.name = 'Member'
where g.id = m.tier_id and g.name = 'Academy graduate';
do $$
begin
  if exists (select 1 from public.member m join public.tier t on t.id = m.tier_id where t.name = 'Academy graduate')
     or exists (select 1 from public.tier t where t.name = 'Academy graduate' and not t.is_retired) then
    raise exception 'A member is still on the Academy graduate tier, or a venue still offers it';
  end if;
end;
$$;
delete from public.promotion_step_skip s where s.promotion_id in (select p.id from public.promotion p where p.template_key in ('graduate_first_buy_in', 'graduate_freeroll'));
-- Its versions, rules and budget go with it.
delete from public.promotion p where p.template_key in ('graduate_first_buy_in', 'graduate_freeroll');

-- The licensed sources' files: no one reads or writes the bucket now.
drop policy "super admins upload learn sources" on storage.objects;
drop policy "super admins replace learn sources" on storage.objects;
drop policy "super admins read learn sources" on storage.objects;
drop policy "members read the licensed encodings they have" on storage.objects;

-- Their settings, features and permission.
delete from public.setting s where s.key in ('academy.gst', 'academy.price', 'learn.daily_points_cap', 'learn.session_points');
delete from public.setting_key where key in ('academy.gst', 'academy.price', 'learn.daily_points_cap', 'learn.session_points');
delete from public.tier_feature t where t.feature_key in ('academy.booking', 'learn.academy_lessons', 'learn.drills', 'learn.library', 'learn.review') or t.feature_key like 'learn.source.%';
delete from public.member_feature_override o where o.feature_key in ('academy.booking', 'learn.academy_lessons', 'learn.drills', 'learn.library', 'learn.review') or o.feature_key like 'learn.source.%';
delete from public.feature where key like 'learn.source.%';
delete from public.feature where key in ('academy.booking', 'learn.academy_lessons', 'learn.drills', 'learn.library', 'learn.review');
delete from public.role_permission where role = 'super_admin' and permission = 'learn.manage_sources';
update public.feature set description = 'The events calendar: pro nights and corporate tables, booked from the app.' where key = 'events.book';
do $$
begin
  if exists (select 1 from public.role_permission where permission = 'learn.manage_sources') then
    raise exception 'A role still holds learn.manage_sources';
  end if;
end;
$$;

-- The tables, with their policies and triggers, then what only they used. First the functions that take or return a row
-- of one of them.
drop trigger venue_academy_gst_placeholder on public.venue;
drop function private.academy_student(p_booking_id uuid, p_must_be_paid boolean);
drop table public.academy_attendance, public.academy_utr_rejection, public.academy_booking, public.academy_batch, public.learn_attempt, public.learn_card, public.learn_lesson, public.learn_session, public.learn_source;
delete from private.member_export_column where table_name in ('academy_attendance', 'academy_utr_rejection', 'academy_booking', 'academy_batch', 'learn_attempt', 'learn_card', 'learn_lesson', 'learn_session', 'learn_source')
   or (table_name = 'venue_config' and column_name = 'sac_academy');
-- The Academy's invoice series where it never issued an invoice and never counted one: a counter that has moved keeps
-- its series, so a number once given is never given again.
delete from public.invoice_series s
where s.code = 'A' and not exists (select 1 from public.invoice i where i.series_id = s.id)
  and not exists (select 1 from public.invoice_counter c where c.series_id = s.id);

-- The venue's SAC code for the Academy (the owner, 15 Nov). The staff view lists its columns, so it is made again.
drop view public.venue_config_detail;
alter table public.venue_config drop column sac_academy;
create view public.venue_config_detail with (security_invoker = true) as
  select venue_id, legal_name, gstin, address, upi_payee_name, upi_vpa, bank_name, bank_account_name, bank_account_number, bank_ifsc,
         invoice_prefix, logo_path, staff_ip_allowlist, alert_whatsapp, created_at, updated_at, tan, sac_club_services,
         signatory_name, signatory_designation, tv_pairing_window_only, tv_pairing_window_at, contact_phone, contact_whatsapp
  from private.venue_config_detail_rows();
revoke all on public.venue_config_detail from public, anon, authenticated, service_role;
grant select on public.venue_config_detail to authenticated;

drop function public.academy_open_batches();
drop function public.academy_payment_details(p_booking_id uuid);
drop function public.book_academy(p_batch_id uuid);
drop function public.book_academy_corporate(p_batch_id uuid, p_member_id uuid, p_company_name text, p_seats integer, p_request_id uuid, p_company_gstin text);
drop function public.cancel_academy_booking(p_booking_id uuid);
drop function public.claim_academy_payment(p_booking_id uuid, p_utr text);
drop function public.complete_learn_lesson(p_source_key text, p_unit_id text, p_correct integer, p_asked integer);
drop function public.complete_learn_session(p_session_id uuid, p_principles text[]);
drop function public.confirm_academy_payment(p_booking_id uuid, p_utr text);
drop function public.create_academy_batch(p_venue_id uuid, p_name text, p_starts_on date, p_ends_on date, p_seats integer);
drop function public.graduate_academy_member(p_booking_id uuid);
drop function public.mark_academy_attendance(p_booking_id uuid);
drop function public.my_academy_bookings();
drop function public.my_academy_invoice(p_booking_id uuid);
drop function public.record_academy_payment(p_booking_id uuid, p_utr text);
drop function public.register_learn_source(p_venue_id uuid, p_source_key text, p_title text, p_author text, p_source_hash text, p_licence_terms text, p_licence_ends_on date);
drop function public.reject_academy_payment(p_booking_id uuid, p_utr text);
drop function public.staff_academy_batches(p_venue_id uuid);
drop function public.sync_learn_progress(p_attempts jsonb, p_cards jsonb);
drop function private.academy_account(p_venue_id uuid);
drop function private.academy_fee(p_kind text, p_seats integer, p_prices jsonb);
drop function private.academy_gst_placeholder();
drop function private.academy_open_batches();
drop function private.academy_payment_details(p_booking_id uuid);
drop function private.academy_seat_hold();
drop function private.academy_seats_taken(p_batch_id uuid);
drop function private.book_academy(p_batch_id uuid);
drop function private.book_academy_corporate(p_batch_id uuid, p_member_id uuid, p_company_name text, p_seats integer, p_request_id uuid, p_company_gstin text);
drop function private.cancel_academy_booking(p_booking_id uuid);
drop function private.claim_academy_payment(p_booking_id uuid, p_utr text);
drop function private.complete_learn_lesson(p_source_key text, p_unit_id text, p_correct integer, p_asked integer);
drop function private.complete_learn_session(p_session_id uuid, p_principles text[]);
drop function private.confirm_academy_payment(p_booking_id uuid, p_utr text);
drop function private.create_academy_batch(p_venue_id uuid, p_name text, p_starts_on date, p_ends_on date, p_seats integer);
drop function private.graduate_academy_member(p_booking_id uuid);
drop function private.learn_points(p_mastered bigint, p_earned_today bigint, p_per_session bigint, p_per_principle bigint, p_daily_cap bigint);
drop function private.learning_member();
drop function private.lock_academy_batch(p_batch_id uuid, p_venue_id uuid, p_seats integer);
drop function private.mark_academy_attendance(p_booking_id uuid);
drop function private.may_handle_learn_sources(p_name text);
drop function private.may_read_learn_source(p_name text);
drop function private.my_academy_bookings();
drop function private.my_academy_invoice(p_booking_id uuid);
drop function private.record_academy_payment(p_booking_id uuid, p_utr text);
drop function private.register_learn_source(p_venue_id uuid, p_source_key text, p_title text, p_author text, p_source_hash text, p_licence_terms text, p_licence_ends_on date);
drop function private.reject_academy_payment(p_booking_id uuid, p_utr text);
drop function private.retire_academy_tier(p_venue_id uuid);
drop function private.staff_academy_batches(p_venue_id uuid);
drop function private.sync_learn_progress(p_attempts jsonb, p_cards jsonb);
drop function private.website_launch_academy(p_venue_id uuid);

CREATE OR REPLACE FUNCTION private.add_promotion_templates(p_venue_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.promotion (venue_id, template_key, name, detail, runs, per_player_limit, per_player_period)
  values
    (p_venue_id, 'tuesday_bonus', 'Buy-in bonus Tuesday', '20% on the first five buy-ins per table', 'Tuesday · all stakes', null, null),
    (p_venue_id, 'referral', 'Referral', '1,000 bonus chips to each side', 'Every day', null, null),
    (p_venue_id, 'founders_priority', 'Founders'' Circle priority', 'Front of every waitlist', 'Every night', null, null),
    (p_venue_id, 'cab', 'Cab home', 'A cab home from your fourth visit in a month', 'Every night', null, null),
    (p_venue_id, 'hours_bonus', 'Four-hour bonus chips', '1,000 bonus chips after four hours at the tables', 'Every night', 1, 'day')
  on conflict (venue_id, template_key) do nothing;
  insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
  select p_venue_id, p.id, r.trigger, r.conditions, r.effect
  from (values
    ('tuesday_bonus', 'buy_in', '{"days": [2], "first_n": {"count": 5, "per": "table"}}'::jsonb,
     '{"kind": "bonus", "percent_bps": 2000, "expires_days": 7}'::jsonb),
    ('referral', 'referral', '{}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb),
    ('hours_bonus', 'hours_played', '{"min_hours": 4}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 7}'::jsonb)
  ) as r (template_key, trigger, conditions, effect)
  join public.promotion p on p.venue_id = p_venue_id and p.template_key = r.template_key
  where not exists (select 1 from public.promotion_rule x where x.promotion_id = p.id);
  perform private.version_promotions(p_venue_id);
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

  -- Every gateable feature for every tier, but Events (#637), cab requests, withdrawal pushes (#709)
  -- and hourly rakeback, which start off and hidden.
  insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
  select p_venue_id, t.id, f.key, not o.is_off, case when o.is_off then 'hidden' else 'locked' end::public.feature_display_mode, '-infinity'
  from public.tier t cross join public.feature f
  cross join lateral (select f.key in ('events.book', 'cab.requests', 'push.withdrawal_sent',
                                    'rewards.rakeback') as is_off) o
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

  insert into public.chip_denomination (venue_id, value_paise, name)
  select p_venue_id, rupees * 100, '₹' || to_char(rupees, 'FM99,99,999')
  from unnest(array[50, 100, 500, 1000, 5000, 25000]) as rupees;

  if p_is_practice then
    perform private.add_certification_quizzes(p_venue_id);
  end if;

  perform private.add_training_sops(p_venue_id);
  perform private.add_promotion_templates(p_venue_id);
  if not p_is_practice and not exists (select 1 from public.venue v where not v.is_practice and v.id <> p_venue_id) then
    perform private.add_website(p_venue_id);
  end if;

  return p_venue_id;
end;
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
    -- Only the member's first buy-in is a conversion: exactly one, as the id breaks a tie.
    when 'cage.buy_in' then case when exists (
        select 1 from public.cage_transaction t join public.cage_transaction this on this.id = (p_payload ->> 'cage_transaction_id')::uuid
        where t.member_id = m.id and t.kind = 'buy_in' and (t.created_at, t.id) < (this.created_at, this.id)) then null else 'first_buy_in' end
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
  delete from public.membership_card x where x.member_id = p_member.id;
  delete from public.feedback x where x.member_id = p_member.id;
  delete from public.review_request x where x.member_id = p_member.id;
  delete from public.cab_request x where x.member_id = p_member.id;
  delete from public.club_event_booking x where x.member_id = p_member.id;
  delete from public.inbox_message x where x.lead_id in (select l.id from public.lead l where l.member_id = p_member.id);
  delete from public.lead x where x.member_id = p_member.id;
  delete from public.push_subscription x where x.member_id = p_member.id;
  delete from public.live_status_device x where x.member_id = p_member.id;
  delete from public.winner_card x where x.member_id = p_member.id;
  delete from public.host_queue_item x where x.member_id = p_member.id;
  delete from public.tournament_interest x where x.member_id = p_member.id;
  delete from public.kyc_review x where x.member_id = p_member.id;
  delete from public.outbox_event x where x.venue_id = p_member.venue_id and x.payload ->> 'member_id' = p_member.id::text;
  delete from public.payout_account p
  where p.member_id = p_member.id
    and not exists (select 1 from public.withdrawal_request w where w.payout_account_id = p.id)
    and not exists (select 1 from public.deposit_request d where d.payout_account_id = p.id);
end;
$function$;

CREATE OR REPLACE FUNCTION private.issue_invoice(p_venue_id uuid, p_series_code text, p_source text, p_inclusive_paise bigint, p_rate_basis_points integer, p_description text, p_member_id uuid DEFAULT NULL::uuid, p_buyer_name text DEFAULT NULL::text, p_buyer_gstin text DEFAULT NULL::text, p_issued_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS invoice
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_invoice public.invoice;
  v_config public.venue_config;
  v_series public.invoice_series;
  v_is_practice boolean;
  v_at timestamptz;
  v_year integer;
  v_sequence integer;
  v_taxable bigint;
  v_half bigint := 0;
  v_igst bigint := 0;
  v_sac text;
  v_inter_state boolean;
  v_place text;
begin
  select * into v_series from public.invoice_series s where s.venue_id = p_venue_id and s.code = p_series_code;
  if v_series.id is null then
    raise exception 'No invoice series % at this venue', p_series_code using errcode = '22023';
  end if;
  -- Held until the caller commits: the next issue in the series sees this one, its number and its source.
  perform pg_advisory_xact_lock(hashtextextended('invoice_series:' || v_series.id::text, 0));

  select * into v_invoice from public.invoice i where i.venue_id = p_venue_id and i.source = p_source;
  if found then
    if (v_invoice.series_id, v_invoice.total_paise, v_invoice.rate_basis_points, v_invoice.member_id, v_invoice.buyer_gstin)
       is distinct from (v_series.id, p_inclusive_paise, p_rate_basis_points, p_member_id, p_buyer_gstin)
       or (p_buyer_name is not null and p_buyer_name <> v_invoice.buyer_name) then
      raise exception 'That source has an invoice with other details' using errcode = '22023';
    end if;
    return v_invoice;
  end if;
  select v.is_practice into v_is_practice from public.venue v where v.id = p_venue_id;
  select * into v_config from public.venue_config c where c.venue_id = p_venue_id;
  if coalesce(p_inclusive_paise < 0 or p_rate_basis_points not between 0 and 10000, true) then
    raise exception 'An invoice is for nothing or more, at a rate of 0 to 10,000 basis points' using errcode = '22023';
  end if;
  v_sac := case p_series_code when 'S' then v_config.sac_club_services end;
  if not v_is_practice and v_config.gstin is null then
    raise exception 'A tax invoice needs the venue''s GSTIN in its configuration' using errcode = 'RVGST';
  end if;
  if not v_is_practice and v_sac is null then
    raise exception 'A tax invoice needs its series'' SAC code in the venue''s configuration' using errcode = 'RVGST';
  end if;

  -- The place of supply: the buyer's state when it differs from the venue's (IGST), else the venue's.
  v_inter_state := coalesce(left(p_buyer_gstin, 2) <> left(v_config.gstin, 2), false);
  v_place := private.gst_state_name(case when v_inter_state then left(p_buyer_gstin, 2) else left(v_config.gstin, 2) end);
  if not v_is_practice and v_place is null then
    raise exception 'A tax invoice needs a place of supply: no state has the GSTIN state code %',
      case when v_inter_state then left(p_buyer_gstin, 2) else left(v_config.gstin, 2) end using errcode = 'RVGST';
  end if;

  if v_inter_state then
    select i.taxable_paise, i.igst_paise into v_taxable, v_igst from private.igst_included(p_inclusive_paise, p_rate_basis_points) i;
  else
    select g.taxable_paise, g.cgst_paise into v_taxable, v_half from private.gst_included(p_inclusive_paise, p_rate_basis_points) g;
  end if;

  v_at := coalesce(p_issued_at, clock_timestamp());
  v_year := private.financial_year(p_venue_id, v_at);
  insert into public.invoice_counter (series_id, venue_id, financial_year, last_number)
  values (v_series.id, p_venue_id, v_year, 1)
  on conflict (series_id, financial_year) do update set last_number = public.invoice_counter.last_number + 1
  returning last_number into v_sequence;

  insert into public.invoice (venue_id, series_id, financial_year, sequence, number, source, is_tax_invoice, issued_at, supplier_legal_name,
                              supplier_gstin, supplier_address, member_id, buyer_name, buyer_gstin, description, rate_basis_points,
                              taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise,
                              sac_code, place_of_supply, signatory_name, signatory_designation)
  values (p_venue_id, v_series.id, v_year, v_sequence,
          v_config.invoice_prefix || '/' || v_series.code || to_char(v_year % 100, 'FM00') || '/' || v_sequence,
          p_source, not v_is_practice, v_at, v_config.legal_name,
          -- A practice invoice never carries a GSTIN, even one set on the practice venue.
          case when v_is_practice then null else v_config.gstin end, v_config.address, p_member_id,
          coalesce(p_buyer_name, (select m.full_name from public.member m where m.id = p_member_id and m.venue_id = p_venue_id)),
          p_buyer_gstin, p_description, p_rate_basis_points, v_taxable, v_half, v_half, v_igst, p_inclusive_paise,
          case when v_is_practice then null else v_sac end, case when v_is_practice then null else v_place end,
          case when v_is_practice then null else v_config.signatory_name end,
          case when v_is_practice then null else v_config.signatory_designation end)
  returning * into v_invoice;

  perform private.emit(p_venue_id, 'invoice.issued', jsonb_build_object('invoice_id', v_invoice.id, 'number', v_invoice.number),
                       'invoice.issued:' || v_invoice.id);
  return v_invoice;
end;
$function$;

CREATE OR REPLACE FUNCTION private.refuse_hidden_modules()
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if current_user in ('anon', 'authenticated') and current_setting('request.path', true) = any (array[
    '/rpc/cage_buy_in', '/rpc/cage_cash_out', '/rpc/cage_members', '/rpc/cage_queue', '/rpc/decline_buy_in_request',
    '/rpc/close_cage_shift', '/rpc/eod_closes', '/rpc/review_eod_close', '/rpc/review_shift_opening', '/rpc/shift_openings',
    '/rpc/credit_report', '/rpc/issue_marker', '/rpc/open_markers', '/rpc/repay_markers',
    '/rpc/decline_withdrawal', '/rpc/my_withdrawals', '/rpc/pay_withdrawal_in_cash', '/rpc/pay_withdrawal_through_cashfree',
    '/rpc/request_withdrawal', '/rpc/second_approve_withdrawal', '/rpc/send_withdrawal', '/rpc/waiting_withdrawals',
    '/rpc/confirm_deposit', '/rpc/deposit_details', '/rpc/my_deposits', '/rpc/reject_deposit', '/rpc/request_deposit',
    '/rpc/second_approve_deposit', '/rpc/waiting_deposits', '/rpc/my_wallet',
    '/rpc/add_expense_category', '/rpc/decide_expense', '/rpc/request_expense', '/rpc/venue_expenses',
    '/rpc/account_statement', '/rpc/add_payment_account', '/rpc/payment_accounts', '/rpc/transfer_between_accounts',
    '/rpc/set_tally_ledger', '/rpc/tally_accounts', '/rpc/tally_day',
    '/rpc/my_tds_certificates', '/rpc/tds_ledger', '/rpc/tds_return_extract',
    '/rpc/chip_inventory', '/rpc/count_chips', '/rpc/open_cage_shift', '/rpc/treasury',
    '/rpc/add_payout_account', '/rpc/decide_payout_account', '/rpc/my_payout_accounts', '/rpc/payout_accounts_to_verify',
    '/rpc/remove_payout_account',
    '/rpc/credit_lines', '/rpc/credit_room', '/rpc/decide_credit_limit', '/rpc/set_credit_limit',
    '/rpc/jackpot_history', '/rpc/jackpot_pools', '/rpc/pay_bad_beat', '/rpc/reverse_jackpot_event',
    '/rpc/cage_tournament_entry', '/rpc/refund_tournament_alternate', '/rpc/set_tournament_payouts', '/rpc/tournament_balance',
    '/rpc/tournament_payouts',
    '/rpc/add_shareholder', '/rpc/record_holding', '/rpc/shareholding_history', '/rpc/shareholding_register',
    '/rpc/mis_report_for', '/rpc/rake_tonight', '/rpc/unclaimed_balances']) then
    raise exception 'That part of RIVR is not in use' using errcode = '42501';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION private.refuse_used_utr()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.utr is null then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.venue_id::text || ':' || new.utr, 0));
  if (tg_table_name <> 'cage_transaction' and exists (select 1 from public.cage_transaction c where c.venue_id = new.venue_id and c.utr = new.utr))
     or (tg_table_name <> 'withdrawal_request' and exists (select 1 from public.withdrawal_request w where w.venue_id = new.venue_id and w.utr = new.utr))
     or (tg_table_name <> 'deposit_request' and exists (select 1 from public.deposit_request d where d.venue_id = new.venue_id and d.utr = new.utr)) then
    raise exception 'That UTR already paid something else at this venue' using errcode = 'RVUTR';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.website_launch_text(p_venue_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.website_launch_home(p_venue_id);
  perform private.website_launch_legal(p_venue_id);
end;
$function$;

CREATE OR REPLACE FUNCTION private.add_website(p_venue_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.add_website_with_points_and_league(p_venue_id);
  perform private.website_without_points_and_league(p_venue_id);
  perform private.website_without_academy(p_venue_id);
end;
$function$;

-- The website: the Academy's page goes, and any link that hands a visitor to the Academy in the app. Saved versions of
-- other pages are left as they were saved; neither production nor staging has one that points to the Academy (read 15 Nov).
create function private.website_without_academy(p_venue_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.site_block b using public.site_page p where p.id = b.page_id and p.venue_id = p_venue_id and p.slug = 'academy';
  delete from public.site_revision r using public.site_page p where p.id = r.page_id and p.venue_id = p_venue_id and p.slug = 'academy';
  delete from public.site_page p where p.venue_id = p_venue_id and p.slug = 'academy';
  update public.site_block b
  set content = jsonb_set(b.content, '{links}', (select coalesce(jsonb_agg(x.link order by x.place), '[]'::jsonb)
                                                 from jsonb_array_elements(b.content -> 'links') with ordinality as x (link, place)
                                                 where x.link ->> 'to' is distinct from 'academy'))
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and b.kind = 'links' and b.content -> 'links' @> '[{"to": "academy"}]';
  delete from public.site_block b using public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and b.kind = 'links' and b.content -> 'links' = '[]'::jsonb;
  update public.site_block b set content = b.content - 'action'
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and b.content -> 'action' ->> 'to' = 'academy';
end;
$$;
revoke all on function private.website_without_academy(uuid) from public, anon, authenticated, service_role;
select private.website_without_academy(v.id) from public.venue v;

-- The practice venue's saved start is taken again: the one saved before held rows of the tables dropped here, and the
-- graduate promotions, which a reset could not put back (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
