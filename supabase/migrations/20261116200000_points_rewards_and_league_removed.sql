-- Points, the rewards catalogue with its redemptions and hotel nights, and the RIVR League go (redesign of 15 Nov 2026, issues
-- 945 and 946; docs/spec/redesign-2026-11-15.md slice 1). A promotion gives bonus chips or a perk; a visit closes without
-- earning; erasure forfeits bonus chips alone; the website keeps its rakeback table and its cab card. Tiers stay: staff set
-- them. Every function below is as the newest migration before this one left it, less what named the removed things.
--
-- What stays on purpose: the ledger's points and hotel-night accounts and their past entries, which nothing reads or writes
-- from here on (decision 0585); Learn's own points figure on a session, which credits nothing now and goes with Learn (issue
-- 947); the `rewards` and `league` values of the TV board list, until the TVs' own issue rebuilds it (971); the
-- `redemptions` value of the kill switch's list, until the kill switch goes (951).

-- Promotions that gave points alone go whole, as the free spin's did: a version's reward must stay one the schema accepts.
-- One that also has another reward, or a grant of points on any other promotion, stops the migration: a grant counts against
-- its promotion's limits, so a person decides what those keep. Production and staging have neither (read 15 Nov 2026).
create temporary table points_promotion as
select p.id from public.promotion p
where p.template_key in ('double_points', 'triple_points')
   or exists (select 1 from public.promotion_version v where v.promotion_id = p.id and v.reward ->> 'kind' = 'points_multiplier')
   or exists (select 1 from public.promotion_rule r where r.promotion_id = p.id and r.effect ->> 'kind' = 'points');
do $$
begin
  if exists (select 1 from points_promotion s
             where exists (select 1 from public.promotion_version v where v.promotion_id = s.id and v.reward ->> 'kind' <> 'points_multiplier')
                or exists (select 1 from public.promotion_rule r where r.promotion_id = s.id and r.effect ->> 'kind' <> 'points'))
     or exists (select 1 from public.promotion_grant g
                where (g.points > 0 or g.effect ->> 'kind' in ('points', 'points_multiplier')) and g.promotion_id not in (select id from points_promotion))
     or exists (select 1 from public.promotion_grant g
                where g.promotion_id in (select id from points_promotion)
                  and (g.chips > 0 or g.cost_paise > 0 or g.bonus_grant_id is not null or g.perk is not null)) then
    raise exception 'A points reward shares its promotion with another reward, a grant gave points outside a points promotion, or a points promotion''s grant carried bonus chips or a perk: decide what its limits keep before points go';
  end if;
end;
$$;
delete from public.promotion_grant g where g.promotion_id in (select id from points_promotion);
delete from public.promotion_step_skip s where s.promotion_id in (select id from points_promotion);
-- Its versions, rules and budget go with it.
delete from public.promotion p where p.id in (select id from points_promotion);
drop table points_promotion;
update public.host_queue_item set offer = null where offer ->> 'kind' = 'points';
-- A TV on either board goes to the waitlist board. The rotations first, then the board itself, which a TV never also
-- holds in its rotation (tv_screen_check).
update public.tv_screen set rotation = array_remove(array_remove(rotation, 'rewards'), 'league') where rotation && array['rewards', 'league']::public.tv_mode[];
update public.tv_screen set mode = 'waitlist', rotation = array_remove(rotation, 'waitlist') where mode in ('rewards', 'league');
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'public-league-refresh';

-- Only a super admin changes a control setting; the daily points limit is no longer one.
drop trigger setting_control_set on public.setting;
drop trigger setting_control_removed on public.setting;
create trigger setting_control_set before insert on public.setting
  for each row when (new.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config', 'rakeback.rate',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap', 'auth.store_reviewer', 'bonus.expiry_days', 'bonus.visit_cap'))
  execute function private.guard_control_settings();
create trigger setting_control_removed before delete on public.setting
  for each row when (old.key in ('credit.config', 'cage.second_approver_threshold', 'tds.config', 'exports.alert_rows', 'alert.thresholds',
                                 'high_hand.payouts', 'jackpot.payout', 'gst.config', 'rakeback.rate',
                                 'kyc.at_the_club', 'bonus.daily_staff_cap', 'auth.store_reviewer', 'bonus.expiry_days', 'bonus.visit_cap'))
  execute function private.guard_control_settings();

-- Their settings, features and permissions.
delete from public.setting s where s.key in ('points.per_hour', 'points.rewards_rake_share', 'points.verified_bonus', 'points.daily_staff_cap',
                                             'league.points', 'league.prizes', 'accommodation.hours_per_night');
delete from public.setting_key where key in ('points.per_hour', 'points.rewards_rake_share', 'points.verified_bonus', 'points.daily_staff_cap', 'league.points', 'league.prizes', 'accommodation.hours_per_night');
delete from public.tier_feature t where t.feature_key in ('rewards.catalogue', 'rewards.points_history', 'rewards.accommodation', 'league.standings');
delete from public.member_feature_override o where o.feature_key in ('rewards.catalogue', 'rewards.points_history', 'rewards.accommodation', 'league.standings');
delete from public.feature where key in ('rewards.catalogue', 'rewards.points_history', 'rewards.accommodation', 'league.standings');
delete from public.role_permission where role = 'super_admin' and permission = 'points.give';
delete from public.role_permission where role = 'admin' and permission = 'points.give';
delete from public.role_permission where role = 'cashier' and permission = 'points.give';
delete from public.role_permission where role = 'floor' and permission = 'points.give';
delete from public.role_permission where role = 'super_admin' and permission = 'rewards.hand_over';
delete from public.role_permission where role = 'admin' and permission = 'rewards.hand_over';
delete from public.role_permission where role = 'cashier' and permission = 'rewards.hand_over';
delete from public.role_permission where role = 'host' and permission = 'rewards.hand_over';
delete from public.role_permission where role = 'floor' and permission = 'rewards.hand_over';
delete from public.role_permission where role = 'super_admin' and permission = 'rewards.manage';
delete from public.role_permission where role = 'admin' and permission = 'rewards.manage';
delete from public.role_permission where role = 'cashier' and permission = 'rewards.manage';
delete from public.role_permission where role = 'marketing' and permission = 'rewards.manage';
delete from public.role_permission where role = 'floor' and permission = 'rewards.manage';
do $$
begin
  if exists (select 1 from public.role_permission where permission in ('points.give', 'rewards.hand_over', 'rewards.manage')) then
    raise exception 'A role still holds a points or rewards permission';
  end if;
end;
$$;

-- A member sees the entries of their money accounts; the points and hotel-night accounts are shown to no one now.
alter policy "members see their entries; ledger staff see the venue's" on public.ledger_entry using (
  venue_id in (select private.venues_where('ledger.read'))
  or account_id in (select a.id from public.ledger_account a
                    where a.member_id = (select private.current_member_id()) and a.unit = 'paise'));

-- The tables, with their policies and triggers, then what only they used.
drop trigger kyc_record_verified_bonus on public.kyc_record;
drop view public.public_league_table;
drop table public.redemption, public.reward_item, public.points_earning, public.league_adjustment, public.league_finish, public.league_season,
  private.public_league_cache;
delete from private.member_export_column where table_name in ('redemption', 'points_earning', 'league_adjustment', 'league_finish')
   or (table_name = 'promotion_grant' and column_name = 'points');
alter table public.promotion_grant drop column points;

drop function public.cancel_redemption(p_redemption_id uuid, p_reason text);
drop function public.give_league_points(p_venue_id uuid, p_rows jsonb, p_reason text, p_request_id uuid);
drop function public.grant_points(p_member_id uuid, p_points bigint, p_is_locked boolean, p_reason text, p_idempotency_key uuid);
drop function public.hand_over_redemption(p_redemption_id uuid);
drop function public.member_points(p_venue_id uuid, p_phone text);
drop function public.member_points_history(p_venue_id uuid, p_member_id uuid, p_limit integer);
drop function public.member_points_of(p_venue_id uuid, p_member_id uuid);
drop function public.my_league();
drop function public.my_locked_points();
drop function public.my_points_history(p_limit integer);
drop function public.my_redemptions();
drop function public.my_rewards();
drop function public.redeem_reward(p_item_id uuid, p_points bigint, p_idempotency_key text, p_nights integer);
drop function public.reward_redemption_counts(p_venue_id uuid);
drop function public.save_league_season(p_venue_id uuid, p_name text, p_first_month date, p_last_month date, p_season_id uuid);
drop function public.save_reward_item(p_venue_id uuid, p_kind text, p_name text, p_detail text, p_points bigint, p_is_live boolean, p_item_id uuid, p_stock integer, p_stock_was integer, p_nights integer);
drop function public.tv_league_board();
drop function public.tv_rewards_ticker();
drop function public.unlock_points(p_member_id uuid, p_points bigint, p_reason text, p_idempotency_key uuid);
drop function public.venue_league(p_venue_id uuid, p_first date, p_last date);
drop function public.venue_redemptions(p_venue_id uuid);
drop function private.add_points_multiplier_templates(p_venue_id uuid);
drop function private.award_league_points(p_tournament_id uuid, p_member_id uuid, p_place integer, p_at timestamp with time zone);
drop function private.cancel_redemption(p_redemption_id uuid, p_reason text);
drop function private.credit_points(p_venue_id uuid, p_member_id uuid, p_points bigint, p_reason text, p_idempotency_key text);
drop function private.debit_nights(p_venue_id uuid, p_member_id uuid, p_thousandths bigint, p_reason text, p_idempotency_key text);
drop function private.debit_points(p_venue_id uuid, p_member_id uuid, p_points bigint, p_reason text, p_idempotency_key text);
drop function private.earn_visit_nights(p_visit_id uuid);
drop function private.earn_visit_points(p_visit_id uuid);
drop function private.forfeit_member_rewards(p_member member);
drop function private.give_league_points(p_venue_id uuid, p_rows jsonb, p_reason text, p_request_id uuid);
drop function private.give_verified_bonus();
drop function private.grant_points(p_member_id uuid, p_points bigint, p_is_locked boolean, p_reason text, p_idempotency_key uuid);
drop function private.hand_over_redemption(p_redemption_id uuid);
drop function private.league_board(p_venue_id uuid);
drop function private.league_finish_points(p_place integer, p_schedule jsonb);
drop function private.league_month(p_at timestamp with time zone);
drop function private.league_points(p_venue_id uuid, p_first date, p_last date);
drop function private.league_rows(p_venue_id uuid, p_rows jsonb);
drop function private.league_standings(p_venue_id uuid, p_first date, p_last date);
drop function private.locked_points_account(p_venue_id uuid, p_member_id uuid);
drop function private.member_points(p_venue_id uuid, p_phone text);
drop function private.member_points_history(p_venue_id uuid, p_member_id uuid, p_limit integer);
drop function private.member_points_of(p_venue_id uuid, p_member_id uuid);
drop function private.my_league();
drop function private.my_locked_points();
drop function private.my_points_history(p_limit integer);
drop function private.my_redemptions();
drop function private.my_rewards();
drop function private.nights_for_time(p_seconds bigint, p_hours_per_night integer);
drop function private.notify_redemption();
drop function private.points_for_time(p_seconds bigint, p_per_hour bigint);
drop function private.points_given_tonight(p_venue_id uuid, p_user_id uuid);
drop function private.points_held(p_member_id uuid, OUT o_earned bigint, OUT o_locked bigint);
drop function private.points_history(p_member_id uuid, p_limit integer);
drop function private.points_member(p_member_id uuid, p_points bigint, p_reason text);
drop function private.post_nights(p_venue_id uuid, p_member_id uuid, p_thousandths bigint, p_kind text, p_memo text, p_idempotency_key text);
drop function private.post_points(p_venue_id uuid, p_member_id uuid, p_points bigint, p_kind text, p_memo text, p_idempotency_key text);
drop function private.public_league_cached();
drop function private.rake_points(p_share bigint, p_basis_points integer);
drop function private.redeem_reward(p_item_id uuid, p_points bigint, p_idempotency_key text, p_nights integer);
drop function private.refresh_public_league();
drop function private.reward_redemption_counts(p_venue_id uuid);
drop function private.save_league_season(p_venue_id uuid, p_name text, p_first_month date, p_last_month date, p_season_id uuid);
drop function private.save_reward_item(p_venue_id uuid, p_kind text, p_name text, p_detail text, p_points bigint, p_is_live boolean, p_item_id uuid, p_stock integer, p_stock_was integer, p_nights integer);
drop function private.signal_rewards_boards();
drop function private.tv_league_board();
drop function private.tv_rewards_ticker();
drop function private.unlock_points(p_member_id uuid, p_points bigint, p_reason text, p_idempotency_key uuid);
drop function private.venue_league(p_venue_id uuid, p_first date, p_last date);
drop function private.venue_redemptions(p_venue_id uuid);
drop function private.visit_rake_share(p_visit_id uuid);

-- These change what they take or return, so they are dropped and made again below, with the grants they had.
drop function public.promotions_overview(p_venue_id uuid);
drop function public.member_promotion_grants(p_member_id uuid, p_limit integer);
drop function public.my_wallet();
drop function public.erase_member(p_member_id uuid, p_full_name text, p_reason text);
drop function public.member_erasure_preview(p_member_id uuid);
drop function private.visit_table_time(p_visit_id uuid);
drop function private.visit_schedule_time(p_visit_id uuid, p_schedule jsonb, p_eligibility jsonb);
drop function private.visit_schedule_time_at(p_visit_id uuid, p_schedule jsonb, p_eligibility jsonb, p_at timestamp with time zone);
drop function private.visit_window_time(p_visit_id uuid, p_conditions jsonb);
drop function private.visit_hours(p_visit_id uuid);
drop function private.promo_grant(p_reward jsonb, p_event jsonb);
drop function private.promotion_reward(p_effect jsonb, p_amount_paise bigint, p_points bigint);
drop function private.rule_in_window(p_conditions jsonb, p_trigger text, p_context jsonb);
drop function private.promotions_overview(p_venue_id uuid);
drop function private.member_promotion_grants(p_member_id uuid, p_limit integer);
drop function private.my_wallet();
drop function private.erase_member(p_member_id uuid, p_full_name text, p_reason text);
drop function private.member_erasure_preview(p_member_id uuid);

CREATE FUNCTION private.visit_table_time(p_visit_id uuid)
 RETURNS TABLE(o_session_id uuid, o_table_id uuid, o_played bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with stints as (
    select s.id as session_id, s.venue_id, t.o_table_id as table_id, t.o_from,
           extract(epoch from (least(t.o_to, v.closed_at) - t.o_from)) as seconds,
           floor(extract(epoch from (coalesce(s.ended_at, v.closed_at) - s.started_at)))::bigint as wall, s.away_seconds
    from public.visit v
    join public.seat_session s on s.visit_id = v.id
    cross join lateral private.session_tables(s.id) t
    where v.id = p_visit_id and t.o_from < v.closed_at
  )
  select r.session_id, r.table_id, private.table_played_seconds(floor(sum(r.seconds))::bigint, r.wall, greatest(0, r.wall - r.away_seconds))
  from stints r
  group by r.session_id, r.table_id, r.wall, r.away_seconds
  order by min(r.o_from);
$function$;
revoke all on function private.visit_table_time(uuid) from public, anon, authenticated, service_role;

CREATE FUNCTION private.visit_schedule_time(p_visit_id uuid, p_schedule jsonb, p_eligibility jsonb)
 RETURNS TABLE(o_seconds bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with stints as (
    select s.id as session_id, s.venue_id, t.o_table_id as table_id, t.o_from,
           private.seconds_in_schedule(p_schedule, t.o_from, least(t.o_to, v.closed_at)) as seconds,
           floor(extract(epoch from (coalesce(s.ended_at, v.closed_at) - s.started_at)))::bigint as wall, s.away_seconds
    from public.visit v
    join public.seat_session s on s.visit_id = v.id
    cross join lateral private.session_tables(s.id) t
    where v.id = p_visit_id and t.o_from < v.closed_at
  ),
  counted as (
    select st.*
    from stints st
    join public.game_table g on g.id = st.table_id
    join public.table_type tt on tt.id = g.table_type_id
    where private.is_listed(p_eligibility -> 'stakes', tt.code) and private.is_listed(p_eligibility -> 'tableIds', st.table_id::text)
  ),
  played as (
    select private.table_played_seconds(sum(r.seconds)::bigint, r.wall, greatest(0, r.wall - r.away_seconds)) as seconds
    from counted r
    group by r.session_id, r.table_id, r.wall, r.away_seconds
  )
  select coalesce(sum(p.seconds), 0)::bigint from played p;
$function$;
revoke all on function private.visit_schedule_time(uuid, jsonb, jsonb) from public, anon, authenticated, service_role;

CREATE FUNCTION private.visit_schedule_time_at(p_visit_id uuid, p_schedule jsonb, p_eligibility jsonb, p_at timestamp with time zone)
 RETURNS TABLE(o_seconds bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with visit_end as (
    select v.id, least(coalesce(v.closed_at, p_at), p_at) as ended_at from public.visit v where v.id = p_visit_id
  ),
  stints as (
    select s.id as session_id, s.venue_id, t.o_table_id as table_id, t.o_from,
           private.seconds_in_schedule(p_schedule, t.o_from, least(t.o_to, e.ended_at)) as seconds,
           floor(extract(epoch from (least(coalesce(s.ended_at, e.ended_at), e.ended_at) - s.started_at)))::bigint as wall,
           s.away_seconds + case when s.ended_at is null and s.away_since is not null
                                 then greatest(0, floor(extract(epoch from (e.ended_at - s.away_since))))::bigint else 0 end as away_seconds
    from visit_end e
    join public.seat_session s on s.visit_id = e.id
    cross join lateral private.session_tables(s.id) t
    where t.o_from < e.ended_at
  ),
  counted as (
    select st.*
    from stints st
    join public.game_table g on g.id = st.table_id
    join public.table_type tt on tt.id = g.table_type_id
    where private.is_listed(p_eligibility -> 'stakes', tt.code) and private.is_listed(p_eligibility -> 'tableIds', st.table_id::text)
  ),
  played as (
    select private.table_played_seconds(sum(r.seconds)::bigint, r.wall, greatest(0, r.wall - r.away_seconds)) as seconds
    from counted r
    group by r.session_id, r.table_id, r.wall, r.away_seconds
  )
  select coalesce(sum(p.seconds), 0)::bigint from played p;
$function$;
revoke all on function private.visit_schedule_time_at(uuid, jsonb, jsonb, timestamp with time zone) from public, anon, authenticated, service_role;

CREATE FUNCTION private.visit_window_time(p_visit_id uuid, p_conditions jsonb)
 RETURNS TABLE(o_seconds bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with stints as (
    select s.id as session_id, s.venue_id, t.o_table_id as table_id, t.o_from,
           private.seconds_in_window(t.o_from, least(t.o_to, v.closed_at), p_conditions) as seconds,
           floor(extract(epoch from (coalesce(s.ended_at, v.closed_at) - s.started_at)))::bigint as wall, s.away_seconds
    from public.visit v
    join public.seat_session s on s.visit_id = v.id
    cross join lateral private.session_tables(s.id) t
    where v.id = p_visit_id and t.o_from < v.closed_at
  ),
  counted as (
    select st.*
    from stints st
    join public.game_table g on g.id = st.table_id
    join public.table_type tt on tt.id = g.table_type_id
    where (not p_conditions ? 'stakes' or p_conditions -> 'stakes' ? tt.code)
      and (not p_conditions ? 'table_ids' or p_conditions -> 'table_ids' ? st.table_id::text)
  ),
  played as (
    select private.table_played_seconds(sum(r.seconds)::bigint, r.wall, greatest(0, r.wall - r.away_seconds)) as seconds
    from counted r
    group by r.session_id, r.table_id, r.wall, r.away_seconds
  )
  select coalesce(sum(p.seconds), 0)::bigint from played p;
$function$;
revoke all on function private.visit_window_time(uuid, jsonb) from public, anon, authenticated, service_role;

CREATE FUNCTION private.visit_hours(p_visit_id uuid)
 RETURNS TABLE(o_played bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(sum(t.o_played), 0)::bigint from private.visit_table_time(p_visit_id) t;
$function$;
revoke all on function private.visit_hours(uuid) from public, anon, authenticated, service_role;

CREATE FUNCTION private.club_month(p_at timestamp with time zone)
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select date_trunc('month', private.tonight_began(p_at) at time zone 'Asia/Kolkata')::date;
$function$;
revoke all on function private.club_month(timestamp with time zone) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.import_glaza_lines(p_venue_id uuid, p_month date, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_import_id uuid;
begin
  if not coalesce(private.has_permission(p_venue_id, 'fnb.manage'), false) then
    raise exception 'Staff who run F&B import Glaza''s lines' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 5000 then
    raise exception 'From 1 to 5,000 lines' using errcode = '22023';
  end if;
  insert into public.glaza_import (venue_id, month, imported_by_staff_id)
  values (p_venue_id, p_month, private.current_staff_id(p_venue_id))
  returning id into v_import_id;
  insert into public.glaza_import_line (venue_id, import_id, line_number, sold_at, table_name, seat, item, kind, quantity, unit_cost_paise,
                                        unit_price_paise, is_comp, table_id, visit_id)
  select p_venue_id, v_import_id, e.n, l.sold_at, l.table_name, l.seat, l.item, l.kind, l.quantity, l.unit_cost_paise, l.unit_price_paise,
         l.is_comp, g.id, s.visit_id
  from jsonb_array_elements(p_lines) with ordinality as e (line, n)
  cross join lateral (
    select (e.line ->> 'sold_at')::timestamptz as sold_at, btrim(e.line ->> 'table_name') as table_name, (e.line ->> 'seat')::integer as seat,
           btrim(e.line ->> 'item') as item, e.line ->> 'kind' as kind, (e.line ->> 'quantity')::integer as quantity,
           (e.line ->> 'unit_cost_paise')::bigint as unit_cost_paise, (e.line ->> 'unit_price_paise')::bigint as unit_price_paise,
           (e.line ->> 'is_comp')::boolean as is_comp
  ) l
  left join public.game_table g on g.venue_id = p_venue_id and lower(g.name) = lower(l.table_name)
  left join lateral (
    select (array_agg(x.visit_id))[1] as visit_id
    from public.seat_session x
    -- Where the player sat then: the seat they left by their first move after it, or the one they are in.
    cross join lateral (
      select coalesce(m.from_table_id, x.table_id) as table_id, coalesce(m.from_seat, x.seat) as seat
      from (select 1) one
      left join lateral (select y.from_table_id, y.from_seat from public.seat_move y where y.session_id = x.id and y.created_at > l.sold_at
                         order by y.created_at limit 1) m on true
    ) then_at
    where x.venue_id = p_venue_id and x.started_at <= l.sold_at and (x.ended_at is null or x.ended_at > l.sold_at)
      and then_at.table_id = g.id and (l.seat is null or then_at.seat = l.seat)
    having count(*) = 1
  ) s on true;
  if exists (select 1 from public.glaza_import_line x where x.import_id = v_import_id and private.club_month(x.sold_at) <> p_month) then
    raise exception 'Every line is sold in the club month' using errcode = '22023';
  end if;
  return v_import_id;
exception
  when check_violation or not_null_violation or invalid_text_representation or invalid_datetime_format or datetime_field_overflow
    or numeric_value_out_of_range then
    raise exception 'Each line needs a time, a table, an item, its kind, a quantity, a unit cost and price, and whether it was a comp'
      using errcode = '22023';
end;
$function$;

CREATE OR REPLACE FUNCTION private.leaderboard_from(p_period text, p_at timestamp with time zone)
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case p_period
    when 'tonight' then private.tonight_began(p_at)
    when 'week' then (date_trunc('week', private.tonight_began(p_at) at time zone 'Asia/Kolkata') + interval '6 hours') at time zone 'Asia/Kolkata'
    when 'month' then (private.club_month(p_at) + interval '6 hours') at time zone 'Asia/Kolkata'
    else '-infinity'::timestamptz
  end;
$function$;

CREATE OR REPLACE FUNCTION private.my_sessions()
 RETURNS TABLE(session_id uuid, visit_id uuid, opened_at timestamp with time zone, closed_at timestamp with time zone, table_name text, small_blind_paise bigint, big_blind_paise bigint, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint, cash_out_paise bigint, tds_paise bigint, paid_paise bigint, net_paise bigint, receipt text, month date, month_sessions integer, month_played_seconds bigint, month_net_paise bigint, tds_basis text, kind text, place integer, entrants integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with mine as (
    select v.id, v.member_id, v.opened_at, v.closed_at
    from public.visit v
    where v.member_id = private.current_member_id() and v.closed_at is not null
      and private.has_feature(v.member_id, 'sessions.history')
  ),
  played as (
    select m.id as visit_id, t.o_table_id as table_id, sum(t.o_played)::bigint as seconds
    from mine m
    cross join lateral private.visit_table_time(m.id) t
    group by m.id, t.o_table_id
  ),
  -- When the member sat at each table that visit: from their first seat there to the last time they left it (a move
  -- keeps one seat session across tables; private.session_tables splits it).
  stints as (
    select m.id as visit_id, t.o_table_id as table_id, min(greatest(t.o_from, m.opened_at)) as opened_at,
           max(least(t.o_to, m.closed_at)) as closed_at
    from mine m
    join public.seat_session s on s.visit_id = m.id
    cross join lateral private.session_tables(s.id) t
    where t.o_from < m.closed_at
    group by m.id, t.o_table_id
  ),
  -- Each table a session of its own (the owner, 9 Nov). A table sat at for under a minute in a visit of more than one
  -- (a move made by mistake and undone) is none, but a visit always keeps the table it was played at longest.
  kept as (
    select st.visit_id, st.table_id, st.opened_at, st.closed_at, coalesce(p.seconds, 0)::bigint as seconds,
           row_number() over (partition by st.visit_id order by coalesce(p.seconds, 0) desc, st.opened_at) = 1 as is_longest
    from stints st
    left join played p on p.visit_id = st.visit_id and p.table_id = st.table_id
  ),
  -- The visit's first session carries its money.
  tabled as (
    select k.visit_id, k.table_id, k.opened_at, k.closed_at, g.name, tt.small_blind_paise, tt.big_blind_paise, k.seconds,
           case when row_number() over (partition by k.visit_id order by k.opened_at, g.name) = 1 then 1 else 0 end as share
    from kept k
    join public.game_table g on g.id = k.table_id
    join public.table_type tt on tt.id = g.table_type_id
    where k.seconds >= 60 or k.is_longest
  ),
  cage as (
    select m.id as visit_id,
           coalesce(sum(c.amount_paise) filter (where c.kind = 'buy_in' and c.method <> 'bonus'), 0)::bigint as bought,
           coalesce(sum(c.amount_paise) filter (where c.kind = 'buy_in' and c.method = 'bonus'), 0)::bigint as bonus,
           coalesce(sum(c.amount_paise) filter (where c.kind = 'cash_out'), 0)::bigint as cashed,
           coalesce(sum(o.o_tds_paise), 0)::bigint as tds,
           coalesce(sum(o.o_to_member_paise), 0)::bigint as paid,
           (array_agg(upper(left(c.id::text, 8)) order by c.created_at desc) filter (where c.kind = 'cash_out'))[1] as receipt,
           (array_agg(w.basis order by c.created_at desc) filter (where w.due_paise > 0))[1] as tds_basis
    from mine m
    left join public.cage_transaction c
      on c.member_id = m.member_id and c.kind in ('buy_in', 'cash_out') and c.created_at > m.opened_at and c.created_at <= m.closed_at
    left join lateral private.cash_out_outcome(c.id) o on c.kind = 'cash_out'
    left join public.tds_withholding w on w.cage_transaction_id = c.id
    group by m.id
  ),
  credit as (
    select m.id as visit_id, coalesce(sum(k.amount_paise), 0)::bigint as markers
    from mine m
    left join public.marker k on k.member_id = m.member_id and k.issued_at > m.opened_at and k.issued_at <= m.closed_at
    group by m.id
  ),
  me as (
    select private.current_member_id() as member_id
    where private.has_feature(private.current_member_id(), 'sessions.history')
  ),
  -- Each finished tournament the member played (an entry that sat, or a payout), from the later of the clock's start and
  -- their first buy (a Day 2 has none of its own) to their last bust, or the finish if they were still in. In: every buy
  -- of an entry not refunded, an entry paid with a satellite's ticket at its value. Won: prizes, bounties, and the
  -- tickets a satellite gave, which the target's buy or the ticket's refund then spends. And the TDS withheld.
  tournaments as (
    select t.id, t.name,
           greatest((select min(p.created_at) from public.tournament_purchase p where p.tournament_id = t.id and p.member_id = me.member_id),
                    t.clock_started_at) as opened_at,
           coalesce((select max(e.busted_at) from public.tournament_entry e where e.tournament_id = t.id and e.member_id = me.member_id
                       and e.status <> 'refunded' having bool_and(e.status = 'busted')), t.finished_at) as closed_at,
           (select coalesce(sum(p.price_paise), 0) from public.tournament_purchase p join public.tournament_entry e on e.id = p.entry_id
            where p.tournament_id = t.id and p.member_id = me.member_id and e.status <> 'refunded')::bigint as bought,
           (select coalesce(sum(o.prize_paise + o.bounty_paise), 0) from public.tournament_payout o
            where o.tournament_id = t.id and o.member_id = me.member_id)::bigint
           + (select coalesce(sum(k.value_paise), 0) from public.tournament_ticket k
              where k.satellite_id = t.id and k.member_id = me.member_id)::bigint as won,
           (select coalesce(sum(o.tds_paise) filter (where not o.is_tds_shadow), 0) from public.tournament_payout o
            where o.tournament_id = t.id and o.member_id = me.member_id)::bigint as tds,
           coalesce((select min(e.place) from public.tournament_entry e where e.tournament_id = t.id and e.member_id = me.member_id and e.status <> 'refunded'),
                    (select min(o.place) from public.tournament_payout o where o.tournament_id = t.id and o.member_id = me.member_id and o.kind = 'prize')) as place,
           -- The field as places count it: every run, each entry not refunded.
           (select count(*) from public.tournament_entry e where e.tournament_id = t.id and e.status <> 'refunded')::integer as entrants
    from me
    join public.tournament t on t.finished_at is not null
      and (exists (select 1 from public.tournament_entry e where e.tournament_id = t.id and e.member_id = me.member_id and e.status in ('seated', 'busted'))
           or exists (select 1 from public.tournament_payout o where o.tournament_id = t.id and o.member_id = me.member_id))
  ),
  sessions as (
    select md5(m.id::text || ':' || l.table_id::text)::uuid as session_id, m.id as visit_id, l.opened_at, l.closed_at, l.name,
           l.small_blind_paise, l.big_blind_paise, l.seconds,
           (c.bought + k.markers) * l.share as buy_in, c.bonus * l.share as bonus, c.cashed * l.share as cashed, c.tds * l.share as tds,
           c.paid * l.share as paid, (c.cashed - c.tds - c.bought - k.markers) * l.share as net,
           case when l.share = 1 then c.receipt end as receipt, private.club_month(l.opened_at) as month,
           case when l.share = 1 then c.tds_basis end as tds_basis, 'cash'::text as kind, null::integer as place,
           null::integer as entrants
    from mine m
    join tabled l on l.visit_id = m.id
    join cage c on c.visit_id = m.id
    join credit k on k.visit_id = m.id
    union all
    select t.id, t.id, t.opened_at, t.closed_at, t.name, 0::bigint, 0::bigint, greatest(0, extract(epoch from t.closed_at - t.opened_at))::bigint,
           t.bought, 0::bigint, t.won, t.tds, t.won - t.tds, t.won - t.tds - t.bought, null::text, private.club_month(t.opened_at), null::text,
           'tournament'::text, t.place, t.entrants
    from tournaments t
  )
  select s.session_id, s.visit_id, s.opened_at, s.closed_at, s.name, s.small_blind_paise, s.big_blind_paise, s.seconds, s.buy_in, s.bonus,
         s.cashed, s.tds, s.paid, s.net, s.receipt, s.month, (count(*) over w)::integer, (sum(s.seconds) over w)::bigint,
         (sum(s.net) over w)::bigint, s.tds_basis, s.kind, s.place, s.entrants
  from sessions s
  window w as (partition by s.month)
  order by s.opened_at desc;
$function$;

CREATE FUNCTION private.promo_grant(p_reward jsonb, p_event jsonb)
 RETURNS TABLE(o_chips bigint, o_perk text, o_refusal text)
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_kind text := p_reward ->> 'kind';
  v_event text := p_event ->> 'kind';
  v_own bigint := coalesce((p_event ->> 'ownChips')::bigint, 0);
  v_chips bigint := 0;
  v_perk text;
  v_refusal text;
  v_step bigint;
begin
  if v_event = 'buy_in' and v_kind = 'buyin_bonus' then
    v_chips := case when v_own <= 0 then 0
                    when p_reward ->> 'mode' = 'fixed' then (p_reward ->> 'chips')::bigint
                    else least(v_own * (p_reward ->> 'percent')::bigint / 5000 * 50, coalesce((p_reward ->> 'capChips')::bigint, v_own)) end;
  elsif v_event = 'buy_in' and v_kind = 'bonus_chips' and p_reward ->> 'on' = 'first_buyin' then
    if not (p_event ->> 'isFirstOfVisit')::boolean then
      v_refusal := 'not_first_buy_in';
    elsif v_own > 0 then
      v_chips := (p_reward ->> 'chips')::bigint;
    end if;
  elsif v_event = 'seated' and v_kind = 'seat_bonus' then
    -- In tiers (decision 0580): on the first seat of a visit, at the first tier's chips until the limits set the tier.
    if (p_reward ? 'tiers' or not p_reward ? 'firstNSeatsPerTable') and not (p_event ->> 'isFirstOfVisit')::boolean then
      v_refusal := 'not_first_seat';
    else
      v_chips := coalesce((p_reward ->> 'chips')::bigint, (p_reward -> 'tiers' -> 0 ->> 'chips')::bigint);
    end if;
  elsif v_event = 'hours_step' and v_kind = 'hours_bonus' then
    select s.o_chips into v_step from private.promo_hours_steps(p_reward) s where s.o_after_minutes = (p_event ->> 'stepMinutes')::integer;
    if v_step is null then
      v_refusal := 'not_a_step';
    elsif (p_event ->> 'minutes')::integer < (p_event ->> 'stepMinutes')::integer then
      v_refusal := 'too_short';
    else
      v_chips := v_step;
    end if;
  elsif v_event = 'visit' and v_kind = 'cab_home' then
    if (p_event ->> 'visitInMonth')::integer >= (p_reward ->> 'fromVisitInMonth')::integer then v_perk := 'cab_home'; else v_refusal := 'not_yet'; end if;
  elsif v_event = 'visit' and v_kind in ('tournament_entry', 'waitlist_priority') then
    v_perk := v_kind;
  elsif v_kind = 'bonus_chips' and v_event in ('visit', 'referral', 'signup') and p_reward ->> 'on' = v_event then
    v_chips := (p_reward ->> 'chips')::bigint;
  else
    v_refusal := 'other_event';
  end if;
  if v_refusal is null and v_perk is null and v_chips = 0 then
    v_refusal := 'nothing_earned';
  end if;
  if v_refusal is not null then
    return query select 0::bigint, null::text, v_refusal;
  else
    return query select v_chips, v_perk, null::text;
  end if;
end;
$function$;
revoke all on function private.promo_grant(jsonb, jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.promo_stack(p_candidates jsonb)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  with c as (
    select e.c, e.n, e.c ->> 'perk' as perk
    from jsonb_array_elements(p_candidates) with ordinality as e (c, n)
  )
  select coalesce(array_agg(c.c ->> 'promotion' order by c.n), '{}'::text[])
  from c
  where c.perk is null or c.n = (select min(x.n) from c x where x.perk = c.perk);
$function$;

CREATE OR REPLACE FUNCTION private.promo_is_eligible(p_terms jsonb, p_member jsonb, p_context jsonb)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.is_listed(e -> 'tiers', p_member ->> 'tierId')
     and case e ->> 'audience'
           when 'new_30d' then (p_member ->> 'daysSinceJoined')::integer < 30
           when 'lapsed' then coalesce((p_member ->> 'daysSinceLastVisit')::integer >= 30, false)
           -- Any audience the terms no longer have, such as women, matches nobody.
           when 'everyone' then true
           else false end
     and (p_terms #>> '{reward,kind}' = 'hours_bonus'
          or (private.is_listed(e -> 'stakes', p_context ->> 'stake') and private.is_listed(e -> 'tableIds', p_context ->> 'tableId')
              and private.is_in_schedule(p_terms -> 'schedule', (p_context ->> 'at')::timestamptz)))
  from (select p_terms -> 'eligibility' as e) t;
$function$;

CREATE OR REPLACE FUNCTION private.promotion_event_kind(p_reward jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_reward ->> 'kind' = 'hours_bonus' then 'hours_step'
    when p_reward ->> 'kind' = 'seat_bonus' then 'seated'
    when p_reward ->> 'kind' = 'buyin_bonus' then 'buy_in'
    when p_reward ->> 'kind' = 'bonus_chips' then case p_reward ->> 'on' when 'first_buyin' then 'buy_in' else p_reward ->> 'on' end
    else 'visit' end;
$function$;

CREATE OR REPLACE FUNCTION private.promotion_event(p_kind text, p_version promotion_version, p_context jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member uuid := (p_context ->> 'member_id')::uuid;
  v_table uuid := (p_context ->> 'table_id')::uuid;
  v_visit uuid := coalesce((p_context ->> 'visit_id')::uuid, private.current_visit(v_member));
  v_base jsonb;
  v_time record;
begin
  v_base := jsonb_build_object('kind', p_kind, 'key', p_context ->> 'key', 'at', now(), 'memberId', v_member, 'visitId', v_visit,
    'tableId', v_table,
    'stake', (select tt.code from public.game_table g join public.table_type tt on tt.id = g.table_type_id where g.id = v_table));
  if p_kind = 'buy_in' then
    return v_base || jsonb_build_object(
      'ownChips', case when p_context ->> 'method' = 'bonus' then 0 else coalesce((p_context ->> 'amount_paise')::bigint, 0) / 100 end,
      'isFirstOfVisit', (select count(*) <= 1 from public.cage_transaction c
                         where c.member_id = v_member and c.kind = 'buy_in'
                           and c.created_at >= coalesce((select v.opened_at from public.visit v where v.id = v_visit), private.tonight_began(now()))));
  elsif p_kind = 'seated' then
    -- At the moment they sat; the first of the visit unless an earlier seat of it remains (one undone is gone).
    return v_base || jsonb_build_object('at', least((p_context ->> 'at')::timestamptz, now()),
      'isFirstOfVisit', not exists (select 1 from public.seat_session s where s.visit_id = v_visit and s.member_id = v_member
                                      and s.started_at < (p_context ->> 'at')::timestamptz));
  elsif p_kind = 'time_played' then
    select * into v_time from private.visit_schedule_time(v_visit, p_version.schedule, p_version.eligibility);
    return v_base || jsonb_build_object('minutes', v_time.o_seconds / 60);
  elsif p_kind = 'hours_step' then
    select * into v_time from private.visit_schedule_time_at(v_visit, p_version.schedule, p_version.eligibility,
                                                             least(coalesce((p_context ->> 'at')::timestamptz, now()), now()));
    return v_base || jsonb_build_object('minutes', v_time.o_seconds / 60, 'stepMinutes', (p_context ->> 'step_minutes')::integer);
  elsif p_kind = 'visit' then
    return v_base || jsonb_build_object('tableId', null, 'stake', null,
      'visitInMonth', (select count(*) from public.visit v where v.member_id = v_member and v.opened_at <= now()
                         and v.opened_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'));
  end if;
  return v_base || jsonb_build_object('visitId', null, 'tableId', null, 'stake', null);
end;
$function$;

CREATE FUNCTION private.promotion_reward(p_effect jsonb, p_amount_paise bigint)
 RETURNS TABLE(cost_paise bigint)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select r.cost
  from (select case p_effect ->> 'kind'
                 when 'bonus' then coalesce((p_effect ->> 'amount_paise')::bigint,
                                            least(coalesce(p_amount_paise, 0) * (p_effect ->> 'percent_bps')::bigint / 10000 / 5000 * 5000,
                                                  coalesce((p_effect ->> 'cap_paise')::bigint, 9223372036854775807)))
                 when 'jackpot_payout' then (p_effect ->> 'amount_paise')::bigint
                 when 'physical_prize' then coalesce((p_effect ->> 'value_paise')::bigint, 0)
                 else 0 end as cost) r
  where not (p_effect ->> 'kind' = 'bonus' and r.cost = 0);
$function$;
revoke all on function private.promotion_reward(jsonb, bigint) from public, anon, authenticated, service_role;

CREATE FUNCTION private.rule_in_window(p_conditions jsonb, p_trigger text, p_context jsonb)
 RETURNS TABLE(o_counts boolean, o_conditions jsonb, o_facts jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_visit_id uuid := (p_context ->> 'visit_id')::uuid;
  v_time record;
begin
  if p_trigger <> 'hours_played' or v_visit_id is null or not p_conditions ?| array['days', 'from'] then
    return query select true, p_conditions, '{}'::jsonb;
    return;
  end if;
  select * into v_time from private.visit_window_time(v_visit_id, p_conditions);
  return query select v_time.o_seconds > 0, p_conditions - array['days', 'from', 'until', 'stakes', 'table_ids'],
    jsonb_build_object('hours_played', trunc(v_time.o_seconds / 3600.0, 2));
end;
$function$;
revoke all on function private.rule_in_window(jsonb, text, jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.promotion_candidate(p_promotion promotion, p_trigger text, p_facts jsonb, p_context jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_day date := (p_facts ->> 'club_day')::date;
  v_given public.promotion_grant;
  v_rule public.promotion_rule;
  v_reward record;
  v_budget public.promotion_budget;
begin
  select * into v_given from public.promotion_grant g
  where g.promotion_id = p_promotion.id and g.member_id = v_member_id and g.source_key = p_context ->> 'key';
  if v_given.id is not null then
    return jsonb_build_object('promotion', p_promotion.id, 'stacks', p_promotion.stacks, 'cost_paise', v_given.cost_paise, 'is_given', true);
  end if;
  select r.* into v_rule from public.promotion_rule r
  cross join lateral private.rule_in_window(r.conditions, p_trigger, p_context) w
  where r.promotion_id = p_promotion.id and r.trigger = p_trigger and w.o_counts
    and private.promotion_applies(w.o_conditions, p_facts || w.o_facts || jsonb_build_object(
      'granted_today', (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id and g.club_day = v_day),
      'granted_today_at_table', (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id and g.club_day = v_day
                                 and g.table_id = (p_facts ->> 'table_id')::uuid)))
  order by r.position limit 1;
  if v_rule.id is null then
    return null;
  end if;
  select * into v_reward from private.promotion_reward(v_rule.effect,
    case when p_context ->> 'method' = 'bonus' then 0 else (p_context ->> 'amount_paise')::bigint end);
  if not found then
    return null;
  end if;
  select * into v_budget from public.promotion_budget b where b.promotion_id = p_promotion.id;
  return jsonb_build_object('promotion', p_promotion.id, 'name', p_promotion.name, 'venue_id', p_promotion.venue_id, 'rule', v_rule.id,
    'trigger', v_rule.trigger, 'effect', v_rule.effect, 'stacks', p_promotion.stacks, 'cost_paise', v_reward.cost_paise,
    'budget_left_paise', v_budget.cap_paise - (select coalesce(sum(g.cost_paise), 0) from public.promotion_grant g where g.promotion_id = p_promotion.id
                                               and (v_budget.period = 'promotion' or date_trunc('month', g.club_day) = date_trunc('month', v_day))),
    'grants_left', v_budget.cap_count - (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id
                                         and (v_budget.period = 'promotion' or date_trunc('month', g.club_day) = date_trunc('month', v_day))),
    'player_left', p_promotion.per_player_limit - (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id
                                                   and g.member_id = v_member_id and (p_promotion.per_player_period = 'promotion' or g.club_day = v_day)));
end;
$function$;

CREATE OR REPLACE FUNCTION private.give_promotion(p_candidate jsonb, p_facts jsonb, p_context jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_venue_id uuid := (p_candidate ->> 'venue_id')::uuid;
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_effect jsonb := p_candidate -> 'effect';
  v_id uuid;
begin
  insert into public.promotion_grant (venue_id, promotion_id, promotion_rule_id, member_id, table_id, trigger, effect, cost_paise,
                                      source_key, club_day)
  values (v_venue_id, (p_candidate ->> 'promotion')::uuid, (p_candidate ->> 'rule')::uuid, v_member_id, (p_facts ->> 'table_id')::uuid,
          p_candidate ->> 'trigger', v_effect, (p_candidate ->> 'cost_paise')::bigint, p_context ->> 'key',
          (p_facts ->> 'club_day')::date)
  returning id into v_id;
  if v_effect ->> 'kind' = 'bonus' then
    update public.promotion_grant
    set fulfilled_at = now(),
        bonus_grant_id = private.credit_bonus(v_venue_id, v_member_id, (p_candidate ->> 'cost_paise')::bigint, p_candidate ->> 'name', null,
                                              'promotion:' || v_id)
    where id = v_id;
  end if;
  perform private.emit(v_venue_id, 'promotion.granted',
                       jsonb_build_object('promotion_grant_id', v_id, 'promotion_id', p_candidate ->> 'promotion', 'member_id', v_member_id,
                                          'effect', v_effect, 'cost_paise', (p_candidate ->> 'cost_paise')::bigint),
                       'promotion.granted:' || v_id);
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.give_promotion_version(p_candidate jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_version public.promotion_version;
  v_event jsonb := p_candidate -> 'event';
  v_member uuid := (p_candidate #>> '{event,memberId}')::uuid;
  v_chips bigint := (p_candidate ->> 'chips')::bigint;
  v_id uuid;
begin
  select * into v_version from public.promotion_version v where v.id = (p_candidate ->> 'version_id')::uuid;
  insert into public.promotion_grant (venue_id, promotion_id, promotion_version_id, member_id, table_id, trigger, effect, cost_paise, chips,
                                      perk, source_key, period_key, club_day)
  values (v_version.venue_id, v_version.promotion_id, v_version.id, v_member, (v_event ->> 'tableId')::uuid, p_candidate ->> 'trigger', v_version.reward,
          v_chips * 100, v_chips, p_candidate ->> 'perk', v_event ->> 'key', p_candidate ->> 'period_key',
          private.club_day_of((v_event ->> 'at')::timestamptz))
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    return null;
  end if;
  if v_chips > 0 then
    update public.promotion_grant
    set fulfilled_at = now(),
        bonus_grant_id = private.credit_bonus(v_version.venue_id, v_member, v_chips * 100, v_version.name, null, 'promotion:' || v_id)
    where id = v_id;
  end if;
  perform private.emit(v_version.venue_id, 'promotion.granted',
                       jsonb_build_object('promotion_grant_id', v_id, 'promotion_id', v_version.promotion_id, 'promotion_version_id', v_version.id,
                                          'member_id', v_member, 'effect', v_version.reward, 'cost_paise', v_chips * 100, 'chips', v_chips,
                                          'perk', p_candidate ->> 'perk'),
                       'promotion.granted:' || v_id);
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.evaluate_promotion_versions(p_venue_id uuid, p_trigger text, p_context jsonb)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_kind text := case p_trigger when 'buy_in' then 'buy_in' when 'hours_played' then 'time_played' when 'check_in' then 'visit'
                                when 'referral' then 'referral' when 'signup' then 'signup' when 'hours_step' then 'hours_step' when 'seated' then 'seated' end;
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_member jsonb;
  v_version public.promotion_version;
  v_event jsonb;
  v_grant record;
  v_base text;
  v_tally jsonb;
  v_period text;
  v_candidates jsonb := '[]'::jsonb;
  v_candidate jsonb;
  v_id uuid;
  v_step integer;
  v_chips bigint;
begin
  -- An event is weighed once; a play-time bonus step once for each promotion, so one paying a step never stops another
  -- with the same step (money audit, 8 Nov).
  if v_kind is null or (p_trigger <> 'hours_step' and exists (
       select 1 from public.promotion_grant g where g.venue_id = p_venue_id and g.member_id = v_member_id
         and g.source_key = p_context ->> 'key' and g.promotion_version_id is not null)) then
    return;
  end if;
  v_member := private.promotion_member_facts(v_member_id);
  for v_version in
    select v.* from public.promotion_version v join public.promotion p on p.id = v.promotion_id
    where v.venue_id = p_venue_id and v.status = 'live' and private.promotion_event_kind(v.reward) = v_kind
    order by p.created_at, p.id
    for update of v
  loop
    -- A play-time step is paid once a visit by its place, whatever its minutes in the version that paid it.
    v_step := private.promo_step_key(v_version.reward, (p_context ->> 'step_minutes')::integer);
    continue when p_trigger = 'hours_step'
      and private.promo_step_settled(v_version.promotion_id, v_member_id, (p_context ->> 'visit_id')::uuid, v_step);
    v_event := private.promotion_event(v_kind, v_version, p_context);
    -- A seat is paid only by terms approved before it was taken: a promotion approved later does not reach back over it.
    continue when p_trigger = 'seated' and v_version.decided_at > (v_event ->> 'at')::timestamptz;
    continue when not private.promo_is_eligible(
      jsonb_build_object('reward', v_version.reward, 'eligibility', v_version.eligibility, 'schedule', v_version.schedule), v_member, v_event);
    select * into v_grant from private.promo_grant(v_version.reward, v_event);
    continue when v_grant.o_refusal is not null;
    -- The member's grants in the period count against up to N times; the next is keyed as theirs in it (decision 0499).
    -- The event's own moment, so a seat swept after 06:00 counts in the club day it was taken.
    v_base := private.promo_period_key(v_version.limits, p_context ->> 'key', (v_event ->> 'at')::timestamptz, (v_event ->> 'visitId')::uuid, v_step);
    v_tally := private.promotion_tally(v_version.promotion_id, v_member_id, v_base, (v_event ->> 'tableId')::uuid, private.club_day_of((v_event ->> 'at')::timestamptz),
                                       v_version.limits);
    -- A seat bonus in tiers pays its tier's chips (decision 0580).
    v_chips := coalesce(private.promo_tier_chips(v_version.reward, (v_tally ->> 'grantsGiven')::integer), v_grant.o_chips);
    continue when private.promo_check_limits(v_version.reward, v_version.limits, jsonb_build_object('chips', v_chips), v_tally) is not null;
    v_period := private.promo_slot_key(v_base, (v_tally ->> 'periodGiven')::integer);
    -- A step's grant has its visit and place for its source, so the database refuses it a second time in the visit.
    if p_trigger = 'hours_step' then
      v_event := v_event || jsonb_build_object('key', 'hours_step:' || (p_context ->> 'visit_id') || ':@' || v_step);
    end if;
    v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
      'promotion', v_version.promotion_id::text, 'version_id', v_version.id, 'trigger', p_trigger,
      'chips', v_chips, 'perk', v_grant.o_perk, 'period_key', v_period, 'event', v_event));
  end loop;
  for v_candidate in
    select e.c from jsonb_array_elements(v_candidates) with ordinality as e (c, n)
    where e.c ->> 'promotion' = any (private.promo_stack(v_candidates)) order by e.n
  loop
    v_id := private.give_promotion_version(v_candidate);
    if v_id is not null then
      return next v_id;
    end if;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION private.evaluate_promotions(p_venue_id uuid, p_trigger text, p_context jsonb)
 RETURNS SETOF uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_table_id uuid := (p_context ->> 'table_id')::uuid;
  v_facts jsonb;
  v_promotion public.promotion;
  v_candidate jsonb;
  v_candidates jsonb := '[]'::jsonb;
begin
  if p_trigger is null or p_trigger <> all (array['buy_in', 'hours_played', 'hand_logged', 'tournament_entry', 'referral', 'check_in',
                                                  'graduation', 'date_window', 'signup', 'hours_step', 'seated'])
     or length(coalesce(p_context ->> 'key', '')) not between 1 and 200 or coalesce((p_context ->> 'amount_paise')::bigint, 0) < 0
     or coalesce((p_context ->> 'hours_played')::numeric, 0) < 0
     or (p_trigger = 'hours_step') <> (p_context ? 'step_minutes')
     or (p_trigger = 'seated' and not p_context ? 'at')
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
      and not exists (select 1 from public.promotion_version x where x.promotion_id = p.id)
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
  return query select * from private.evaluate_promotion_versions(p_venue_id, p_trigger, p_context);
end;
$function$;

CREATE OR REPLACE FUNCTION private.weigh_hours_played(p_visit_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_visit public.visit;
  v_hours record;
  v_table uuid;
begin
  select * into v_visit from public.visit v where v.id = p_visit_id;
  if v_visit.closed_at is not null then
    perform private.weigh_hours_steps(p_visit_id, v_visit.closed_at);
  end if;
  select * into v_hours from private.visit_hours(p_visit_id);
  if v_visit.closed_at is null or v_hours.o_played <= 0 then return; end if;
  select t.o_table_id into v_table from private.visit_table_time(p_visit_id) t
  group by t.o_table_id order by sum(t.o_played) desc, t.o_table_id limit 1;
  perform private.evaluate_promotions(v_visit.venue_id, 'hours_played', jsonb_build_object(
    'member_id', v_visit.member_id, 'table_id', v_table, 'key', 'hours_played:' || p_visit_id, 'visit_id', p_visit_id,
    'hours_played', trunc(v_hours.o_played / 3600.0, 2)));
end;
$function$;

CREATE OR REPLACE FUNCTION private.replay_buy_ins(p_venue_id uuid, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('at', b.created_at, 'member', b.member, 'tier_id', b.tier_id, 'table_id', b.table_id,
           'stake', b.stake, 'amount_paise', b.amount_paise, 'hours_played', 0) order by b.created_at, b.id), '[]'::jsonb)
  from (
    select c.id, c.created_at, dense_rank() over (order by c.member_id) as member, m.tier_id, t.o_table_id as table_id, tt.code as stake,
           case when c.method = 'bonus' then 0 else c.amount_paise end as amount_paise
    from public.cage_transaction c
    join public.member m on m.id = c.member_id
    left join lateral (select st.o_table_id from private.session_tables(c.session_id) st
                       where st.o_from <= c.created_at order by st.o_from desc limit 1) t on true
    left join public.game_table g on g.id = t.o_table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where c.venue_id = p_venue_id and c.kind = 'buy_in' and c.created_at >= p_from and c.created_at < p_to
  ) b;
$function$;

CREATE OR REPLACE FUNCTION private.replay_hours_played(p_venue_id uuid, p_conditions jsonb, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('at', x.closed_at, 'member', x.member, 'tier_id', x.tier_id, 'table_id', x.table_id,
           'stake', x.stake, 'amount_paise', 0, 'hours_played', trunc(x.seconds / 3600.0, 2)) order by x.closed_at, x.id), '[]'::jsonb)
  from (
    select v.id, v.closed_at, dense_rank() over (order by v.member_id) as member, m.tier_id, t.table_id, tt.code as stake,
           case when p_conditions ?| array['days', 'from'] then win.o_seconds else h.o_played end as seconds
    from public.visit v
    join public.member m on m.id = v.member_id
    cross join lateral private.visit_hours(v.id) h
    cross join lateral private.visit_window_time(v.id, p_conditions) win
    left join lateral (select e.o_table_id as table_id from private.visit_table_time(v.id) e
                       group by e.o_table_id order by sum(e.o_played) desc, e.o_table_id limit 1) t on true
    left join public.game_table g on g.id = t.table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where v.venue_id = p_venue_id and v.closed_at >= p_from and v.closed_at < p_to and h.o_played > 0
      and (not p_conditions ?| array['days', 'from'] or win.o_seconds > 0)
  ) x;
$function$;

CREATE OR REPLACE FUNCTION private.replay_version_events(p_version promotion_version, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with buy_ins as (
    select c.id, c.created_at as at, c.member_id, vis.id as visit_id, t.o_table_id as table_id, tt.code as stake,
           case when c.method = 'bonus' then 0 else c.amount_paise / 100 end as own_chips,
           row_number() over (partition by c.member_id, coalesce(vis.id::text, private.club_day_of(c.created_at)::text) order by c.created_at, c.id) as nth
    from public.cage_transaction c
    left join lateral (select v.id from public.visit v where v.member_id = c.member_id and v.opened_at <= c.created_at
                       order by v.opened_at desc limit 1) vis on true
    left join lateral (select st.o_table_id from private.session_tables(c.session_id) st where st.o_from <= c.created_at
                       order by st.o_from desc limit 1) t on true
    left join public.game_table g on g.id = t.o_table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where private.promotion_event_kind(p_version.reward) = 'buy_in'
      and c.venue_id = p_version.venue_id and c.kind = 'buy_in' and c.created_at >= p_from and c.created_at < p_to
  ),
  seats as (
    select s.id, s.started_at as at, s.member_id, s.visit_id, s.table_id, tt.code as stake,
           row_number() over (partition by s.visit_id order by s.started_at, s.id) as nth
    from public.seat_session s
    left join public.game_table g on g.id = s.table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where private.promotion_event_kind(p_version.reward) = 'seated'
      and s.venue_id = p_version.venue_id and s.started_at >= p_from and s.started_at < p_to
  ),
  played as (
    select v.id, v.closed_at as at, v.member_id, w.o_seconds, lt.table_id, tt.code as stake
    from public.visit v
    cross join lateral private.visit_schedule_time(v.id, p_version.schedule, p_version.eligibility) w
    left join lateral (select e.o_table_id as table_id from private.visit_table_time(v.id) e
                       group by e.o_table_id order by sum(e.o_played) desc, e.o_table_id limit 1) lt on true
    left join public.game_table g on g.id = lt.table_id
    left join public.table_type tt on tt.id = g.table_type_id
    where private.promotion_event_kind(p_version.reward) in ('time_played', 'hours_step')
      and v.venue_id = p_version.venue_id and v.closed_at >= p_from and v.closed_at < p_to and w.o_seconds > 0
  ),
  visits as (
    select v.id, v.opened_at as at, v.member_id,
           (select count(*) from public.visit x where x.member_id = v.member_id and x.opened_at <= v.opened_at
              and x.opened_at >= date_trunc('month', v.opened_at at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as in_month
    from public.visit v
    where private.promotion_event_kind(p_version.reward) = 'visit'
      and v.venue_id = p_version.venue_id and v.opened_at >= p_from and v.opened_at < p_to
  ),
  others as (
    select r.id, r.completed_at as at, side.member_id
    from public.referral r cross join lateral (values (r.member_id), (r.referrer_member_id)) side (member_id)
    where private.promotion_event_kind(p_version.reward) = 'referral'
      and r.venue_id = p_version.venue_id and r.completed_at >= p_from and r.completed_at < p_to
    union all
    select k.id, k.verified_at, k.member_id from public.kyc_record k
    where private.promotion_event_kind(p_version.reward) = 'signup'
      and k.venue_id = p_version.venue_id and k.status = 'verified' and k.verified_at >= p_from and k.verified_at < p_to
  ),
  entries as (
    select b.at, b.id::text as id, b.member_id, 'buy_in' as kind,
           jsonb_build_object('tableId', b.table_id, 'stake', b.stake, 'ownChips', b.own_chips, 'isFirstOfVisit', b.nth = 1,
                              'visitId', 'v' || dense_rank() over (order by b.visit_id)) as more
    from buy_ins b
    union all
    select s.at, s.id::text, s.member_id, 'seated',
           jsonb_build_object('tableId', s.table_id, 'stake', s.stake, 'isFirstOfVisit', s.nth = 1, 'visitId', 'v' || dense_rank() over (order by s.visit_id))
    from seats s
    union all
    select p.at, p.id::text, p.member_id, 'time_played',
           jsonb_build_object('tableId', p.table_id, 'stake', p.stake, 'minutes', p.o_seconds / 60,
                              'visitId', 'v' || dense_rank() over (order by p.id))
    from played p
    union all
    select v.at, v.id::text, v.member_id, 'visit', jsonb_build_object('visitInMonth', v.in_month, 'visitId', 'v' || dense_rank() over (order by v.id))
    from visits v
    union all
    select o.at, o.id::text || o.member_id::text, o.member_id, private.promotion_event_kind(p_version.reward), '{}'::jsonb
    from others o
  )
  select coalesce(jsonb_agg(private.replay_entry(e.kind, e.n, e.at, e.member_id, e.member_n, e.more) order by e.at, e.n), '[]'::jsonb)
  from (select x.*, row_number() over (order by x.at, x.id) as n, dense_rank() over (order by x.member_id) as member_n from entries x) e;
$function$;

CREATE OR REPLACE FUNCTION private.reward_from_rule(p_promotion promotion, p_rule promotion_rule)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select jsonb_strip_nulls(case
    when p_rule.trigger = 'buy_in' and e ->> 'kind' = 'bonus' and (e ->> 'percent_bps')::integer % 100 = 0
      then jsonb_build_object('kind', 'buyin_bonus', 'mode', 'percent', 'percent', (e ->> 'percent_bps')::integer / 100,
                              'capChips', (e ->> 'cap_paise')::bigint / 100,
                              'firstNBuyinsPerTable', case when c #>> '{first_n,per}' = 'table' then (c #>> '{first_n,count}')::integer end)
    when p_rule.trigger = 'buy_in' and e ->> 'kind' = 'bonus' and e ? 'amount_paise' and p_promotion.per_player_period = 'promotion'
      then jsonb_build_object('kind', 'bonus_chips', 'chips', (e ->> 'amount_paise')::bigint / 100, 'on', 'first_buyin')
    when p_rule.trigger = 'buy_in' and e ->> 'kind' = 'bonus' and e ? 'amount_paise'
      then jsonb_build_object('kind', 'buyin_bonus', 'mode', 'fixed', 'chips', (e ->> 'amount_paise')::bigint / 100,
                              'firstNBuyinsPerTable', case when c #>> '{first_n,per}' = 'table' then (c #>> '{first_n,count}')::integer end)
    when p_rule.trigger = 'hours_played' and e ->> 'kind' = 'bonus' and e ? 'amount_paise' and c ? 'min_hours'
      then jsonb_build_object('kind', 'hours_bonus', 'chips', (e ->> 'amount_paise')::bigint / 100, 'afterMinutes', (c ->> 'min_hours')::integer * 60)
    when p_rule.trigger in ('referral', 'check_in') and e ->> 'kind' = 'bonus' and e ? 'amount_paise'
      then jsonb_build_object('kind', 'bonus_chips', 'chips', (e ->> 'amount_paise')::bigint / 100,
                              'on', case p_rule.trigger when 'referral' then 'referral' else 'visit' end)
    when p_rule.trigger = 'graduation' and e ->> 'kind' = 'freeroll_ticket'
      then jsonb_build_object('kind', 'tournament_entry', 'tournamentId', e ->> 'tournament')
  end)
  from (select p_rule.effect as e, p_rule.conditions as c) x
  -- Only the conditions the typed model has; first N per table only for a buy-in, where it is the reward's.
  where not exists (select 1 from jsonb_object_keys(p_rule.conditions) k
                    where k not in ('days', 'from', 'until', 'stakes', 'table_ids', 'tier_ids', 'first_n', 'min_hours'))
    and (not p_rule.conditions ? 'first_n' or p_rule.conditions #>> '{first_n,per}' = 'day' or p_rule.trigger = 'buy_in');
$function$;

CREATE OR REPLACE FUNCTION private.is_promotion_terms(p_reward jsonb, p_eligibility jsonb, p_schedule jsonb, p_limits jsonb, p_channels jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select extensions.jsonb_matches_schema('{
      "$defs": {
        "chips": {"type": "integer", "minimum": 50, "maximum": 10000000, "multipleOf": 50},
        "minutes": {"type": "integer", "minimum": 30, "maximum": 1440, "multipleOf": 30},
        "firstN": {"type": "integer", "minimum": 1, "maximum": 100}
      },
      "oneOf": [
        {"type": "object", "additionalProperties": false, "required": ["kind", "mode", "percent"],
         "properties": {"kind": {"const": "buyin_bonus"}, "mode": {"const": "percent"}, "percent": {"type": "integer", "minimum": 1, "maximum": 100},
                        "capChips": {"$ref": "#/$defs/chips"}, "firstNBuyinsPerTable": {"$ref": "#/$defs/firstN"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "mode", "chips"],
         "properties": {"kind": {"const": "buyin_bonus"}, "mode": {"const": "fixed"}, "chips": {"$ref": "#/$defs/chips"},
                        "firstNBuyinsPerTable": {"$ref": "#/$defs/firstN"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "chips"],
         "properties": {"kind": {"const": "seat_bonus"}, "chips": {"$ref": "#/$defs/chips"}, "firstNSeatsPerTable": {"$ref": "#/$defs/firstN"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "tiers"],
         "properties": {"kind": {"const": "seat_bonus"}, "tiers": {"type": "array", "minItems": 1, "maxItems": 5,
           "items": {"type": "object", "additionalProperties": false, "required": ["count", "chips"],
                     "properties": {"count": {"type": "integer", "minimum": 1, "maximum": 10000}, "chips": {"$ref": "#/$defs/chips"}}}}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "chips", "afterMinutes"],
         "properties": {"kind": {"const": "hours_bonus"}, "chips": {"$ref": "#/$defs/chips"}, "afterMinutes": {"$ref": "#/$defs/minutes"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "mode", "steps"],
         "properties": {"kind": {"const": "hours_bonus"}, "mode": {"const": "steps"},
                        "steps": {"type": "array", "minItems": 2, "maxItems": 6,
                                  "items": {"type": "object", "additionalProperties": false, "required": ["afterMinutes", "chips"],
                                            "properties": {"afterMinutes": {"$ref": "#/$defs/minutes"}, "chips": {"$ref": "#/$defs/chips"}}}}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "mode", "everyMinutes", "chips"],
         "properties": {"kind": {"const": "hours_bonus"}, "mode": {"const": "every"},
                        "everyMinutes": {"type": "integer", "minimum": 30, "maximum": 720, "multipleOf": 30}, "chips": {"$ref": "#/$defs/chips"},
                        "timesPerVisit": {"type": "integer", "minimum": 1, "maximum": 20}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "chips", "on"],
         "properties": {"kind": {"const": "bonus_chips"}, "chips": {"$ref": "#/$defs/chips"}, "on": {"enum": ["visit", "first_buyin", "referral", "signup"]}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "fromVisitInMonth"],
         "properties": {"kind": {"const": "cab_home"}, "fromVisitInMonth": {"type": "integer", "minimum": 1, "maximum": 31}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "tournamentId"],
         "properties": {"kind": {"const": "tournament_entry"}, "tournamentId": {"type": "string", "minLength": 1, "maxLength": 80, "pattern": "\\S"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind"], "properties": {"kind": {"const": "waitlist_priority"}}}
      ]
    }', p_reward)
    -- A play-time bonus's set steps each later than the one before (owner, 8 Nov).
    and (p_reward ->> 'mode' is distinct from 'steps' or private.is_rising_steps(p_reward -> 'steps'))
    and extensions.jsonb_matches_schema('{
      "type": "object", "additionalProperties": false, "required": ["stakes", "tiers", "audience"],
      "properties": {
        "stakes": {"oneOf": [{"const": "all"}, {"type": "array", "minItems": 1, "items": {"type": "string", "pattern": "^[a-z0-9_]{2,40}$"}}]},
        "tableIds": {"type": "array", "minItems": 1, "items": {"type": "string", "minLength": 1, "maxLength": 64}},
        "tiers": {"oneOf": [{"const": "all"}, {"type": "array", "minItems": 1, "items": {"type": "string", "minLength": 1, "maxLength": 64}}]},
        "audience": {"enum": ["everyone", "new_30d", "lapsed"]}
      }
    }', p_eligibility)
    and extensions.jsonb_matches_schema('{
      "type": "object", "additionalProperties": false, "required": ["days", "from", "to", "startsOn", "timezone"],
      "properties": {
        "days": {"type": "array", "minItems": 1, "maxItems": 7, "uniqueItems": true, "items": {"type": "integer", "minimum": 1, "maximum": 7}},
        "from": {"type": "string", "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$"},
        "to": {"type": "string", "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$"},
        "startsOn": {"type": "string"},
        "endsOn": {"type": "string"},
        "timezone": {"const": "Asia/Kolkata"}
      }
    }', p_schedule)
    and private.is_iso_day(p_schedule ->> 'startsOn')
    and (not p_schedule ? 'endsOn' or (private.is_iso_day(p_schedule ->> 'endsOn') and p_schedule ->> 'endsOn' >= p_schedule ->> 'startsOn'))
    and extensions.jsonb_matches_schema('{
      "type": "object", "additionalProperties": false, "required": ["perMember"],
      "properties": {
        "perMember": {"enum": ["none", "per_visit", "per_day", "per_week", "once"]},
        "timesPerMember": {"type": "integer", "minimum": 2, "maximum": 20},
        "maxMembersPerDay": {"type": "integer", "minimum": 1, "maximum": 10000},
        "budgetChips": {"type": "integer", "minimum": 50, "maximum": 10000000, "multipleOf": 50},
        "maxGrants": {"type": "integer", "minimum": 1, "maximum": 1000000},
        "budgetPeriod": {"enum": ["month"]}
      }
    }', p_limits)
    -- Up to N times a member needs a period; a monthly budget needs a budget or most grants (decision 0499).
    and (not p_limits ? 'timesPerMember' or p_limits ->> 'perMember' <> 'none')
    and (not p_limits ? 'budgetPeriod' or p_limits ? 'budgetChips' or p_limits ? 'maxGrants')
    and extensions.jsonb_matches_schema('{
      "type": "object", "additionalProperties": false, "required": ["playerApp", "tv", "website", "whatsapp"],
      "properties": {"playerApp": {"type": "boolean"}, "tv": {"type": "boolean"}, "website": {"type": "boolean"}, "whatsapp": {"type": "boolean"}}
    }', p_channels)
    -- A seat bonus in tiers counts its claims over the promotion's life, each member once (decision 0580): no monthly reset.
    and (not (p_reward ->> 'kind' = 'seat_bonus' and p_reward ? 'tiers')
         or (p_limits ->> 'perMember' = 'once' and not p_limits ? 'timesPerMember' and coalesce(p_limits ->> 'budgetPeriod', '') <> 'month'));
$function$;

CREATE OR REPLACE FUNCTION private.is_promotion_rule(p_conditions jsonb, p_effect jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select extensions.jsonb_matches_schema('{
      "type": "object", "additionalProperties": false,
      "properties": {
        "tier_ids": {"type": "array", "minItems": 1, "items": {"type": "string", "minLength": 1, "maxLength": 64}},
        "stakes": {"type": "array", "minItems": 1, "items": {"type": "string", "pattern": "^[a-z0-9_]{2,40}$"}},
        "table_ids": {"type": "array", "minItems": 1, "items": {"type": "string", "minLength": 1, "maxLength": 64}},
        "days": {"type": "array", "minItems": 1, "items": {"type": "integer", "minimum": 1, "maximum": 7}},
        "from": {"type": "string", "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$"},
        "until": {"type": "string", "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$"},
        "first_n": {"type": "object", "additionalProperties": false, "required": ["count", "per"],
                    "properties": {"count": {"type": "integer", "minimum": 1, "maximum": 1000}, "per": {"enum": ["table", "day"]}}},
        "new_player": {"const": true},
        "lapsed_days": {"type": "integer", "minimum": 1, "maximum": 365},
        "min_visits_in_month": {"type": "integer", "minimum": 1, "maximum": 31},
        "call_time_complete": {"const": true},
        "min_hours": {"type": "integer", "minimum": 1, "maximum": 24},
        "hands": {"type": "array", "minItems": 1, "items": {"enum": ["four_of_a_kind", "straight_flush", "royal_flush", "bad_beat"]}}
      }
    }', p_conditions)
    -- A window is given whole, and opens before it closes within the club's day.
    and (p_conditions ? 'from') = (p_conditions ? 'until')
    and (not p_conditions ? 'from'
         or private.club_minute(p_conditions ->> 'from') < coalesce(nullif(private.club_minute(p_conditions ->> 'until'), 0), 1440))
    and extensions.jsonb_matches_schema('{
      "$defs": {
        "chips": {"type": "integer", "minimum": 5000, "maximum": 1000000000, "multipleOf": 5000},
        "days": {"type": "integer", "minimum": 1, "maximum": 90},
        "name": {"type": "string", "minLength": 1, "maxLength": 80, "pattern": "\\S"}
      },
      "oneOf": [
        {"type": "object", "additionalProperties": false, "required": ["kind", "amount_paise"],
         "properties": {"kind": {"const": "bonus"}, "amount_paise": {"$ref": "#/$defs/chips"}, "expires_days": {"$ref": "#/$defs/days"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "percent_bps", "expires_days"],
         "properties": {"kind": {"const": "bonus"}, "percent_bps": {"type": "integer", "minimum": 1, "maximum": 10000},
                        "cap_paise": {"$ref": "#/$defs/chips"}, "expires_days": {"$ref": "#/$defs/days"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "tournament"],
         "properties": {"kind": {"const": "freeroll_ticket"}, "tournament": {"$ref": "#/$defs/name"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind"], "properties": {"kind": {"const": "cab_eligibility"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "prize"],
         "properties": {"kind": {"const": "physical_prize"}, "prize": {"$ref": "#/$defs/name"},
                        "value_paise": {"type": "integer", "minimum": 0, "maximum": 1000000000}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "pool", "amount_paise"],
         "properties": {"kind": {"const": "jackpot_payout"}, "pool": {"enum": ["main", "season", "freeroll"]}, "amount_paise": {"$ref": "#/$defs/chips"}}},
        {"type": "object", "additionalProperties": false, "required": ["kind", "text"],
         "properties": {"kind": {"const": "message"}, "text": {"type": "string", "minLength": 1, "maxLength": 500, "pattern": "\\S"}}}
      ]
    }', p_effect);
$function$;

CREATE OR REPLACE FUNCTION private.is_promotion_simulation(p_simulation jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select extensions.jsonb_matches_schema('{
    "type": "object", "additionalProperties": false,
    "required": ["events", "membersQualified", "timesGiven", "chips", "perks", "isBudgetReached"],
    "properties": {
      "events": {"type": "integer", "minimum": 0}, "membersQualified": {"type": "integer", "minimum": 0},
      "timesGiven": {"type": "integer", "minimum": 0}, "chips": {"type": "integer", "minimum": 0},
      "perks": {"type": "integer", "minimum": 0}, "isBudgetReached": {"type": "boolean"}
    }
  }', p_simulation);
$function$;

CREATE OR REPLACE FUNCTION private.version_promotions(p_venue_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_promotion public.promotion;
  v_rule public.promotion_rule;
  v_reward jsonb;
begin
  for v_promotion in
    select p.* from public.promotion p
    where p.venue_id = p_venue_id and not exists (select 1 from public.promotion_version v where v.promotion_id = p.id)
    order by p.created_at, p.id
  loop
    select * into v_rule from public.promotion_rule r where r.promotion_id = v_promotion.id order by r.position limit 1;
    if v_rule.id is not null and (select count(*) from public.promotion_rule r where r.promotion_id = v_promotion.id) = 1 then
      v_reward := private.reward_from_rule(v_promotion, v_rule);
    elsif v_rule.id is null and v_promotion.template_key = 'founders_priority' then
      v_reward := '{"kind": "waitlist_priority"}';
    elsif v_rule.id is null and v_promotion.template_key = 'cab' then
      v_reward := '{"kind": "cab_home", "fromVisitInMonth": 4}';
    else
      v_reward := null;
    end if;
    -- Up to N ever on a buy-in is a fixed bonus on any buy-in: the first buy-in's chips say once ever (money audit).
    if coalesce(v_promotion.per_player_limit, 1) > 1 and v_reward ->> 'kind' = 'bonus_chips' and v_reward ->> 'on' = 'first_buyin' then
      v_reward := jsonb_strip_nulls(jsonb_build_object('kind', 'buyin_bonus', 'mode', 'fixed', 'chips', v_reward -> 'chips',
        'firstNBuyinsPerTable', case when v_rule.conditions #>> '{first_n,per}' = 'table' then (v_rule.conditions #>> '{first_n,count}')::integer end));
    end if;
    -- A rule the model cannot say exactly stays on the old path (decision 0491; money audit). Up to N a member and monthly
    -- budgets are the model's now (decision 0499); more than 20 a member is not, nor a budget under 50 chips, whole or
    -- monthly, which a version's whole 50s of chips would drop, nor the first N grants a club day when a member may have
    -- it more than once: the model counts members a day, and a member given it twice would take two of the N. With no
    -- limit a member, it converts as one a club day each (decision 0501).
    if coalesce(v_promotion.per_player_limit, 1) > 20
       or exists (select 1 from public.promotion_budget b where b.promotion_id = v_promotion.id and b.cap_paise is not null and b.cap_paise < 5000)
       or (v_rule.conditions #>> '{first_n,per}' = 'day' and coalesce(v_promotion.per_player_limit, 1) > 1) then
      v_reward := null;
    end if;
    if v_reward is not null then
      perform private.insert_version_from_rule(v_promotion, v_reward,
        case when v_promotion.template_key = 'founders_priority'
             then jsonb_strip_nulls(jsonb_build_object('tier_ids',
                    (select jsonb_agg(t.id) from public.tier t where t.venue_id = p_venue_id and t.name = 'Founders'' Circle')))
             else coalesce(v_rule.conditions, '{}') end);
    end if;
  end loop;
end;
$function$;

CREATE FUNCTION private.promotions_overview(p_venue_id uuid)
 RETURNS TABLE(promotion_id uuid, template_key text, status text, name text, detail text, runs text, current_version_id uuid, current_status text, open_version_id uuid, open_status text, rejected_reason text, reward jsonb, eligibility jsonb, schedule jsonb, limits jsonb, channels jsonb, given_this_week bigint, is_legacy boolean, created_at timestamp with time zone, ended_at timestamp with time zone, chips_given_this_week bigint, budget_used_chips bigint, is_quiet boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.id, p.template_key, p.status, coalesce(cur.name, o.name, p.name), coalesce(cur.detail, o.detail, p.detail), coalesce(cur.runs, o.runs, p.runs),
         cur.id, cur.status, o.id, o.status, o.rejected_reason, coalesce(cur.reward, o.reward), coalesce(cur.eligibility, o.eligibility),
         coalesce(cur.schedule, o.schedule), coalesce(cur.limits, o.limits), coalesce(cur.channels, o.channels),
         w.times,
         not exists (select 1 from public.promotion_version x where x.promotion_id = p.id), p.created_at,
         case when cur.status = 'ended' then cur.updated_at when cur.id is null and o.id is null and p.status = 'ended' then p.updated_at end,
         w.chips,
         -- As the limits count it (private.promotion_tally), so the list and the refusal agree.
         case when coalesce(cur.limits, o.limits) ? 'budgetChips'
              then (private.promotion_tally(p.id, null, null, null, private.club_day_of(now()), coalesce(cur.limits, o.limits)) ->> 'chipsGiven')::bigint end,
         coalesce(cur.status = 'live' and cur.updated_at <= now() - interval '7 days'
                  and (cur.schedule ->> 'startsOn')::date <= private.club_day_of(now()) - 7
                  and not exists (select 1 from public.promotion_grant g where g.promotion_id = p.id and g.created_at > now() - interval '7 days'), false)
  from public.promotion p
  left join public.promotion_version cur on cur.promotion_id = p.id and cur.version = p.current_version
  left join public.promotion_version o on o.promotion_id = p.id and o.status in ('draft', 'awaiting_approval')
  cross join lateral (
    select count(*) as times, coalesce(sum(g.chips), 0)::bigint as chips
    from public.promotion_grant g
    where g.promotion_id = p.id and g.club_day >= private.club_day_of(now()) - (extract(isodow from private.club_day_of(now()))::integer - 1)
  ) w
  where p.venue_id = p_venue_id and private.has_permission(p_venue_id, 'promotions.manage')
  order by p.created_at desc, p.id;
$function$;
revoke all on function private.promotions_overview(uuid) from public, anon, authenticated, service_role;
grant execute on function private.promotions_overview(uuid) to authenticated;

CREATE FUNCTION private.member_promotion_grants(p_member_id uuid, p_limit integer)
 RETURNS TABLE(grant_id uuid, granted_at timestamp with time zone, club_day date, promotion_name text, version integer, chips bigint, perk text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select g.id, g.created_at, g.club_day, coalesce(v.name, p.name), v.version, g.chips, g.perk
  from public.promotion_grant g
  join public.promotion p on p.id = g.promotion_id
  left join public.promotion_version v on v.id = g.promotion_version_id
  where g.member_id = p_member_id and private.has_permission(g.venue_id, 'members.read')
  order by g.created_at desc, g.id
  limit greatest(least(coalesce(p_limit, 20), 5000), 1);
$function$;
revoke all on function private.member_promotion_grants(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function private.member_promotion_grants(uuid, integer) to authenticated;

CREATE OR REPLACE FUNCTION private.close_visit(p_member_id uuid, p_at timestamp with time zone, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_visit public.visit;
  v_entry public.waitlist_entry;
begin
  select * into v_visit from public.visit v where v.member_id = p_member_id and v.closed_at is null for update;
  if v_visit.id is null then return null; end if;
  update public.visit set closed_at = greatest(p_at, v_visit.opened_at), close_reason = p_reason where id = v_visit.id;
  for v_entry in select * from public.waitlist_entry e
                 where e.member_id = p_member_id and e.status = 'waiting' and e.joined_at < private.tonight_began(now()) for update loop
    update public.waitlist_entry set status = 'left', left_at = now(), left_reason = 'left' where id = v_entry.id;
    if v_entry.called_at is not null then perform private.roll_call_on(v_entry); end if;
  end loop;
  perform private.emit(v_visit.venue_id, 'visit.closed',
                       jsonb_build_object('visit_id', v_visit.id, 'member_id', p_member_id, 'reason', p_reason), 'visit.closed:' || v_visit.id);
  -- No close while the venue or the member is frozen: nothing is written then.
  perform private.assert_writable(v_visit.venue_id, null, p_member_id);
  perform private.weigh_hours_played(v_visit.id);
  return v_visit.id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.open_member_accounts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if private.purging(new.venue_id) then
    return null;
  end if;
  insert into public.ledger_account (venue_id, code, name, kind, unit, member_id, is_players_money) values
    (new.venue_id, 'member.cash', 'Cash balance', 'liability', 'paise', new.id, true),
    (new.venue_id, 'member.bonus', 'Bonus balance', 'liability', 'paise', new.id, false),
    (new.venue_id, 'member.receivable', 'Markers outstanding', 'asset', 'paise', new.id, false);
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.bootstrap_venue(p_venue_id uuid, p_name text, p_slug text, p_is_practice boolean, p_legal_name text, p_address text, p_invoice_prefix text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  member_tier_id uuid;
begin
  if exists (select 1 from public.venue v where v.id = p_venue_id) then
    return p_venue_id;
  end if;

  insert into public.venue (id, name, slug, is_practice) values (p_venue_id, p_name, p_slug, p_is_practice);
  insert into public.venue_config (venue_id, legal_name, address, invoice_prefix)
  values (p_venue_id, p_legal_name, p_address, p_invoice_prefix);
  insert into public.invoice_series (venue_id, code, name) values (p_venue_id, 'S', 'Club services');

  insert into public.tier (venue_id, name, rank) values
    (p_venue_id, 'Member', 1), (p_venue_id, 'Academy graduate', 2),
    (p_venue_id, 'Founders'' Circle', 3), (p_venue_id, 'Black card', 4);
  select t.id into member_tier_id from public.tier t where t.venue_id = p_venue_id and t.name = 'Member';

  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tier.default', '', jsonb_build_object('tier_id', member_tier_id), '-infinity', 'Venue created');
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tds.config', '',
          '{"enabled": false, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 1000000, "basis": "financial_year", "pan_required": true, "no_pan_rate_basis_points": 3000}',
          '-infinity', 'Switched off until the owner sets TDS (#22)');
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'gst.config', '', '{"rate_basis_points": 1800, "basis": "rake"}', '-infinity', 'A placeholder until the owner sets GST (#23)');

  -- Every gateable feature for every tier, but Learn, the Academy, Events (#637), cab requests, withdrawal pushes (#709)
  -- and hourly rakeback, which start off and hidden.
  insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
  select p_venue_id, t.id, f.key, not o.is_off, case when o.is_off then 'hidden' else 'locked' end::public.feature_display_mode, '-infinity'
  from public.tier t cross join public.feature f
  cross join lateral (select f.key in ('learn.library', 'academy.booking', 'events.book', 'cab.requests', 'push.withdrawal_sent',
                                    'rewards.rakeback') as is_off) o
  where t.venue_id = p_venue_id and f.is_gateable;

  insert into public.ledger_account (venue_id, code, name, kind, unit, is_players_money) values
    (p_venue_id, 'venue.cash_drawer', 'Cash drawer', 'asset', 'paise', false),
    (p_venue_id, 'venue.bank', 'Bank and UPI', 'asset', 'paise', false),
    (p_venue_id, 'venue.chips_outstanding', 'Chips in play', 'liability', 'paise', true),
    (p_venue_id, 'venue.rake', 'Rake', 'revenue', 'paise', false),
    (p_venue_id, 'venue.jackpot.main', 'Bad-beat jackpot', 'liability', 'paise', true),
    (p_venue_id, 'venue.jackpot.season', 'Season jackpot pool', 'liability', 'paise', true),
    (p_venue_id, 'venue.jackpot.freeroll', 'Freeroll jackpot pool', 'liability', 'paise', true),
    (p_venue_id, 'venue.bonus_expense', 'Bonus issued', 'expense', 'paise', false),
    (p_venue_id, 'venue.high_hand_expense', 'High hands paid', 'expense', 'paise', false),
    (p_venue_id, 'venue.withdrawals_pending', 'Withdrawals waiting to be paid', 'liability', 'paise', true),
    (p_venue_id, 'venue.tds_payable', 'TDS withheld, to be paid to the government', 'liability', 'paise', false),
    (p_venue_id, 'venue.tournament_pool', 'Tournament prize pools', 'liability', 'paise', true),
    (p_venue_id, 'venue.tournament_fees', 'Tournament fees', 'revenue', 'paise', false),
    (p_venue_id, 'venue.tournament_overlay', 'Tournament overlay', 'expense', 'paise', false),
    (p_venue_id, 'venue.tournament_tickets', 'Satellite tickets held', 'liability', 'paise', true),
    (p_venue_id, 'venue.cashfree', 'Cashfree payout balance', 'asset', 'paise', false),
    (p_venue_id, 'venue.opening_balance', 'Opening balances', 'equity', 'paise', false);

  insert into public.chip_denomination (venue_id, value_paise, name)
  select p_venue_id, rupees * 100, '₹' || to_char(rupees, 'FM99,99,999')
  from unnest(array[50, 100, 500, 1000, 5000, 25000]) as rupees;

  if p_is_practice then
    perform private.add_certification_quizzes(p_venue_id);
  end if;

  perform private.add_training_sops(p_venue_id);
  perform private.add_promotion_templates(p_venue_id);
  if not p_is_practice and not exists (select 1 from public.venue v where not v.is_practice and v.id <> p_venue_id) then
    perform private.add_website(p_venue_id);
  end if;

  return p_venue_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.finish_tournament(p_tournament_id uuid, p_method text, p_stacks jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tournament public.tournament := (select t from public.tournament t where t.id = p_tournament_id);
  v_left uuid[];
  v_overlay bigint;
begin
  perform private.assert_runs_tournaments(v_tournament.venue_id);
  perform 1 from public.tournament t where t.id = p_tournament_id for update;
  v_tournament := (select t from public.tournament t where t.id = p_tournament_id);
  if v_tournament.finished_at is not null then
    return;
  end if;
  perform private.assert_writable(v_tournament.venue_id);
  v_left := private.tournament_finishers(v_tournament, p_method, p_stacks);
  -- Every run's place: those left by the order above, the rest by their busts.
  update public.tournament_entry e set place = array_position(v_left, e.id) where e.id = any(v_left);
  update public.tournament_entry e set place = p.place from private.tournament_places(p_tournament_id) p where p.entry_id = e.id and e.status = 'busted';
  v_overlay := (select p.overlay_paise from private.tournament_prize_pool((select c.pool_paise from private.tournament_counts(p_tournament_id) c),
                                                                       v_tournament.guarantee_paise) p);
  if v_overlay > 0 then
    perform private.post_ledger_transaction(v_tournament.venue_id, 'tournament_overlay', 'tournament_overlay:' || p_tournament_id,
      (select jsonb_agg(jsonb_build_object('account_id', a.id, 'amount', case when a.code = 'venue.tournament_overlay' then v_overlay else -v_overlay end::text))
       from public.ledger_account a where a.venue_id = v_tournament.venue_id and a.member_id is null
         and a.code in ('venue.tournament_overlay', 'venue.tournament_pool')),
      null, 'The overlay a tournament''s guarantee needs');
  end if;
  if v_tournament.satellite_target_id is not null then
    perform private.issue_tournament_tickets(v_tournament);
  end if;
  perform private.pay_tournament_run(w.entry_id, w.place, w.prize_paise, w.bounty_paise, 0, null)
  from private.tournament_winnings(v_tournament, p_method, p_stacks, v_left) w where w.prize_paise + w.bounty_paise > 0;
  update public.tournament set finished_at = now(), overlay_paise = v_overlay, deal_method = p_method,
                               deal_stacks = case when p_method is not null then p_stacks end
  where id = p_tournament_id;
  perform private.emit(v_tournament.venue_id, 'tournament.finished',
    jsonb_build_object('tournament_id', p_tournament_id, 'overlay_paise', v_overlay, 'deal_method', p_method,
                       'deal_stacks', case when p_method is not null then p_stacks end,
                       'winner_member_id', (select e.member_id from public.tournament_entry e where e.tournament_id = p_tournament_id and e.place = 1)),
    'tournament.finished:' || p_tournament_id);
end;
$function$;

CREATE OR REPLACE FUNCTION private.complete_learn_session(p_session_id uuid, p_principles text[])
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member public.member := private.learning_member();
  v_done public.learn_session;
  v_source text;
  v_new text[];
  v_rates jsonb;
  v_cap bigint;
  v_today bigint;
  v_points bigint;
begin
  perform private.assert_writable(v_member.venue_id, null, v_member.id);
  -- One completion at a time per member, so two sessions never both take the day's last points.
  perform pg_advisory_xact_lock(hashtext('learn-points:' || v_member.id));
  select * into v_done from public.learn_session s where s.id = p_session_id and s.member_id = v_member.id;
  if v_done.id is not null then
    return v_done.points;
  end if;
  select a.source_key into v_source from public.learn_attempt a where a.session_id = p_session_id and a.member_id = v_member.id limit 1;
  if v_source is null then
    raise exception 'A session with answers kept' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct p), '{}') into v_new
  from unnest(coalesce(p_principles, '{}')) p
  where length(p) between 1 and 200
    and not exists (select 1 from public.learn_session s where s.member_id = v_member.id and s.source_key = v_source and p = any (s.principles))
    -- Only a principle the member answered in this session.
    and exists (select 1 from public.learn_attempt a where a.session_id = p_session_id and a.member_id = v_member.id and a.principle_id = p);
  v_rates := private.setting_at(v_member.venue_id, 'learn.session_points', '', now());
  v_cap := coalesce((private.setting_at(v_member.venue_id, 'learn.daily_points_cap', '', now()) ->> 'points')::bigint, 100);
  select coalesce(sum(s.points), 0) into v_today from public.learn_session s
  where s.member_id = v_member.id and (s.completed_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;
  v_points := private.learn_points(cardinality(v_new), v_today, coalesce((v_rates ->> 'per_session')::bigint, 10),
                                   coalesce((v_rates ->> 'per_principle')::bigint, 25), v_cap);
  insert into public.learn_session (id, venue_id, member_id, source_key, principles, points)
  values (p_session_id, v_member.venue_id, v_member.id, v_source, v_new, v_points);
  return v_points;
end;
$function$;

CREATE FUNCTION private.my_wallet()
 RETURNS TABLE(member_id uuid, cash_paise bigint, credit_limit_paise bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.id,
         coalesce((select -private.account_balance(a.id) from public.ledger_account a where a.member_id = m.id and a.code = 'member.cash'), 0)::bigint,
         (select nullif(c.limit_paise, 0) from public.credit_line c where c.member_id = m.id and c.venue_id = m.venue_id)
  from public.member m
  where m.id = private.current_member_id();
$function$;
revoke all on function private.my_wallet() from public, anon, authenticated, service_role;
grant execute on function private.my_wallet() to authenticated;

CREATE OR REPLACE FUNCTION private.staff_queue_counts(p_venue_id uuid)
 RETURNS TABLE(queue text, waiting integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select q.queue, q.waiting::integer
  from (values
    ('waitlist', (select count(*) from private.waitlist_requests(p_venue_id))),
    ('topUps', (select count(*) from private.top_ups_tonight(p_venue_id) t where t.status in ('requested', 'in_progress'))),
    ('timeRequests', (select count(*) from private.floor_seats(p_venue_id) s where s.time_request_id is not null)),
    ('fnb', (select count(*) from private.fnb_orders_tonight(p_venue_id) o where o.delivered_at is null and o.cancelled_at is null)),
    -- A member's own cancellation, for a minute, so the console chimes: the bar may already hold its KOT.
    ('fnbCancelled', (select count(*) from private.fnb_orders_tonight(p_venue_id) o
                      where o.cancel_reason = 'Cancelled by the member' and o.cancelled_at > now() - interval '1 minute')),
    ('liveFloor', (select count(*) from private.floor_seats(p_venue_id) s where s.leaving_at is not null)),
    -- Approved players the floor can seat now (the owner, 8 Nov).
    ('seating', (select count(*) from private.seating_alerts(p_venue_id) a where a.state = 'ready')),
    ('kycReview', (select count(*) from private.kyc_review_queue(p_venue_id) k where k.status = 'needs_review')),
    ('feedback', (select count(*) from private.venue_feedback(p_venue_id) f where f.is_ticket and f.resolved_at is null)),
    -- Waiting for an approver: a marketer who asked sees the list, but only a super admin decides.
    ('promotions', (select count(*) from private.promotions_awaiting_approval(p_venue_id)
                    where private.has_permission(p_venue_id, 'promotions.approve'))),
    -- Calls not yet made: a call logged without an offer stays open, handled.
    ('hostQueue', (select count(*) from private.host_queue(p_venue_id) h where h.status = 'open' and h.handled_at is null)),
    ('tournamentInterest', (select count(*) from private.tournament_interest_list(p_venue_id) i
                            join public.tournament t on t.id = i.tournament_id
                            where i.registered_at is null and t.is_published)),
    -- Wall posts waiting for approval, for those who approve them.
    ('wallPosts', (select count(*) from public.wall_post w
                   where w.venue_id = p_venue_id and w.status = 'pending' and private.has_permission(p_venue_id, 'marketing.publish'))),
    -- Members who asked to delete their account, for those who erase.
    ('erasureRequests', (select count(*) from private.member_erasure_requests(p_venue_id)))
  ) as q (queue, waiting)
  where q.waiting > 0;
$function$;

CREATE OR REPLACE FUNCTION private.todays_players(p_venue_id uuid, p_day date DEFAULT NULL::date)
 RETURNS TABLE(member_id uuid, full_name text, member_number bigint, status text, checked_in_at timestamp with time zone, checked_out_at timestamp with time zone, waiting_seconds integer, tables jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with day as (
    select s.starts_at, s.starts_at + interval '1 day' as ends_at, p_day is null as is_today
    from (select coalesce((p_day + time '06:00') at time zone 'Asia/Kolkata', private.tonight_began(now())) as starts_at) s
  ),
  people as (
    select v.member_id from public.visit v, day where v.venue_id = p_venue_id
      and ((v.opened_at >= day.starts_at and v.opened_at < day.ends_at) or (day.is_today and v.closed_at is null))
    union select e.member_id from public.waitlist_entry e, day where e.venue_id = p_venue_id
      and ((e.joined_at >= day.starts_at and e.joined_at < day.ends_at) or (day.is_today and e.status = 'waiting'))
    union select s.member_id from public.seat_session s, day where s.venue_id = p_venue_id
      and ((s.started_at >= day.starts_at and s.started_at < day.ends_at) or (day.is_today and s.ended_at is null))
  ),
  sessions as (
    select s.* from public.seat_session s, day where s.venue_id = p_venue_id
      and ((s.started_at >= day.starts_at and s.started_at < day.ends_at) or (day.is_today and s.ended_at is null))
  ),
  -- Each stretch at one table, as private.session_tables splits a seat's time: an open one runs to now.
  stretches as (
    select s.member_id, t.o_table_id as table_id, t.o_from as from_at, least(t.o_to, now()) as to_at
    from sessions s cross join lateral private.session_tables(s.id) t
  ),
  per_table as (
    select st.member_id, g.name, g.position, floor(sum(greatest(0, extract(epoch from st.to_at - st.from_at))))::integer as seconds
    from stretches st join public.game_table g on g.id = st.table_id
    group by st.member_id, g.name, g.position
  )
  select m.id, m.full_name, m.member_number,
         case when exists (select 1 from public.seat_session s where s.member_id = m.id and s.ended_at is null) then 'playing'
              when exists (select 1 from public.waitlist_entry e where e.member_id = m.id and e.status = 'waiting') then 'waiting'
              when exists (select 1 from public.visit v where v.member_id = m.id and v.closed_at is null) then 'in_room'
              when not exists (select 1 from public.visit v, day where v.member_id = m.id
                                 and v.opened_at < day.ends_at and (v.closed_at is null or v.closed_at >= day.starts_at))
                then 'never_arrived'
              else 'left' end,
         (select min(v.opened_at) from public.visit v, day where v.member_id = m.id and v.opened_at >= day.starts_at and v.opened_at < day.ends_at),
         -- Checked out once the day's every visit is closed: the last close.
         (select case when bool_and(v.closed_at is not null) then max(v.closed_at) end from public.visit v, day
          where v.member_id = m.id and v.opened_at >= day.starts_at and v.opened_at < day.ends_at),
         coalesce((select floor(sum(extract(epoch from coalesce(e.left_at, e.seated_at, now()) - e.joined_at)))::integer
                   from public.waitlist_entry e, day where e.member_id = m.id and e.joined_at >= day.starts_at and e.joined_at < day.ends_at), 0),
         coalesce((select jsonb_agg(jsonb_build_object('table', pt.name, 'seconds', pt.seconds) order by pt.position)
                   from per_table pt where pt.member_id = m.id), '[]'::jsonb)
  from people p
  join public.member m on m.id = p.member_id
  where private.has_permission(p_venue_id, 'members.read')
  order by m.full_name;
$function$;

CREATE FUNCTION private.forfeit_member_bonus(p_member member)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_bonus bigint;
  v_bonus_txn uuid;
begin
  perform 1 from public.bonus_grant g where g.member_id = p_member.id and g.expired_at is null for update;
  v_bonus := -private.account_balance((select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.bonus'));
  if v_bonus > 0 then
    v_bonus_txn := private.post_ledger_transaction(p_member.venue_id, 'member_erasure_forfeit', 'member_erasure_forfeit:bonus:' || p_member.id,
      jsonb_build_array(
        jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p_member.id and a.code = 'member.bonus'),
                           'amount', v_bonus::text),
        jsonb_build_object('account_id', (select a.id from public.ledger_account a
                                           where a.venue_id = p_member.venue_id and a.code = 'venue.bonus_expense' and a.member_id is null),
                           'amount', (-v_bonus)::text)),
      null, 'Forfeited on erasure');
  end if;
  -- As the expiry job does, a grant with nothing left names no transaction.
  update public.bonus_grant g
  set remaining_paise = 0, expired_at = now(), expiry_transaction_id = case when g.remaining_paise > 0 then v_bonus_txn end
  where g.member_id = p_member.id and g.expired_at is null;
  return jsonb_build_object('bonus_paise', greatest(v_bonus, 0),
                            'forfeit_transactions', to_jsonb(array_remove(array[v_bonus_txn], null)));
end;
$function$;
revoke all on function private.forfeit_member_bonus(member) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.carry_out_erasure(p_member_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member public.member;
  v_blockers text[];
  v_summary jsonb;
begin
  select * into v_member from public.member m where m.id = p_member_id for update;
  if not found then
    raise exception 'No such member' using errcode = 'RVNOM';
  end if;
  v_blockers := private.member_erasure_blockers(p_member_id);
  if cardinality(v_blockers) > 0 then
    raise exception 'Settle these before erasing the member: %', array_to_string(v_blockers, ', ')
      using errcode = 'RVERA', detail = array_to_string(v_blockers, ',');
  end if;
  v_summary := private.forfeit_member_bonus(v_member) || jsonb_build_object('blocked_until', private.block_erased_member(v_member));
  perform private.delete_member_records(v_member);
  perform private.anonymise_member(v_member);
  perform private.remove_member_login(v_member);
  perform private.scrub_member_audit(v_member);
  if not exists (select 1 from public.audit_log a where a.entity = 'member' and a.entity_id = p_member_id::text and a.action = 'member.erase') then
    perform private.audit(v_member.venue_id, 'member.erase', 'member', p_member_id::text, null, v_summary, p_reason);
  end if;
  if (select v.is_practice from public.venue v where v.id = v_member.venue_id) then
    perform private.capture_practice_seed(v_member.venue_id);
  end if;
  return v_summary || jsonb_build_object('venue_id', v_member.venue_id);
end;
$function$;

CREATE FUNCTION private.erase_member(p_member_id uuid, p_full_name text, p_reason text)
 RETURNS TABLE(venue_id uuid, forfeited_bonus_paise bigint, blocked_until timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_member public.member;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_summary jsonb;
begin
  select * into v_member from public.member m where m.id = p_member_id;
  if v_member.id is null or not private.has_permission(v_member.venue_id, 'members.erase') then
    raise exception 'Only a super admin erases a member' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('member-erase:' || v_member.venue_id::text));
  select * into v_member from public.member m where m.id = p_member_id for update;
  if v_member.erased_at is not null then
    raise exception 'This member was erased already' using errcode = 'RVERD';
  end if;
  if btrim(coalesce(p_full_name, '')) is distinct from v_member.full_name then
    raise exception 'Type the member''s full name exactly to erase them' using errcode = 'RVNAM';
  end if;
  if not private.is_safe_erasure_reason(v_reason, v_member.full_name) then
    raise exception 'Give a reason of 3 to 300 characters with nothing of the person in it' using errcode = '22023';
  end if;
  if (select count(*) from public.audit_log a
      where a.venue_id = v_member.venue_id and a.action = 'member.erase' and a.occurred_at > now() - interval '1 hour') >= 10 then
    raise exception 'Ten members were erased in the last hour: wait before erasing another' using errcode = 'RVRAT';
  end if;
  v_summary := private.carry_out_erasure(p_member_id, v_reason);
  update public.member_erasure_request r
  set completed_at = now()
  where r.member_id = p_member_id and r.completed_at is null;
  if found and v_member.phone is not null then
    insert into private.erasure_notice_phone (member_id, venue_id, phone) values (p_member_id, v_member.venue_id, v_member.phone);
    perform private.emit(v_member.venue_id, 'member.notice',
      jsonb_build_object('member_id', p_member_id, 'notice', 'account_erased', 'params', '[]'::jsonb),
      'member.notice:account_erased:' || p_member_id);
  end if;
  return query select (v_summary ->> 'venue_id')::uuid, (v_summary ->> 'bonus_paise')::bigint,
                      (v_summary ->> 'blocked_until')::timestamptz;
end;
$function$;
revoke all on function private.erase_member(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function private.erase_member(uuid, text, text) to authenticated;

CREATE FUNCTION private.member_erasure_preview(p_member_id uuid)
 RETURNS TABLE(is_erased boolean, blockers text[], bonus_paise bigint, blocked_until timestamp with time zone, kyc_files integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.erased_at is not null, private.member_erasure_blockers(m.id),
         greatest(-private.account_balance((select a.id from public.ledger_account a where a.member_id = m.id and a.code = 'member.bonus')), 0),
         (select r.break_until from private.member_restrictions(m.id, now()) r),
         (select count(*)::integer from storage.objects o
          where o.bucket_id = 'kyc' and o.name like m.venue_id::text || '/' || m.id::text || '/%')
  from public.member m
  where m.id = p_member_id and private.has_permission(m.venue_id, 'members.erase');
$function$;
revoke all on function private.member_erasure_preview(uuid) from public, anon, authenticated, service_role;
grant execute on function private.member_erasure_preview(uuid) to authenticated;

CREATE OR REPLACE FUNCTION private.member_erasure_blockers(p_member_id uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    -- Bonus owed to the club (a liability above zero): never forfeited, so set right first.
    case when exists (select 1 from balance b where b.code = 'member.bonus' and b.amount > 0) then 'bonus' end,
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
$function$;

CREATE OR REPLACE FUNCTION private.activity_kind(p_action text, p_entity text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_entity = 'control_state' then 'controls'
    when p_action like 'export.%' or p_entity = 'export_archive' then 'exports'
    when p_entity in ('staff', 'staff_credential', 'staff_shift', 'staff_attendance') then 'staff'
    when p_action = 'bonus.give' or p_entity in ('bonus_grant', 'bonus_redemption') then 'bonus_chips'
    when p_entity in ('member_tier_change', 'tier', 'tier_feature') then 'tiers'
    when p_action like 'member.%' or p_action like 'kyc_image.%'
         or p_entity in ('member', 'member_limit', 'member_feature_override', 'self_exclusion', 'consent', 'sign_up_attribution') then 'members'
    when p_entity in ('setting', 'venue', 'venue_config', 'device', 'tablet_assignment', 'tv_screen', 'camera', 'storage_object') then 'settings'
    when p_entity in ('game_table', 'table_type', 'waitlist_entry', 'seat_session', 'seat_move', 'visit', 'early_departure',
                      'early_departure_withdrawal', 'down_count', 'dealer_down', 'hand') then 'floor'
    else 'other'
  end;
$function$;

CREATE OR REPLACE FUNCTION private.activity_log(p_venue_id uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_who text DEFAULT NULL::text, p_kind text DEFAULT NULL::text, p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id bigint DEFAULT NULL::bigint, p_limit integer DEFAULT 50)
 RETURNS TABLE(id bigint, occurred_at timestamp with time zone, who text, is_system boolean, action text, entity text, kind text, about text, reason text, amount bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select l.id, l.occurred_at, w.name, l.actor_user_id is null, l.action, l.entity,
         private.activity_kind(l.action, l.entity),
         coalesce(case when rm.erased_at is null then rm.full_name end, rs.full_name, case when l.entity = 'table' then l.entity_id end),
         -- A reason can name the person, so an erased member's go; the erasure keeps its own.
         case when rm.erased_at is null or l.action = 'member.erase' then l.reason end,
         -- How many bonus chips were given by hand.
         case when l.action = 'bonus.give' then (l.after ->> 'chips')::bigint end
  from public.audit_log l
  left join public.staff s on s.user_id = l.actor_user_id and s.venue_id = l.venue_id
  left join public.member a on a.user_id = l.actor_user_id and a.venue_id = l.venue_id
  -- By the device the row names, as a revoked device has lost its login.
  left join public.device d on d.id = l.device_id and d.venue_id = l.venue_id
  cross join lateral (select coalesce(s.full_name, case when a.erased_at is null then a.full_name end, d.name) as name) w
  left join lateral (
    select coalesce(case when l.entity = 'member' then l.entity_id end, l.after ->> 'member_id', l.before ->> 'member_id') as member_id,
           coalesce(case when l.entity = 'staff' then l.entity_id end, l.after ->> 'staff_id', l.before ->> 'staff_id') as staff_id
  ) t on true
  left join public.member rm on rm.id = private.uuid_or_null(t.member_id) and rm.venue_id = l.venue_id
  left join public.staff rs on rs.id = private.uuid_or_null(t.staff_id) and rs.venue_id = l.venue_id
  where l.venue_id = p_venue_id and private.has_permission(p_venue_id, 'control.engage')
    and (p_from is null or l.occurred_at >= (p_from::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
    and (p_to is null or l.occurred_at < ((p_to + 1)::timestamp + interval '6 hours') at time zone 'Asia/Kolkata')
    and (p_who is null or position(lower(p_who) in lower(coalesce(w.name, ''))) > 0)
    and (p_kind is null or private.activity_kind(l.action, l.entity) = p_kind)
    and (p_before is null or (l.occurred_at, l.id) < (p_before, p_before_id))
  order by l.occurred_at desc, l.id desc
  limit greatest(least(coalesce(p_limit, 50), 200), 1);
$function$;

CREATE OR REPLACE FUNCTION private.is_shareable_audit_row(p_entity text, p_before jsonb, p_after jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select p_entity in ('setting', 'tier', 'tier_feature', 'table_type', 'game_table', 'table_run', 'chip_denomination', 'blind_structure',
                      'tournament_template', 'tournament', 'promotion', 'promotion_rule', 'promotion_grant', 'bonus_grant',
                      'fnb_item', 'sop', 'sop_version', 'site_block', 'site_page', 'site_revision', 'cage_shift',
                      'chip_inventory_count', 'chip_inventory_line', 'ledger_account', 'academy_batch', 'device', 'tablet_assignment',
                      'down_count', 'dealer_down', 'hand', 'high_hand_claim', 'jackpot_event', 'visit', 'waitlist_entry', 'credit_line',
                      'venue', 'alert')
     and not exists (
       select 1 from unnest(array[p_before, p_after]) r
       where coalesce(r ?| array['phone', 'full_name', 'address', 'signature_svg', 'buyer_name', 'buyer_gstin', 'pan', 'date_of_birth',
                                 'city', 'occupation', 'alert_whatsapp', 'bank_account_name', 'bank_account_number', 'bank_ifsc', 'upi_vpa',
                                 'upi_payee_name', 'staff_ip_allowlist', 'company_name', 'company_gstin', 'signatory_name'], false));
$function$;

CREATE OR REPLACE FUNCTION private.live_purge_keeps()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select array['blind_structure', 'expense_category', 'fnb_item', 'payment_account', 'shareholder',
               'shareholding', 'tally_ledger_map', 'tournament_template', 'purge_request'];
$function$;

CREATE OR REPLACE FUNCTION private.may_upload_item_photo(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/menu-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
              then private.has_permission(split_part(p_name, '/', 1)::uuid, 'fnb.manage')
              else false end;
$function$;

CREATE OR REPLACE FUNCTION private.set_item_photo(p_kind text, p_item_id uuid, p_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_venue_id uuid;
  v_object storage.objects;
begin
  if p_kind is distinct from 'menu' then
    raise exception 'A photo is of a menu item' using errcode = '22023';
  end if;
  v_venue_id := (select f.venue_id from public.fnb_item f where f.id = p_item_id);
  if v_venue_id is null or not private.has_permission(v_venue_id, 'fnb.manage') then
    raise exception 'Only staff who keep the menu set its photos' using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id);
  select * into v_object from storage.objects o where o.bucket_id = 'item-photos' and o.name = p_path;
  if v_object.id is null or not private.may_upload_item_photo(p_path) or split_part(p_path, '/', 1) <> v_venue_id::text
     or split_part(p_path, '/', 2) not like p_kind || '-%'
     or v_object.metadata ->> 'mimetype' is distinct from 'image/jpeg'
     or coalesce((v_object.metadata ->> 'size')::bigint > 1048576, true) then
    raise exception 'Not a JPEG of this venue''s item photos of up to 1 MB' using errcode = '22023';
  end if;
  perform private.audit(v_venue_id, 'item.photo_uploaded', 'fnb_item', p_item_id::text, null,
                        jsonb_build_object('path', p_path, 'bytes', (v_object.metadata ->> 'size')::bigint, 'type', v_object.metadata ->> 'mimetype'));
  update public.fnb_item set photo_path = p_path where id = p_item_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.public_club_rule_rows()
 RETURNS TABLE(venue_slug text, key text, subject text, subject_name text, subject_order bigint, value jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with in_force as (
    select distinct on (s.venue_id, s.key, s.subject) s.venue_id, s.key, s.subject, s.value
    from public.setting s
    where s.key in ('rakeback.rate', 'jackpot.payout', 'high_hand.payouts')
      and s.effective_from <= now()
    order by s.venue_id, s.key, s.subject, s.effective_from desc
  ), cab_tiers as (
    select distinct on (f.venue_id, f.tier_id) f.venue_id, f.is_enabled
    from public.tier_feature f
    where f.feature_key = 'cab.requests' and f.effective_from <= now()
    order by f.venue_id, f.tier_id, f.effective_from desc
  )
  -- Rakeback shows its rate alone: its cap and how long its bonus lasts are not the website's to show.
  select v.slug, r.key, r.subject, t.name, t.big_blind_paise,
         case when r.key = 'rakeback.rate' then jsonb_build_object('basis_points', r.value -> 'basis_points') else r.value end
  from in_force r
  join public.venue v on v.id = r.venue_id and not v.is_practice
  left join public.table_type t on t.venue_id = r.venue_id and t.code = r.subject
  where (r.subject = '' or t.id is not null)
  union all
  select v.slug, 'cab.minimum_visits', '', null, null, jsonb_build_object('visits', private.cab_minimum_visits(v.id))
  from public.venue v
  where not v.is_practice and exists (select 1 from cab_tiers c where c.venue_id = v.id and c.is_enabled);
$function$;

CREATE OR REPLACE FUNCTION private.site_block_public_keys(p_kind text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case p_kind
    when 'hero' then array['eyebrow', 'heading', 'text', 'action', 'video', 'note']
    when 'statement' then array['eyebrow', 'lines', 'text', 'action', 'image', 'note']
    when 'gallery' then array['eyebrow', 'heading', 'intro', 'items', 'note']
    when 'feature' then array['eyebrow', 'heading', 'text', 'points', 'action', 'image', 'alt']
    when 'text' then array['heading', 'body']
    when 'rules' then array['heading', 'rules']
    when 'faq' then array['heading', 'questions']
    when 'careers' then array['heading', 'roles', 'apply']
    when 'map' then array['heading', 'address', 'hours', 'directionsUrl', 'phone', 'email']
    when 'games' then array['heading']
    when 'calendar' then array['heading']
    when 'links' then array['heading', 'links']
    when 'story' then array['eyebrow', 'heading', 'paragraphs', 'figures', 'action', 'image', 'alt']
    when 'cards' then array['eyebrow', 'heading', 'intro', 'cards', 'quote', 'action']
    when 'marquee' then array['phrases']
    when 'timeline' then array['eyebrow', 'heading', 'intro', 'items']
    when 'table' then array['heading', 'intro', 'columns', 'rows', 'note']
    when 'promotions' then array['eyebrow', 'heading', 'only']
    when 'social_wall' then array['heading']
    when 'rewards' then array['heading']
    when 'outstation' then array['eyebrow', 'heading']
    when 'jackpot' then array['eyebrow', 'heading']
    else array[]::text[]
  end;
$function$;

CREATE OR REPLACE FUNCTION private.add_website_parity(p_venue_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_page uuid;
  v_after integer;
begin
  if not exists (select 1 from public.venue v where v.id = p_venue_id and not v.is_practice) then return; end if;


  perform private.add_site_page(p_venue_id, $j${"slug": "journal-cash-game-tips", "title": "Cash game tips for the live table", "is_published": true,
    "description": "Habits that save chips at a live cash game, from the first hand to the last.",
    "blocks": [
      {"kind": "hero", "content": {"eyebrow": "Strategy", "heading": "Cash game tips for the live table", "text": "Habits that save chips at a live cash game, from the first hand to the last."}},
      {"kind": "text", "content": {"body": "Play fewer hands, and play them harder. Most chips at a live table are lost by calling with hands that were never good enough to start with. Fold more before the flop, and raise the hands you do play rather than limping in.\n\nPosition is worth more than cards. Acting last lets you see what everyone else does first. Open more hands on the button and in the cut-off, and fewer from the blinds and the first seats after them.\n\nWatch the table while you are not in a hand. Who calls too much, who only bets when they have it, who tilts after losing a pot: the next hour is decided by what you notice now.\n\nSize your bets for a reason. Bet bigger for value against players who call too much, and smaller when you only want to take the pot down. A bet with no reason behind it costs chips either way.\n\nDo not pay off the big bet on the river without a plan. Live players bluff the river less than you think. If the story does not hold together, a fold is fine.\n\nKeep your stack in line with your bankroll, and leave when you are tired or tilted. A long session is only worth it while you are playing your best.\n\nPoker is a game of skill, and you can still lose money at it. Play with money you can afford to lose."}}
    ]}$j$::jsonb);

  perform private.add_site_page(p_venue_id, $j${"slug": "journal-tournaments-gurugram", "title": "Poker tournaments in Gurugram", "is_published": true,
    "description": "How a live tournament runs at RIVR, from the buy-in to the final table.",
    "blocks": [
      {"kind": "hero", "content": {"eyebrow": "Tournaments", "heading": "Poker tournaments in Gurugram", "text": "How a live tournament runs at RIVR, from the buy-in to the final table."}},
      {"kind": "text", "content": {"body": "A tournament is one buy-in for a stack of chips. The blinds rise on a clock, players drop out as they lose their chips, and the prize pool is paid to the places at the top.\n\nThe calendar on the Tournaments page lists every event with its start, its buy-in and any guarantee. Register in the RIVR app or at the front desk, and be seated before the first level starts.\n\nThe clock runs on the TVs and on every table's tablet, so everyone sees the same level, the same blinds and the same time to the break. A late registration window, where an event has one, is shown on the clock too.\n\nEarly on, the blinds are small next to the stacks: play patiently and pick your spots. As the blinds rise, every pot matters more, and a short stack has to push or fold. At the final table, the pay jumps make every decision count.\n\nEvery finish earns RIVR League points, more for the final table and the top three. The standings are on the Leaderboard page.\n\nPoker is a game of skill, and you can still lose money at it. Play with money you can afford to lose."}}
    ]}$j$::jsonb);

  -- General information drafted from the rulings and Haryana's Act, a draft until the owner's lawyer has read it.
  perform private.add_site_page(p_venue_id, $j${"slug": "journal-poker-legal-gurugram", "title": "Is poker legal in Gurugram?", "is_published": false,
    "description": "What India's courts and Haryana's law say about poker as a game of skill.",
    "blocks": [
      {"kind": "hero", "content": {"eyebrow": "The law", "heading": "Is poker legal in Gurugram?", "text": "What India's courts and Haryana's law say about poker as a game of skill."}},
      {"kind": "text", "content": {"body": "India's gambling laws are written by each state, and every one of them treats a game of skill differently from a game of chance.\n\nThe Supreme Court drew that line in 1968, when it held in State of Andhra Pradesh v. K. Satyanarayana that rummy is mainly and preponderantly a game of skill. In 1996, in K.R. Lakshmanan v. State of Tamil Nadu, it set the test courts still apply: whether skill predominates over chance.\n\nPoker has been tested against it. In 2013 the Karnataka High Court held, in Indian Poker Association v. State of Karnataka, that poker played as a game of skill needs no gaming licence.\n\nIn Haryana, the Haryana Prevention of Public Gambling Act, 2025 keeps games of skill outside gambling: a game of skill is one where skill predominates over chance, and the state government may notify games as games of skill. In September 2026 the state notified poker and rummy as games of skill under the Act. Clubs that host them must follow the conditions the state sets for them.\n\nAt RIVR every member is 18 or over and has had their identity checked, every table runs as a game of skill, and TDS is deducted on winnings as the law requires.\n\nThis is general information, not legal advice."}}
    ]}$j$::jsonb);

  -- Membership: the rules in force in place of the example rates, the cab and hotel nights after them, and the welcome
  -- offer after the steps to join.
  select id into v_page from public.site_page where venue_id = p_venue_id and slug = 'membership';
  if v_page is not null then
    update public.site_block set kind = 'rewards', content = '{"heading": "Points for every hour"}'::jsonb
    where page_id = v_page and kind = 'table' and content = $j${"note": "Example rates: the club confirms its rates before launch. Only time seated at a table counts, not time away from it.", "rows": [["NLH 50/100", "5"], ["NLH 100/200", "10"], ["Private Room", "20"]], "intro": "Every hour you play earns points, more at the higher stakes. Points never turn into cash: they are for rewards.", "columns": ["Stake", "Points an hour"], "heading": "Points for every hour"}$j$::jsonb;
    if not exists (select 1 from public.site_block where page_id = v_page and kind = 'rewards') then
      select coalesce((select position from public.site_block where page_id = v_page and content ->> 'eyebrow' = 'Tiers'),
                      (select max(position) from public.site_block where page_id = v_page), 0) into v_after;
      perform private.place_site_block(v_page, v_after, 'rewards', '{"heading": "Points for every hour"}'::jsonb);
    end if;
    if not exists (select 1 from public.site_block where page_id = v_page and kind = 'outstation') then
      select position into v_after from public.site_block where page_id = v_page and kind = 'rewards';
      perform private.place_site_block(v_page, v_after, 'outstation', '{"eyebrow": "Outstation", "heading": "Getting here, and staying over."}'::jsonb);
    end if;
    if not exists (select 1 from public.site_block where page_id = v_page and kind = 'promotions') then
      select coalesce((select position from public.site_block where page_id = v_page and content ->> 'eyebrow' = 'How to join'),
                      (select max(position) from public.site_block where page_id = v_page)) into v_after;
      perform private.place_site_block(v_page, v_after, 'promotions', '{"eyebrow": "Welcome offer", "heading": "Your first visit.", "only": "welcome"}'::jsonb);
    end if;
  end if;

  -- Promotions: the jackpot and the rare hands, after the hero.
  select id into v_page from public.site_page where venue_id = p_venue_id and slug = 'promotions';
  if v_page is not null and not exists (select 1 from public.site_block where page_id = v_page and kind = 'jackpot') then
    perform private.place_site_block(v_page, coalesce((select min(position) from public.site_block where page_id = v_page and kind = 'hero'), 0), 'jackpot',
      '{"eyebrow": "On the house", "heading": "Jackpots and rare hands."}'::jsonb);
  end if;

  -- The front page: the room's hours and amenities, and the questions grandpokerarena.com answers.
  select id into v_page from public.site_page where venue_id = p_venue_id and slug = 'home';
  update public.site_block set content = jsonb_set(content, '{cards}', private.with_more(content -> 'cards', $j$[
      {"label": "Hours", "title": "Open every night", "text": "14:00 to 08:00, from Sunday 15 November."},
      {"title": "Smoking terrace", "text": "Details to follow."},
      {"title": "Parking", "text": "Details to follow."}]$j$::jsonb, 'title'))
  where page_id = v_page and kind = 'cards' and content ->> 'eyebrow' = 'The room' and jsonb_array_length(content -> 'cards') <= 9;
  update public.site_block set content = jsonb_set(content, '{questions}', private.with_more(content -> 'questions', $j$[
      {"question": "Is poker a game of skill?", "answer": "India's Supreme Court treats a game where skill predominates over chance as a game of skill, not gambling, and courts have applied that test to poker. The rulings are listed under On the record."},
      {"question": "What are the house rules?", "answer": "Members only, 18 and over. One player to a hand, chips stay in the club until you cash out at the cage, and the floor's decision on a hand is final. The full list is on the House rules page."},
      {"question": "What is the RIVR League?", "answer": "The club's leaderboard, month by month and season by season. Cash game hours and tournament finishes earn League points, and the standings and prizes are on the Leaderboard page."}]$j$::jsonb, 'question'))
  where page_id = v_page and kind = 'faq' and jsonb_array_length(content -> 'questions') <= 37;

  update public.site_block set content = jsonb_set(content, '{cards}', private.with_more(content -> 'cards', $j$[
      {"title": "Valet and parking", "text": "Details to follow."}]$j$::jsonb, 'title'))
  where page_id = v_page and kind = 'cards' and content ->> 'eyebrow' = 'Hospitality' and jsonb_array_length(content -> 'cards') <= 11;

  -- Rules the pages wrote in words now come from the settings and promotions (decision 0283), so the words that named
  -- them say so without the figures, each only while it still reads as first written.
  update public.site_block b set content = replace(replace(replace(replace(b.content::text,
      '"Chauffeured rides for regulars, and a cab home from your fourth visit in a month."',
      '"Chauffeured rides for regulars, and a cab home for members who play often. Membership has the details."'),
      '"For members who finish RIVR Academy: ₹1,000 on your first buy-in after you graduate."',
      '"For members who finish RIVR Academy: a bonus on their first buy-in after they graduate."'),
      '"RIVR Rewards: 5% of your rake back as points"', '"RIVR Rewards: a share of your rake back as points"'),
      '"₹1,000 on your first buy-in after you graduate"', '"A bonus on your first buy-in after you graduate"')::jsonb
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug in ('home', 'membership') and b.kind = 'cards';

  -- On the record, on the front page and About: every ruling linked to its judgment.
  update public.site_block b set content = jsonb_set(b.content, '{items}', private.with_rulings(b.content -> 'items'))
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug in ('home', 'about') and b.kind = 'timeline'
    and b.content ->> 'eyebrow' in ('On the record', 'Legal and compliance') and jsonb_array_length(b.content -> 'items') <= 6;

  -- The journal lists the new published articles.
  update public.site_block b set content = jsonb_set(b.content, '{cards}', b.content -> 'cards' || coalesce((
      select jsonb_agg(c order by n) from jsonb_array_elements($j$[
        {"label": "Strategy", "title": "Cash game tips for the live table", "text": "Habits that save chips at a live cash game, from the first hand to the last.", "link": {"page": "journal-cash-game-tips", "label": "Read"}},
        {"label": "Tournaments", "title": "Poker tournaments in Gurugram", "text": "How a live tournament runs at RIVR, from the buy-in to the final table.", "link": {"page": "journal-tournaments-gurugram", "label": "Read"}}
      ]$j$::jsonb) with ordinality t(c, n)
      where not exists (select 1 from jsonb_array_elements(b.content -> 'cards') e where e #>> '{link,page}' = c #>> '{link,page}')), '[]'::jsonb))
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug = 'journal' and b.kind = 'cards' and b.content ->> 'heading' = 'Articles'
    and jsonb_array_length(b.content -> 'cards') <= 10;
end;
$function$;

CREATE FUNCTION public.promotions_overview(p_venue_id uuid)
 RETURNS TABLE(promotion_id uuid, template_key text, status text, name text, detail text, runs text, current_version_id uuid, current_status text, open_version_id uuid, open_status text, rejected_reason text, reward jsonb, eligibility jsonb, schedule jsonb, limits jsonb, channels jsonb, given_this_week bigint, is_legacy boolean, created_at timestamp with time zone, ended_at timestamp with time zone, chips_given_this_week bigint, budget_used_chips bigint, is_quiet boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.promotions_overview(p_venue_id); $function$;
revoke all on function public.promotions_overview(uuid) from public, anon, authenticated, service_role;
grant execute on function public.promotions_overview(uuid) to authenticated;

CREATE FUNCTION public.member_promotion_grants(p_member_id uuid, p_limit integer DEFAULT 20)
 RETURNS TABLE(grant_id uuid, granted_at timestamp with time zone, club_day date, promotion_name text, version integer, chips bigint, perk text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.member_promotion_grants(p_member_id, p_limit); $function$;
revoke all on function public.member_promotion_grants(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.member_promotion_grants(uuid, integer) to authenticated;

CREATE FUNCTION public.my_wallet()
 RETURNS TABLE(member_id uuid, cash_paise bigint, credit_limit_paise bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.my_wallet(); $function$;
revoke all on function public.my_wallet() from public, anon, authenticated, service_role;
grant execute on function public.my_wallet() to authenticated;

CREATE FUNCTION public.erase_member(p_member_id uuid, p_full_name text, p_reason text)
 RETURNS TABLE(venue_id uuid, forfeited_bonus_paise bigint, blocked_until timestamp with time zone)
 LANGUAGE sql
 SET search_path TO ''
AS $function$ select * from private.erase_member(p_member_id, p_full_name, p_reason); $function$;
revoke all on function public.erase_member(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.erase_member(uuid, text, text) to authenticated;

CREATE FUNCTION public.member_erasure_preview(p_member_id uuid)
 RETURNS TABLE(is_erased boolean, blockers text[], bonus_paise bigint, blocked_until timestamp with time zone, kyc_files integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select * from private.member_erasure_preview(p_member_id); $function$;
revoke all on function public.member_erasure_preview(uuid) from public, anon, authenticated, service_role;
grant execute on function public.member_erasure_preview(uuid) to authenticated;

-- A simulation kept on a version no longer counts points. Here, after the functions: the check on a version's simulation
-- is the new one now, which the old count of points would fail, as the new shape failed the old check.
update public.promotion_version set simulation = simulation - 'points' where simulation ? 'points';

-- The website: the Leaderboard page and its League block go, and each line that named points, the League or RIVR Rewards,
-- as the website came with it. A line the club has since rewritten is left as the club wrote it. The privacy notice keeps
-- its word on points: the ledger keeps the points a member once held (decision 0585).
create function private.website_without_points_and_league(p_venue_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_lines constant text[][] := array[
    ['Your points and bonus chips are forfeited.', 'Your bonus chips are forfeited.'],
    ['"Where everyone starts: the waitlist from the app and RIVR Rewards."', '"Where everyone starts: the waitlist from the app."'],
    ['"points": ["Points from the club, spent on rewards", "RIVR Rewards", "The waitlist from the app"]', '"points": ["The waitlist from the app"]'],
    ['"heading": "Getting here, and staying over."', '"heading": "Getting here."'],
    ['{"text": "A bonus is credited to your balance and kept for its play; points are for rewards and never turn into cash.", "title": "Paid as bonus or points"}',
     '{"text": "A bonus is credited to your balance and kept for its play.", "title": "Paid as bonus"}'],
    ['"Points, bonus chips and offers"', '"Bonus chips and offers"'],
    ['Points, bonus chips and other offers follow the rules shown with each one in the app.', 'Bonus chips and other offers follow the rules shown with each one in the app.'],
    ['\n\nThe standings are on the Leaderboard page.', ''],
    ['{"heading": "Points and rewards"}', '{"heading": "Rakeback"}']
  ];
  v_line text[];
begin
  delete from public.site_block b using public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and (b.kind = 'league' or p.slug = 'leaderboard');
  delete from public.site_revision r using public.site_page p where p.id = r.page_id and p.venue_id = p_venue_id and p.slug = 'leaderboard';
  delete from public.site_page p where p.venue_id = p_venue_id and p.slug = 'leaderboard';
  foreach v_line slice 1 in array v_lines loop
    update public.site_block b set content = replace(b.content::text, v_line[1], v_line[2])::jsonb
    from public.site_page p
    where p.id = b.page_id and p.venue_id = p_venue_id and strpos(b.content::text, v_line[1]) > 0;
  end loop;
  -- The question about the League, among the home page's questions.
  update public.site_block b
  set content = jsonb_set(b.content, '{questions}', coalesce((select jsonb_agg(q.item order by q.n) from jsonb_array_elements(b.content -> 'questions') with ordinality as q (item, n)
                                                               where q.item ->> 'question' <> 'What is the RIVR League?'), '[]'::jsonb))
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and b.kind = 'faq' and b.content -> 'questions' @> '[{"question": "What is the RIVR League?"}]';
  update public.site_page set description = 'Join RIVR: tiers earned at the table, and how to sign up.'
  where venue_id = p_venue_id and slug = 'membership' and description = 'Join RIVR: tiers earned at the table, rewards, and how to sign up.';
end;
$$;
revoke all on function private.website_without_points_and_league(uuid) from public, anon, authenticated, service_role;
select private.website_without_points_and_league(v.id) from public.venue v;

-- A new venue's website: as before (20261110656400), then without them.
alter function private.add_website(uuid) rename to add_website_with_points_and_league;
create function private.add_website(p_venue_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.add_website_with_points_and_league(p_venue_id);
  perform private.website_without_points_and_league(p_venue_id);
end;
$$;
revoke all on function private.add_website(uuid) from public, anon, authenticated, service_role;

-- The website has no League block.
alter table public.site_block drop constraint site_block_kind_check;
alter table public.site_block add constraint site_block_kind_check check (kind in (
  'hero', 'statement', 'gallery', 'feature', 'text', 'rules', 'faq', 'careers', 'map', 'games', 'calendar', 'links',
  'story', 'cards', 'marquee', 'timeline', 'table', 'promotions', 'social_wall', 'rewards', 'outstation', 'jackpot'));

-- The practice venue's saved start is taken again: the one saved before held the points promotions, which a reset would
-- now be refused (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
