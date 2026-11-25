-- The floor sets up tables too (the owner, 25 Nov; #1137): everything in Tables setup, as admins do, under tables.manage.
insert into public.role_permission (role, permission)
select 'floor', permission from unnest(array['tables.manage']) as permission;

-- A stake's minimum playing time is set with the stake in Tables setup, so whoever sets up tables sets it, as well as
-- staff who change settings. Generated from the live definition, that check alone changed.
CREATE OR REPLACE FUNCTION private.set_stake_call_time(p_venue_id uuid, p_code text, p_minutes integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_minutes is null then return; end if;
  if p_minutes not between 1 and 1440 then
    raise exception 'A stake''s call time is 1 to 1,440 minutes' using errcode = '22023';
  end if;
  if p_minutes = private.stake_call_time(p_venue_id, p_code) then return; end if;
  if not (private.has_permission(p_venue_id, 'settings.manage') or private.has_permission(p_venue_id, 'tables.manage')) then
    raise exception 'Only staff who change settings or set up tables set a stake''s call time' using errcode = '42501';
  end if;
  -- A second change in one transaction replaces the first: a setting's start is the transaction's, and one start holds one value.
  delete from public.setting s
  where s.venue_id = p_venue_id and s.key = 'call_time.minutes' and s.subject = p_code and s.effective_from = now();
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'call_time.minutes', p_code, jsonb_build_object('minutes', p_minutes), now(), 'Set with the stake in Tables setup (RD-16)');
end;
$function$;
