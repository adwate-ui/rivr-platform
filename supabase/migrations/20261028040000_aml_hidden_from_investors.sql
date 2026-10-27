-- AML alerts, audit rows and settings are for staff who review AML (#492, decision 0237; questions #484 and #493 P8,
-- the owner's answers of 27 Oct). Investors (owner_view) read the owner dashboard's alerts, the audit log and the
-- outbox; every staff member reads the settings. An AML alert or audit row names no member, but its time matches a
-- cash buy-in in the ledger an investor can also read, and the structuring rule tells anyone how to stay under it.
-- So, for staff without aml.review (super admins and admins hold it):
--   * alerts of an `aml.` kind, and the outbox events raising them, with their deliveries, are hidden;
--   * audit rows of an `aml.` action, about the register, about an AML alert or about an `aml.` setting are hidden;
--   * `aml.` settings are hidden, unless the staff member configures the venue.

drop policy "dashboard staff see the venue's alerts" on public.alert;
create policy "dashboard staff see the venue's alerts; AML ones only for AML reviewers" on public.alert
  for select to authenticated
  using (venue_id in (select private.venues_where('dashboards.read'))
         and (kind not like 'aml.%' or venue_id in (select private.venues_where('aml.review'))));

drop policy "auditors read their venue's log" on public.audit_log;
create policy "auditors read their venue's log; AML rows only for AML reviewers" on public.audit_log
  for select to authenticated
  using (venue_id in (select private.venues_where('audit.read'))
         and ((action not like 'aml.%'
               and entity not in ('sar_entry', 'sar_entry_transaction')
               and not (entity = 'alert' and coalesce(after, before) ->> 'kind' like 'aml.%')
               and not (entity = 'setting' and coalesce(after, before) ->> 'key' like 'aml.%'))
              or venue_id in (select private.venues_where('aml.review'))));

drop policy "reports staff see the venue's events" on public.outbox_event;
create policy "reports staff see the venue's events; AML alerts only for AML reviewers" on public.outbox_event
  for select to authenticated
  using (venue_id in (select private.venues_where('reports.read'))
         and (not (event_type = 'alert.raised' and payload ->> 'kind' like 'aml.%')
              or venue_id in (select private.venues_where('aml.review'))));

-- A delivery shows only with its event, so the rule above covers both.
drop policy "reports staff see the venue's deliveries" on public.outbox_delivery;
create policy "reports staff see the venue's deliveries of events they see" on public.outbox_delivery
  for select to authenticated
  using (venue_id in (select private.venues_where('reports.read'))
         and exists (select 1 from public.outbox_event e where e.id = event_id));

drop policy "staff read their venue's settings" on public.setting;
create policy "staff read their venue's settings; AML ones only for AML reviewers and venue configurers" on public.setting
  for select to authenticated
  using (venue_id in (select private.staff_venues())
         and (key not like 'aml.%'
              or venue_id in (select private.venues_where('aml.review'))
              or venue_id in (select private.venues_where('venue.configure'))));

-- As before (20261026235700_owner_dashboard.sql), but the latest alerts leave out AML ones for a caller who does not
-- review AML.
create or replace function private.owner_snapshot(p_venue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tonight timestamptz := private.tonight_began(now());
  v_sees_aml boolean := private.has_permission(p_venue_id, 'aml.review');
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'dashboards.read') then
    raise exception 'The owner dashboard is the owner''s and super admins''' using errcode = '42501';
  end if;
  if exists (select 1 from public.venue v where v.id = p_venue_id and v.is_practice) then
    raise exception 'The practice venue has no owner dashboard' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'rake_tonight_paise', (select coalesce(sum(h.rake_paise), 0) from public.hand h where h.venue_id = p_venue_id and h.played_at >= v_tonight),
    'hands_tonight', (select count(*) from public.hand h where h.venue_id = p_venue_id and h.played_at >= v_tonight),
    'tables_open', (select count(*) from public.game_table g where g.venue_id = p_venue_id and g.is_open),
    'seated', (select count(*) from public.seat_session s where s.venue_id = p_venue_id and s.ended_at is null),
    'in_the_room', (select count(*) from public.visit v where v.venue_id = p_venue_id and v.closed_at is null),
    'cash', coalesce((select jsonb_agg(jsonb_build_object('name', a.name, 'balance_paise', private.account_balance(a.ledger_account_id))
                                       order by case a.kind when 'cash_drawer' then 0 when 'bank' then 1 else 2 end, a.name)
                      from public.payment_account a where a.venue_id = p_venue_id and a.is_active), '[]'::jsonb),
    -- What the club holds for players, as the treasury works it out: their cash balances, and the chips in play.
    'players_money_paise', (select coalesce(t.wallets_paise, 0) from private.treasury(p_venue_id) t),
    'chips_out_paise', (select coalesce(t.chips_in_play_paise, 0) from private.treasury(p_venue_id) t),
    'alerts', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'kind', l.kind, 'raised_at', l.raised_at) order by l.raised_at desc)
                        from (select a.id, a.kind, a.raised_at from public.alert a
                              where a.venue_id = p_venue_id and (v_sees_aml or a.kind not like 'aml.%')
                              order by a.raised_at desc limit 10) l), '[]'::jsonb),
    'nights', (select jsonb_agg(jsonb_build_object('day', n.day, 'rake_paise', (
                 select coalesce(sum(h.rake_paise), 0) from public.hand h
                 where h.venue_id = p_venue_id and h.played_at >= (n.day + time '06:00') at time zone 'Asia/Kolkata'
                   and h.played_at < (n.day + 1 + time '06:00') at time zone 'Asia/Kolkata')) order by n.day)
               from (select (v_tonight at time zone 'Asia/Kolkata')::date - d as day from generate_series(0, 13) d) n)
  );
end;
$$;
