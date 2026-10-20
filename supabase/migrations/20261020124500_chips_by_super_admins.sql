-- The console's Settings screen (#33; decision 0104): super admins edit the venue configuration and the
-- chip denominations. Lane 0 let anyone with settings.manage (admins too) add and change chips
-- (20261018090900_ledger.sql); a chip's value decides what every count at the cage adds up to, so it
-- now takes venue.configure, as the venue configuration does. Every change stays in the audit log.

drop policy "setting managers manage chips" on public.chip_denomination;
drop policy "setting managers change chips" on public.chip_denomination;

create policy "super admins add chips" on public.chip_denomination
  for insert to authenticated
  with check (venue_id in (select private.venues_where('venue.configure')));

create policy "super admins change chips" on public.chip_denomination
  for update to authenticated
  using (venue_id in (select private.venues_where('venue.configure')))
  with check (venue_id in (select private.venues_where('venue.configure')));
