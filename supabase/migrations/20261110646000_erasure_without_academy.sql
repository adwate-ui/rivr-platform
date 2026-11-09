-- A booking on the dropped Academy no longer holds up a member's erasure, as no screen can clear one (audit F-070).
-- As 20261028350000_tournament_satellites.sql made it, without that line. The money lines stay: while the cage is hidden
-- they cannot fire, and if money ever exists a member must not be erased with it outstanding.
create or replace function private.member_erasure_blockers(p_member_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  with balance as (
    select a.code, private.account_balance(a.id) as amount from public.ledger_account a where a.member_id = p_member_id
  )
  select array_remove(array[
    case when exists (select 1 from public.control_state c where c.venue_id = m.venue_id and c.released_at is null
                      and (c.level = 'venue_freeze' or (c.level = 'member_freeze' and c.member_id = m.id))) then 'frozen' end,
    case when exists (select 1 from balance b where b.code = 'member.cash' and b.amount <> 0) then 'cash' end,
    case when exists (select 1 from public.visit v where v.member_id = m.id and v.closed_at is null)
           or exists (select 1 from public.seat_session s where s.member_id = m.id and s.ended_at is null) then 'chips' end,
    case when exists (select 1 from balance b where b.code = 'member.receivable' and b.amount <> 0)
           or exists (select 1 from public.marker k where k.member_id = m.id and k.settled_at is null) then 'markers' end,
    -- Points or bonus owed to the club (a liability above zero): never forfeited, so set right first.
    case when exists (select 1 from balance b where b.code in ('member.points', 'member.bonus') and b.amount > 0) then 'rewards' end,
    case when exists (select 1 from public.redemption r where r.member_id = m.id and r.handed_over_at is null) then 'redemptions' end,
    case when exists (select 1 from public.waitlist_entry w where w.member_id = m.id and w.status = 'waiting') then 'waitlist' end,
    case when exists (select 1 from public.tournament_entry e join public.tournament t on t.id = e.tournament_id
                      where e.member_id = m.id and e.status <> 'refunded' and t.finished_at is null)
           or exists (select 1 from public.tournament_ticket k where k.member_id = m.id and k.status = 'held') then 'tournament' end,
    case when exists (select 1 from public.buy_in_request b where b.member_id = m.id and b.status = 'waiting')
           or exists (select 1 from public.withdrawal_request w where w.member_id = m.id and w.status = 'waiting')
           or exists (select 1 from public.deposit_request d where d.member_id = m.id and d.status = 'waiting') then 'requests' end
  ], null)
  from public.member m
  where m.id = p_member_id;
$$;
