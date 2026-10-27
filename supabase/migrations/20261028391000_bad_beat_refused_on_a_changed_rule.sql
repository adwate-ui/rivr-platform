-- A bad-beat payout is refused when the payout rule changed since the console showed it (#309; the security
-- re-check of #307). pay_bad_beat compared only the total, so a jackpot.payout rule saved between the preview and the
-- pay, with the same total and the loser's and winner's shares swapped, recorded a split other than the chips the floor
-- handed out. The console now sends the rule it showed, and any share that differs is refused (RVSTL).
drop function public.pay_bad_beat(uuid, uuid, text, text, text[], bigint, text);
drop function private.pay_bad_beat(uuid, uuid, text, text, text[], bigint, text);

-- As before (20261019091100_jackpot_payouts.sql), with the rule the console showed.
create function private.pay_bad_beat(p_venue_id uuid, p_table_id uuid, p_loser_phone text, p_winner_phone text,
                                     p_table_phones text[], p_expected_total bigint, p_expected_rule jsonb, p_idempotency_key text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_players uuid[];
  v_rule jsonb;
  v_pool bigint;
  v_paid record;
  v_event_id uuid;
begin
  if not private.has_permission(p_venue_id, 'jackpots.approve') then
    raise exception 'Only staff who approve jackpots pay one' using errcode = '42501';
  end if;
  perform private.assert_read_committed();
  perform pg_advisory_xact_lock(hashtextextended('jackpot:' || p_venue_id, 0));
  if not exists (select 1 from public.game_table t where t.id = p_table_id and t.venue_id = p_venue_id) then
    raise exception 'That table is not at this venue' using errcode = '22023';
  end if;
  v_players := private.members_by_phone(p_venue_id, array[p_loser_phone, p_winner_phone] || coalesce(p_table_phones, '{}'));
  v_event_id := private.replayed_jackpot_event(p_venue_id, p_idempotency_key, 'payout', p_table_id, v_players, null);
  if v_event_id is not null then
    return v_event_id;
  end if;
  perform private.assert_writable(p_venue_id, 'promotions');
  perform private.assert_writable(p_venue_id, 'promotions', player) from unnest(v_players) as player;
  if (select count(distinct player) from unnest(v_players) as player) <> cardinality(v_players) then
    raise exception 'The loser, the winner and each other player are different members' using errcode = '22023';
  end if;
  v_rule := private.setting_at(p_venue_id, 'jackpot.payout', '', now());
  if v_rule is null then
    raise exception 'No payout rule is set' using errcode = '22023';
  end if;
  -- The floor hands out the split the console showed: a rule saved since, even one with the same total, pays nothing.
  if exists (select 1 from unnest(array['pool_basis_points', 'loser_basis_points', 'winner_basis_points', 'table_basis_points']) as share
             where (p_expected_rule ->> share)::numeric is distinct from (v_rule ->> share)::numeric) then
    raise exception 'The payout rule has changed since the amounts were shown' using errcode = 'RVSTL';
  end if;
  v_pool := private.main_pool(p_venue_id);
  select * into v_paid from private.bad_beat_payout(v_pool, (v_rule ->> 'pool_basis_points')::numeric::integer,
    (v_rule ->> 'loser_basis_points')::numeric::integer, (v_rule ->> 'winner_basis_points')::numeric::integer,
    (v_rule ->> 'table_basis_points')::numeric::integer, cardinality(v_players) - 2);
  if v_paid.total = 0 then
    raise exception 'The pool pays nothing yet' using errcode = '22023';
  end if;
  -- The floor hands out the chips the console showed: if drops or another payout moved the pool
  -- since, nothing is paid and the console shows the new amounts.
  if p_expected_total is distinct from v_paid.total then
    raise exception 'The jackpot has changed since the amounts were shown' using errcode = 'RVSTL';
  end if;
  insert into public.jackpot_event (venue_id, kind, table_id, loser_member_id, winner_member_id, table_member_ids, pool_paise,
                                    loser_paise, winner_paise, each_at_table_paise, total_paise, rule, staff_id, idempotency_key)
  values (p_venue_id, 'payout', p_table_id, v_players[1], v_players[2], v_players[3:], v_pool, v_paid.loser, v_paid.winner,
          v_paid.each_at_table, v_paid.total, v_rule, private.current_staff_id(p_venue_id), p_idempotency_key)
  returning id into v_event_id;
  -- Chips into play from the main pool: one balanced transaction, keyed by the event.
  perform private.post_ledger_transaction(p_venue_id, 'jackpot_payout', 'jackpot:' || v_event_id,
    jsonb_build_array(
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id and a.code = 'venue.jackpot.main'),
                         'amount', v_paid.total::text),
      jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = p_venue_id and a.code = 'venue.chips_outstanding'),
                         'amount', (-v_paid.total)::text)),
    'promotions', 'Bad-beat jackpot paid in chips');
  perform private.emit(p_venue_id, 'jackpot.paid',
    jsonb_build_object('event_id', v_event_id, 'table_id', p_table_id, 'loser_member_id', v_players[1], 'winner_member_id', v_players[2],
                       'total_paise', v_paid.total),
    'jackpot.paid:' || v_event_id);
  return v_event_id;
end;
$$;

create function public.pay_bad_beat(p_venue_id uuid, p_table_id uuid, p_loser_phone text, p_winner_phone text,
                                    p_table_phones text[], p_expected_total bigint, p_expected_rule jsonb, p_idempotency_key text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.pay_bad_beat(p_venue_id, p_table_id, p_loser_phone, p_winner_phone, p_table_phones, p_expected_total, p_expected_rule,
                                  p_idempotency_key); $$;

revoke execute on function private.pay_bad_beat(uuid, uuid, text, text, text[], bigint, jsonb, text),
  public.pay_bad_beat(uuid, uuid, text, text, text[], bigint, jsonb, text) from public, anon;
grant execute on function private.pay_bad_beat(uuid, uuid, text, text, text[], bigint, jsonb, text),
  public.pay_bad_beat(uuid, uuid, text, text, text[], bigint, jsonb, text) to authenticated;
