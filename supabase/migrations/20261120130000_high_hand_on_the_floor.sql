-- High hand on the Live floor (redesign RD-24). The floor's strip reads the high hand that runs now and tonight's hits;
-- a hit logged anywhere refreshes every floor console; and Activity shows a hit with where it was and the hand paid.

-- Who reads the strip: everyone who sees the Live floor (those who read members, run the floor or seat players), and
-- those who manage promotions. Only those who add Bonus by hand log a hit (log_high_hand, decision 0621).
create function private.reads_high_hands(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.has_permission(p_venue_id, 'waitlist.manage'), false)
      or coalesce(private.has_permission(p_venue_id, 'promotions.manage'), false)
      or coalesce(private.has_permission(p_venue_id, 'floor.manage'), false)
      or coalesce(private.has_permission(p_venue_id, 'members.read'), false);
$$;
revoke execute on function private.reads_high_hands(uuid) from public, anon, authenticated;

-- Tonight's hits, as 20261120120100 has them, for the same readers as the strip.
create or replace function private.high_hand_tonight(p_venue_id uuid, p_promotion_id uuid, p_limit integer)
returns table (hit_id uuid, logged_at timestamptz, member_id uuid, member_name text, table_name text, seat integer, hand text, rank text, chips bigint,
               logged_by text, paid_count bigint, paid_chips bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.created_at, h.member_id, m.full_name, g.name, h.seat, h.hand, h.rank, h.chips, s.full_name,
         count(*) over (), (sum(h.chips) over ())::bigint
  from public.high_hand_hit h
  join public.member m on m.id = h.member_id
  join public.game_table g on g.id = h.table_id
  join public.staff s on s.id = h.logged_by_staff_id
  where h.venue_id = p_venue_id and h.created_at >= private.tonight_began(now())
    and (p_promotion_id is null or h.promotion_id = p_promotion_id)
    and private.reads_high_hands(p_venue_id)
  order by h.created_at desc, h.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

-- The high hand that runs at a venue now: its name, and its hands and rules for the strip and the logging panel. One
-- runs in a venue (promotion_version_one_high_hand); none while it is paused, scheduled or ended.
create function private.high_hand_live(p_venue_id uuid)
returns table (promotion_id uuid, name text, reward jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select v.promotion_id, v.name, v.reward
  from public.promotion_version v
  where v.venue_id = p_venue_id and v.status = 'live' and v.reward ->> 'kind' = 'high_hand'
    and private.reads_high_hands(p_venue_id);
$$;

create function public.high_hand_live(p_venue_id uuid)
returns table (promotion_id uuid, name text, reward jsonb)
language sql stable security invoker set search_path = ''
as $$ select * from private.high_hand_live(p_venue_id); $$;

revoke execute on function private.high_hand_live(uuid), public.high_hand_live(uuid) from public, anon;
grant execute on function private.high_hand_live(uuid), public.high_hand_live(uuid) to authenticated;

-- A hand with no rank, a royal flush or Aces full, comes from the console as a blank: none.
create or replace function public.log_high_hand(p_table_id uuid, p_member_id uuid, p_hand text, p_rank text, p_confirmed jsonb, p_request_id uuid)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select private.log_high_hand(p_table_id, p_member_id, p_hand, nullif(p_rank, ''), p_confirmed, p_request_id); $function$;

-- A hit logged tells the venue's floor consoles to read again (20261107310000_floor_signals.sql), naming nothing.
create trigger high_hand_hit_floor_signal after insert on public.high_hand_hit
  referencing new table as changed for each statement execute function private.signal_floor();

-- Activity: a high hand paid sits with Bonus, with its Bonus as the amount and its table, seat and hand beside it.
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
    when p_action in ('bonus.give', 'high_hand.pay') or p_entity in ('bonus_grant', 'bonus_redemption', 'high_hand_hit') then 'bonus_chips'
    when p_entity in ('member_tier_change', 'tier', 'tier_feature') then 'tiers'
    when p_action like 'member.%' or p_action like 'kyc_image.%'
         or p_entity in ('member', 'member_limit', 'member_feature_override', 'self_exclusion', 'consent', 'sign_up_attribution') then 'members'
    when p_entity in ('setting', 'venue', 'venue_config', 'device', 'tablet_assignment', 'tv_screen', 'camera', 'storage_object') then 'settings'
    when p_entity in ('game_table', 'table_type', 'waitlist_entry', 'seat_session', 'seat_move', 'visit', 'early_departure',
                      'early_departure_withdrawal', 'down_count', 'dealer_down', 'hand') then 'floor'
    else 'other'
  end;
$function$;

drop function public.activity_log(uuid, date, date, text, text, timestamp with time zone, bigint, integer);
drop function private.activity_log(uuid, date, date, text, text, timestamp with time zone, bigint, integer);

create function private.activity_log(p_venue_id uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_who text DEFAULT NULL::text, p_kind text DEFAULT NULL::text, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id bigint DEFAULT NULL::bigint, p_limit integer DEFAULT 50)
 RETURNS TABLE(id bigint, occurred_at timestamp with time zone, who text, is_system boolean, action text, entity text, kind text, about text, reason text, amount bigint, high_hand jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select l.id, l.occurred_at, w.name, l.actor_user_id is null, l.action, l.entity,
         private.activity_kind(l.action, l.entity),
         coalesce(case when rm.erased_at is null then rm.full_name end, rs.full_name, case when l.entity = 'table' then l.entity_id end),
         -- A reason can name the person, so an erased member's go; the erasure keeps its own.
         case when rm.erased_at is null or l.action = 'member.erase' then l.reason end,
         -- How much Bonus was added by hand, or paid for a high hand.
         case when l.action in ('bonus.give', 'high_hand.pay') then (l.after ->> 'chips')::bigint end,
         -- A high hand paid: where, and the hand as it was paid, for the screen to put in words.
         case when l.action = 'high_hand.pay'
              then jsonb_build_object('table', l.after ->> 'table', 'seat', l.after -> 'seat', 'hand', l.after ->> 'hand', 'rank', l.after -> 'rank') end
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

create function public.activity_log(p_venue_id uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_who text DEFAULT NULL::text, p_kind text DEFAULT NULL::text, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id bigint DEFAULT NULL::bigint, p_limit integer DEFAULT 50)
 RETURNS TABLE(id bigint, occurred_at timestamp with time zone, who text, is_system boolean, action text, entity text, kind text, about text, reason text, amount bigint, high_hand jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.activity_log(p_venue_id, p_from, p_to, p_who, p_kind, p_before, p_before_id, p_limit); $function$;

revoke execute on function private.activity_log(uuid, date, date, text, text, timestamp with time zone, bigint, integer), public.activity_log(uuid, date, date, text, text, timestamp with time zone, bigint, integer) from public, anon;
grant execute on function private.activity_log(uuid, date, date, text, text, timestamp with time zone, bigint, integer), public.activity_log(uuid, date, date, text, text, timestamp with time zone, bigint, integer) to authenticated;
