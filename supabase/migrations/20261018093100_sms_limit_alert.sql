-- An alert when Auth refuses sign-in codes because the project's hourly code limit is used up (#182,
-- over_sms_send_rate_limit): every member is then locked out of sign-in. The sign-in screen tells
-- the sign-in-alert Edge Function, which calls this with the service role. One alert, for the club,
-- at most every 15 minutes, whoever calls and however often.

create function private.raise_sms_limit_alert()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select v.id from public.venue v where not v.is_practice order by v.created_at limit 1);
begin
  perform pg_advisory_xact_lock(hashtext('sms-limit-alert'));
  if v_venue_id is null or exists (
    select 1 from public.alert a
    where a.venue_id = v_venue_id and a.kind = 'auth.sms_rate_limit' and a.raised_at > now() - interval '15 minutes'
  ) then
    return;
  end if;
  insert into public.alert (venue_id, kind, detail)
  values (v_venue_id, 'auth.sms_rate_limit',
          jsonb_build_object('note', 'Sign-in codes are being refused: the project''s hourly code limit is used up.'));
end;
$$;

revoke execute on function private.raise_sms_limit_alert() from public;
grant execute on function private.raise_sms_limit_alert() to service_role;

create function public.raise_sms_limit_alert()
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.raise_sms_limit_alert();
$$;

revoke execute on function public.raise_sms_limit_alert() from public;
grant execute on function public.raise_sms_limit_alert() to service_role;
