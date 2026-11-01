-- A purge is not refused because the month's MIS was stored while the archive was made. The 07:00 IST job (store_mis)
-- stores last month's report for every venue without one, a frozen one too: on the first of each month, and on any day
-- for a venue made since. The report is worked out from rows the archive holds, so like the alerts and the outbox it is
-- deleted without being held to the archive's count. As in 20261028330000_purge_live_venue.sql, with mis_report.
create or replace function private.live_purge_logs()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['alert', 'mis_report', 'outbox_delivery', 'outbox_event'];
$$;
