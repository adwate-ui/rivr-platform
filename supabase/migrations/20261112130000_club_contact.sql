-- The club's numbers for calls and WhatsApp (the owner, 12 Nov; decision 0582; #917). They were one number in code
-- (CLUB_CONTACT); now the club's details hold them, set under Settings, Club, by whoever changes those details
-- (venue.configure). The website and the player app read them through public_club_contact, which gives the two numbers
-- of the club, never the practice venue's, to anyone. The number in use until now fills both for the club.

alter table public.venue_config
  add column contact_phone text check (contact_phone ~ '^\+91[1-9][0-9]{9}$'),
  add column contact_whatsapp text check (contact_whatsapp ~ '^\+91[6-9][0-9]{9}$');
comment on column public.venue_config.contact_phone is 'The number members and visitors call the club on, +91 and ten digits (decision 0582).';
comment on column public.venue_config.contact_whatsapp is 'The mobile number members and visitors WhatsApp the club on, +91 and ten digits (decision 0582).';

-- The super admin's view of the whole row gains the columns.
create or replace view public.venue_config_detail
with (security_invoker = true)
as
select * from private.venue_config_detail_rows();

-- The club is the first venue that is not the practice venue, as alerting and the website take it
-- (20261026234000_alerting.sql, 20261027000200_website_comes_with_the_venue.sql).
update public.venue_config c
set contact_phone = '+918796580435', contact_whatsapp = '+918796580435'
where c.venue_id = (select v.id from public.venue v where not v.is_practice order by v.created_at limit 1);

-- The club's two numbers, for the website and the app, signed in or not; nothing else of its details. Only the club's: a
-- later live venue, or one being purged, has its own super admins, who must not change what the club's members are sent to.
create function private.public_club_contact_rows()
returns table (venue_slug text, phone text, whatsapp text)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, c.contact_phone, c.contact_whatsapp
  from public.venue v
  join public.venue_config c on c.venue_id = v.id
  where v.id = (select f.id from public.venue f where not f.is_practice order by f.created_at limit 1);
$$;

grant execute on function private.public_club_contact_rows() to anon, authenticated;

create view public.public_club_contact
with (security_invoker = true)
as
select venue_slug, phone, whatsapp from private.public_club_contact_rows();

grant select on public.public_club_contact to anon, authenticated;

-- As 20261101190100_venue_controls_alert.sql made it, with the club's public numbers among the fields a change of which
-- alerts the owner: a changed number could send members to someone else.
create or replace function private.alert_venue_config_change()
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
    case when new.alert_whatsapp is distinct from old.alert_whatsapp then 'alert_whatsapp' end,
    case when new.contact_phone is distinct from old.contact_phone then 'contact_phone' end,
    case when new.contact_whatsapp is distinct from old.contact_whatsapp then 'contact_whatsapp' end
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
