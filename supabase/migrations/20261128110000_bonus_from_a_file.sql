-- Bonus added and used from a file (the owner, 22 Nov; decision 0707). A super admin chooses a CSV or .xlsx file on Members
-- whose lines each name a member (number or phone), Add or Use, chips and a reason; the console shows every line with the
-- member's name (private.bonus_file_members), and Save sends the file (private.bonus_from_file): every line or none.
-- - Super admins only. The cap on one Bonus by hand and the daily limit don't bind them (#996), so no line is capped.
-- - An Add is Bonus given by hand (private.credit_bonus, keyed bonus.hand:file:<file>:<line>, so Reports counts and lists it
--   as by hand, with the super admin who saved the file): the club's usual expiry, what is owed paid first, and told to the
--   member (bonus.credited).
-- - A Use needs no check-in and no visit cap: it is a record tied to no visit or seat, a bonus_redemption with neither,
--   posted as a use without a seat is, member.bonus to venue.chips_outstanding. Never more than the Bonus in force, and
--   none while any is owed. Told to the member (bonus.redeemed, with no table). It is in the report's Bonus used and in the
--   Bonus histories with no table; the Door and Players visits show a visit's uses alone (private.players_by_seat joins
--   each use to its visit), so not these.
-- - Each line is kept in the audit log with its reason as bonus.file, with added_chips or used_chips. One action of its own,
--   as a member's History makes one change of the rows a save writes at one moment (private.member_staff_history): a
--   member's Add and Use in one file read as one change from a file, with both figures, never as a gift alone. Activity
--   counts it among the Bonus changes and shows an Add's chips, as for Bonus given by hand.
-- - Lines go in the file's order, so a Use may spend an Add above it for the same member.
-- - A refusal names the file's line in its detail, and undoes the whole file.
-- - The same file again (its request id) changes nothing and gives the same count.

-- A use is a seat's (its session and table), a visit's without a seat (the visit, and a reason), or a file's (a reason alone).
alter table public.bonus_redemption
  drop constraint bonus_redemption_seat_or_visit_check,
  add constraint bonus_redemption_seat_or_visit_check check (
    (session_id is not null and table_id is not null and visit_id is null and (reason is null) = (used_at is null))
    or (session_id is null and table_id is null and visit_id is not null and reason is not null and used_at is null)
    or (session_id is null and table_id is null and visit_id is null and reason is not null and used_at is null));
comment on table public.bonus_redemption is
  'Bonus a member used: with their buy-in as they were seated (decision 0504), added after on a past seat (#1077), without a seat during a visit (the owner, 20 Nov), or from a file a super admin saved, with no visit (the owner, 22 Nov).';

-- The members a file's lines name, for its preview: each key (a member number, or a phone as +91 and ten digits) that names
-- a member of the venue, with their name, Bonus in force, what they owe, and whether they are the reader's own record. For
-- the venue's super admins; nothing for anyone else. 500 keys at most, as a file holds.
create function private.bonus_file_members(p_venue_id uuid, p_keys text[])
returns table (key text, member_id uuid, member_number bigint, full_name text, in_force_paise bigint, owed_paise bigint, is_own boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select k.key, m.id, m.member_number, m.full_name, private.bonus_in_force(m.id, now()), private.bonus_owed_by(m.id),
         private.is_own_cage_record(m.id) or coalesce(private.is_own_kyc_check(m.id), false)
  from (select distinct unnest(p_keys[1:500]) as key) k
  join public.member m
    on m.venue_id = p_venue_id and m.erased_at is null
   and (m.member_number = case when k.key ~ '^[0-9]{1,15}$' then k.key::bigint end or m.phone = k.key)
  where coalesce(private.is_super_admin(p_venue_id), false);
$$;

create function public.bonus_file_members(p_venue_id uuid, p_keys text[])
returns table (key text, member_id uuid, member_number bigint, full_name text, in_force_paise bigint, owed_paise bigint, is_own boolean)
language sql
stable
set search_path = ''
as $$ select * from private.bonus_file_members(p_venue_id, p_keys); $$;
revoke all on function private.bonus_file_members(uuid, text[]) from public, anon;
grant execute on function private.bonus_file_members(uuid, text[]) to authenticated;
revoke all on function public.bonus_file_members(uuid, text[]) from public, anon;
grant execute on function public.bonus_file_members(uuid, text[]) to authenticated;

-- The id of a file's use on its nth line: the same file again gives the same ids.
create function private.bonus_file_use_id(p_request_id uuid, p_n integer)
returns uuid
language sql
immutable
set search_path = ''
as $$ select md5(p_request_id::text || ':' || p_n)::uuid; $$;
revoke all on function private.bonus_file_use_id(uuid, integer) from public, anon, authenticated;

-- Whether the file with this request id was saved: its first line is there, as given (the file went whole or not at all).
-- A refusal (22023) when the id holds anything else.
create function private.bonus_file_replayed(p_venue_id uuid, p_lines jsonb, p_request_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_first jsonb := p_lines -> 0;
  v_grant public.bonus_grant;
  v_use public.bonus_redemption;
begin
  select * into v_grant from public.bonus_grant g
  where g.venue_id = p_venue_id and g.idempotency_key = 'bonus.hand:file:' || p_request_id || ':1';
  select * into v_use from public.bonus_redemption r where r.id = private.bonus_file_use_id(p_request_id, 1);
  if v_grant.id is null and v_use.id is null then
    return false;
  end if;
  if (v_grant.id is not null and (v_first ->> 'kind' is distinct from 'add' or v_grant.member_id::text is distinct from v_first ->> 'member_id'
                                  or v_grant.amount_paise is distinct from (v_first ->> 'chips')::bigint * 100))
     or (v_use.id is not null and (v_first ->> 'kind' is distinct from 'use' or v_use.member_id::text is distinct from v_first ->> 'member_id'
                                   or v_use.amount_paise is distinct from (v_first ->> 'chips')::bigint * 100 or v_use.venue_id <> p_venue_id)) then
    raise exception 'That request id was used for another file' using errcode = '22023';
  end if;
  return true;
end;
$$;
revoke all on function private.bonus_file_replayed(uuid, jsonb, uuid) from public, anon, authenticated;

-- A file's lines in its order: n, the place in the array (1 first); line, the line of the file the console read it from.
create function private.bonus_file_lines(p_lines jsonb)
returns table (n integer, line integer, member_id uuid, kind text, chips integer, reason text)
language sql
immutable
set search_path = ''
as $$
  select o.n::integer, coalesce(r.line, o.n::integer), r.member_id, r.kind, r.chips, btrim(coalesce(r.reason, ''))
  from jsonb_array_elements(p_lines) with ordinality o(value, n)
  cross join lateral jsonb_to_record(o.value) as r(line integer, member_id uuid, kind text, chips integer, reason text)
  order by o.n;
$$;
revoke all on function private.bonus_file_lines(jsonb) from public, anon, authenticated;

-- Adds and uses a file's Bonus (above), resolving to how many lines went. Refusals, each naming the file's line in its
-- detail where there is one: 42501 not a super admin of the venue; 22023 no lines, more than 500, no request id, a request
-- id used for another file, a line with no member of the venue (or one erased), with a type not add or use, or with no reason
-- of 3 to 200 characters; RVOWN the super admin's own record; RVCHP not whole 50s from 50 to 1,00,000; RVKIL/RVFRZ/RVMBR
-- promotions stopped or frozen; RVRAT too many a minute; RVBON a use of more than the Bonus in force then, or while some
-- is owed.
create function private.bonus_from_file(p_venue_id uuid, p_lines jsonb, p_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line record;
  v_members uuid[];
  v_member uuid;
  v_locked integer;
  v_amount bigint;
  v_grant_id uuid;
  v_use_id uuid;
  v_ids uuid[];
  v_remaining bigint[];
  v_expires timestamptz[];
  v_result text;
  v_taken bigint[];
  v_txn uuid;
  v_staff uuid;
begin
  if p_venue_id is null or not coalesce(private.is_super_admin(p_venue_id), false) then
    raise exception 'Only super admins add or use Bonus from a file' using errcode = '42501';
  end if;
  if p_request_id is null or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 500 then
    raise exception 'One to 500 lines, and a request id' using errcode = '22023';
  end if;
  -- A file that went through is answered before anything that refuses a new one.
  if private.bonus_file_replayed(p_venue_id, p_lines, p_request_id) then
    return jsonb_array_length(p_lines);
  end if;
  perform private.assert_writable(p_venue_id, 'promotions');
  perform private.assert_rate(p_venue_id, 'bonus.file');
  -- Every line is checked before anything is locked or written.
  for v_line in select * from private.bonus_file_lines(p_lines) loop
    if v_line.member_id is null
       or not exists (select 1 from public.member m where m.id = v_line.member_id and m.venue_id = p_venue_id and m.erased_at is null) then
      raise exception 'Line %: no such member here', v_line.line using errcode = '22023', detail = v_line.line::text;
    end if;
    if v_line.kind is null or v_line.kind not in ('add', 'use') then
      raise exception 'Line %: Add or Use', v_line.line using errcode = '22023', detail = v_line.line::text;
    end if;
    if v_line.chips is null or v_line.chips < 50 or v_line.chips > 100000 or v_line.chips % 50 <> 0 then
      raise exception 'Line %: whole fifties from 50 to 1,00,000 chips', v_line.line using errcode = 'RVCHP', detail = v_line.line::text;
    end if;
    if length(v_line.reason) not between 3 and 200 then
      raise exception 'Line %: a reason of 3 to 200 characters', v_line.line using errcode = '22023', detail = v_line.line::text;
    end if;
    if private.is_own_cage_record(v_line.member_id) or coalesce(private.is_own_kyc_check(v_line.member_id), false) then
      raise exception 'Line %: staff never change Bonus on their own record', v_line.line using errcode = 'RVOWN', detail = v_line.line::text;
    end if;
    perform private.assert_writable(p_venue_id, 'promotions', v_line.member_id);
  end loop;
  -- The members' rows, then their Bonus locks, each in the members' id order, so two files, or a file and a use at a seat
  -- or without one (the member's row first: private.use_bonus sets out the order), wait in turn and never on each other.
  select array_agg(distinct l.member_id order by l.member_id) into v_members from private.bonus_file_lines(p_lines) l;
  select count(*) into v_locked
  from (select 1 from public.member m where m.id = any(v_members) and m.erased_at is null order by m.id for no key update) l;
  if v_locked <> cardinality(v_members) then
    raise exception 'A member of the file was erased' using errcode = '22023';
  end if;
  -- The same file at the same moment waited above for the first, and is answered as it.
  if private.bonus_file_replayed(p_venue_id, p_lines, p_request_id) then
    return jsonb_array_length(p_lines);
  end if;
  foreach v_member in array v_members loop
    perform pg_advisory_xact_lock(hashtextextended('bonus:' || v_member::text, 0));
  end loop;
  v_staff := private.current_staff_id(p_venue_id);
  for v_line in select * from private.bonus_file_lines(p_lines) loop
    v_amount := v_line.chips::bigint * 100;
    if v_line.kind = 'add' then
      v_grant_id := private.credit_bonus(p_venue_id, v_line.member_id, v_amount, v_line.reason, null,
                                         'bonus.hand:file:' || p_request_id || ':' || v_line.n);
      perform private.audit(p_venue_id, 'bonus.file', 'member', v_line.member_id::text, null,
                            jsonb_build_object('added_chips', v_line.chips, 'bonus_grant_id', v_grant_id, 'bonus_file_id', p_request_id,
                                               'line', v_line.line), v_line.reason);
      continue;
    end if;
    -- No Bonus is used while any is owed (#1077): new Bonus pays it first, an Add above in the file among it.
    if private.bonus_owed_by(v_line.member_id) > 0 then
      raise exception 'Line %: Bonus is owed, none to use until new Bonus pays it', v_line.line using errcode = 'RVBON', detail = v_line.line::text;
    end if;
    select array_agg(g.id order by g.created_at, g.id), array_agg(g.remaining_paise order by g.created_at, g.id),
           array_agg(g.expires_at order by g.created_at, g.id)
    into v_ids, v_remaining, v_expires
    from (select g.id, g.created_at, g.remaining_paise, private.bonus_end_in_force(g.venue_id, g.expires_at) as expires_at
          from public.bonus_grant g where g.member_id = v_line.member_id and g.expired_at is null for update) g;
    select d.result, d.taken into v_result, v_taken from private.bonus_draws(v_amount, v_remaining, v_expires, now()) d;
    if v_result <> 'ok' then
      raise exception 'Line %: more than the Bonus in force', v_line.line using errcode = 'RVBON', detail = v_line.line::text;
    end if;
    for i in 1 .. coalesce(array_length(v_ids, 1), 0) loop
      continue when v_taken[i] = 0;
      update public.bonus_grant set remaining_paise = remaining_paise - v_taken[i] where id = v_ids[i];
    end loop;
    v_use_id := private.bonus_file_use_id(p_request_id, v_line.n);
    v_txn := private.post_ledger_transaction(p_venue_id, 'bonus_buy_in', 'bonus_file_use:' || v_use_id,
      jsonb_build_array(
        jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = v_line.member_id and a.code = 'member.bonus'),
                           'amount', v_amount::text),
        jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id
                                           and a.code = 'venue.chips_outstanding'), 'amount', (-v_amount)::text)),
      'promotions', 'Bonus used from a file');
    insert into public.bonus_redemption (id, venue_id, member_id, amount_paise, ledger_transaction_id, staff_id, reason)
    values (v_use_id, p_venue_id, v_line.member_id, v_amount, v_txn, v_staff, v_line.reason);
    perform private.audit(p_venue_id, 'bonus.file', 'member', v_line.member_id::text, null,
                          jsonb_build_object('used_chips', v_line.chips, 'bonus_redemption_id', v_use_id, 'bonus_file_id', p_request_id,
                                             'line', v_line.line), v_line.reason);
    -- No table: the member's app and push say it was used, with no table (packages/contracts bonusRedeemedSchema).
    perform private.emit(p_venue_id, 'bonus.redeemed',
                         jsonb_build_object('bonus_redemption_id', v_use_id, 'member_id', v_line.member_id, 'amount_paise', v_amount,
                                            'table_id', null, 'table_name', null),
                         'bonus.redeemed:' || v_use_id);
  end loop;
  return jsonb_array_length(p_lines);
end;
$$;

create function public.bonus_from_file(p_venue_id uuid, p_lines jsonb, p_request_id uuid)
returns integer
language sql
set search_path = ''
as $$ select private.bonus_from_file(p_venue_id, p_lines, p_request_id); $$;
revoke all on function private.bonus_from_file(uuid, jsonb, uuid) from public, anon;
grant execute on function private.bonus_from_file(uuid, jsonb, uuid) to authenticated;
revoke all on function public.bonus_from_file(uuid, jsonb, uuid) from public, anon;
grant execute on function public.bonus_from_file(uuid, jsonb, uuid) to authenticated;

-- As 20261128100000_bonus_use_without_seat.sql made it, with a file's lines among the Bonus changes.
CREATE OR REPLACE FUNCTION private.activity_kind(p_action text, p_entity text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_entity = 'control_state' then 'controls'
    when p_action like 'export.%' or p_entity = 'export_archive' then 'exports'
    when p_entity in ('staff', 'staff_credential', 'staff_shift', 'staff_attendance') then 'staff'
    when p_action in ('bonus.give', 'high_hand.pay', 'bonus.approve', 'bonus.refuse', 'bonus.reverse', 'bonus.use_add', 'bonus.use', 'bonus.file')
         or p_entity in ('bonus_grant', 'bonus_redemption', 'bonus_owed', 'high_hand_hit', 'promotion_bonus_decision') then 'bonus_chips'
    when p_entity in ('member_tier_change', 'tier', 'tier_feature') then 'tiers'
    when p_action like 'member.%' or p_action like 'kyc_image.%'
         or p_entity in ('member', 'member_limit', 'member_feature_override', 'self_exclusion', 'consent', 'sign_up_attribution') then 'members'
    when p_entity in ('setting', 'venue', 'venue_config', 'device', 'tablet_assignment', 'tv_screen', 'camera', 'storage_object') then 'settings'
    when p_entity in ('game_table', 'table_type', 'waitlist_entry', 'seat_session', 'seat_move', 'visit', 'early_departure',
                      'early_departure_withdrawal', 'down_count', 'dealer_down', 'hand') then 'floor'
    else 'other'
  end;
$function$;

-- As 20261127080000_activity_names_member_ids.sql made it, with a file's Add showing its chips as Bonus given by hand does.
create or replace view private.activity_line with (security_invoker = true) as
SELECT l.venue_id,
    l.id,
    l.occurred_at,
    w.name AS who,
    l.actor_user_id IS NULL AS is_system,
    l.action,
    l.entity,
    private.activity_kind(l.action, l.entity) AS kind,
    COALESCE(
        CASE
            WHEN rm.erased_at IS NULL THEN rm.full_name
            ELSE NULL::text
        END, rs.full_name,
        CASE
            WHEN l.entity = 'table'::text THEN l.entity_id
            WHEN l.entity = 'promotion_bonus_decision'::text AND NOT l.after ? 'member_id'::text THEN l.after ->> 'grants'::text
            ELSE NULL::text
        END) AS about,
        CASE
            WHEN rm.erased_at IS NULL OR l.action = 'member.erase'::text THEN l.reason
            ELSE NULL::text
        END AS reason,
        CASE
            WHEN l.action = ANY (ARRAY['bonus.give'::text, 'high_hand.pay'::text, 'bonus.approve'::text, 'bonus.refuse'::text]) THEN (l.after ->> 'chips'::text)::bigint
            WHEN l.action = 'bonus.file'::text THEN (l.after ->> 'added_chips'::text)::bigint
            ELSE NULL::bigint
        END AS amount,
        CASE
            WHEN l.action = 'high_hand.pay'::text THEN jsonb_build_object('table', l.after ->> 'table'::text, 'seat', l.after -> 'seat'::text, 'hand', l.after ->> 'hand'::text, 'rank', l.after -> 'rank'::text)
            ELSE NULL::jsonb
        END AS high_hand,
    -- Who is a member only where no staff name stands first, and while they are not erased, as `who` reads.
        CASE
            WHEN s.full_name IS NULL AND a.erased_at IS NULL THEN a.id
            ELSE NULL::uuid
        END AS who_member_id,
    -- About is a member only while they are not erased, as `about` reads.
        CASE
            WHEN rm.erased_at IS NULL THEN rm.id
            ELSE NULL::uuid
        END AS about_member_id
   FROM public.audit_log l
     LEFT JOIN public.staff s ON s.user_id = l.actor_user_id AND s.venue_id = l.venue_id
     LEFT JOIN public.member a ON a.user_id = l.actor_user_id AND a.venue_id = l.venue_id
     LEFT JOIN public.device d ON d.id = l.device_id AND d.venue_id = l.venue_id
     CROSS JOIN LATERAL ( SELECT COALESCE(s.full_name,
                CASE
                    WHEN a.erased_at IS NULL THEN a.full_name
                    ELSE NULL::text
                END, d.name) AS name) w
     LEFT JOIN LATERAL ( SELECT COALESCE(
                CASE
                    WHEN l.entity = 'member'::text THEN l.entity_id
                    ELSE NULL::text
                END, l.after ->> 'member_id'::text, l.before ->> 'member_id'::text) AS member_id,
            COALESCE(
                CASE
                    WHEN l.entity = 'staff'::text THEN l.entity_id
                    ELSE NULL::text
                END, l.after ->> 'staff_id'::text, l.before ->> 'staff_id'::text) AS staff_id) t ON true
     LEFT JOIN public.member rm ON rm.id = private.uuid_or_null(t.member_id) AND rm.venue_id = l.venue_id
     LEFT JOIN public.staff rs ON rs.id = private.uuid_or_null(t.staff_id) AND rs.venue_id = l.venue_id;
