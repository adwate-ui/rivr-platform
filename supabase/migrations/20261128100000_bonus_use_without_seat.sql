-- A member's Bonus used without a seat (the owner, 20 Nov). Until now Bonus was used only as a seat's buy-in
-- (private.redeem_bonus_at_seat) or added afterwards on a past seat by a super admin (private.add_bonus_use). Now floor
-- managers, admins and super admins, who give Bonus by hand (bonus.give), also use it with no seat, from the member's Bonus
-- on Members or the member's row at the Door (private.use_bonus):
-- - never on their own record; only while the member is checked in (an open visit); whole 50s; a reason of 3 to 200
--   characters; never more than the Bonus in force; and within the visit's Bonus cap, which counts it with the visit's seat
--   buy-ins (private.bonus_visit_left, private.draw_bonus). The cap is a share of the Bonus held at the visit's first use,
--   a seat or none, so a use before the first seat no longer shrinks it.
-- - posted as a buy-in at the seat is, member.bonus to venue.chips_outstanding, keyed on its request id; recorded as a
--   bonus_redemption of the visit with no seat or table; kept in the audit log with its reason (the member's History of
--   changes by staff); and told to the member (bonus.redeemed, with no table).
-- - shown as Used on the first row of its visit at the Door and in Players visits (private.players_by_seat), in the
--   report's Bonus used (report_figures counts every bonus_redemption already), in the record's and the member's Bonus
--   history with no table (the member sees no reason, as for a use added).

-- A use is a seat's (its session and table) or a visit's without a seat (the visit, and a reason).
alter table public.visit add constraint visit_id_venue_id_key unique (id, venue_id);

alter table public.bonus_redemption
  alter column session_id drop not null,
  alter column table_id drop not null,
  add column visit_id uuid,
  add constraint bonus_redemption_visit_id_venue_id_fkey foreign key (visit_id, venue_id) references public.visit (id, venue_id),
  drop constraint bonus_redemption_added_check,
  add constraint bonus_redemption_seat_or_visit_check check (
    (session_id is not null and table_id is not null and visit_id is null and (reason is null) = (used_at is null))
    or (session_id is null and table_id is null and visit_id is not null and reason is not null and used_at is null));
create index bonus_redemption_visit_idx on public.bonus_redemption (visit_id, venue_id);
comment on table public.bonus_redemption is
  'Bonus a member used: with their buy-in as they were seated (decision 0504), added after on a past seat (#1077), or without a seat during a visit (the owner, 20 Nov).';
comment on column public.bonus_redemption.visit_id is
  'For Bonus used without a seat (private.use_bonus): the visit it was used in; null for a seat''s, which has its session and table.';

-- Signed-in readers read the visit as every other column but the reason (20261125100000_bonus_reverse_and_missed_use.sql),
-- and the member's export carries it.
grant select (visit_id) on public.bonus_redemption to authenticated;
insert into private.member_export_column (table_name, column_name, kind) values ('bonus_redemption', 'visit_id', 'owed');

comment on column public.visit.bonus_at_first_seat_paise is
  'The bonus the member held as the visit''s first seat began, or as Bonus was first used in it without a seat, in paise; what bonus.visit_cap takes its share of (decision 0579).';

-- As 20261112100000_bonus_expiry_and_visit_cap.sql made it, keeping the note while the visit has a use without a seat,
-- which was counted against the share of what was held then.
CREATE OR REPLACE FUNCTION private.forget_bonus_at_first_seat()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.visit v set bonus_at_first_seat_paise = null
  where v.id = old.visit_id and not exists (select 1 from public.seat_session s where s.visit_id = old.visit_id)
    and not exists (select 1 from public.bonus_redemption r where r.visit_id = old.visit_id);
  return null;
end;
$function$;

-- As 20261117210000_card_social_cage_and_older_screens_removed.sql made it, counting the visit's uses without a seat with
-- its seats' buy-ins.
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
      (coalesce((select sum(r.amount_paise) from public.bonus_redemption r join public.seat_session ss on ss.id = r.session_id
                 where ss.visit_id = (select o.id from open_visit o)), 0)
       + coalesce((select sum(r.amount_paise) from public.bonus_redemption r where r.visit_id = (select o.id from open_visit o)), 0))::bigint)
  end
  from share s;
$function$;

-- Uses a member's Bonus without a seat. The request id is the use's id: the same request again changes nothing and gives
-- the same id, even once the visit is over. Refusals: 42501 not one who gives Bonus by hand; RVOWN their own record; RVCHP
-- not whole 50s from 50 to 1,00,000; 22023 no reason of 3 to 200 characters or no request id, a request id used for
-- another use, or the member erased; RVKIL/RVFRZ/RVMBR promotions stopped or frozen; RVRAT too many a minute; RVNIN not
-- checked in; RVVCP more than the visit's cap leaves; RVBON more than the Bonus in force, or some owed.
create function private.use_bonus(p_member_id uuid, p_chips integer, p_reason text, p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id and m.erased_at is null);
  v_amount bigint := p_chips::bigint * 100;
  v_replay public.bonus_redemption;
  v_visit_id uuid;
  v_txn uuid;
begin
  if v_venue_id is null or not coalesce(private.has_permission(v_venue_id, 'bonus.give'), false) then
    raise exception 'Only super admins, admins and floor managers use Bonus by hand' using errcode = '42501';
  end if;
  if private.is_own_cage_record(p_member_id) or coalesce(private.is_own_kyc_check(p_member_id), false) then
    raise exception 'Staff never use Bonus on their own record' using errcode = 'RVOWN';
  end if;
  if p_chips is null or p_chips < 50 or p_chips > 100000 or p_chips % 50 <> 0 then
    raise exception 'Whole fifties from 50 to 1,00,000 chips' using errcode = 'RVCHP';
  end if;
  if p_request_id is null or length(btrim(coalesce(p_reason, ''))) not between 3 and 200 then
    raise exception 'A reason of 3 to 200 characters, and a request id' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue_id, 'promotions', p_member_id);
  perform private.assert_rate(v_venue_id, 'bonus.use');
  if private.bonus_use_replayed(p_request_id, p_member_id, v_amount) then
    return p_request_id;
  end if;
  -- The open visit's row first, then the member's Bonus lock (in private.draw_bonus), the order a seating takes them in
  -- (its first seat notes the Bonus held on the visit), so the two never wait on each other; a check-out waits for this.
  select v.id into v_visit_id from public.visit v where v.member_id = p_member_id and v.closed_at is null for update;
  if v_visit_id is null then
    raise exception 'Not checked in: Bonus is used during a visit' using errcode = 'RVNIN';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('bonus:' || p_member_id::text, 0));
  -- The same request at the same moment waited above for the first, and is answered as it.
  if private.bonus_use_replayed(p_request_id, p_member_id, v_amount) then
    return p_request_id;
  end if;
  perform 1 from public.member m where m.id = p_member_id and m.erased_at is null for share;
  if not found then
    raise exception 'The member was erased' using errcode = '22023';
  end if;
  -- The visit's cap is a share of what was held at its first use, a seat or none (private.note_bonus_at_first_seat).
  update public.visit v set bonus_at_first_seat_paise = private.bonus_in_force(p_member_id, now())
  where v.id = v_visit_id and v.bonus_at_first_seat_paise is null;
  perform private.draw_bonus(p_member_id, v_amount);
  v_txn := private.post_ledger_transaction(v_venue_id, 'bonus_buy_in', 'bonus_use:' || p_request_id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member_id and a.code = 'member.bonus'),
                         'amount', v_amount::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_venue_id
                                         and a.code = 'venue.chips_outstanding'), 'amount', (-v_amount)::text)),
    'promotions', 'Bonus used without a seat');
  insert into public.bonus_redemption (id, venue_id, member_id, visit_id, amount_paise, ledger_transaction_id, staff_id, reason)
  values (p_request_id, v_venue_id, p_member_id, v_visit_id, v_amount, v_txn, private.current_staff_id(v_venue_id), btrim(p_reason));
  perform private.audit(v_venue_id, 'bonus.use', 'member', p_member_id::text, null,
                        jsonb_build_object('chips', p_chips, 'bonus_redemption_id', p_request_id, 'visit_id', v_visit_id), btrim(p_reason));
  -- No table: the member's app and push say it was used, with no table (packages/contracts bonusRedeemedSchema).
  perform private.emit(v_venue_id, 'bonus.redeemed',
                       jsonb_build_object('bonus_redemption_id', p_request_id, 'member_id', p_member_id, 'amount_paise', v_amount,
                                          'table_id', null, 'table_name', null),
                       'bonus.redeemed:' || p_request_id);
  return p_request_id;
end;
$$;

-- Whether a use without a seat with this request id is already recorded: true for the same member and amount; a refusal
-- (22023) for anything else under that id, a seat's use among them.
create function private.bonus_use_replayed(p_request_id uuid, p_member_id uuid, p_amount_paise bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_replay public.bonus_redemption;
begin
  select * into v_replay from public.bonus_redemption r where r.id = p_request_id;
  if v_replay.id is null then
    return false;
  end if;
  if v_replay.member_id <> p_member_id or v_replay.amount_paise <> p_amount_paise or v_replay.session_id is not null then
    raise exception 'That request id was used for another Bonus use' using errcode = '22023';
  end if;
  return true;
end;
$$;

create function public.use_bonus(p_member_id uuid, p_chips integer, p_reason text, p_request_id uuid)
returns uuid
language sql
set search_path = ''
as $$ select private.use_bonus(p_member_id, p_chips, p_reason, p_request_id); $$;
revoke all on function private.bonus_use_replayed(uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function private.use_bonus(uuid, integer, text, uuid) from public, anon;
grant execute on function private.use_bonus(uuid, integer, text, uuid) to authenticated;
revoke all on function public.use_bonus(uuid, integer, text, uuid) from public, anon;
grant execute on function public.use_bonus(uuid, integer, text, uuid) to authenticated;

-- As 20261125100000_bonus_reverse_and_missed_use.sql made it, with a request id already used for a use without a seat
-- (no session) refused as another use's, never answered as this one.
CREATE OR REPLACE FUNCTION private.add_bonus_use(p_session_id uuid, p_chips integer, p_reason text, p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_session public.seat_session;
  v_amount bigint := p_chips::bigint * 100;
  v_replay public.bonus_redemption;
  v_ids uuid[];
  v_remaining bigint[];
  v_expires timestamptz[];
  v_taken bigint[];
  v_owed bigint;
  v_txn uuid;
  v_table_name text;
begin
  select * into v_session from public.seat_session s where s.id = p_session_id;
  if v_session.id is null or not private.is_super_admin(v_session.venue_id) then
    raise exception 'Only super admins add a missed Bonus use' using errcode = '42501';
  end if;
  if private.is_own_cage_record(v_session.member_id) or coalesce(private.is_own_kyc_check(v_session.member_id), false) then
    raise exception 'Staff never add a Bonus use to their own record' using errcode = 'RVOWN';
  end if;
  if p_chips is null or p_chips < 50 or p_chips > 100000 or p_chips % 50 <> 0 then
    raise exception 'Whole fifties from 50 to 1,00,000 chips' using errcode = 'RVCHP';
  end if;
  if p_request_id is null or length(btrim(coalesce(p_reason, ''))) not between 3 and 200 then
    raise exception 'A reason of 3 to 200 characters, and a request id' using errcode = '22023';
  end if;
  perform private.assert_writable(v_session.venue_id, 'promotions', v_session.member_id);
  perform private.assert_rate(v_session.venue_id, 'bonus.use_add');
  perform pg_advisory_xact_lock(hashtextextended('bonus:' || v_session.member_id::text, 0));
  -- Under the member's lock, so the same request at once is answered as one, and an erasure is seen.
  select * into v_replay from public.bonus_redemption r where r.id = p_request_id;
  if v_replay.id is not null then
    if v_replay.session_id is distinct from p_session_id or v_replay.amount_paise <> v_amount then
      raise exception 'That request id was used for another Bonus use' using errcode = '22023';
    end if;
    return v_replay.id;
  end if;
  perform 1 from public.member m where m.id = v_session.member_id and m.erased_at is null for share;
  if not found or not exists (select 1 from private.bonus_use_seats(v_session.venue_id, v_session.member_id) u where u.session_id = p_session_id) then
    raise exception 'A seat of the member''s, past its Undo' using errcode = '22023';
  end if;
  select array_agg(g.id order by g.created_at, g.id), array_agg(g.remaining_paise order by g.created_at, g.id),
         array_agg(g.expires_at order by g.created_at, g.id)
  into v_ids, v_remaining, v_expires
  from (    select g.id, g.created_at, g.remaining_paise, private.bonus_end_in_force(g.venue_id, g.expires_at) as expires_at
          from public.bonus_grant g where g.member_id = v_session.member_id and g.expired_at is null for update) g;
  select t.taken, t.owed into v_taken, v_owed from private.bonus_takes(v_amount, v_remaining, v_expires, now(), null) t;
  for i in 1 .. coalesce(array_length(v_ids, 1), 0) loop
    continue when v_taken[i] = 0;
    update public.bonus_grant set remaining_paise = remaining_paise - v_taken[i] where id = v_ids[i];
  end loop;
  v_txn := private.post_ledger_transaction(v_session.venue_id, 'bonus_buy_in', 'bonus_buy_in:' || p_request_id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = v_session.member_id and a.code = 'member.bonus'),
                         'amount', v_amount::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = v_session.venue_id
                                         and a.code = 'venue.chips_outstanding'), 'amount', (-v_amount)::text)),
    'promotions', 'Bonus use added');
  insert into public.bonus_redemption (id, venue_id, member_id, session_id, table_id, amount_paise, ledger_transaction_id, staff_id, reason, used_at)
  values (p_request_id, v_session.venue_id, v_session.member_id, v_session.id, v_session.table_id, v_amount, v_txn,
          private.current_staff_id(v_session.venue_id), btrim(p_reason), v_session.started_at);
  if v_owed > 0 then
    insert into public.bonus_owed (venue_id, member_id, kind, amount_paise, bonus_redemption_id)
    values (v_session.venue_id, v_session.member_id, 'use', v_owed, p_request_id);
  end if;
  select t.name into v_table_name from public.game_table t where t.id = v_session.table_id;
  perform private.audit(v_session.venue_id, 'bonus.use_add', 'member', v_session.member_id::text, null,
                        jsonb_build_object('chips', p_chips, 'bonus_redemption_id', p_request_id, 'session_id', p_session_id,
                                           'table_name', v_table_name, 'owed_chips', v_owed / 100), btrim(p_reason));
  perform private.emit(v_session.venue_id, 'bonus.use_added',
                       jsonb_build_object('bonus_redemption_id', p_request_id, 'member_id', v_session.member_id, 'amount_paise', v_amount,
                                          'session_id', p_session_id, 'owed_paise', v_owed),
                       'bonus.use_added:' || p_request_id);
  return p_request_id;
end;
$function$;

-- As 20261125100000_bonus_reverse_and_missed_use.sql made it, with Bonus used without a seat as a line with no table: who
-- used it and why for staff; the member reads neither the reason (private.my_bonus_history) nor who.
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
    select r.id, coalesce(r.used_at, r.created_at), 'redeemed', r.amount_paise, r.reason, t.name, s.full_name
    from public.bonus_redemption r
    left join public.game_table t on t.id = r.table_id
    left join public.staff s on s.id = r.staff_id
    where r.member_id = p_member_id
    union all
    -- A Bonus reversed (#1077): what came back, under the grant's id as an expiry's line, with the reason and who reversed it.
    select g.id, g.reversed_at, 'reversed', e.amount, g.reversal_reason, null, rs.full_name
    from public.bonus_grant g
    join public.ledger_entry e on e.transaction_id = g.reversal_transaction_id
    join public.ledger_account a on a.id = e.account_id and a.code = 'member.bonus'
    left join public.staff rs on rs.id = g.reversed_by_staff_id
    where g.member_id = p_member_id and g.reversed_at is not null
  ) h
  order by h.at desc, h.line_id
  limit greatest(least(coalesce(p_limit, 20), 500), 1);
$function$;

-- As 20261127060100_bonus_per_seat.sql made it, with a visit's Bonus used without a seat that day on the visit's first
-- row, by when they sat, a row without a seat last: beside the first seat's own Bonus used, or alone on a row without one.
CREATE OR REPLACE FUNCTION private.players_by_seat(p_venue_id uuid, p_day date DEFAULT NULL::date)
 RETURNS TABLE(member_id uuid, full_name text, member_number bigint, status text, session_id uuid, table_name text, tables jsonb, seated_at timestamp with time zone, left_at timestamp with time zone, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, played_seconds bigint, away_seconds bigint, is_first_row boolean, bonus_used_paise bigint, visit_id uuid, linked_member_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with day as (
    select s.starts_at, s.starts_at + interval '1 day' as ends_at, p_day is null as is_today
    from (select coalesce((p_day + time '06:00') at time zone 'Asia/Kolkata', private.tonight_began(now())) as starts_at) s
  ),
  players as (select * from private.todays_players(p_venue_id, p_day)),
  -- The day's visits: opened that club day, or still open today.
  visits as (
    select v.id, v.member_id, v.opened_at, v.closed_at
    from public.visit v cross join day
    where v.venue_id = p_venue_id
      and ((v.opened_at >= day.starts_at and v.opened_at < day.ends_at) or (day.is_today and v.closed_at is null))
  ),
  seats as (
    select s.member_id, s.id as session_id, s.visit_id, t.o_table_id as table_id, t.o_from as seated_at, nullif(t.o_to, 'infinity') as left_at,
           least(floor(greatest(0, extract(epoch from least(t.o_to, now()) - t.o_from)))::bigint, w.wall) as seconds, w.wall, w.away
    from public.seat_session s
    cross join day
    cross join lateral (
      select floor(extract(epoch from (coalesce(s.ended_at, now()) - s.started_at)))::bigint as wall,
             s.away_seconds + case when s.ended_at is null and s.away_since is not null
                                   then greatest(0, floor(extract(epoch from (now() - s.away_since))))::bigint else 0 end as away) w
    cross join lateral private.session_tables(s.id) t
    where s.venue_id = p_venue_id
      and ((s.started_at >= day.starts_at and s.started_at < day.ends_at) or (day.is_today and s.ended_at is null))
  ),
  -- Bonus used at a seat (private.redeem_bonus_at_seat, private.add_bonus_use): each use on the stretch of its seat session at
  -- its table that began last by the time it was used; one used before any such stretch, on the session's last.
  uses as (
    select r.amount_paise, r.session_id, at_seat.table_id, at_seat.seated_at
    from public.bonus_redemption r
    cross join lateral (
      select st.table_id, st.seated_at from seats st
      where st.session_id = r.session_id
      order by (st.table_id = r.table_id and st.seated_at <= coalesce(r.used_at, r.created_at)) desc, st.seated_at desc
      limit 1) at_seat
    where r.venue_id = p_venue_id and r.session_id in (select st.session_id from seats st)
  ),
  -- Bonus used without a seat (private.use_bonus, the owner, 20 Nov): each visit's, on the day it was used, so a visit on
  -- two days' rows counts each use once.
  visit_uses as (
    select r.visit_id, sum(r.amount_paise)::bigint as paise
    from public.bonus_redemption r cross join day
    where r.venue_id = p_venue_id and r.session_id is null and r.created_at >= day.starts_at and r.created_at < day.ends_at
    group by r.visit_id
  ),
  seat_rows as (
  select p.member_id, p.full_name, p.member_number, p.status, st.session_id, g.name as table_name,
         jsonb_build_array(jsonb_build_object('table', g.name, 'seconds', played.seconds)) as tables,
         st.seated_at, st.left_at, v.opened_at as checked_in_at, v.closed_at as checked_out_at,
         -- The wait that ended in this seat: the list's entry seated as the seat began, from the waitlist, or ended as seated
         -- when the floor seated the member by name or number (private.seat_member), in the same moment.
         (select private.wait_after_check_in(p_venue_id, e.member_id, e.joined_at, coalesce(e.seated_at, e.left_at))
          from public.waitlist_entry e
          where e.venue_id = p_venue_id and e.member_id = st.member_id
            and (e.seated_at = st.seated_at or (e.left_reason = 'seated' and e.left_at = st.seated_at))
          order by e.joined_at limit 1) as waiting_seconds,
         played.seconds as played_seconds, st.seconds - played.seconds as away_seconds,
         (select coalesce(sum(u.amount_paise), 0) from uses u
          where u.session_id = st.session_id and u.table_id = st.table_id and u.seated_at = st.seated_at)::bigint as bonus_used_paise,
         st.visit_id
  from players p
  join seats st on st.member_id = p.member_id
  join public.game_table g on g.id = st.table_id
  join public.visit v on v.id = st.visit_id
  cross join lateral (select private.table_played_seconds(st.seconds, st.wall, least(st.wall, greatest(0, st.wall - st.away))) as seconds) played
  union all
  -- A row without a seat: each visit of the day with none, the open one too while the member waits again for a seat; and
  -- one with no visit for a member with none that day (on a list from the app, never in), or waiting again from outside
  -- once their visits are over.
  select p.member_id, p.full_name, p.member_number, p.status, null, null, '[]'::jsonb, null, null, sv.opened_at, sv.closed_at,
         last_wait.seconds, 0, null, null, sv.id
  from players p
  cross join day
  cross join lateral (
    select v.id, v.opened_at, v.closed_at from visits v where v.member_id = p.member_id
    union all select null::uuid, null::timestamptz, null::timestamptz) sv
  -- The visit's current wait, else its last: one still running first, then the one that ended latest; one that ended in a
  -- seat only when there is no other.
  left join lateral (
    -- On a visit's row a wait ends at the visit's check-out at the latest (the reviews of the batch PR): it goes on after
    -- on the member's own row, and counted past it on both it would be counted twice, running or since ended.
    select private.wait_after_check_in(p_venue_id, e.member_id, e.joined_at,
                                       least(coalesce(e.left_at, e.seated_at, now()), coalesce(sv.closed_at, 'infinity'))) as seconds
    from public.waitlist_entry e
    where e.venue_id = p_venue_id and e.member_id = p.member_id
      and ((e.joined_at >= day.starts_at and e.joined_at < day.ends_at) or (day.is_today and e.status = 'waiting'))
      and (sv.id is null or (coalesce(e.left_at, e.seated_at, now()) >= sv.opened_at and e.joined_at <= coalesce(sv.closed_at, now())))
    order by (e.seated_at is null and e.left_reason is distinct from 'seated') desc, coalesce(e.left_at, e.seated_at, 'infinity') desc,
             e.joined_at
    limit 1) last_wait on true
  where (sv.id is null and not exists (select 1 from visits v where v.member_id = p.member_id)
                       and not exists (select 1 from seats st where st.member_id = p.member_id))
     or (sv.id is null and day.is_today and p.status = 'waiting'
                       and not exists (select 1 from visits v where v.member_id = p.member_id and v.closed_at is null))
     or (sv.id is not null and not exists (select 1 from seats st where st.visit_id = sv.id))
     or (sv.id is not null and day.is_today and p.status = 'waiting' and sv.closed_at is null)
  )
  -- The first row of the member's latest visit that day (the open one for one back in), by when they sat, a row without a
  -- seat last; a row with no visit only when they had none: it carries what is not a
  -- seat's own. An erased member's name links nowhere.
  select r.member_id, r.full_name, r.member_number, r.status, r.session_id, r.table_name, r.tables, r.seated_at, r.left_at,
         r.checked_in_at, r.checked_out_at, r.waiting_seconds, r.played_seconds, r.away_seconds,
         row_number() over (partition by r.member_id
                            order by r.checked_in_at desc nulls last, r.checked_out_at desc nulls first, r.seated_at nulls last, r.table_name) = 1,
         case when vu.paise is not null
                   and row_number() over (partition by r.visit_id order by r.seated_at nulls last, r.table_name, r.session_id) = 1
              then coalesce(r.bonus_used_paise, 0) + vu.paise
              else r.bonus_used_paise end,
         r.visit_id, case when m.erased_at is null then r.member_id end
  from seat_rows r
  join public.member m on m.id = r.member_id
  left join visit_uses vu on vu.visit_id = r.visit_id;
$function$;

-- As 20261125100000_bonus_reverse_and_missed_use.sql made it, with Bonus used without a seat among the Bonus changes.
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
    when p_action in ('bonus.give', 'high_hand.pay', 'bonus.approve', 'bonus.refuse', 'bonus.reverse', 'bonus.use_add', 'bonus.use')
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
