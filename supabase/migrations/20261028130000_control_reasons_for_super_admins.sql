-- Who sees a control's reason and whom it names (#497; question #493 P5, the owner's answer of 27 Oct). Every staff
-- member and device still sees that the venue is frozen, a feature switched off or messaging stopped, and its level. A
-- member freeze or an access revoke, which names a member or a staff member, and every control's reason, are for staff
-- who engage controls (control.engage: super admins), wherever they show: the controls, the control.* outbox events
-- (which carry whom a control names) and the audit rows of controls (which keep whole rows, reasons included). Members
-- still see venue-wide controls and their own freeze.

drop policy "staff and devices see the venue's controls" on public.control_state;

create policy "staff and devices see the venue's venue-wide controls" on public.control_state
  for select to authenticated
  using (
    level in ('venue_freeze', 'feature_kill', 'messaging_stop')
    and (venue_id in (select private.staff_venues())
         or venue_id in (select d.venue_id from public.device d where d.id = (select private.current_device_id())))
  );

create policy "staff who engage controls see every control, and whom it names" on public.control_state
  for select to authenticated
  using (venue_id in (select private.venues_where('control.engage')));

-- As before (20261018090700_control_state.sql), full rows with reasons, but only for staff who engage controls.
create or replace function private.control_state_detail_rows()
returns setof public.control_state
language sql
stable
security definer
set search_path = ''
as $$
  select c.* from public.control_state c where c.venue_id in (select private.venues_where('control.engage'));
$$;

-- As 20261028040000_aml_hidden_from_investors.sql, and the control.* events only for staff who engage controls.
drop policy "reports staff see the venue's events; AML alerts only for AML reviewers" on public.outbox_event;
create policy "reports staff see the venue's events; AML alerts and controls only for their staff" on public.outbox_event
  for select to authenticated
  using (venue_id in (select private.venues_where('reports.read'))
         and (not (event_type = 'alert.raised' and payload ->> 'kind' like 'aml.%')
              or venue_id in (select private.venues_where('aml.review')))
         and (event_type not like 'control.%' or venue_id in (select private.venues_where('control.engage'))));

-- As 20261028040000_aml_hidden_from_investors.sql, and the audit rows of controls only for staff who engage controls.
drop policy "auditors read their venue's log; AML rows only for AML reviewers" on public.audit_log;
create policy "auditors read their venue's log; AML rows and controls only for their staff" on public.audit_log
  for select to authenticated
  using (venue_id in (select private.venues_where('audit.read'))
         and ((action not like 'aml.%'
               and entity not in ('sar_entry', 'sar_entry_transaction')
               and not (entity = 'alert' and coalesce(after, before) ->> 'kind' like 'aml.%')
               and not (entity = 'setting' and coalesce(after, before) ->> 'key' like 'aml.%'))
              or venue_id in (select private.venues_where('aml.review')))
         and (entity <> 'control_state' or venue_id in (select private.venues_where('control.engage'))));
