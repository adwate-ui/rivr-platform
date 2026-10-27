-- Hourly rakeback (#108; additions "Rakeback"; question #485, the owner's answer of 27 Oct; decision 0245). A promotion
-- rule set off by rake_week gives each member, every Monday at 06:00 IST for the club week before, a bonus on their rake
-- at each table: every hand's rake split equally among the members seated at its table when it was played (RIVR
-- Rewards' share, decision 0161), summed by member and table. The table's stake picks the rule (its `stakes`
-- condition), and the rule's percentage bonus is the rate: its share of that rake, rounded down to whole ₹50 chips and
-- held to its cap, credited as bonus by the engine with its budget, per-player limit and kill switch. It is on top of
-- RIVR Rewards' rake-share points. @rivr/domain weekRakeShares and rakebackBonus are proved equal by
-- packages/testing/golden/rakeback.json.

alter table public.promotion_rule drop constraint promotion_rule_trigger_check,
  add constraint promotion_rule_trigger_check check (trigger in ('buy_in', 'hours_played', 'hand_logged', 'tournament_entry', 'referral',
                                                                 'check_in', 'graduation', 'date_window', 'rake_week'));

-- As before (20261020145904_promotions_engine.sql), the engine weighing rake_week events too.
create or replace function private.evaluate_promotions(p_venue_id uuid, p_trigger text, p_context jsonb)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_table_id uuid := (p_context ->> 'table_id')::uuid;
  v_facts jsonb;
  v_promotion public.promotion;
  v_candidate jsonb;
  v_candidates jsonb := '[]'::jsonb;
begin
  if p_trigger is null or p_trigger <> all (array['buy_in', 'hours_played', 'hand_logged', 'tournament_entry', 'referral', 'check_in',
                                                  'graduation', 'date_window', 'rake_week'])
     or length(coalesce(p_context ->> 'key', '')) not between 1 and 200 or coalesce((p_context ->> 'amount_paise')::bigint, 0) < 0
     or coalesce((p_context ->> 'points')::bigint, 0) < 0 or coalesce((p_context ->> 'hours_played')::numeric, 0) < 0
     or (p_context ? 'amount_paise') <> (p_context ? 'method') or coalesce(p_context ->> 'method', 'cash') not in ('cash', 'upi', 'wallet', 'bonus')
     or coalesce(p_context ->> 'hand', 'bad_beat') not in ('four_of_a_kind', 'straight_flush', 'royal_flush', 'bad_beat')
     or (v_table_id is not null and not exists (select 1 from public.game_table g where g.id = v_table_id and g.venue_id = p_venue_id)) then
    raise exception 'A trigger, the event''s key, a table of this venue, a known method and hand, and nothing below nothing' using errcode = '22023';
  end if;
  if not exists (select 1 from public.member m where m.id = v_member_id and m.venue_id = p_venue_id) then
    raise exception 'No such member at this venue' using errcode = 'RVNOM';
  end if;
  begin
    perform private.assert_writable(p_venue_id, 'promotions', v_member_id);
  exception when sqlstate 'RVFRZ' or sqlstate 'RVKIL' or sqlstate 'RVMBR' then
    return;
  end;
  v_facts := private.promotion_facts(v_member_id, v_table_id, now())
             || jsonb_strip_nulls(jsonb_build_object('hours_played', p_context -> 'hours_played', 'hand', p_context -> 'hand'));
  for v_promotion in
    select p.* from public.promotion p
    where p.venue_id = p_venue_id and p.status = 'live' and p.starts_at <= now() and (p.ends_at is null or p.ends_at > now())
      and exists (select 1 from public.promotion_rule r where r.promotion_id = p.id and r.trigger = p_trigger)
    order by p.priority desc, p.created_at, p.id
    for update
  loop
    v_candidate := private.promotion_candidate(v_promotion, p_trigger, v_facts, p_context);
    if v_candidate is not null then
      v_candidates := v_candidates || jsonb_build_array(v_candidate);
    end if;
  end loop;
  for v_candidate in
    select e.c from jsonb_array_elements(v_candidates) with ordinality as e (c, n)
    where e.c ->> 'promotion' = any (private.promotions_to_give(v_candidates)) order by e.n
  loop
    return next private.give_promotion(v_candidate, v_facts, p_context);
  end loop;
end;
$$;

-- Each member's rake at each of a venue's tables between two moments: every hand's rake split among the members seated
-- at its table when it was played, rounded down to the paisa per hand, as private.visit_rake_share splits it.
create function private.week_rake_shares(p_venue_id uuid, p_from timestamptz, p_to timestamptz)
returns table (member_id uuid, table_id uuid, share_paise bigint)
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
    select o.member_id, h.table_id, private.rake_share(h.rake_paise, (count(*) over (partition by h.id))::integer) as share
    from public.hand h
    join seated o on o.o_table_id = h.table_id and o.o_from <= h.played_at and o.o_to > h.played_at
    where h.venue_id = p_venue_id and h.played_at >= p_from and h.played_at < p_to and h.rake_paise > 0
  )
  select s.member_id, s.table_id, sum(s.share)::bigint from shares s group by s.member_id, s.table_id having sum(s.share) > 0;
$$;

-- The club week before now: Monday 06:00 IST to Monday 06:00 IST.
create function private.rakeback_week(p_at timestamptz)
returns table (week_from timestamptz, week_to timestamptz)
language sql
stable
set search_path = ''
as $$
  select w - interval '7 days', w
  from (select (date_trunc('week', (p_at at time zone 'Asia/Kolkata') - interval '6 hours') + interval '6 hours') at time zone 'Asia/Kolkata' as w) x;
$$;

-- Gives a venue's rakeback for the week before: an engine event per member and table, the week's rake there as its
-- amount, keyed by the week, so a second run gives nothing twice. A member or venue the kill switch holds gets none
-- that week (the engine gives nothing); the others still do. Nothing to weigh when no live promotion has a rake_week rule.
create function private.give_rakeback(p_venue_id uuid, p_at timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week record;
  v_share record;
  v_given integer := 0;
begin
  if not exists (select 1 from public.promotion p join public.promotion_rule r on r.promotion_id = p.id
                 where p.venue_id = p_venue_id and p.status = 'live' and r.trigger = 'rake_week') then
    return 0;
  end if;
  select * into v_week from private.rakeback_week(p_at);
  for v_share in select * from private.week_rake_shares(p_venue_id, v_week.week_from, v_week.week_to) order by member_id, table_id loop
    -- The engine itself gives nothing to a member or venue the kill switch holds.
    v_given := v_given + (select count(*)::integer from private.evaluate_promotions(p_venue_id, 'rake_week', jsonb_build_object(
      'member_id', v_share.member_id, 'table_id', v_share.table_id, 'amount_paise', v_share.share_paise, 'method', 'cash',
      'key', 'rake_week:' || to_char(v_week.week_from at time zone 'Asia/Kolkata', 'YYYY-MM-DD') || ':' || v_share.table_id)));
  end loop;
  return v_given;
end;
$$;

-- Every venue's rakeback, each Monday at 06:00 IST (00:30 UTC).
create function private.give_rakeback_everywhere()
returns void
language sql
security definer
set search_path = ''
as $$
  select private.give_rakeback(v.id, now()) from public.venue v;
$$;

revoke execute on function private.week_rake_shares(uuid, timestamptz, timestamptz), private.rakeback_week(timestamptz),
  private.give_rakeback(uuid, timestamptz), private.give_rakeback_everywhere() from public, anon, authenticated;

select cron.schedule('rakeback-weekly', '30 0 * * 1', 'select private.give_rakeback_everywhere()');
