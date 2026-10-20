-- The daily rake invoice (#379; the owner's answer to #378, point 5; decision 0106). Once per business day,
-- one invoice in series S for that day's rake, to unregistered customers as one consolidated buyer, with
-- GST taken out at the gst.config rate in force when the day began (#23). The business day is the club's
-- night, from 06:00 IST to 06:00 IST, as private.tonight_began has it, named by the date it began on.

-- What venue.rake was credited by ledger transactions in a business day: the rake of the day's hands, less
-- any reversed. Revenue is credited as negative amounts, so the rake is the sum turned round. A transaction
-- counts on the day it was posted (occurred_at), so a hand an offline tablet sends late is invoiced with
-- the night it arrived in; the live floor's "rake tonight" counts by when hands were played, so the two
-- can differ by such a hand. The business day is IST's, as tonight_began has it: every venue is in India.
create function private.day_rake(p_venue_id uuid, p_day date)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(-sum(e.amount), 0)::bigint
  from public.ledger_entry e
  join public.ledger_account a on a.id = e.account_id
  join public.ledger_transaction t on t.id = e.transaction_id
  where a.venue_id = p_venue_id and a.code = 'venue.rake'
    and t.occurred_at >= (p_day + time '06:00') at time zone 'Asia/Kolkata'
    and t.occurred_at < (p_day + 1 + time '06:00') at time zone 'Asia/Kolkata';
$$;

-- Issues a venue's rake invoice for one business day, or returns null when there is nothing to invoice: no
-- rake that day, or GST charged on a table fee instead of the rake (gst.config's basis). Once per day: the
-- source names the day, so a retry or a second run gives the same invoice and uses no number.
create function private.issue_day_rake_invoice(p_venue_id uuid, p_day date)
returns public.invoice
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rake bigint := private.day_rake(p_venue_id, p_day);
  v_gst jsonb := private.setting_at(p_venue_id, 'gst.config', '', (p_day + time '06:00') at time zone 'Asia/Kolkata');
begin
  if v_rake <= 0 or v_gst ->> 'basis' is distinct from 'rake' then
    return null;
  end if;
  return private.issue_invoice(p_venue_id, 'S', 'rake:' || p_day::text, v_rake, (v_gst ->> 'rate_basis_points')::integer,
                               'Club services: the rake of the business day of ' || to_char(p_day, 'FMDD Mon YYYY'),
                               null, 'Unregistered customers, consolidated', null);
end;
$$;

-- Every venue's invoices for the business days that have ended, the last 35 of them, oldest first: a day
-- already invoiced gives the same invoice and uses no number, so a day refused or a run missed is invoiced
-- on a later run. A venue whose invoice is refused (no GSTIN yet) raises an alert each run until it is
-- put right, and leaves the other venues to go through. A night whose reversals came to more than its rake
-- raises an alert too. The practice venue's are practice invoices, and nothing about them leaves.
create function private.issue_rake_invoices()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_yesterday date := ((private.tonight_began(now()) - interval '1 day') at time zone 'Asia/Kolkata')::date;
  v_venue_id uuid;
  v_day date;
begin
  for v_venue_id in select v.id from public.venue v loop
    if private.day_rake(v_venue_id, v_yesterday) < 0 then
      perform private.raise_alert(v_venue_id, 'invoice.rake_negative',
        jsonb_build_object('day', v_yesterday, 'rake_paise', private.day_rake(v_venue_id, v_yesterday)));
    end if;
    for v_day in select d::date from generate_series(v_yesterday - 34, v_yesterday, interval '1 day') d loop
      begin
        perform private.issue_day_rake_invoice(v_venue_id, v_day);
      exception when others then
        perform private.raise_alert(v_venue_id, 'invoice.rake_refused', jsonb_build_object('day', v_day, 'reason', sqlerrm));
        exit;
      end;
    end loop;
  end loop;
end;
$$;

revoke execute on function private.day_rake(uuid, date), private.issue_day_rake_invoice(uuid, date), private.issue_rake_invoices()
  from public, anon, authenticated;

-- 01:30 UTC is 07:00 IST, an hour after the business day ends.
select cron.schedule('daily-rake-invoice', '30 1 * * *', 'select private.issue_rake_invoices()');
