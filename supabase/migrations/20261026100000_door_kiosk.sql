-- The door kiosk (owner, 26 Oct 2026; #331; decision 0164). A tablet at the door, added and paired on
-- the console as a dealer tablet is (device_kind door), scans the membership card a member holds up:
-- the first scan checks them in, the next checks them out, under the same rules as the front desk
-- (#72, #82). It does nothing else: no list of who is in the room, no check-in by number. Each visit
-- it opens names it. And the promotions that hang on a visit now run: a check-in weighs the check-in
-- rules, and a visit's close (the door, a final cash-out or the end of the day) weighs the
-- hours-played rules with the hours the member played that visit on the call-time clock (seated
-- time, as points count it, decision 0161) and the points those hours earned.

-- The door kiosk that checked a member in, beside the front desk who did.
alter table public.visit
  add column opened_by_device_id uuid,
  add foreign key (opened_by_device_id, venue_id) references public.device (id, venue_id);
create index visit_device_venue_idx on public.visit (opened_by_device_id, venue_id);

-- The signed-in door kiosk's venue; null for anyone else, and at once for a revoked kiosk.
create function private.door_venue_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.venue_id from public.device d where d.id = (select private.current_device_id()) and d.kind = 'door';
$$;

-- Opens a visit for a member, as #72's check-in did, for whoever may (the front desk or a door kiosk):
-- refused for a member on a break, frozen, or at a frozen venue; a member already in gets their visit.
-- A new visit weighs the venue's check-in promotions.
create function private.open_visit(p_venue_id uuid, p_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
  v_id := private.current_visit(p_member_id);
  if v_id is not null then return v_id; end if;
  insert into public.visit (venue_id, member_id, opened_by_staff_id, opened_by_device_id)
  values (p_venue_id, p_member_id, private.current_staff_id(p_venue_id),
          case when private.door_venue_id() = p_venue_id then private.current_device_id() end)
  returning id into v_id;
  perform private.emit(p_venue_id, 'visit.opened', jsonb_build_object('visit_id', v_id, 'member_id', p_member_id), 'visit.opened:' || v_id);
  -- Once a club day, however often a member scans in and out (keyed by the day, not the visit).
  perform private.evaluate_promotions(p_venue_id, 'check_in', jsonb_build_object('member_id', p_member_id,
    'key', 'check_in:' || p_member_id || ':' || (private.tonight_began(now()) at time zone 'Asia/Kolkata')::date));
  return v_id;
end;
$$;

-- #72's check-in, for the front desk, now through open_visit.
create or replace function private.check_in(p_venue_id uuid, p_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'waitlist.manage') then
    raise exception 'Only the front desk checks a member in' using errcode = '42501';
  end if;
  return private.open_visit(p_venue_id, p_member_id);
end;
$$;

-- Closes a member's visit as they leave by the door (#82), for whoever may: refused while they are
-- seated (RVSTD) or owe call time no admin has let them off (RVCTS, the seconds owed as the detail).
create function private.leave_by_door(p_venue_id uuid, p_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
    raise exception 'Still seated: the floor ends the seat, or the cage cashes out, first' using errcode = 'RVSTD';
  end if;
  select * into v_owed from private.call_time_owed(p_member_id, now());
  if coalesce(v_owed.o_seconds, 0) > 0 and not exists (select 1 from public.early_departure e where e.session_id = v_owed.o_session_id) then
    raise exception 'Call time not complete: % seconds owed', v_owed.o_seconds
      using errcode = 'RVCTS', detail = v_owed.o_seconds::text;
  end if;
  return private.close_visit(p_member_id, now(), 'door');
end;
$$;

-- #82's check-out, for the front desk, now through leave_by_door.
create or replace function private.check_out(p_venue_id uuid, p_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'waitlist.manage') then
    raise exception 'Only the front desk checks a member out' using errcode = '42501';
  end if;
  return private.leave_by_door(p_venue_id, p_member_id);
end;
$$;

-- A closed visit's seconds played (the call-time clock, at every table) and the points they earned.
create function private.visit_hours(p_visit_id uuid)
returns table (o_played bigint, o_points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(e.played_seconds), 0)::bigint, coalesce(sum(e.points), 0)::bigint
  from public.points_earning e where e.visit_id = p_visit_id and e.basis = 'hours';
$$;

-- A visit closed with time played weighs the venue's hours-played promotions once: the hours that
-- visit, the points they earned, and the table played longest for its stake.
create function private.weigh_hours_played(p_visit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.visit;
  v_hours record;
  v_table uuid;
begin
  select * into v_visit from public.visit v where v.id = p_visit_id;
  select * into v_hours from private.visit_hours(p_visit_id);
  if v_visit.closed_at is null or v_hours.o_played <= 0 then return; end if;
  select e.table_id into v_table from public.points_earning e where e.visit_id = p_visit_id and e.basis = 'hours'
  group by e.table_id order by sum(e.played_seconds) desc, e.table_id limit 1;
  perform private.evaluate_promotions(v_visit.venue_id, 'hours_played', jsonb_build_object(
    'member_id', v_visit.member_id, 'table_id', v_table, 'key', 'hours_played:' || p_visit_id,
    'hours_played', trunc(v_hours.o_played / 3600.0, 2), 'points', v_hours.o_points));
end;
$$;

-- #89's close_visit, now also weighing the hours-played promotions once the points are earned.
create or replace function private.close_visit(p_member_id uuid, p_at timestamptz, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.visit;
begin
  select * into v_visit from public.visit v where v.member_id = p_member_id and v.closed_at is null for update;
  if v_visit.id is null then return null; end if;
  update public.visit set closed_at = greatest(p_at, v_visit.opened_at), close_reason = p_reason where id = v_visit.id;
  perform private.emit(v_visit.venue_id, 'visit.closed',
                       jsonb_build_object('visit_id', v_visit.id, 'member_id', p_member_id, 'reason', p_reason), 'visit.closed:' || v_visit.id);
  perform private.earn_visit_points(v_visit.id);
  perform private.weigh_hours_played(v_visit.id);
  return v_visit.id;
end;
$$;

-- A scan at the door kiosk: the member whose card it is, checked in, or out if they are in. A scan in
-- the first two minutes of a visit (a card still held up, scanned again) only says they are in; a scan
-- within ten minutes of their visit closing (a final cash-out at the cage, say) opens nothing again: it
-- says goodbye. Gives what happened (`in`, `out` or `gone`), the member's first name, and for `out`
-- and `gone` the seconds they played that visit. Refusals: 42501 not a door kiosk, RVCRD a card code
-- that is not current, and those of a check-in (RVBRK, RVMBR, RVFRZ) and a check-out (RVSTD, RVCTS).
create function private.door_scan(p_code text)
returns table (action text, first_name text, played_seconds bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.door_venue_id();
  v_member public.member;
  v_visit uuid;
  v_last public.visit;
begin
  if v_venue_id is null then
    raise exception 'Only a door kiosk scans members in and out' using errcode = '42501';
  end if;
  select * into v_member from public.member m where m.id = private.card_member(v_venue_id, p_code, now()) for update;
  v_visit := private.current_visit(v_member.id);
  if v_visit is not null and (select v.opened_at from public.visit v where v.id = v_visit) > now() - interval '2 minutes' then
    return query select 'in'::text, split_part(trim(v_member.full_name), ' ', 1), 0::bigint;
    return;
  end if;
  if v_visit is not null then
    perform private.leave_by_door(v_venue_id, v_member.id);
    return query select 'out'::text, split_part(trim(v_member.full_name), ' ', 1), h.o_played from private.visit_hours(v_visit) h;
    return;
  end if;
  select * into v_last from public.visit v where v.member_id = v_member.id and v.closed_at is not null order by v.closed_at desc limit 1;
  if v_last.closed_at > now() - interval '10 minutes' then
    return query select 'gone'::text, split_part(trim(v_member.full_name), ' ', 1), h.o_played from private.visit_hours(v_last.id) h;
    return;
  end if;
  perform private.open_visit(v_venue_id, v_member.id);
  return query select 'in'::text, split_part(trim(v_member.full_name), ' ', 1), 0::bigint;
end;
$$;

-- A playing-time promotion in the deck (#85's templates), for the floor to publish as it stands: a
-- ₹1,000 bonus, good for a week, once a club day, for a visit with four hours at the tables. As
-- 20261020180644_promotion_templates.sql, with the one more template; every venue gets it now.
create or replace function private.add_promotion_templates(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_graduate_tier uuid := (select t.id from public.tier t where t.venue_id = p_venue_id and t.name = 'Academy graduate');
begin
  insert into public.promotion (venue_id, template_key, name, detail, runs, per_player_limit, per_player_period)
  values
    (p_venue_id, 'tuesday_bonus', 'Buy-in bonus Tuesday', '20% on the first five buy-ins per table', 'Tuesday · all stakes', null, null),
    (p_venue_id, 'high_hands', 'High hands', 'Royal flush ₹25,000 · Straight flush ₹10,000 · Four of a kind ₹2,000', 'Every night', null, null),
    (p_venue_id, 'bad_beat', 'Bad-beat jackpot', 'The pool pays the losing hand, the winner and the table', 'Every night', null, null),
    (p_venue_id, 'referral', 'Referral', '₹1,000 to each side', 'Every day', null, null),
    (p_venue_id, 'graduate_first_buy_in', 'Graduate first buy-in', '₹1,000 on an Academy graduate''s first buy-in', 'Every day', 1, 'promotion'),
    (p_venue_id, 'rivr_rewards', 'RIVR Rewards', '5% of your rake back as points', 'Every game', null, null),
    (p_venue_id, 'founders_priority', 'Founders'' Circle priority', 'First call on every waitlist', 'Every night', null, null),
    (p_venue_id, 'cab', 'Cab home', 'A cab home from your fourth visit in a month', 'Every night', null, null),
    (p_venue_id, 'ladies_night', 'Ladies'' Night', 'An evening for women players', null, null, null),
    (p_venue_id, 'league', 'RIVR League', 'Points from cash games and tournaments, a champion each season', 'Every month', null, null),
    (p_venue_id, 'sunday_guarantee', 'RIVR Sunday', '₹5,00,000 guaranteed', 'Sundays', null, null),
    (p_venue_id, 'hours_bonus', 'Four-hour bonus', '₹1,000 bonus after four hours at the tables', 'Every night', 1, 'day')
  on conflict (venue_id, template_key) do nothing;
  insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
  select p_venue_id, p.id, r.trigger, r.conditions, r.effect
  from (values
    ('tuesday_bonus', 'buy_in', '{"days": [2], "first_n": {"count": 5, "per": "table"}}'::jsonb,
     '{"kind": "bonus", "percent_bps": 2000, "expires_days": 7}'::jsonb),
    ('referral', 'referral', '{}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb),
    ('graduate_first_buy_in', 'buy_in', jsonb_build_object('tier_ids', jsonb_build_array(v_graduate_tier)),
     '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb),
    ('hours_bonus', 'hours_played', '{"min_hours": 4}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 7}'::jsonb)
  ) as r (template_key, trigger, conditions, effect)
  join public.promotion p on p.venue_id = p_venue_id and p.template_key = r.template_key
  where (r.template_key <> 'graduate_first_buy_in' or v_graduate_tier is not null)
    and not exists (select 1 from public.promotion_rule x where x.promotion_id = p.id);
end;
$$;

select private.add_promotion_templates(v.id) from public.venue v;

-- Door kiosks pair as dealer tablets do (#41, as in 20261019091200_tv_pairing.sql).
create or replace function private.start_device_pairing(p_device_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := private.manageable_device(p_device_id, array['dealer_tablet', 'door']::public.device_kind[]);
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
$$;

create function public.door_scan(p_code text)
returns table (action text, first_name text, played_seconds bigint)
language sql volatile security invoker set search_path = ''
as $$ select * from private.door_scan(p_code); $$;

revoke execute on function private.door_venue_id(), private.open_visit(uuid, uuid), private.leave_by_door(uuid, uuid),
  private.visit_hours(uuid), private.weigh_hours_played(uuid), private.door_scan(text) from public, anon, authenticated;
grant execute on function private.door_scan(text) to authenticated;
revoke execute on function public.door_scan(text) from public, anon;
grant execute on function public.door_scan(text) to authenticated;
