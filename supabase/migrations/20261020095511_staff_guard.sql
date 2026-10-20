-- The Staff screen (#28; scope-v1 module 10; additions "Staff job titles"; decision 0073). Lane 0's
-- policies already let a manager add and change only staff whose role they could give. Three more rules
-- hold whatever the client:
-- - a number is on a venue's staff list once, or link_my_login would fail and lock the person out of
--   every app;
-- - nobody changes their own role or turns themselves off;
-- - a venue keeps two super admins able to release a freeze, the kill switch's own floor (RVLCK).
-- The last two hold for a request from an app, which runs as authenticated. The database owner
-- (migrations, the seed, a purge, tests) is trusted, as engage_control trusts it.

create unique index staff_venue_phone_key on public.staff (venue_id, phone) where phone is not null;

create function private.staff_guard()
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
  if old.role = 'super_admin' and old.is_active and (new.role <> 'super_admin' or not new.is_active) then
    -- Two managers each taking away one of the last ones would otherwise both succeed.
    perform pg_advisory_xact_lock(hashtextextended('venue_super_admins:' || old.venue_id::text, 0));
    if private.engagers(old.venue_id, old.id) < 2 then
      raise exception 'That would leave fewer than two super admins able to release a venue freeze' using errcode = 'RVLCK';
    end if;
  end if;
  return new;
end;
$$;

create trigger staff_guard before update on public.staff
  for each row execute function private.staff_guard();
