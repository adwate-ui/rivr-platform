-- Bonus added by hand is capped by its own setting (redesign of 15 Nov, RD-19): bonus.by_hand_cap is the most one addition
-- may be, and give_bonus_chips refuses more (RVCAP), whoever asks: the cap is on the addition, not on the person, unlike
-- bonus.daily_staff_cap, which stays as it is. None set leaves the most any addition may be, 1,00,000. A retry of an
-- addition that went through before the cap was set is still answered with it. The cap is a limit on the amount, as the
-- whole fifties are, so it answers before the daily limit does: an addition above both is refused here, and alerts no one.

insert into public.setting_key (key, description, scope, value_schema) values
  ('bonus.by_hand_cap',
   'The most bonus added by hand at once; an addition above it is refused. None set is 1,00,000.',
   'venue',
   '{"type":"object","properties":{"chips":{"type":"integer","minimum":50,"maximum":100000}},"required":["chips"],"additionalProperties":false}');

-- As before (20261116200000_points_rewards_and_league_removed.sql), with the new cap a control setting too: only a super admin changes it.
drop trigger setting_control_set on public.setting;
drop trigger setting_control_removed on public.setting;
create trigger setting_control_set before insert on public.setting
  for each row when (new.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config', 'rakeback.rate',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap', 'auth.store_reviewer', 'bonus.expiry_days', 'bonus.visit_cap',
                                 'bonus.by_hand_cap'))
  execute function private.guard_control_settings();
create trigger setting_control_removed before delete on public.setting
  for each row when (old.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config', 'rakeback.rate',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap', 'auth.store_reviewer', 'bonus.expiry_days', 'bonus.visit_cap',
                                 'bonus.by_hand_cap'))
  execute function private.guard_control_settings();

-- As 20261110647000_bonus_chips_by_hand_for_staff.sql, and an addition above bonus.by_hand_cap is refused.
create or replace function private.give_bonus_chips(p_member_id uuid, p_chips integer, p_reason text, p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select m.venue_id from public.member m where m.id = p_member_id and m.erased_at is null);
  v_key text := 'bonus.hand:' || p_request_id;
  v_is_retry boolean;
  v_most integer;
  v_cap bigint;
  v_is_capped boolean;
  v_staff uuid;
  v_id uuid;
begin
  if v_venue_id is null or not private.has_permission(v_venue_id, 'bonus.give') then
    raise exception 'Only super admins, admins and floor managers add bonus chips' using errcode = '42501';
  end if;
  if private.is_own_cage_record(p_member_id) or coalesce(private.is_own_kyc_check(p_member_id), false) then
    raise exception 'Staff never add bonus chips to their own record' using errcode = 'RVOWN';
  end if;
  if p_chips is null or p_chips < 50 or p_chips > 100000 or p_chips % 50 <> 0 then
    raise exception 'Whole fifties from 50 to 1,00,000 chips' using errcode = 'RVCHP';
  end if;
  if p_request_id is null or length(btrim(coalesce(p_reason, ''))) not between 3 and 200 then
    raise exception 'A reason of 3 to 200 characters, and a request id' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue_id, 'promotions', p_member_id);
  v_cap := (private.setting_at(v_venue_id, 'bonus.daily_staff_cap', '', now()) ->> 'chips')::bigint;
  v_is_capped := v_cap is not null and not private.is_super_admin(v_venue_id);
  -- One person's additions wait for each other, so two at once, to different members, cannot both fit under the limit, and a
  -- retry that waited here finds the first one done.
  if v_is_capped then
    perform pg_advisory_xact_lock(hashtextextended('bonus.daily_cap:' || v_venue_id::text || ':' || (select auth.uid())::text, 0));
  end if;
  v_is_retry := exists (select 1 from public.bonus_grant g where g.venue_id = v_venue_id and g.idempotency_key = v_key);
  -- The most at once binds everyone, a super admin too; a retry of one that went through is answered below, not refused.
  v_most := (private.setting_at(v_venue_id, 'bonus.by_hand_cap', '', now()) ->> 'chips')::numeric::integer;
  if not v_is_retry and v_most is not null and p_chips > v_most then
    raise exception 'More bonus than the club adds by hand at once' using errcode = 'RVCAP';
  end if;
  if v_is_capped and not v_is_retry
     and private.bonus_given_tonight(v_venue_id, (select auth.uid())) + p_chips::bigint * 100 > v_cap * 100 then
    v_staff := private.current_staff_id(v_venue_id);
    if not exists (select 1 from public.alert a where a.venue_id = v_venue_id and a.kind = 'bonus.daily_cap'
                   and a.detail ->> 'staff_id' = v_staff::text and a.created_at >= private.tonight_began(now())) then
      perform private.raise_alert(v_venue_id, 'bonus.daily_cap', jsonb_build_object('staff_id', v_staff, 'cap', v_cap));
    end if;
    return null;
  end if;
  v_id := private.credit_bonus(v_venue_id, p_member_id, p_chips::bigint * 100, btrim(p_reason), null, v_key);
  if not v_is_retry then
    perform private.audit(v_venue_id, 'bonus.give', 'member', p_member_id::text, null,
                          jsonb_build_object('chips', p_chips, 'bonus_grant_id', v_id), btrim(p_reason));
  end if;
  return v_id;
end;
$$;
