-- Each role sees the owner's modules (#644; owner's feedback doc of 29 Oct). Floor sees every super admin module but
-- tables setup, the member list (the CRM link), games history, tournaments and bonus; Cashier the same less the food and
-- drink orders; Service only the menu and orders (#640). The console's rail follows the permissions below.

-- Floor: tonight's floor, the waitlist and check-in, call time, today's players, food and drink orders, and the rewards,
-- points by hand among them (#645). Not yet the TVs (the doc's Devices module): devices.manage also enrols the cage's and
-- admin's computers and keeps the cameras, so TVs wait for a permission of their own.
insert into public.role_permission (role, permission)
select 'floor', permission from unnest(array['sops.acknowledge', 'incidents.log', 'members.read', 'waitlist.manage', 'floor.manage',
  'call_time.override', 'fnb.serve', 'rewards.manage', 'rewards.hand_over', 'points.give']) as permission;
-- Cashier: the same less the orders, beside what the cage held (hidden, decision 0284).
insert into public.role_permission (role, permission)
select 'cashier', permission from unnest(array['waitlist.manage', 'floor.manage', 'call_time.override', 'rewards.manage', 'points.give']) as permission;

-- Tournaments are not the floor's or the cashier's: the interest list (#636) is for tournaments.manage, which super
-- admins and admins hold. As in 20261029160000_tournament_interest.sql, with tournaments.manage for waitlist.manage.
drop policy tournament_interest_floor_read on public.tournament_interest;
create policy tournament_interest_floor_read on public.tournament_interest for select to authenticated
  using (venue_id in (select private.venues_where('tournaments.manage')));

create or replace function private.tournament_interest_list(p_venue_id uuid)
returns table (interest_id uuid, tournament_id uuid, tournament_name text, starts_at timestamptz, member_id uuid, full_name text,
               member_number bigint, created_at timestamptz, registered_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, t.id, t.name, t.starts_at, m.id, m.full_name, m.member_number, i.created_at, i.registered_at
  from public.tournament_interest i
  join public.tournament t on t.id = i.tournament_id
  join public.member m on m.id = i.member_id
  where i.venue_id = p_venue_id and private.has_permission(p_venue_id, 'tournaments.manage') and t.starts_at > now() - interval '1 day'
  order by t.starts_at, i.created_at;
$$;

-- Refusals: 42501 not tournaments.manage at its venue; 22023 registered already; RVFRZ the venue frozen.
create or replace function private.mark_tournament_registered(p_interest_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_interest public.tournament_interest;
begin
  select * into v_interest from public.tournament_interest i where i.id = p_interest_id for update;
  if v_interest.id is null or not private.has_permission(v_interest.venue_id, 'tournaments.manage') then
    raise exception 'Only staff who manage tournaments mark a member registered' using errcode = '42501';
  end if;
  if v_interest.registered_at is not null then
    raise exception 'Registered already' using errcode = '22023';
  end if;
  perform private.assert_writable(v_interest.venue_id, 'tournament_registration', v_interest.member_id);
  update public.tournament_interest
  set registered_at = now(), registered_by_staff_id = private.current_staff_id(v_interest.venue_id)
  where id = v_interest.id;
end;
$$;
