-- Hand logging is rate-limited per table (#298; security review of #294, L1; decision 0259). One tablet session logged
-- 300 hands back to back. A new hand is refused (RVFST) once its table has logged 30 in the last minute; the fastest
-- table plays about one a minute. The limit counts when hands arrive, not their played_at, so an offline tablet's
-- replay keeps its own times. The tablet's queue tries a refused hand again later, so a long replay waits rather than
-- losing hands. A replay of a hand already logged returns it before the limit is checked.
create index hand_table_created_idx on public.hand (table_id, created_at);

-- As before (20261019090900_log_hand.sql), with the rate limit after the replay check.
create or replace function private.log_hand(p_pot bigint, p_variant public.hand_variant, p_played_at timestamptz, p_idempotency_key text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tablet record;
  v_down public.dealer_down;
  v_rules record;
  v_take record;
  v_hand_id uuid;
begin
  select * into v_tablet from private.my_tablet_table();
  v_hand_id := private.replayed_hand(v_tablet.o_venue_id, v_tablet.o_table_id, p_idempotency_key, p_pot, p_variant, p_played_at);
  if v_hand_id is not null then
    return v_hand_id;
  end if;
  perform private.assert_writable(v_tablet.o_venue_id);
  select * into v_down from public.dealer_down d
  where d.table_id = v_tablet.o_table_id and d.device_id = v_tablet.o_device_id and d.ended_at is null;
  if v_down.id is null or not private.is_dealer_at(v_down.staff_id, v_tablet.o_venue_id) then
    raise exception 'Sign a dealer in before logging hands' using errcode = 'RVDWN';
  end if;
  if (select count(*) from public.hand h where h.table_id = v_tablet.o_table_id and h.created_at > now() - interval '1 minute') >= 30 then
    raise exception 'This table has logged 30 hands in the last minute; try again shortly' using errcode = 'RVFST';
  end if;
  if p_pot is null or p_pot <= 0 or p_pot > 1000000000 or p_pot % 5000 <> 0 then
    raise exception 'A pot is a whole number of ₹50 chips, up to ₹1 crore' using errcode = '22023';
  end if;
  -- A minute either side for the tablet's clock.
  if p_played_at is null or p_played_at > now() + interval '1 minute' or p_played_at < v_down.started_at - interval '1 minute' then
    raise exception 'A hand is played during the down it is logged in' using errcode = '22023';
  end if;
  select * into v_rules from private.rake_rules_at(v_tablet.o_table_id, p_played_at);
  if v_rules.rate_basis_points is null then
    raise exception 'No rake is set for this table''s game' using errcode = '22023';
  end if;
  if p_variant is null or (p_variant <> 'holdem' and not v_rules.has_variation) then
    raise exception 'This table plays Hold''em only' using errcode = '22023';
  end if;
  select * into v_take from private.pot_take(p_pot, v_rules.rate_basis_points, v_rules.cap_paise, v_rules.is_jackpot_live,
                                             v_rules.drop_paise, v_rules.drop_above_paise);
  insert into public.hand (venue_id, table_id, down_id, staff_id, device_id, variant, pot_paise, rake_paise, drop_paise,
                           is_cap_applied, played_at, idempotency_key)
  values (v_tablet.o_venue_id, v_tablet.o_table_id, v_down.id, v_down.staff_id, v_tablet.o_device_id, p_variant, p_pot,
          v_take.rake, v_take.drop_paise, v_take.is_cap_applied, p_played_at, p_idempotency_key)
  on conflict (venue_id, idempotency_key) do nothing
  returning id into v_hand_id;
  if v_hand_id is null then
    return private.replayed_hand(v_tablet.o_venue_id, v_tablet.o_table_id, p_idempotency_key, p_pot, p_variant, p_played_at);
  end if;
  perform private.post_hand(v_tablet.o_venue_id, v_hand_id, v_take.rake, v_take.drop_paise);
  perform private.emit(v_tablet.o_venue_id, 'hand.logged',
    jsonb_build_object('hand_id', v_hand_id, 'table_id', v_tablet.o_table_id, 'variant', p_variant, 'pot_paise', p_pot,
                       'rake_paise', v_take.rake, 'drop_paise', v_take.drop_paise, 'played_at', p_played_at),
    'hand.logged:' || v_hand_id);
  return v_hand_id;
end;
$$;
