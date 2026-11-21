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
-- - Each member of a file is kept in the audit log once, as bonus.file: their added_chips and used_chips in the file, its
--   lines and their reasons. A member's History makes one change of the rows a save writes at one moment
--   (private.member_staff_history), so one row with the sums reads right, where a row a line would read an Add and a Use as
--   a gift, and two Adds of 500 as one. Activity counts it among the Bonus changes and shows the chips added.
-- - Lines go in the file's order, so a Use may spend an Add above it for the same member. A Use before a visit's first Bonus
--   use lowers that visit's cap, which is a share of what is held until then (decision 0706).
-- - A refusal names the file's line in its detail, a frozen member's too, and undoes the whole file.
-- - The same file again (its request id) changes nothing and gives the same count; another file under that id is refused.

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
-- a member of the venue, with their name, Bonus in force, what they owe, whether they are the reader's own record, and
-- whether they are frozen. For the venue's super admins; nothing for anyone else. 500 keys at most, as a file holds.
create function private.bonus_file_members(p_venue_id uuid, p_keys text[])
returns table (key text, member_id uuid, member_number bigint, full_name text, in_force_paise bigint, owed_paise bigint, is_own boolean,
               is_frozen boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select k.key, m.id, m.member_number, m.full_name, private.bonus_in_force(m.id, now()), private.bonus_owed_by(m.id),
         private.is_own_cage_record(m.id) or coalesce(private.is_own_kyc_check(m.id), false),
         exists (select 1 from public.control_state c where c.venue_id = p_venue_id and c.level = 'member_freeze' and c.member_id = m.id
                 and c.released_at is null)
  from (select distinct unnest(p_keys[1:500]) as key) k
  join public.member m
    on m.venue_id = p_venue_id and m.erased_at is null
   and (m.member_number = case when k.key ~ '^[0-9]{1,15}$' then k.key::bigint end or m.phone = k.key)
  where coalesce(private.is_super_admin(p_venue_id), false);
$$;

create function public.bonus_file_members(p_venue_id uuid, p_keys text[])
returns table (key text, member_id uuid, member_number bigint, full_name text, in_force_paise bigint, owed_paise bigint, is_own boolean,
               is_frozen boolean)
language sql
stable
set search_path = ''
as $$ select * from private.bonus_file_members(p_venue_id, p_keys); $$;
revoke all on function private.bonus_file_members(uuid, text[]) from public, anon;
grant execute on function private.bonus_file_members(uuid, text[]) to authenticated;
revoke all on function public.bonus_file_members(uuid, text[]) from public, anon;
grant execute on function public.bonus_file_members(uuid, text[]) to authenticated;

-- The id of a file's use on its nth line: the same file again gives the same ids. A version-4 id (its version and variant
-- digits set), as every consumer of bonus.redeemed checks its ids (packages/contracts bonusRedeemedSchema).
create function private.bonus_file_use_id(p_request_id uuid, p_n integer)
returns uuid
language sql
immutable
set search_path = ''
as $$ select overlay(overlay(md5(p_request_id::text || ':' || p_n) placing '4' from 13) placing '8' from 17)::uuid; $$;
revoke all on function private.bonus_file_use_id(uuid, integer) from public, anon, authenticated;

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

-- What the file with this request id saved at its nth place: the member, Add or Use, and chips; no row when nothing.
create function private.bonus_file_saved_line(p_venue_id uuid, p_request_id uuid, p_n integer)
returns table (member_id uuid, kind text, chips bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select g.member_id, 'add', g.amount_paise / 100 from public.bonus_grant g
  where g.venue_id = p_venue_id and g.idempotency_key = 'bonus.hand:file:' || p_request_id || ':' || p_n
  union all
  select r.member_id, 'use', r.amount_paise / 100 from public.bonus_redemption r
  where r.id = private.bonus_file_use_id(p_request_id, p_n) and r.venue_id = p_venue_id and r.session_id is null and r.visit_id is null;
$$;
revoke all on function private.bonus_file_saved_line(uuid, uuid, integer) from public, anon, authenticated;

-- Whether the file with this request id was saved: every line there as given, and nothing past its last (a file goes whole
-- or not at all, so nothing at its first place is nothing saved). A refusal (22023) when the id holds any other file.
create function private.bonus_file_replayed(p_venue_id uuid, p_lines jsonb, p_request_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_line record;
  v_saved record;
  v_same integer := 0;
begin
  for v_line in select * from private.bonus_file_lines(p_lines) loop
    select * into v_saved from private.bonus_file_saved_line(p_venue_id, p_request_id, v_line.n);
    continue when not found;
    if v_saved.member_id is distinct from v_line.member_id or v_saved.kind is distinct from v_line.kind
       or v_saved.chips is distinct from v_line.chips::bigint then
      raise exception 'That request id was used for another file' using errcode = '22023';
    end if;
    v_same := v_same + 1;
  end loop;
  if v_same = 0 then
    return false;
  end if;
  if v_same < jsonb_array_length(p_lines)
     or exists (select 1 from private.bonus_file_saved_line(p_venue_id, p_request_id, jsonb_array_length(p_lines) + 1)) then
    raise exception 'That request id was used for another file' using errcode = '22023';
  end if;
  return true;
end;
$$;
revoke all on function private.bonus_file_replayed(uuid, jsonb, uuid) from public, anon, authenticated;

-- Adds and uses a file's Bonus (above), resolving to how many lines went. Refusals, each naming the file's line in its
-- detail where there is one: 42501 not a super admin of the venue; 22023 no lines, more than 500, no request id, a request
-- id used for another file, a line with no member of the venue (or one erased), with a type not add or use, or with no reason
-- of 3 to 200 characters; RVOWN the super admin's own record; RVCHP not whole 50s from 50 to 1,00,000; RVKIL/RVFRZ
-- promotions stopped or the venue frozen; RVMBR a line's member frozen; RVRAT more than five files a minute; RVBON a use of
-- more than the Bonus in force then, or while some is owed.
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
  -- One attempt at a time under a request id: a second waits here for the first, so two files under one id never both go.
  perform pg_advisory_xact_lock(hashtextextended('bonus.file:' || p_request_id::text, 0));
  -- A file that went through is answered before anything that refuses a new one.
  if private.bonus_file_replayed(p_venue_id, p_lines, p_request_id) then
    return jsonb_array_length(p_lines);
  end if;
  perform private.assert_writable(p_venue_id, 'promotions');
  -- A file is up to 500 changes and as many messages: five a minute for a super admin, ten for the venue.
  perform private.assert_rate(p_venue_id, 'bonus.file', 5, 10);
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
    -- The venue's freeze and stop were checked above; a member's freeze names the line.
    begin
      perform private.assert_writable(p_venue_id, 'promotions', v_line.member_id);
    exception when sqlstate 'RVMBR' then
      raise exception 'Line %: the member is frozen', v_line.line using errcode = 'RVMBR', detail = v_line.line::text;
    end;
  end loop;
  -- The members' rows, then their Bonus locks, each in the members' id order, so two files, or a file and a use at a seat
  -- or without one (the member's row first: private.use_bonus sets out the order), wait in turn and never on each other.
  -- An erasure still takes the Bonus lock first (#1111): with a file naming that member at that moment, Postgres ends one of
  -- the two as a deadlock, and nothing of it is written.
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
      perform private.credit_bonus(p_venue_id, v_line.member_id, v_amount, v_line.reason, null,
                                   'bonus.hand:file:' || p_request_id || ':' || v_line.n);
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
    -- No table: the member's app and push say it was used, with no table (packages/contracts bonusRedeemedSchema).
    perform private.emit(p_venue_id, 'bonus.redeemed',
                         jsonb_build_object('bonus_redemption_id', v_use_id, 'member_id', v_line.member_id, 'amount_paise', v_amount,
                                            'table_id', null, 'table_name', null),
                         'bonus.redeemed:' || v_use_id);
  end loop;
  -- Each member once in the audit log: the chips added and used (either left out when none), the lines, and their reasons
  -- in the order they first come.
  foreach v_member in array v_members loop
    perform private.audit(p_venue_id, 'bonus.file', 'member', v_member::text, null,
      (select jsonb_strip_nulls(jsonb_build_object('added_chips', sum(l.chips) filter (where l.kind = 'add'),
                                                   'used_chips', sum(l.chips) filter (where l.kind = 'use'),
                                                   'lines', jsonb_agg(l.line order by l.n), 'bonus_file_id', p_request_id))
       from private.bonus_file_lines(p_lines) l where l.member_id = v_member),
      (select string_agg(r.reason, '; ' order by r.first_n)
       from (select l.reason, min(l.n) as first_n from private.bonus_file_lines(p_lines) l where l.member_id = v_member group by l.reason) r));
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

-- As 20261128100000_bonus_use_without_seat.sql made it, with a file's use (no seat and no visit) refused as another use's,
-- never answered as a use without a seat, which always names its visit.
CREATE OR REPLACE FUNCTION private.bonus_use_replayed(p_request_id uuid, p_member_id uuid, p_amount_paise bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_replay public.bonus_redemption;
begin
  select * into v_replay from public.bonus_redemption r where r.id = p_request_id;
  if v_replay.id is null then
    return false;
  end if;
  if v_replay.member_id <> p_member_id or v_replay.amount_paise <> p_amount_paise or v_replay.session_id is not null
     or v_replay.visit_id is null then
    raise exception 'That request id was used for another Bonus use' using errcode = '22023';
  end if;
  return true;
end;
$function$;

-- As 20261127070000_member_staff_history.sql made it, with a change from a Bonus file showing its own row's figures alone
-- (added_chips, used_chips): the rows its grants and uses wrote at the same moment would add an amount for each with no word
-- of which was given and which used, and say two of the same amount once.
create or replace function private.member_staff_history(p_venue_id uuid, p_member_id uuid, p_limit integer)
returns table (id bigint, occurred_at timestamptz, who text, action text, entity text, reason text, changes jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with member as materialized (
    select m.id, m.user_id, m.erased_at is not null as is_erased
    from public.member m
    where m.id = p_member_id and m.venue_id = p_venue_id and (select private.has_permission(p_venue_id, 'members.phone'))
  ), grouped as materialized (
    -- One change is one action: the rows it wrote share its time and its actor. Its own named action, where it has one,
    -- says what it was; otherwise its first row.
    select l.occurred_at, max(l.id) as id, min(s.full_name) as who,
           (array_agg(l.action order by l.action in ('insert', 'update', 'delete'), l.id))[1] as action,
           (array_agg(l.entity order by l.action in ('insert', 'update', 'delete'), l.id))[1] as entity,
           (array_agg(l.reason order by l.id) filter (where l.reason is not null))[1] as reason,
           array_agg(l.id) as line_ids
    from member m
    join public.audit_log l
      on l.venue_id = p_venue_id and l.actor_user_id is not null
     and coalesce(case when l.entity = 'member' then l.entity_id end, l.after ->> 'member_id', l.before ->> 'member_id') = m.id::text
    join public.staff s on s.user_id = l.actor_user_id and s.venue_id = l.venue_id
    where l.actor_user_id is distinct from m.user_id
      and l.action not like '%.view' and l.action not like 'export.%'
      -- Who was frozen and why is the super admins' alone (#493): a freeze's lines only for those who read Activity.
      and (l.entity <> 'control_state' or (select private.has_permission(p_venue_id, 'activity.read')))
      and l.entity = any (array['member', 'kyc_record', 'kyc_review', 'kyc_document', 'bonus_grant', 'bonus_redemption', 'promotion_grant',
                                'visit', 'seat_session', 'waitlist_entry', 'early_departure', 'promotion_step_skip', 'member_tier_change',
                                'member_feature_override', 'member_limit', 'self_exclusion', 'control_state', 'consent', 'referral'])
    group by l.occurred_at, l.actor_user_id
    order by l.occurred_at desc, max(l.id) desc
    limit least(greatest(coalesce(p_limit, 20), 1), 500)
  )
  select g.id, g.occurred_at, g.who, g.action, g.entity,
         case when not m.is_erased or g.action = 'member.erase' then g.reason end,
         case when m.is_erased then '[]'::jsonb else coalesce((
           select jsonb_agg(distinct c.change)
           from public.audit_log a
           cross join lateral jsonb_array_elements(private.staff_history_changes(p_venue_id, a.entity, a.before, a.after)) c(change)
           where a.venue_id = p_venue_id and a.id = any (g.line_ids)
             and (g.action is distinct from 'bonus.file' or a.action = 'bonus.file')), '[]'::jsonb) end
  from grouped g
  cross join member m
  order by g.occurred_at desc, g.id desc;
$$;

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

-- As 20261127080000_activity_names_member_ids.sql made it, with a file's chips added showing as Bonus given by hand does.
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
