-- Who still has access, and who deals (8 Nov audit, I-76, F-082, F-116). Staff shows when each login last signed in, to staff who
-- manage staff. Dealer PINs lists dealers, and a manager who deals only for themselves: nobody deals under another manager's name.

-- As 20261110010000_staff_phones.sql, with the last sign-in, on the same terms as the number.
drop function public.venue_staff(uuid);
drop function private.venue_staff(uuid);
create function private.venue_staff(p_venue_id uuid)
returns table (staff_id uuid, full_name text, job_title text, role public.staff_role, phone text, is_active boolean,
               user_id uuid, last_signed_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.full_name, s.job_title, s.role,
         case when private.has_permission(p_venue_id, 'staff.manage') then s.phone end,
         s.is_active, s.user_id,
         case when private.has_permission(p_venue_id, 'staff.manage') then u.last_sign_in_at end
  from public.staff s
  left join auth.users u on u.id = s.user_id
  where s.venue_id = p_venue_id and p_venue_id in (select private.staff_venues())
  order by s.is_active desc, s.full_name;
$$;

create function public.venue_staff(p_venue_id uuid)
returns table (staff_id uuid, full_name text, job_title text, role public.staff_role, phone text, is_active boolean,
               user_id uuid, last_signed_in_at timestamptz)
language sql
stable
set search_path = ''
as $$ select * from private.venue_staff(p_venue_id); $$;

revoke execute on function private.venue_staff(uuid), public.venue_staff(uuid) from public, anon;
grant execute on function private.venue_staff(uuid), public.venue_staff(uuid) to authenticated;

-- As 20261019090800_dealer_sign_in.sql, with the role, for dealers and the caller alone.
drop function public.venue_dealers(uuid);
drop function private.venue_dealers(uuid);
create function private.venue_dealers(p_venue_id uuid)
returns table (staff_id uuid, full_name text, role public.staff_role, has_pin boolean, locked_until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.full_name, s.role, c.staff_id is not null, case when c.locked_until > now() then c.locked_until end
  from public.staff s
  left join public.staff_credential c on c.staff_id = s.id
  where s.venue_id = p_venue_id and private.is_dealer_at(s.id, p_venue_id)
    and (s.role = 'dealer' or s.user_id = (select auth.uid()))
    and private.has_permission(p_venue_id, 'staff.manage') and private.can_grant_role(p_venue_id, s.role)
  order by s.full_name;
$$;

create function public.venue_dealers(p_venue_id uuid)
returns table (staff_id uuid, full_name text, role public.staff_role, has_pin boolean, locked_until timestamptz)
language sql
stable
set search_path = ''
as $$ select * from private.venue_dealers(p_venue_id); $$;

revoke execute on function private.venue_dealers(uuid), public.venue_dealers(uuid) from public, anon;
grant execute on function private.venue_dealers(uuid), public.venue_dealers(uuid) to authenticated;

-- As 20261019090800_dealer_sign_in.sql: a dealer's PIN, or one's own, and no other manager's.
create or replace function private.set_dealer_pin(p_staff_id uuid, p_pin text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_staff public.staff;
begin
  select * into v_staff from public.staff s where s.id = p_staff_id;
  if v_staff.id is null or not private.has_permission(v_staff.venue_id, 'staff.manage')
     or not private.can_grant_role(v_staff.venue_id, v_staff.role) or not private.is_dealer_at(v_staff.id, v_staff.venue_id)
     or (v_staff.role <> 'dealer' and v_staff.user_id is distinct from (select auth.uid())) then
    raise exception 'Only staff managers set a dealer''s PIN' using errcode = '42501';
  end if;
  -- Four digits, and not one digit four times.
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' or p_pin ~ '^(.)\1{3}$' then
    raise exception 'A PIN is four digits, not all the same' using errcode = '22023';
  end if;
  insert into public.staff_credential (staff_id, venue_id, pin_hash)
  values (v_staff.id, v_staff.venue_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 8)))
  on conflict (staff_id) do update set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null;
end;
$$;
