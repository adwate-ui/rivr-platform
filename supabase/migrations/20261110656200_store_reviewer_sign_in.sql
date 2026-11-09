-- How the app stores' reviewers sign in (the owner, tracker Q9, decision 0575): codes go by WhatsApp, which a reviewer cannot
-- receive, so one number on production has a private fixed code. That code must never open a real account: the number signs in
-- only while it is no one who has played, and no staff member.

insert into public.setting_key (key, description, scope, value_schema) values
  ('auth.store_reviewer',
   'The one number the app stores'' reviewers sign in with. Set on the day the store apps go in for review. None set is none.',
   'venue',
   '{"type":"object","properties":{"phone":{"type":"string","pattern":"^\\+91[6-9][0-9]{9}$"}},"required":["phone"],"additionalProperties":false}');

-- As before (20261110647000_bonus_chips_by_hand_for_staff.sql), with auth.store_reviewer a control setting too: it decides which
-- number a fixed code may sign in.
drop trigger setting_control_set on public.setting;
drop trigger setting_control_removed on public.setting;
create trigger setting_control_set before insert on public.setting
  for each row when (new.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config', 'rakeback.rate', 'points.daily_staff_cap',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap', 'auth.store_reviewer'))
  execute function private.guard_control_settings();
create trigger setting_control_removed before delete on public.setting
  for each row when (old.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config', 'rakeback.rate', 'points.daily_staff_cap',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap', 'auth.store_reviewer'))
  execute function private.guard_control_settings();

-- Whether this login is the reviewer's number and also someone real: a staff member, linked or still to be linked by that number
-- on first sign-in, or a member with a visit (every seat has
-- one), a tournament entry or a ledger entry. A waitlist place or a selfie is not history, so a reviewer can use the app.
create function private.store_reviewer_has_history(p_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.venue v on not v.is_practice
    where u.id::text = p_user_id
      and private.setting_at(v.id, 'auth.store_reviewer', '', now()) ->> 'phone' = '+' || u.phone
      and (exists (select 1 from public.staff s where s.user_id = u.id or s.phone = '+' || u.phone)
           or exists (select 1 from public.member m
                      where m.venue_id = v.id and m.phone = '+' || u.phone
                        and (exists (select 1 from public.visit x where x.member_id = m.id)
                             or exists (select 1 from public.tournament_entry x where x.member_id = m.id)
                             or exists (select 1 from public.ledger_entry e join public.ledger_account a on a.id = e.account_id
                                        where a.member_id = m.id))))
  );
$$;
revoke execute on function private.store_reviewer_has_history(text) from public, anon, authenticated;

-- As in 20261019090700_device_login.sql, with the reviewer's number refused once it is someone real.
create or replace function private.require_code_sign_in(event jsonb)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.device d where d.auth_user_id::text = event ->> 'user_id') then
      case
        when jsonb_path_exists(event, '$.claims.amr[*] ? (@.method == "password")')
         and not jsonb_path_exists(event, '$.claims.amr[*] ? (@.method != "password")')
         and exists (select 1 from public.device d
                     where d.auth_user_id::text = event ->> 'user_id' and d.revoked_at is null
                       and not exists (select 1 from public.control_state c
                                       where c.level = 'access_revoke' and c.device_id = d.id and c.released_at is null))
        then event
        else jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'This device is not paired.'))
      end
    -- Lax JSON path: an amr that is missing or null, or holds no otp method, matches nothing.
    when jsonb_path_exists(event, '$.claims.amr[*] ? (@.method == "otp")') then
      case
        when private.store_reviewer_has_history(event ->> 'user_id')
        then jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'This number cannot sign in. Ask at the front desk.'))
        else event
      end
    else jsonb_build_object(
      'error', jsonb_build_object('http_code', 403, 'message', 'Sign in with the code sent to your phone.')
    )
  end
$$;
