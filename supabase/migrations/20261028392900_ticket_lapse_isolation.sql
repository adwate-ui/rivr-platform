-- Satellite tickets that lapse (#520). Each ticket is refunded on its own, so one whose refund fails leaves the
-- rest refunded: it stays held, to be tried again the next minute, and raises one alert naming it. A refund
-- emits tournament.ticket_refunded, in the same transaction, for the member to be told.
-- As before (20261028350000_tournament_satellites.sql), but each ticket on its own, with its event.
create or replace function private.lapse_tournament_tickets()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket public.tournament_ticket;
begin
  for v_ticket in
    select k.* from public.tournament_ticket k join public.tournament t on t.id = k.target_id
    where k.status = 'held'
      and (t.finished_at is not null or private.tournament_level_now(t) > t.last_registration_level
           or (t.clock_started_at is null and t.starts_at < now() - interval '1 day'))
      and not exists (select 1 from public.control_state c where c.venue_id = k.venue_id and c.released_at is null
                      and (c.level = 'venue_freeze' or (c.level = 'member_freeze' and c.member_id = k.member_id)))
    order by k.created_at
    for update of k skip locked
  loop
    begin
      update public.tournament_ticket
      set status = 'refunded',
          refund_transaction_id = private.credit_wallet(v_ticket.venue_id, v_ticket.member_id, v_ticket.value_paise, 'tournament_ticket_refund',
            'tournament_ticket_refund:' || v_ticket.id,
            jsonb_build_array(jsonb_build_object('code', 'venue.tournament_tickets', 'amount', v_ticket.value_paise)), 0)
      where id = v_ticket.id;
      perform private.emit(v_ticket.venue_id, 'tournament.ticket_refunded',
        jsonb_build_object('ticket_id', v_ticket.id, 'member_id', v_ticket.member_id, 'tournament_id', v_ticket.target_id,
                           'value_paise', v_ticket.value_paise),
        'tournament.ticket_refunded:' || v_ticket.id);
    exception when others then
      if not exists (select 1 from public.alert a where a.venue_id = v_ticket.venue_id and a.kind = 'tournaments.ticket_refund_failed'
                     and a.detail ->> 'ticket_id' = v_ticket.id::text) then
        perform private.raise_alert(v_ticket.venue_id, 'tournaments.ticket_refund_failed',
          jsonb_build_object('ticket_id', v_ticket.id, 'sqlstate', sqlstate));
      end if;
    end;
  end loop;
end;
$$;
