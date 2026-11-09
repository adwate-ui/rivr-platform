-- Turning a super admin off and revoking one through the kill switch took different locks, so with three super admins the two at once could
-- leave one, and a freeze nobody else can release. As in 20261101130000_one_person_one_approval.sql, on the kill switch's own lock.
create or replace function private.staff_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('role', true) is distinct from 'authenticated' then
    return new;
  end if;
  if old.user_id = (select auth.uid()) and (new.role is distinct from old.role or (old.is_active and not new.is_active)) then
    raise exception 'Staff do not change their own role or turn themselves off' using errcode = 'RVOWN';
  end if;
  if old.user_id = (select auth.uid()) and (new.phone is distinct from old.phone or new.full_name is distinct from old.full_name) then
    raise exception 'Staff do not change their own number or name' using errcode = 'RVOWN';
  end if;
  if old.role = 'super_admin' and old.is_active and (new.role <> 'super_admin' or not new.is_active) then
    -- Two managers each taking away one of the last ones would otherwise both succeed.
    perform pg_advisory_xact_lock(hashtextextended('control:' || old.venue_id, 0));
    if private.engagers(old.venue_id, old.id) < 2 then
      raise exception 'That would leave fewer than two super admins able to release a venue freeze' using errcode = 'RVLCK';
    end if;
  end if;
  return new;
end;
$$;
