-- Activity and Past controls, for super admins (8 Nov audit, I-75, F-034). The audit log was kept, but no console screen read
-- it, and Kill switch showed only what is engaged now. Both are for staff who engage controls (control.engage: super admins):
-- an investor holds audit.read for the table's own policy, but a log naming who was frozen and why is the super admins' alone
-- (#493 P5). Rows' before and after never leave the database here: they hold whole records, identity details among them.

-- The screen's kinds, for its filter. Anything not named is `other`.
create function private.activity_kind(p_action text, p_entity text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_entity = 'control_state' then 'controls'
    when p_action like 'export.%' or p_entity = 'export_archive' then 'exports'
    when p_entity in ('staff', 'staff_credential', 'staff_shift', 'staff_attendance') then 'staff'
    when p_action like 'points.%' then 'points'
    when p_action = 'bonus.give' or p_entity in ('bonus_grant', 'bonus_redemption') then 'bonus_chips'
    when p_entity in ('points_earning', 'redemption', 'reward_item', 'league_adjustment') then 'points'
    when p_entity in ('member_tier_change', 'tier', 'tier_feature') then 'tiers'
    when p_action like 'member.%' or p_action like 'kyc_image.%'
         or p_entity in ('member', 'member_limit', 'member_feature_override', 'self_exclusion', 'consent', 'sign_up_attribution') then 'members'
    when p_entity in ('setting', 'venue', 'venue_config', 'device', 'tablet_assignment', 'tv_screen', 'camera', 'storage_object') then 'settings'
    when p_entity in ('game_table', 'table_type', 'waitlist_entry', 'seat_session', 'seat_move', 'visit', 'early_departure',
                      'early_departure_withdrawal', 'down_count', 'dealer_down', 'hand') then 'floor'
    else 'other'
  end;
$$;

-- An id kept as text in a row's before or after, or null when it is not one, so one odd row cannot break the screen.
create function private.uuid_or_null(p_text text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when p_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_text::uuid end;
$$;

-- A page of the log, newest first, after the row named by p_before and p_before_id: who (a staff member, a member or a device; null
-- when the system did it, or an erased or removed login), what and how much, about whom, why and when. The dates are club days (06:00 to 06:00
-- IST); p_who is part of the name of whoever did it.
create function private.activity_log(p_venue_id uuid, p_from date default null, p_to date default null, p_who text default null,
                                     p_kind text default null, p_before timestamptz default null, p_before_id bigint default null,
                                     p_limit integer default 50)
returns table (id bigint, occurred_at timestamptz, who text, is_system boolean, action text, entity text, kind text, about text, reason text, amount bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.occurred_at, w.name, l.actor_user_id is null, l.action, l.entity,
         private.activity_kind(l.action, l.entity),
         coalesce(case when rm.erased_at is null then rm.full_name end, rs.full_name, case when l.entity = 'table' then l.entity_id end),
         -- A reason can name the person, so an erased member's go; the erasure keeps its own.
         case when rm.erased_at is null or l.action = 'member.erase' then l.reason end,
         -- How many points or bonus chips were given by hand, each in its own unit.
         case when l.action like 'points.%' then (l.after ->> 'points')::bigint when l.action = 'bonus.give' then (l.after ->> 'chips')::bigint end
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
  where l.venue_id = p_venue_id and private.has_permission(p_venue_id, 'control.engage')
    and (p_from is null or l.occurred_at >= (p_from::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
    and (p_to is null or l.occurred_at < ((p_to + 1)::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
    and (p_who is null or position(lower(p_who) in lower(coalesce(w.name, ''))) > 0)
    and (p_kind is null or private.activity_kind(l.action, l.entity) = p_kind)
    and (p_before is null or (l.occurred_at, l.id) < (p_before, p_before_id))
  order by l.occurred_at desc, l.id desc
  limit greatest(least(coalesce(p_limit, 50), 200), 1);
$$;

-- What has been released, latest first: engaged by whom and why, released by whom (a freeze by two) and why.
create function private.past_controls(p_venue_id uuid)
returns table (control_id uuid, level public.control_level, feature public.killable_feature, member_name text, staff_name text, reason text,
               engaged_at timestamptz, engaged_by text, released_at timestamptz, released_by text, release_second text, release_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.level, c.feature, case when m.erased_at is null then m.full_name end, t.full_name,
         case when m.erased_at is null then c.reason else '' end, c.engaged_at, e.full_name,
         c.released_at, r.full_name, b.full_name, case when m.erased_at is null then c.release_reason end
  from public.control_state c
  left join public.member m on m.id = c.member_id
  left join public.staff t on t.id = c.staff_id
  left join public.staff e on e.id = c.engaged_by_staff_id
  left join public.staff r on r.id = c.released_by_staff_id
  left join public.staff b on b.id = c.release_second_staff_id
  where c.venue_id = p_venue_id and c.released_at is not null and private.has_permission(p_venue_id, 'control.engage')
  order by c.released_at desc, c.id;
$$;

create function public.activity_log(p_venue_id uuid, p_from date default null, p_to date default null, p_who text default null,
                                    p_kind text default null, p_before timestamptz default null, p_before_id bigint default null,
                                    p_limit integer default 50)
returns table (id bigint, occurred_at timestamptz, who text, is_system boolean, action text, entity text, kind text, about text, reason text, amount bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.activity_log(p_venue_id, p_from, p_to, p_who, p_kind, p_before, p_before_id, p_limit); $$;

create function public.past_controls(p_venue_id uuid)
returns table (control_id uuid, level public.control_level, feature public.killable_feature, member_name text, staff_name text, reason text,
               engaged_at timestamptz, engaged_by text, released_at timestamptz, released_by text, release_second text, release_reason text)
language sql stable security invoker set search_path = ''
as $$ select * from private.past_controls(p_venue_id); $$;

revoke execute on function private.activity_kind(text, text), private.uuid_or_null(text),
  private.activity_log(uuid, date, date, text, text, timestamptz, bigint, integer),
  public.activity_log(uuid, date, date, text, text, timestamptz, bigint, integer), private.past_controls(uuid), public.past_controls(uuid) from public, anon;
grant execute on function private.activity_log(uuid, date, date, text, text, timestamptz, bigint, integer),
  public.activity_log(uuid, date, date, text, text, timestamptz, bigint, integer), private.past_controls(uuid), public.past_controls(uuid) to authenticated;
