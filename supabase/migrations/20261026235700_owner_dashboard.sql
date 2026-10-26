-- The owner dashboard (#101; tech plan item 22; decision 0192): a mobile view of the console for the owner
-- (owner_view) and super admins (dashboards.read): tonight's rake and hands, the tables running and the
-- members in the room and seated, the cash position, the latest alerts, and the rake of the last fortnight's
-- nights. Live: what it reads changing signals the venue's private owner:<venue> topic, and the console
-- reads again. The practice venue has no dashboard.

-- Everything the dashboard shows, at once.
create function private.owner_snapshot(p_venue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tonight timestamptz := private.tonight_began(now());
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
                        from (select a.id, a.kind, a.raised_at from public.alert a where a.venue_id = p_venue_id
                              order by a.raised_at desc limit 10) l), '[]'::jsonb),
    'nights', (select jsonb_agg(jsonb_build_object('day', n.day, 'rake_paise', (
                 select coalesce(sum(h.rake_paise), 0) from public.hand h
                 where h.venue_id = p_venue_id and h.played_at >= (n.day + time '06:00') at time zone 'Asia/Kolkata'
                   and h.played_at < (n.day + 1 + time '06:00') at time zone 'Asia/Kolkata')) order by n.day)
               from (select (v_tonight at time zone 'Asia/Kolkata')::date - d as day from generate_series(0, 13) d) n)
  );
end;
$$;

create function public.owner_snapshot(p_venue_id uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.owner_snapshot(p_venue_id); $$;

-- Tells the venue's owner dashboards that what they show changed, on its private topic, once a statement,
-- for each venue its rows belong to. The message names nothing.
create function private.signal_owner_dashboard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
begin
  for v_venue_id in select distinct c.venue_id from changed c loop
    perform realtime.send('{}'::jsonb, 'changed', 'owner:' || v_venue_id::text, true);
  end loop;
  return null;
end;
$$;

create trigger hand_owner_signal after insert on public.hand
  referencing new table as changed for each statement execute function private.signal_owner_dashboard();
create trigger alert_owner_signal after insert on public.alert
  referencing new table as changed for each statement execute function private.signal_owner_dashboard();
create trigger ledger_entry_owner_signal after insert on public.ledger_entry
  referencing new table as changed for each statement execute function private.signal_owner_dashboard();
create trigger game_table_owner_signal after update on public.game_table
  referencing new table as changed for each statement execute function private.signal_owner_dashboard();
create trigger seat_session_owner_signal after insert on public.seat_session
  referencing new table as changed for each statement execute function private.signal_owner_dashboard();
create trigger seat_session_owner_signal_end after update on public.seat_session
  referencing new table as changed for each statement execute function private.signal_owner_dashboard();
create trigger visit_owner_signal after insert on public.visit
  referencing new table as changed for each statement execute function private.signal_owner_dashboard();
create trigger visit_owner_signal_close after update on public.visit
  referencing new table as changed for each statement execute function private.signal_owner_dashboard();

-- Only staff who read the venue's dashboards hear its topic: Realtime checks this as they subscribe.
create policy "a venue's owner dashboards hear its signals" on realtime.messages
  for select to authenticated
  using (realtime.messages.extension = 'broadcast'
         and case when (select realtime.topic()) ~ '^owner:[0-9a-f-]{36}$'
                  then private.has_permission(substr((select realtime.topic()), 7)::uuid, 'dashboards.read')
                  else false end);

revoke execute on function private.signal_owner_dashboard() from public, anon, authenticated;
revoke execute on function private.owner_snapshot(uuid) from public, anon;
grant execute on function private.owner_snapshot(uuid) to authenticated;
revoke execute on function public.owner_snapshot(uuid) from public, anon;
grant execute on function public.owner_snapshot(uuid) to authenticated;
