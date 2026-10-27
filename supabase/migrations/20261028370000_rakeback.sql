-- Hourly rakeback (#108; additions "Rakeback"; question #485, the owner's answer of 27 Oct; decision 0245). Each
-- Monday at 06:00 IST, for the club week before, each member is given bonus on their rake at each stake: every hand's
-- rake split equally among the members seated at its table when it was played (RIVR Rewards' share, decision 0161),
-- summed by member and stake. The stake's rakeback.rate in force when the week began is the share given: rounded down
-- to whole ₹50 chips, held to its cap, ending after its days. It is on top of RIVR Rewards' rake-share points.
-- @rivr/domain weekRakeShares and rakebackBonus are proved equal by packages/testing/golden/rakeback.json.
--
-- The job runs every day and looks back five weeks, giving only what is due and not yet given: Monday's run gives
-- the week just ended, and a later run gives a hand the tablet sent late, or a member's week held by a freeze or the
-- promotions kill switch once it is released. A week held more than five weeks is not given; the owner is alerted. What was given is the week's bonus grants, keyed by week, stake and member.

insert into public.setting_key (key, description, scope, value_schema) values
  ('rakeback.rate',
   'Hourly rakeback (decision 0245): the share of a member''s rake at this table type over a club week, in basis points (1000 is 10%), given as bonus each Monday at 06:00 IST, rounded down to whole ₹50 chips, held to the cap and ending after the days given. The rate in force when the week began applies to all of it; none set gives none. Only a super admin changes it, with a reason.',
   'table_type',
   '{"type":"object","properties":{"basis_points":{"type":"integer","minimum":1,"maximum":10000},"cap_paise":{"type":"integer","minimum":5000,"maximum":10000000,"multipleOf":5000},"expires_days":{"type":"integer","minimum":1,"maximum":365}},"required":["basis_points","expires_days"],"additionalProperties":false}');

-- As before (20261028140000_money_settings.sql), with rakeback.rate a control setting too: only a super admin changes
-- it, with a reason, and the owner is alerted.
drop trigger setting_control_set on public.setting;
drop trigger setting_control_removed on public.setting;
create trigger setting_control_set before insert on public.setting
  for each row when (new.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config', 'rakeback.rate'))
  execute function private.guard_control_settings();
create trigger setting_control_removed before delete on public.setting
  for each row when (old.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config', 'rakeback.rate'))
  execute function private.guard_control_settings();

-- @rivr/domain rakebackBonus: the rate's share of the rake, rounded down to whole ₹50 chips, then held to the cap.
create function private.rakeback_bonus(p_share bigint, p_basis_points integer, p_cap bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select least(p_share * p_basis_points / 10000 / 5000 * 5000, p_cap); -- least() passes over a cap of null
$$;

-- Each member's rake at each of a venue's stakes between two moments: every hand's rake split among the members
-- seated at its table when it was played, rounded down to the paisa per hand, as private.visit_rake_share splits it.
create function private.week_rake_shares(p_venue_id uuid, p_from timestamptz, p_to timestamptz)
returns table (member_id uuid, stake text, share_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with seated as materialized (
    select s.member_id, t.o_table_id, t.o_from, t.o_to
    from public.seat_session s
    cross join lateral private.session_tables(s.id) t
    where s.venue_id = p_venue_id and s.started_at < p_to and (s.ended_at > p_from or s.ended_at is null)
  ),
  shares as (
    select o.member_id, tt.code as stake, private.rake_share(h.rake_paise, (count(*) over (partition by h.id))::integer) as share
    from public.hand h
    join seated o on o.o_table_id = h.table_id and o.o_from <= h.played_at and o.o_to > h.played_at
    join public.game_table g on g.id = h.table_id
    join public.table_type tt on tt.id = g.table_type_id
    where h.venue_id = p_venue_id and h.played_at >= p_from and h.played_at < p_to and h.rake_paise > 0
  )
  select s.member_id, s.stake, sum(s.share)::bigint from shares s group by s.member_id, s.stake having sum(s.share) > 0;
$$;

-- The club week before a moment: Monday 06:00 IST to Monday 06:00 IST.
create function private.rakeback_week(p_at timestamptz)
returns table (week_from timestamptz, week_to timestamptz)
language sql
stable
set search_path = ''
as $$
  select w - interval '7 days', w
  from (select (date_trunc('week', (p_at at time zone 'Asia/Kolkata') - interval '6 hours') + interval '6 hours') at time zone 'Asia/Kolkata' as w) x;
$$;

-- What a venue's members are still due for the club week from p_week_from: for each member and stake with a rate,
-- the rate in force when the week began of the week's rake there, less what was given for it before. The bonus's key
-- ends with what was given before, so a second run finding the same still due gives it once.
create function private.rakeback_due(p_venue_id uuid, p_week_from timestamptz)
returns table (member_id uuid, stake text, rate jsonb, due_paise bigint, key text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.member_id, d.stake, d.rate, d.bonus - d.given, d.key_start || d.given
  from (
    select s.member_id, s.stake, r.rate, k.key_start,
           private.rakeback_bonus(s.share_paise, (r.rate ->> 'basis_points')::integer, (r.rate ->> 'cap_paise')::bigint) as bonus,
           (select coalesce(sum(g.amount_paise), 0)::bigint from public.bonus_grant g
            where g.venue_id = p_venue_id and g.member_id = s.member_id and starts_with(g.idempotency_key, k.key_start)) as given
    from private.week_rake_shares(p_venue_id, p_week_from, p_week_from + interval '7 days') s
    cross join lateral (select private.setting_at(p_venue_id, 'rakeback.rate', s.stake, p_week_from) as rate) r
    cross join lateral (select 'rakeback:' || to_char(p_week_from at time zone 'Asia/Kolkata', 'YYYY-MM-DD') || ':' || s.stake || ':'
                               || s.member_id || ':' as key_start) k
    where r.rate is not null
  ) d
  where d.bonus > d.given;
$$;

-- Gives a venue's rakeback still due for the club week from p_week_from. A frozen member or venue, or promotions
-- switched off at the kill switch, is skipped and given by a later run once released. Returns how many were given.
create function private.give_rakeback(p_venue_id uuid, p_week_from timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due record;
  v_given integer := 0;
begin
  for v_due in select * from private.rakeback_due(p_venue_id, p_week_from) order by member_id, stake loop
    begin
      perform private.assert_writable(p_venue_id, 'promotions', v_due.member_id);
      perform private.credit_bonus(p_venue_id, v_due.member_id, v_due.due_paise, 'Hourly rakeback',
                                   now() + make_interval(days => (v_due.rate ->> 'expires_days')::integer), v_due.key);
      v_given := v_given + 1;
    exception when sqlstate 'RVFRZ' or sqlstate 'RVKIL' or sqlstate 'RVMBR' then
      null;
    end;
  end loop;
  return v_given;
end;
$$;

-- Every venue's rakeback for the five club weeks before, each day at 06:00 IST (00:30 UTC). A venue refused is alerted
-- to its owner and tried again the next day; the other venues still get theirs. A week no longer looked at with
-- rakeback still due (held more than five weeks) is told to the owner once, as rakeback.unpaid.
create function private.give_rakeback_everywhere()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
  v_week timestamptz;
  v_past timestamptz := (select w.week_from - interval '35 days' from private.rakeback_week(now()) w);
begin
  for v_venue_id in select v.id from public.venue v loop
    for v_week in
      select w.week_from - make_interval(days => 7 * n) from private.rakeback_week(now()) w cross join generate_series(4, 0, -1) n
    loop
      begin
        perform private.give_rakeback(v_venue_id, v_week);
      exception when others then
        perform private.raise_alert(v_venue_id, 'rakeback.refused', jsonb_build_object('week_from', v_week, 'reason', sqlerrm));
        exit;
      end;
    end loop;
    if exists (select 1 from private.rakeback_due(v_venue_id, v_past))
       and not exists (select 1 from public.alert a where a.venue_id = v_venue_id and a.kind = 'rakeback.unpaid'
                         and a.detail @> jsonb_build_object('week_from', v_past)) then
      perform private.raise_alert(v_venue_id, 'rakeback.unpaid', jsonb_build_object('week_from', v_past));
    end if;
  end loop;
end;
$$;

revoke execute on function private.rakeback_bonus(bigint, integer, bigint), private.week_rake_shares(uuid, timestamptz, timestamptz),
  private.rakeback_week(timestamptz), private.rakeback_due(uuid, timestamptz), private.give_rakeback(uuid, timestamptz),
  private.give_rakeback_everywhere()
  from public, anon, authenticated;

select cron.schedule('rakeback-daily', '30 0 * * *', 'select private.give_rakeback_everywhere()');
