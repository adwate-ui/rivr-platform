-- Guest relations read only top-up requests (redesign RD-32; the security review of the pull request). Nineteen policies and six
-- functions let in whoever works at the venue (private.staff_venues(), which asks for no permission), so the role read its
-- colleagues and their numbers, the escalation contacts, the settings, the devices with their token hashes, the tables, stakes
-- and tiers, and the venue's configuration. Each of them, apart from the three the console cannot load without, now lets in the
-- venues where the caller's role is more than guest relations.
--
-- Kept for the role: its venue's own row (`venue`: the console names the venue and knows the practice one), the role matrix
-- (`role_permission`: the console reads its one permission from it), the computer it signs in at (`this_computer`,
-- `claim_computer`), and its own staff record, by a policy of its own below. Its own `staff_preference` rows already go by its
-- staff id.

-- The venues where the signed-in person is staff in a role other than guest relations: the same check as
-- private.staff_venues(), less that role.
create function private.staff_venues_beyond_top_ups()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.venue_id from public.staff s
  where s.user_id = (select auth.uid()) and s.is_active and s.role <> 'guest_relations'
    and not exists (select 1 from public.control_state c
                    where c.level = 'access_revoke' and c.staff_id = s.id and c.released_at is null);
$$;
revoke execute on function private.staff_venues_beyond_top_ups() from public, anon;
grant execute on function private.staff_venues_beyond_top_ups() to authenticated;

-- A staff member reads their own record whatever their role: the console signs them in by it.
create policy "staff see their own record" on public.staff for select to authenticated
  using (id = private.current_staff_id(venue_id));

-- The policies, each as it stood with the one call changed.
alter policy "staff see their venue's cameras" on public.camera
  using ((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues)));

alter policy "staff read their venue's contacts" on public.contact
  using ((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues)));

alter policy "staff and devices see the venue's venue-wide controls" on public.control_state
  using (((level = ANY (ARRAY['venue_freeze'::public.control_level, 'feature_kill'::public.control_level, 'messaging_stop'::public.control_level])) AND ((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues)) OR (venue_id IN ( SELECT d.venue_id
   FROM public.device d
  WHERE (d.id = ( SELECT private.current_device_id() AS current_device_id)))))));

alter policy "staff and the venue's tablets see downs" on public.dealer_down
  using (((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues)) OR (venue_id = ( SELECT d.venue_id
   FROM public.device d
  WHERE ((d.id = ( SELECT private.current_device_id() AS current_device_id)) AND (d.kind = 'dealer_tablet'::public.device_kind))))));

alter policy "staff see the venue's devices" on public.device
  using (((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues)) OR (id = ( SELECT private.current_device_id() AS current_device_id))));

alter policy "staff and members see the venue's tables" on public.game_table
  using ((((deleted_at IS NULL) AND (venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues))) OR (active AND (venue_id = ( SELECT private.current_member_venue_id() AS current_member_venue_id)) AND ( SELECT private.has_feature(private.current_member_id(), 'floor.live_view'::text) AS has_feature))));

alter policy "staff read their venue's settings; AML ones only for AML review" on public.setting
  using (((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues)) AND ((key !~~ 'aml.%'::text) OR (venue_id IN ( SELECT private.venues_where('aml.review'::text) AS venues_where)) OR (venue_id IN ( SELECT private.venues_where('venue.configure'::text) AS venues_where)))));

alter policy "staff read the setting catalogue" on public.setting_key
  using ((EXISTS ( SELECT 1
   FROM private.staff_venues_beyond_top_ups() staff_venues(staff_venues))));

alter policy "staff see their colleagues" on public.staff
  using ((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues)));

alter policy "staff and members see the venue's table types" on public.table_type
  using (((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues)) OR ((venue_id = ( SELECT private.current_member_venue_id() AS current_member_venue_id)) AND ( SELECT private.has_feature(private.current_member_id(), 'floor.live_view'::text) AS has_feature))));

alter policy "staff and the tablet see tablet assignments" on public.tablet_assignment
  using (((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues)) OR (device_id = ( SELECT private.current_device_id() AS current_device_id))));

alter policy "staff and members see the venue's tiers" on public.tier
  using (((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues)) OR (venue_id = ( SELECT private.current_member_venue_id() AS current_member_venue_id))));

alter policy "staff and members read the venue's matrix" on public.tier_feature
  using (((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues)) OR (venue_id = ( SELECT private.current_member_venue_id() AS current_member_venue_id))));

alter policy "staff see the venue's tournaments" on public.tournament
  using ((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues)));

alter policy "staff see when the venue's TVs last reported in" on public.tv_heartbeat
  using ((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues)));

alter policy "staff and the TV see TV screens" on public.tv_screen
  using (((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues)) OR (device_id = ( SELECT private.current_device_id() AS current_device_id))));

alter policy "staff read their venue's configuration" on public.venue_config
  using ((venue_id IN ( SELECT private.staff_venues_beyond_top_ups() AS staff_venues)));

-- The functions that listed a venue's things to whoever works there, each as it stood with the one call changed.
CREATE OR REPLACE FUNCTION private.cameras(p_venue_id uuid)
 RETURNS TABLE(camera_id uuid, name text, channel text, table_id uuid, table_name text, is_cage boolean, is_active boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.id, c.name, c.channel, c.table_id, g.name, c.is_cage, c.is_active
  from public.camera c left join public.game_table g on g.id = c.table_id
  where c.venue_id = p_venue_id and p_venue_id in (select private.staff_venues_beyond_top_ups())
  order by c.is_active desc, c.is_cage desc, g.position nulls last, c.name;
$function$;

CREATE OR REPLACE FUNCTION private.floor_open_seats()
 RETURNS TABLE(table_id uuid, open_seats integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- A seat counts once: the floor may seat a called member in the seat held for them before their place closes.
  select t.id, greatest(t.seats - (select count(*)::integer from (
    select s.seat from public.seat_session s where s.table_id = t.id and s.ended_at is null
    union
    select e.call_seat from public.waitlist_entry e where e.call_table_id = t.id and e.status = 'waiting' and e.called_at is not null
  ) taken), 0)
  from public.game_table t
  where t.active
    and ((t.venue_id = private.current_member_venue_id() and private.has_feature(private.current_member_id(), 'floor.live_view'))
         or t.venue_id in (select private.staff_venues_beyond_top_ups()));
$function$;

CREATE OR REPLACE FUNCTION private.stake_call_times(p_venue_id uuid)
 RETURNS TABLE(table_type_id uuid, call_time_minutes integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select t.id, private.stake_call_time(t.venue_id, t.code)
  from public.table_type t
  where t.venue_id = p_venue_id and p_venue_id in (select private.staff_venues_beyond_top_ups());
$function$;

CREATE OR REPLACE FUNCTION private.venue_staff(p_venue_id uuid)
 RETURNS TABLE(staff_id uuid, full_name text, job_title text, role public.staff_role, phone text, is_active boolean, user_id uuid, last_signed_in_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select s.id, s.full_name, s.job_title, s.role,
         case when private.has_permission(p_venue_id, 'staff.manage') then s.phone end,
         s.is_active, s.user_id,
         case when private.has_permission(p_venue_id, 'staff.manage') then u.last_sign_in_at end
  from public.staff s
  left join auth.users u on u.id = s.user_id
  where s.venue_id = p_venue_id and p_venue_id in (select private.staff_venues_beyond_top_ups())
  order by s.is_active desc, s.full_name;
$function$;

CREATE OR REPLACE FUNCTION private.waitlist_lengths()
 RETURNS TABLE(table_id uuid, waiting integer, call_time_minutes integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select g.id, (select count(*)::integer from public.waitlist_entry e where e.table_id = g.id and e.status = 'waiting'
                and e.approved_at is not null and e.joined_at >= private.tonight_began(now())),
         coalesce((private.setting_at(g.venue_id, 'call_time.minutes', t.code, now()) ->> 'minutes')::integer, 0)
  from public.game_table g
  join public.table_type t on t.id = g.table_type_id
  where g.active
    and ((g.venue_id = private.current_member_venue_id() and private.has_feature(private.current_member_id(), 'floor.live_view'))
         or g.venue_id in (select private.staff_venues_beyond_top_ups()));
$function$;
