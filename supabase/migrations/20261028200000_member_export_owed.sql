-- A member's own data export, built from what a member is owed (#498; question #493 X5, the owner's answer of 27 Oct;
-- decision 0240). Until now it held every column of every table naming the member: staff notes about them (freeze and
-- override reasons, KYC review reasons, the credit proposal's reason, face-match details) and other members' ids (the
-- other side of a bad beat), which the owner removed by hand. Now each column is listed with what the export does:
--   owed      given as it is;
--   note      given in a separate staff-notes/<table> file, clearly a staff note, with the row's id to join it by;
--   other     another member's id: given only where it is this member's own, else blank;
--   withheld  never given.
-- A column not listed is withheld; 151_member_export lists every column of every table, so a new one is a decision.
-- The full archive (#103) is unchanged.

create function private.member_export_columns()
returns table (table_name text, column_name text, kind text)
language sql
immutable
set search_path = ''
as $$
  select t.table_name, c.column_name, t.kind
  from (values
    ('academy_booking', 'owed', array['id', 'venue_id', 'is_practice', 'batch_id', 'member_id', 'kind', 'company_name', 'seats', 'amount', 'status', 'utr',
      'request_id', 'claimed_at', 'recorded_by_staff_id', 'paid_at', 'confirmed_by_staff_id', 'ledger_transaction_id', 'created_at', 'updated_at',
      'turned_down_utr', 'company_gstin', 'invoice_id']),
    ('bonus_grant', 'owed', array['id', 'venue_id', 'member_id', 'amount_paise', 'remaining_paise', 'expires_at', 'reason', 'idempotency_key',
      'ledger_transaction_id', 'expired_at', 'expiry_transaction_id', 'created_at', 'updated_at']),
    ('buy_in_request', 'owed', array['id', 'venue_id', 'member_id', 'session_id', 'amount_paise', 'status', 'requested_by_staff_id',
      'requested_by_device_id', 'decided_by_staff_id', 'decided_at', 'idempotency_key', 'created_at', 'updated_at']),
    ('cage_transaction', 'owed', array['id', 'venue_id', 'member_id', 'kind', 'method', 'amount_paise', 'utr', 'session_id', 'buy_in_request_id',
      'ledger_transaction_id', 'cashier_staff_id', 'idempotency_key', 'created_at', 'updated_at', 'is_final', 'camera_id']),
    ('consent', 'owed', array['id', 'venue_id', 'member_id', 'purpose', 'granted_at', 'withdrawn_at', 'created_at', 'updated_at', 'recorded_by_staff_id']),
    ('control_state', 'owed', array['id', 'venue_id', 'level', 'feature', 'member_id', 'staff_id', 'device_id', 'engaged_at', 'engaged_by_staff_id',
      'released_at', 'released_by_staff_id', 'release_second_staff_id', 'created_at', 'updated_at']),
    ('control_state', 'note', array['reason', 'release_reason']),
    ('credit_line', 'owed', array['id', 'venue_id', 'member_id', 'limit_paise', 'set_by_staff_id', 'approved_by_staff_id', 'proposed_limit_paise',
      'proposed_by_staff_id', 'proposed_at', 'created_at', 'updated_at']),
    ('credit_line', 'note', array['reason', 'proposal_reason']),
    ('deposit_request', 'owed', array['id', 'venue_id', 'member_id', 'amount_paise', 'utr', 'payout_account_id', 'status', 'ledger_transaction_id',
      'decided_at', 'decided_by_staff_id', 'idempotency_key', 'created_at', 'updated_at']),
    ('early_departure', 'owed', array['id', 'venue_id', 'member_id', 'visit_id', 'session_id', 'shortfall_seconds', 'overridden_by_staff_id',
      'created_at', 'updated_at']),
    ('early_departure', 'note', array['reason']),
    ('feedback', 'owed', array['id', 'venue_id', 'member_id', 'visit_id', 'score', 'note', 'is_ticket', 'resolved_at', 'resolved_by_staff_id',
      'created_at', 'updated_at']),
    ('feedback', 'note', array['resolution']),
    ('invoice', 'owed', array['id', 'venue_id', 'series_id', 'financial_year', 'sequence', 'number', 'source', 'is_tax_invoice', 'issued_at',
      'supplier_legal_name', 'supplier_gstin', 'supplier_address', 'member_id', 'buyer_name', 'buyer_gstin', 'description', 'rate_basis_points',
      'taxable_paise', 'cgst_paise', 'sgst_paise', 'total_paise', 'created_at', 'updated_at', 'igst_paise', 'sac_code', 'place_of_supply',
      'signatory_name', 'signatory_designation']),
    ('jackpot_event', 'owed', array['id', 'venue_id', 'kind', 'reverses_id', 'table_id', 'pool_paise', 'loser_paise', 'winner_paise',
      'each_at_table_paise', 'total_paise', 'rule', 'staff_id', 'idempotency_key', 'created_at', 'updated_at']),
    ('jackpot_event', 'other', array['loser_member_id', 'winner_member_id', 'table_member_ids']),
    ('jackpot_event', 'note', array['reason']),
    ('kyc_record', 'owed', array['id', 'venue_id', 'member_id', 'status', 'method', 'date_of_birth', 'masked_aadhaar', 'pan', 'address', 'verified_at',
      'vendor_calls', 'vendor_calls_since', 'created_at', 'updated_at', 'photo_path', 'selfie_claimed_at']),
    ('kyc_record', 'note', array['liveness_score', 'face_match_score', 'refusal']),
    ('kyc_record', 'withheld', array['same_face_as']),
    ('kyc_review', 'owed', array['id', 'venue_id', 'member_id', 'decision', 'entered_date_of_birth', 'entered_pan', 'outcome', 'reviewed_by_staff_id',
      'created_at', 'updated_at', 'method']),
    ('kyc_review', 'note', array['reason']),
    ('league_finish', 'owed', array['id', 'venue_id', 'tournament_id', 'member_id', 'place', 'month', 'points', 'created_at', 'updated_at']),
    ('ledger_account', 'owed', array['id', 'venue_id', 'code', 'name', 'kind', 'unit', 'member_id', 'is_players_money', 'created_at', 'updated_at']),
    ('ledger_entry', 'owed', array['id', 'venue_id', 'transaction_id', 'account_id', 'amount', 'created_at', 'updated_at']),
    ('marker', 'owed', array['id', 'venue_id', 'member_id', 'amount_paise', 'outstanding_paise', 'issued_at', 'due_at', 'signature_svg',
      'issued_by_staff_id', 'session_id', 'ledger_transaction_id', 'idempotency_key', 'settled_at', 'created_at', 'updated_at']),
    ('member', 'owed', array['id', 'venue_id', 'user_id', 'member_number', 'full_name', 'phone', 'tier_id', 'qualifying_small_blind',
      'qualifying_big_blind', 'created_at', 'updated_at', 'erased_at']),
    ('member_feature_override', 'owed', array['id', 'venue_id', 'member_id', 'feature_key', 'is_granted', 'ends_at', 'revoked_at',
      'created_by_staff_id', 'created_at', 'updated_at', 'lifted_by_staff_id']),
    ('member_feature_override', 'note', array['reason', 'lift_reason']),
    ('member_limit', 'owed', array['member_id', 'venue_id', 'session_reminder_hours', 'created_at', 'updated_at']),
    ('member_preference', 'owed', array['member_id', 'venue_id', 'games', 'small_blind', 'big_blind', 'created_at', 'updated_at', 'name_on_tvs']),
    ('member_tier_change', 'owed', array['id', 'venue_id', 'member_id', 'from_tier_id', 'to_tier_id', 'ends_at', 'changed_by_staff_id', 'is_expiry',
      'created_at', 'updated_at']),
    ('member_tier_change', 'note', array['reason']),
    ('membership_card', 'owed', array['id', 'venue_id', 'member_id', 'created_at', 'updated_at']),
    ('notification_preference', 'owed', array['member_id', 'venue_id', 'push_type', 'is_on', 'created_at', 'updated_at']),
    ('payout_account', 'owed', array['id', 'venue_id', 'member_id', 'kind', 'bank_name', 'vpa', 'account_number', 'ifsc', 'holder_name', 'status',
      'decided_at', 'decided_by_staff_id', 'reject_reason', 'removed_at', 'created_at', 'updated_at']),
    ('points_earning', 'owed', array['id', 'venue_id', 'member_id', 'visit_id', 'basis', 'session_id', 'table_id', 'played_seconds', 'rake_share_paise',
      'rate', 'points', 'created_at', 'updated_at']),
    ('promotion_grant', 'owed', array['id', 'venue_id', 'promotion_id', 'promotion_rule_id', 'member_id', 'table_id', 'trigger', 'effect', 'cost_paise',
      'points', 'source_key', 'club_day', 'bonus_grant_id', 'fulfilled_at', 'created_at', 'updated_at']),
    ('redemption', 'owed', array['id', 'venue_id', 'member_id', 'reward_item_id', 'points', 'idempotency_key', 'ledger_transaction_id', 'handed_over_at',
      'handed_over_by_staff_id', 'created_at', 'updated_at']),
    ('seat_move', 'owed', array['id', 'venue_id', 'session_id', 'from_table_id', 'from_seat', 'to_table_id', 'to_seat', 'moved_by_staff_id', 'created_at',
      'updated_at']),
    ('seat_session', 'owed', array['id', 'venue_id', 'member_id', 'visit_id', 'table_id', 'seat', 'started_at', 'seated_here_at', 'ended_at',
      'end_reason', 'seated_by_staff_id', 'created_at', 'updated_at', 'away_since', 'call_time_minutes', 'away_seconds', 'call_time_completed_at',
      'reminded_at', 'leaving_at', 'leaving_by_staff_id']),
    ('self_exclusion', 'owed', array['id', 'venue_id', 'member_id', 'starts_at', 'ends_at', 'set_by_staff_id', 'reason', 'created_at', 'updated_at']),
    ('sign_up_attribution', 'owed', array['member_id', 'id', 'venue_id', 'referral_code', 'creator_code', 'utm_source', 'utm_medium', 'utm_campaign',
      'utm_content', 'utm_term', 'first_seen_at', 'created_at', 'updated_at']),
    ('tds_withholding', 'owed', array['id', 'venue_id', 'member_id', 'cage_transaction_id', 'section', 'basis', 'period_start', 'winnings_paise',
      'already_paise', 'has_pan', 'rate_basis_points', 'due_paise', 'amount_paise', 'is_shadow', 'created_at', 'updated_at', 'tournament_payout_id']),
    ('tournament_entry', 'owed', array['id', 'venue_id', 'tournament_id', 'member_id', 'entry_number', 'status', 'table_number', 'seat_number',
      'bust_order', 'busted_at', 'created_at', 'updated_at', 'place']),
    ('tournament_payout', 'owed', array['id', 'venue_id', 'tournament_id', 'entry_id', 'member_id', 'kind', 'place', 'prize_paise', 'bounty_paise',
      'head_paise', 'tds_paise', 'is_tds_shadow', 'ledger_transaction_id', 'created_at', 'updated_at']),
    ('tournament_payout', 'withheld', array['busted_entry_id']),
    ('tournament_purchase', 'owed', array['id', 'venue_id', 'tournament_id', 'entry_id', 'member_id', 'kind', 'paid_by', 'price_paise', 'fee_paise',
      'chips', 'ledger_transaction_id', 'idempotency_key', 'created_by_user_id', 'created_at', 'updated_at']),
    ('visit', 'owed', array['id', 'venue_id', 'member_id', 'opened_at', 'opened_by_staff_id', 'closed_at', 'close_reason', 'created_at', 'updated_at',
      'opened_by_device_id']),
    ('waitlist_entry', 'owed', array['id', 'venue_id', 'member_id', 'table_type_id', 'status', 'joined_at', 'left_at', 'added_by_staff_id',
      'idempotency_key', 'created_at', 'updated_at', 'called_at', 'hold_until', 'call_table_id', 'call_seat', 'seated_at', 'stepped_away_at',
      'away_used', 'left_reason']),
    ('withdrawal_request', 'owed', array['id', 'venue_id', 'member_id', 'amount_paise', 'payout_account_id', 'status', 'utr', 'decline_reason',
      'hold_transaction_id', 'outcome_transaction_id', 'decided_at', 'decided_by_staff_id', 'idempotency_key', 'created_at', 'updated_at', 'method',
      'payout_key', 'payout_id', 'payout_failure', 'payout_attempted_at'])
  ) t (table_name, kind, columns)
  cross join unnest(t.columns) c (column_name);
$$;

-- As before (20261028010000_aml.sql), with each entry's source table and the columns it blanks: the full archive gives
-- every column of every table; one member's gives what member_export_columns lists, its staff notes as separate
-- staff-notes/<table> entries with the row's id.
drop function private.export_archive_tables(boolean);
create function private.export_archive_tables(p_for_member boolean)
returns table (table_name text, source_table text, column_names text[], predicate text, blanked text[])
language sql
stable
security definer
set search_path = ''
as $$
  with tables as (
    select c.table_name::text as table_name,
           array_agg(c.column_name::text order by c.ordinal_position)
             filter (where c.column_name not like '%\_hash'
                       and c.column_name not in ('encrypted_password', 'identity_key', 'aadhaar_reference', 'vendor_reference', 'digilocker_session_id'))
             as column_names,
           -- A secret column never goes, whatever the list says.
           array_agg(c.column_name::text order by c.ordinal_position)
             filter (where e.kind in ('owed', 'other') and c.column_name not like '%\_hash'
                       and c.column_name not in ('encrypted_password', 'identity_key', 'aadhaar_reference', 'vendor_reference', 'digilocker_session_id')) as owed_names,
           array_agg(c.column_name::text order by c.ordinal_position)
             filter (where e.kind = 'note' and c.column_name not like '%\_hash'
                       and c.column_name not in ('encrypted_password', 'identity_key', 'aadhaar_reference', 'vendor_reference', 'digilocker_session_id')) as note_names,
           array_agg(c.column_name::text order by c.ordinal_position) filter (where e.kind = 'other') as other_names,
           bool_or(c.column_name = 'venue_id') as has_venue,
           string_agg(case when c.column_name = 'member_id' or c.column_name like '%\_member\_id' then format('$2 = t.%I', c.column_name)
                           when c.column_name like '%\_member\_ids' then format('$2 = any(t.%I)', c.column_name) end, ' or ')
             as member_match
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    left join private.member_export_columns() e on e.table_name = c.table_name::text and e.column_name = c.column_name::text
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
    group by c.table_name
  ),
  member_tables as (
    select t.*,
           case
             when t.table_name = 'member' then 't.venue_id = $1 and t.id = $2'
             when t.table_name = 'ledger_entry' then
               't.venue_id = $1 and t.account_id in (select a.id from public.ledger_account a where a.venue_id = $1 and a.member_id = $2)'
             when t.table_name = 'seat_move' then
               't.venue_id = $1 and t.session_id in (select s.id from public.seat_session s where s.venue_id = $1 and s.member_id = $2)'
             else format('t.venue_id = $1 and (%s)', t.member_match)
           end as predicate
    from tables t
    where t.table_name not in ('sar_entry', 'sar_entry_transaction')
      and (t.table_name in ('member', 'ledger_entry', 'seat_move') or (t.has_venue and t.member_match is not null))
  )
  select t.table_name, t.table_name, t.column_names,
         case when t.table_name = 'venue' then 't.id = $1' when t.has_venue then 't.venue_id = $1' else 'true' end, '{}'::text[]
  from tables t
  where not p_for_member
  union all
  select m.table_name, m.table_name, m.owed_names, m.predicate, coalesce(m.other_names, '{}')
  from member_tables m
  where p_for_member and m.owed_names is not null
  union all
  select 'staff-notes/' || m.table_name, m.table_name, array['id'] || m.note_names, m.predicate, '{}'::text[]
  from member_tables m
  where p_for_member and m.note_names is not null
  order by 1;
$$;

revoke execute on function private.member_export_columns(), private.export_archive_tables(boolean) from public, anon, authenticated;

-- As before (20261027200200_export_archive.sql), counting each entry's rows in its source table; the total leaves out
-- the staff-notes entries, whose rows their table already counts.
create or replace function private.start_export_archive(p_venue_id uuid, p_member_id uuid, p_kyc_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(coalesce(p_kyc_reason, '')), '');
  v_recipient text;
  v_alert_rows integer := coalesce((private.setting_at(p_venue_id, 'exports.alert_rows', '', now()) ->> 'rows')::integer, 1000);
  v_table record;
  v_rows bigint;
  v_counts jsonb := '{}'::jsonb;
  v_tables jsonb := '[]'::jsonb;
  v_id uuid;
begin
  perform private.assert_may_export_archive(p_venue_id, p_member_id);
  if v_reason is not null and (p_member_id is not null or length(v_reason) not between 10 and 500) then
    raise exception 'KYC photos go in a full archive only, with a reason of 10 to 500 characters' using errcode = '22023';
  end if;
  v_recipient := private.setting_at(p_venue_id, 'exports.archive_recipient', '', now()) ->> 'recipient';
  if v_recipient is null then
    raise exception 'Set the owner''s backup key (exports.archive_recipient) first' using errcode = 'RVKEY';
  end if;
  for v_table in select * from private.export_archive_tables(p_member_id is not null) loop
    execute format('select count(*) from public.%I t where %s', v_table.source_table, v_table.predicate) using p_venue_id, p_member_id into v_rows;
    v_counts := v_counts || jsonb_build_object(v_table.table_name, v_rows);
    v_tables := v_tables || jsonb_build_array(jsonb_build_object('name', v_table.table_name, 'columns', to_jsonb(v_table.column_names)));
  end loop;
  -- A staff-notes entry is rows already counted with its table, and not a table of its own.
  v_rows := (select coalesce(sum(c.value::bigint), 0) from jsonb_each(v_counts) c where c.key not like 'staff-notes/%');
  insert into private.export_archive (venue_id, member_id, started_by, kyc_reason)
  values (p_venue_id, p_member_id, (select auth.uid()), v_reason)
  returning id into v_id;
  perform private.audit(p_venue_id, case when p_member_id is null then 'export.archive' else 'export.member' end,
                        case when p_member_id is null then 'venue' else 'member' end, coalesce(p_member_id, p_venue_id)::text, null,
                        jsonb_build_object('archive', v_id, 'tables', (select count(*) from jsonb_array_elements(v_tables) e where e ->> 'name' not like 'staff-notes/%'), 'rows', v_rows,
                                           'kyc_photos', v_reason is not null, 'counts', v_counts),
                        v_reason);
  if v_rows >= v_alert_rows then
    -- No personal data in an alert: the audit log holds who, and which member.
    perform private.raise_alert(p_venue_id, 'export.large', jsonb_build_object(
      'what', case when p_member_id is null then 'Full archive' else 'Member export' end, 'format', 'archive', 'rows', v_rows));
  end if;
  return jsonb_build_object('archive_id', v_id, 'recipient', v_recipient, 'tables', v_tables);
end;
$$;

-- As before (20261027200200_export_archive.sql), reading each entry from its source table, and blanking another member's
-- id where the entry says so.
create or replace function private.export_archive_rows(p_archive_id uuid, p_table text, p_after jsonb, p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set "TimeZone" = 'UTC'
as $$
declare
  v_archive private.export_archive;
  v_table record;
  v_key text[];
  v_order text;
  v_last_first text;
  v_after text := '';
  v_rows jsonb;
  v_last jsonb;
begin
  select * into v_archive from private.export_archive a
  where a.id = p_archive_id and a.started_by = (select auth.uid()) and a.expires_at > now();
  if not found then
    raise exception 'No archive of yours under way: start it again' using errcode = '42501';
  end if;
  perform private.assert_may_export_archive(v_archive.venue_id, v_archive.member_id);
  if p_limit is null or p_limit not between 1 and 5000 then
    raise exception 'Pages of 1 to 5,000 rows' using errcode = '22023';
  end if;
  select * into v_table from private.export_archive_tables(v_archive.member_id is not null) t where t.table_name = p_table;
  if not found then
    raise exception 'Not a table this archive holds' using errcode = '22023';
  end if;
  select array_agg(a.attname::text order by k.position) into v_key
  from pg_index i
  cross join unnest(i.indkey) with ordinality k(attnum, position)
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
  where i.indrelid = format('public.%I', v_table.source_table)::regclass and i.indisprimary;
  v_order := (select string_agg(format('t.%I', c), ', ') from unnest(v_key) c);
  -- Descending on every key column, so the page's last row is its last by the whole key.
  v_last_first := (select string_agg(format('t.%I desc', c), ', ') from unnest(v_key) c);
  if p_after is not null and p_after <> 'null'::jsonb then
    v_after := format(' and (%s) > (select %s from jsonb_populate_record(null::public.%I, $3) a)',
                      v_order, (select string_agg(format('a.%I', c), ', ') from unnest(v_key) c), v_table.source_table);
  end if;
  -- The page is taken first, by the primary key's index, then turned into cells in the same order.
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(array[%s]::text[]) order by %s), ''[]''), (array_agg(jsonb_build_object(%s) order by %s))[1]
     from (select * from public.%I t where (%s)%s order by %s limit $4) t',
    -- Another member's id is given only where it is this member's own (#498).
    (select string_agg(case when c <> all(v_table.blanked) then format('t.%I::text', c)
                            when exists (select 1 from pg_attribute a where a.attrelid = format('public.%I', v_table.source_table)::regclass
                                         and a.attname = c and a.atttypid = 'uuid[]'::regtype)
                              then format('(case when $2 = any(t.%I) then array[$2] end)::text', c)
                            else format('(case when t.%I = $2 then t.%I end)::text', c, c) end, ', ')
     from unnest(v_table.column_names) c), v_order,
    (select string_agg(format('%L, t.%I', c, c), ', ') from unnest(v_key) c), v_last_first,
    v_table.source_table, v_table.predicate, v_after, v_order)
  using v_archive.venue_id, v_archive.member_id, p_after, p_limit
  into v_rows, v_last;
  return jsonb_build_object('rows', v_rows, 'after', case when jsonb_array_length(v_rows) = p_limit then v_last end);
end;
$$;

