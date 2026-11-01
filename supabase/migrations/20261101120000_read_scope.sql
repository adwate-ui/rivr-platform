-- Staff who read the ledger or the audit log but not members (the owner's view, the investor) no longer read members'
-- and staff's personal data, or the club's bank details, by those routes (A1 of the Fix Tracker; the 28 Oct audit).

-- The audit log: staff without members.read read only rows about the club's business (an allowlist of entities, so a
-- table added later is hidden until listed) that name nobody and hold no bank or contact details, on either side. As in
-- 20261028130000_control_reasons_for_super_admins.sql, with that clause.
create function private.is_shareable_audit_row(p_entity text, p_before jsonb, p_after jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_entity in ('setting', 'tier', 'tier_feature', 'table_type', 'game_table', 'table_run', 'chip_denomination', 'blind_structure',
                      'tournament_template', 'tournament', 'promotion', 'promotion_rule', 'promotion_grant', 'bonus_grant', 'reward_item',
                      'league_season', 'fnb_item', 'sop', 'sop_version', 'site_block', 'site_page', 'site_revision', 'cage_shift',
                      'chip_inventory_count', 'chip_inventory_line', 'ledger_account', 'academy_batch', 'device', 'tablet_assignment',
                      'down_count', 'dealer_down', 'hand', 'high_hand_claim', 'jackpot_event', 'visit', 'waitlist_entry', 'credit_line',
                      'spin_wheel', 'venue', 'alert')
     and not exists (
       select 1 from unnest(array[p_before, p_after]) r
       where coalesce(r ?| array['phone', 'full_name', 'address', 'signature_svg', 'buyer_name', 'buyer_gstin', 'pan', 'date_of_birth',
                                 'city', 'occupation', 'alert_whatsapp', 'bank_account_name', 'bank_account_number', 'bank_ifsc', 'upi_vpa',
                                 'upi_payee_name', 'staff_ip_allowlist', 'company_name', 'company_gstin', 'signatory_name'], false));
$$;
grant execute on function private.is_shareable_audit_row(text, jsonb, jsonb) to authenticated;

drop policy "auditors read their venue's log; AML rows and controls only for their staff" on public.audit_log;
create policy "auditors read their venue's log; AML rows, controls and personal rows only for their staff" on public.audit_log
  for select to authenticated
  using (venue_id in (select private.venues_where('audit.read'))
         and ((action not like 'aml.%'
               and entity not in ('sar_entry', 'sar_entry_transaction')
               and not (entity = 'alert' and coalesce(after, before) ->> 'kind' like 'aml.%')
               and not (entity = 'setting' and coalesce(after, before) ->> 'key' like 'aml.%'))
              or venue_id in (select private.venues_where('aml.review')))
         and (entity <> 'control_state' or venue_id in (select private.venues_where('control.engage')))
         and (private.is_shareable_audit_row(entity, before, after) or venue_id in (select private.venues_where('members.read'))));

-- The actor's address on each row is read by nobody through the API: it would map the staff network.
revoke select on public.audit_log from authenticated;
grant select (id, venue_id, occurred_at, actor_user_id, device_id, action, entity, entity_id, before, after, reason, created_at, updated_at)
  on public.audit_log to authenticated;

-- A marker's signature is read by nobody through the API: the markers' other columns stay as they were.
revoke select on public.marker from authenticated;
grant select (id, venue_id, member_id, amount_paise, outstanding_paise, issued_at, due_at, issued_by_staff_id, session_id,
              ledger_transaction_id, idempotency_key, settled_at, created_at, updated_at) on public.marker to authenticated;

-- Invoices: the member's own, and the venue's for staff who read both the ledger and members, as an invoice names its
-- buyer. As in 20261020091300_gst_invoices.sql, with members.read.
drop policy "members see their invoices; ledger staff see the venue's" on public.invoice;
create policy "members see their invoices; ledger staff who read members see the venue's" on public.invoice
  for select to authenticated
  using (member_id = (select private.current_member_id())
         or (venue_id in (select private.venues_where('ledger.read')) and venue_id in (select private.venues_where('members.read'))));

-- The withholding ledger names each member only to staff who read members, and shows a PAN's last four characters only to
-- KYC reviewers. As in 20261027200300_tournament_tds_in_the_ledger.sql, with those.
create or replace function private.tds_ledger(p_venue_id uuid, p_from date, p_to date)
returns table (member_id uuid, full_name text, member_number bigint, pan_last4 text, payments integer, paid_paise bigint,
               withheld_paise bigint, shadow_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, case when private.has_permission(p_venue_id, 'members.read') then m.full_name end,
         case when private.has_permission(p_venue_id, 'members.read') then m.member_number end,
         case when private.has_permission(p_venue_id, 'kyc.review') then right(k.pan, 4) end,
         count(*)::integer,
         sum(coalesce(c.amount_paise, p.prize_paise + p.bounty_paise))::bigint,
         coalesce(sum(w.amount_paise) filter (where not w.is_shadow), 0)::bigint,
         coalesce(sum(w.amount_paise) filter (where w.is_shadow), 0)::bigint
  from public.tds_withholding w
  left join public.cage_transaction c on c.id = w.cage_transaction_id
  left join public.tournament_payout p on p.id = w.tournament_payout_id
  join public.member m on m.id = w.member_id
  left join public.kyc_record k on k.member_id = m.id and k.venue_id = m.venue_id
  where w.venue_id = p_venue_id and private.has_permission(p_venue_id, 'ledger.read')
    and w.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and w.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Kolkata')
  group by m.id, m.full_name, m.member_number, k.pan
  order by coalesce(sum(w.amount_paise) filter (where not w.is_shadow), 0) desc, m.full_name;
$$;
