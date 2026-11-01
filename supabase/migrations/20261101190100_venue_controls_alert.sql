-- A change to the venue's controls alerts the owner (audit of 28 Oct, A4-12). A person who changes the venue's networks
-- (which can switch the computer and network checks off), its UPI or bank details, or the alert number raises
-- venue.config_changed, naming the fields. When the alert number changed, that alert goes to the number before the
-- change, so a repointed number cannot hide its own change. The number before is kept apart from the alert, readable
-- by no one, as the alert number itself is (venue_config_detail, for venue.configure only).

-- The alert number before a change, for that change's own alert: no grants, no audit row; it goes with its alert.
create table private.alert_previous_number (
  alert_id uuid primary key references public.alert (id) on delete cascade,
  alert_whatsapp text not null
);
revoke all on private.alert_previous_number from public, anon, authenticated;

-- The venue's controls, changed by a person (not the seed or a migration): their fields; and, kept apart, the alert
-- number before the change, if it was the one changed.
create function private.alert_venue_config_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alert_id uuid;
  v_fields text[] := array_remove(array[
    case when new.staff_ip_allowlist is distinct from old.staff_ip_allowlist then 'staff_ip_allowlist' end,
    case when new.upi_vpa is distinct from old.upi_vpa then 'upi_vpa' end,
    case when new.upi_payee_name is distinct from old.upi_payee_name then 'upi_payee_name' end,
    case when new.bank_name is distinct from old.bank_name then 'bank_name' end,
    case when new.bank_account_name is distinct from old.bank_account_name then 'bank_account_name' end,
    case when new.bank_account_number is distinct from old.bank_account_number then 'bank_account_number' end,
    case when new.bank_ifsc is distinct from old.bank_ifsc then 'bank_ifsc' end,
    case when new.alert_whatsapp is distinct from old.alert_whatsapp then 'alert_whatsapp' end
  ], null);
begin
  if cardinality(v_fields) > 0 and (select auth.uid()) is not null then
    v_alert_id := private.raise_alert(new.venue_id, 'venue.config_changed', jsonb_build_object('fields', to_jsonb(v_fields)));
    if 'alert_whatsapp' = any (v_fields) and old.alert_whatsapp is not null then
      insert into private.alert_previous_number (alert_id, alert_whatsapp) values (v_alert_id, old.alert_whatsapp);
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.alert_venue_config_change() from public, anon, authenticated;
create trigger venue_config_alert_change after update on public.venue_config
  for each row execute function private.alert_venue_config_change();

-- As 20261026234000_alerting.sql made it: an alert of a changed alert number goes to the number before the change.
create or replace function private.alert_recipient(p_venue_id uuid, p_alert_id uuid)
returns table (alert_whatsapp text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p.alert_whatsapp, c.alert_whatsapp)
  from public.alert a
  join public.venue v on v.id = a.venue_id and not v.is_practice
  join public.venue_config c on c.venue_id = a.venue_id
  left join private.alert_previous_number p on p.alert_id = a.id
  where a.id = p_alert_id and a.venue_id = p_venue_id and a.raised_at > now() - interval '1 day';
$$;
