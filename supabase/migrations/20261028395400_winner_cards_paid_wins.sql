-- No winner card for a win that paid no money (#594): a freeroll, or a satellite that pays a ticket, made a card showing
-- "₹0". A tournament win, a high hand or a jackpot share now makes a card only when it paid. Otherwise as in
-- 20261028395000_winner_cards.sql.
create or replace function private.make_winner_cards()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := new.payload;
  v_played_at timestamptz;
begin
  if (select v.is_practice from public.venue v where v.id = new.venue_id) then
    return null;
  end if;
  if new.event_type = 'tournament.finished' and v_payload ->> 'winner_member_id' is not null then
    insert into public.winner_card (venue_id, member_id, kind, source_id, details, prize_paise, won_at)
    select t.venue_id, (v_payload ->> 'winner_member_id')::uuid, 'tournament', t.id, jsonb_build_object('event_name', t.name),
           won.paise, coalesce(t.finished_at, now())
    from public.tournament t
    cross join lateral (select coalesce(sum(p.prize_paise + p.bounty_paise), 0) as paise from public.tournament_payout p
                        where p.tournament_id = t.id and p.member_id = (v_payload ->> 'winner_member_id')::uuid) won
    where t.id = (v_payload ->> 'tournament_id')::uuid and won.paise > 0
    on conflict (kind, source_id, member_id) do nothing;
  elsif new.event_type = 'high_hand.approved' then
    v_played_at := (v_payload ->> 'played_at')::timestamptz;
    insert into public.winner_card (venue_id, member_id, kind, source_id, details, prize_paise, won_at)
    select new.venue_id, s.member_id, 'high_hand', (v_payload ->> 'claim_id')::uuid,
           jsonb_build_object('category', v_payload ->> 'category', 'rank', v_payload ->> 'rank', 'table_name', gt.name),
           (v_payload ->> 'payout_paise')::bigint, v_played_at
    from public.game_table gt
    cross join lateral (select x.member_id from public.seat_session x
                        where x.table_id = gt.id and x.seat = (v_payload ->> 'seat')::integer and x.started_at <= v_played_at
                          and (x.ended_at is null or x.ended_at >= v_played_at)
                        order by x.started_at desc limit 1) s
    where gt.id = (v_payload ->> 'table_id')::uuid and (v_payload ->> 'payout_paise')::bigint > 0
    on conflict (kind, source_id, member_id) do nothing;
  elsif new.event_type = 'jackpot.paid' then
    insert into public.winner_card (venue_id, member_id, kind, source_id, prize_paise, won_at)
    select j.venue_id, w.member_id, 'jackpot', j.id, w.paise, j.created_at
    from public.jackpot_event j
    cross join lateral (values (j.loser_member_id, j.loser_paise), (j.winner_member_id, j.winner_paise)) w (member_id, paise)
    where j.id = (v_payload ->> 'event_id')::uuid and w.member_id is not null and w.paise > 0
    on conflict (kind, source_id, member_id) do nothing;
  elsif new.event_type = 'high_hand.reversed' then
    delete from public.winner_card w where w.kind = 'high_hand' and w.source_id = (v_payload ->> 'claim_id')::uuid;
  elsif new.event_type = 'jackpot.reversed' then
    delete from public.winner_card w where w.kind = 'jackpot' and w.source_id = (v_payload ->> 'payout_event_id')::uuid;
  end if;
  return null;
end;
$$;
