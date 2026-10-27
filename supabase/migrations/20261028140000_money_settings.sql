-- Money settings (#499; question #494 items 1 and 2, the owner's answers of 27 Oct; decision 0213).
-- 1. high_hand.payouts, jackpot.payout and gst.config join the control settings: only a super admin changes them, with
--    a reason, and the owner is alerted. tier.default stays with admins.
-- 2. A raise of the second-approver threshold, or of the credit approval threshold, takes effect 24 hours after it is
--    made, so the owner hears of it before anyone can pay or approve alone under it. A cut takes effect as asked.

drop trigger setting_control_set on public.setting;
drop trigger setting_control_removed on public.setting;
create trigger setting_control_set before insert on public.setting
  for each row when (new.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config'))
  execute function private.guard_control_settings();
create trigger setting_control_removed before delete on public.setting
  for each row when (old.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config'))
  execute function private.guard_control_settings();

-- The threshold a value of these keys sets: above it a second approver (0063), or a super admin (0058), is needed.
create function private.control_threshold(p_key text, p_value jsonb)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case p_key
           when 'cage.second_approver_threshold' then (p_value ->> 'threshold_paise')::bigint
           when 'credit.config' then (p_value ->> 'approval_threshold_paise')::bigint
         end;
$$;

-- A raise waits 24 hours: its effective_from moves to a day from now if it was sooner. No threshold in force means every
-- amount needs the second person, so any threshold is a raise. The database itself (seed, migrations, a practice reset)
-- is not delayed.
create function private.delay_threshold_raise()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_in_force bigint := private.control_threshold(new.key, private.setting_at(new.venue_id, new.key, new.subject, now()));
begin
  if (select auth.uid()) is null or coalesce(private.purging(new.venue_id), false) then
    return new;
  end if;
  if v_in_force is null or private.control_threshold(new.key, new.value) > v_in_force then
    new.effective_from := greatest(new.effective_from, now() + interval '24 hours');
  end if;
  return new;
end;
$$;

revoke execute on function private.control_threshold(text, jsonb), private.delay_threshold_raise() from public, anon, authenticated;

create trigger setting_threshold_raise_waits before insert on public.setting
  for each row when (new.key in ('cage.second_approver_threshold', 'credit.config'))
  execute function private.delay_threshold_raise();

-- What the Settings screen says under each key.
update public.setting_key set description = description || ' A raise of the threshold takes effect 24 hours after it is made; a cut, as set.'
where key in ('cage.second_approver_threshold', 'credit.config');
update public.setting_key set description = description || ' Only a super admin changes it, with a reason.'
where key in ('high_hand.payouts', 'jackpot.payout', 'gst.config');
