-- Bonus from promotions waits for a super admin (the owner, 15 Nov): every Bonus a promotion calculates is kept waiting,
-- with nothing on the ledger and nothing to the member, until a super admin approves it (posted then, exactly as the grant
-- posted it, with the push "Bonus added") or refuses it (nothing posted, nothing said). The high hand bonus is paid at once,
-- the floor's log being its check (the owner's choice); Bonus by hand is no promotion's and is unchanged. A waiting Bonus
-- counts toward its promotion's limits and budget as one given; a refused one counts toward nothing. Decision 0670.
-- Nothing waits at deploy: every grant made before is given.

-- Who decided which Bonus, once a request: approved, or refused with a reason. The grants it decided point at it.
create table public.promotion_bonus_decision (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  -- The console's request: the same one again is answered with this decision, so a second press decides nothing twice.
  request_id uuid not null,
  decision text not null check (decision in ('approved', 'refused')),
  grants integer not null check (grants > 0),
  amount_paise bigint not null check (amount_paise > 0),
  reason text check (length(btrim(reason)) between 3 and 200),
  decided_by_staff_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, request_id),
  unique (id, venue_id),
  check ((decision = 'refused') = (reason is not null)),
  foreign key (decided_by_staff_id, venue_id) references public.staff (id, venue_id)
);

comment on table public.promotion_bonus_decision is 'A super admin''s approval or refusal of Bonus a promotion calculated (decision 0670).';

create index promotion_bonus_decision_staff_idx on public.promotion_bonus_decision (decided_by_staff_id, venue_id);
create trigger promotion_bonus_decision_touch_updated_at before update on public.promotion_bonus_decision
  for each row execute function private.touch_updated_at();

alter table public.promotion_bonus_decision enable row level security;
grant select on public.promotion_bonus_decision to authenticated;
-- promotions.approve is a super admin's alone.
create policy "super admins see the venue's Bonus decisions" on public.promotion_bonus_decision
  for select to authenticated using (venue_id in (select private.venues_where('promotions.approve')));

-- A grant's state: waiting for a super admin, given, or refused; the event it was calculated for; and the decision.
alter table public.promotion_grant
  add column status text not null default 'given' check (status in ('waiting', 'given', 'refused')),
  add column event jsonb,
  add column decision_id uuid,
  add constraint promotion_grant_decision_fkey foreign key (decision_id, venue_id) references public.promotion_bonus_decision (id, venue_id),
  -- Only a Bonus waits or is refused, and neither has been posted.
  add constraint promotion_grant_waiting_is_unpaid_bonus check (status = 'given' or (bonus_grant_id is null and cost_paise > 0));

comment on column public.promotion_grant.status is 'waiting for a super admin (a promotion''s Bonus), given, or refused (decision 0670).';
comment on column public.promotion_grant.event is 'The event the grant was calculated for, as the engine saw it: its kind, moment, table and step.';

-- A refused grant holds no slot of its period: the member's next grant in it may take the slot (decision 0670). It keeps its
-- event's key, so the same event is never weighed again.
drop index public.promotion_grant_period_key;
create unique index promotion_grant_period_key on public.promotion_grant (promotion_id, member_id, period_key)
  where period_key is not null and status <> 'refused';
create index promotion_grant_waiting_idx on public.promotion_grant (venue_id, created_at) where status = 'waiting';
create index promotion_grant_decision_idx on public.promotion_grant (decision_id, venue_id);

-- A member's export holds the grants' new columns (decision 0240).
insert into private.member_export_column (table_name, column_name, kind) values
  ('promotion_grant', 'status', 'owed'), ('promotion_grant', 'event', 'owed'), ('promotion_grant', 'decision_id', 'owed');

-- The engine on versions: a promotion's Bonus waits; the high hand's (PR 3's trigger) is paid at once, as are perks.
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
  -- A Bonus waits for a super admin (decision 0670), but for the high hand's, paid at once: the floor's log is its check.
  v_waits boolean := (p_candidate ->> 'chips')::bigint > 0 and p_candidate ->> 'trigger' is distinct from 'high_hand';
  v_id uuid;
begin
  select * into v_version from public.promotion_version v where v.id = (p_candidate ->> 'version_id')::uuid;
  insert into public.promotion_grant (venue_id, promotion_id, promotion_version_id, member_id, table_id, trigger, effect, cost_paise, chips,
                                      perk, source_key, period_key, club_day, status, event)
  values (v_version.venue_id, v_version.promotion_id, v_version.id, v_member, (v_event ->> 'tableId')::uuid, p_candidate ->> 'trigger', v_version.reward,
          v_chips * 100, v_chips, p_candidate ->> 'perk', v_event ->> 'key', p_candidate ->> 'period_key',
          private.club_day_of((v_event ->> 'at')::timestamptz), case when v_waits then 'waiting' else 'given' end, v_event)
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    return null;
  end if;
  if v_chips > 0 and not v_waits then
    update public.promotion_grant
    set fulfilled_at = now(),
        bonus_grant_id = private.credit_bonus(v_version.venue_id, v_member, v_chips * 100, v_version.name, null, 'promotion:' || v_id)
    where id = v_id;
  end if;
  perform private.emit(v_version.venue_id, 'promotion.granted',
                       jsonb_build_object('promotion_grant_id', v_id, 'promotion_id', v_version.promotion_id, 'promotion_version_id', v_version.id,
                                          'member_id', v_member, 'effect', v_version.reward, 'cost_paise', v_chips * 100, 'chips', v_chips,
                                          'perk', p_candidate ->> 'perk', 'status', case when v_waits then 'waiting' else 'given' end),
                       'promotion.granted:' || v_id);
  return v_id;
end;
$function$;

-- The old engine, on rules: its Bonus waits too, and is posted when approved.
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
                                      source_key, club_day, status, event)
  values (v_venue_id, (p_candidate ->> 'promotion')::uuid, (p_candidate ->> 'rule')::uuid, v_member_id, (p_facts ->> 'table_id')::uuid,
          p_candidate ->> 'trigger', v_effect, (p_candidate ->> 'cost_paise')::bigint, p_context ->> 'key',
          (p_facts ->> 'club_day')::date, case when v_effect ->> 'kind' = 'bonus' then 'waiting' else 'given' end,
          jsonb_build_object('kind', p_candidate ->> 'trigger', 'key', p_context ->> 'key', 'at', now(), 'tableId', p_facts ->> 'table_id'))
  returning id into v_id;
  perform private.emit(v_venue_id, 'promotion.granted',
                       jsonb_build_object('promotion_grant_id', v_id, 'promotion_id', p_candidate ->> 'promotion', 'member_id', v_member_id,
                                          'effect', v_effect, 'cost_paise', (p_candidate ->> 'cost_paise')::bigint),
                       'promotion.granted:' || v_id);
  return v_id;
end;
$function$;

-- The limits and the budget count a waiting Bonus as one given, and a refused one as nothing (decision 0670).
CREATE OR REPLACE FUNCTION private.promotion_tally(p_promotion_id uuid, p_member_id uuid, p_period_key text, p_table_id uuid, p_day date, p_limits jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'chipsGiven', coalesce(sum(g.chips) filter (where g.is_counted), 0),
    'grantsGiven', count(*) filter (where g.is_counted),
    'membersToday', count(distinct g.member_id) filter (where g.club_day = p_day),
    'isMemberGrantedToday', coalesce(bool_or(g.member_id = p_member_id and g.club_day = p_day), false),
    'periodGiven', count(*) filter (where g.member_id = p_member_id
                                     and (g.period_key = p_period_key or starts_with(g.period_key, p_period_key || '#'))),
    'grantsAtTableToday', case when p_table_id is not null then count(*) filter (where g.club_day = p_day and g.table_id = p_table_id) end)
  from (select x.*, p_limits ->> 'budgetPeriod' is distinct from 'month'
                    or date_trunc('month', x.club_day) = date_trunc('month', p_day) as is_counted
        from public.promotion_grant x where x.promotion_id = p_promotion_id and x.status <> 'refused') g;
$function$;

-- The old engine's limits likewise; an event already weighed, refused or not, is not weighed again.
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
      'granted_today', (select count(*) from public.promotion_grant g where g.status <> 'refused' and g.promotion_id = p_promotion.id and g.club_day = v_day),
      'granted_today_at_table', (select count(*) from public.promotion_grant g where g.status <> 'refused' and g.promotion_id = p_promotion.id and g.club_day = v_day
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
    'budget_left_paise', v_budget.cap_paise - (select coalesce(sum(g.cost_paise), 0) from public.promotion_grant g where g.status <> 'refused' and g.promotion_id = p_promotion.id
                                               and (v_budget.period = 'promotion' or date_trunc('month', g.club_day) = date_trunc('month', v_day))),
    'grants_left', v_budget.cap_count - (select count(*) from public.promotion_grant g where g.status <> 'refused' and g.promotion_id = p_promotion.id
                                         and (v_budget.period = 'promotion' or date_trunc('month', g.club_day) = date_trunc('month', v_day))),
    'player_left', p_promotion.per_player_limit - (select count(*) from public.promotion_grant g where g.status <> 'refused' and g.promotion_id = p_promotion.id
                                                   and g.member_id = v_member_id and (p_promotion.per_player_period = 'promotion' or g.club_day = v_day)));
end;
$function$;

-- A member's record lists what was given: a Bonus once approved.
CREATE OR REPLACE FUNCTION private.member_promotion_grants(p_member_id uuid, p_limit integer)
 RETURNS TABLE(grant_id uuid, granted_at timestamp with time zone, club_day date, promotion_name text, version integer, chips bigint, perk text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select g.id, g.created_at, g.club_day, coalesce(v.name, p.name), v.version, g.chips, g.perk
  from public.promotion_grant g
  join public.promotion p on p.id = g.promotion_id
  left join public.promotion_version v on v.id = g.promotion_version_id
  where g.member_id = p_member_id and g.status = 'given' and private.has_permission(g.venue_id, 'members.read')
  order by g.created_at desc, g.id
  limit greatest(least(coalesce(p_limit, 20), 5000), 1);
$function$;

-- The list counts a waiting Bonus as given this week, as its budget used and the limits do; a refused one not.
CREATE OR REPLACE FUNCTION private.promotions_overview(p_venue_id uuid)
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
    where g.promotion_id = p.id and g.status <> 'refused' and g.club_day >= private.club_day_of(now()) - (extract(isodow from private.club_day_of(now()))::integer - 1)
  ) w
  where p.venue_id = p_venue_id and private.has_permission(p_venue_id, 'promotions.manage')
  order by p.created_at desc, p.id;
$function$;

-- The MIS counts what a promotion gave.
CREATE OR REPLACE FUNCTION private.mis_for(p_venue_id uuid, p_month date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with bounds as (
    select (p_month + time '06:00') at time zone 'Asia/Kolkata' as starts,
           ((p_month + interval '1 month')::date + time '06:00') at time zone 'Asia/Kolkata' as ends
  ),
  rake as (select r.* from bounds b cross join lateral private.rake_by(p_venue_id, b.starts, b.ends) r),
  posted as (
    select a.code, a.name, a.kind, sum(e.amount)::bigint as amount
    from bounds b
    join public.ledger_transaction t on t.venue_id = p_venue_id and t.occurred_at >= b.starts and t.occurred_at < b.ends
    join public.ledger_entry e on e.transaction_id = t.id and e.venue_id = t.venue_id
    join public.ledger_account a on a.id = e.account_id and a.venue_id = e.venue_id
    where a.unit = 'paise' and a.kind in ('revenue', 'expense') and not a.is_players_money
    group by a.code, a.name, a.kind
  ),
  visits as (
    select v.member_id from bounds b join public.visit v on v.venue_id = p_venue_id and v.opened_at >= b.starts and v.opened_at < b.ends
  ),
  -- Each promotion's grants by club day: this month's, and every one to its end.
  promotions as (
    select p.id, p.name,
           count(g.id) filter (where g.club_day >= p_month)::integer as grants,
           coalesce(sum(g.cost_paise) filter (where g.club_day >= p_month), 0)::bigint as cost_paise,
           coalesce(sum(g.cost_paise), 0)::bigint as cost_to_date_paise,
           b.cap_paise, b.cap_count
    from public.promotion p
    join public.promotion_grant g on g.promotion_id = p.id and g.status = 'given' and g.club_day < (p_month + interval '1 month')::date
    left join public.promotion_budget b on b.promotion_id = p.id
    where p.venue_id = p_venue_id
    group by p.id, p.name, b.cap_paise, b.cap_count
    having count(g.id) filter (where g.club_day >= p_month) > 0
  ),
  -- Each visit's club month, up to this month's end, and each member's first.
  member_months as (
    select distinct v.member_id, date_trunc('month', (v.opened_at at time zone 'Asia/Kolkata') - interval '6 hours')::date as month
    from bounds b join public.visit v on v.venue_id = p_venue_id and v.opened_at < b.ends
  ),
  cohort_of as (select m.member_id, min(m.month) as cohort from member_months m group by m.member_id),
  cohorts as (
    select c.cohort, count(*)::integer as members
    from cohort_of c
    where c.cohort > (p_month - interval '6 months')::date
    group by c.cohort
  ),
  -- Each cohort's months from its first to this one: how many of its members visited, and the share, rounded down.
  cohort_months as (
    select c.cohort, s.month::date as month, c.members,
           (select count(*)::integer from member_months m join cohort_of x on x.member_id = m.member_id
            where x.cohort = c.cohort and m.month = s.month::date) as returned
    from cohorts c cross join lateral generate_series(c.cohort, p_month, interval '1 month') s(month)
  )
  select jsonb_build_object(
    'month', p_month,
    'hands', (select coalesce(sum(r.hands), 0) from rake r where r.dimension = 'variant'),
    'rake_paise', (select coalesce(sum(r.rake_paise), 0) from rake r where r.dimension = 'variant'),
    'drop_paise', (select coalesce(sum(r.drop_paise), 0) from rake r where r.dimension = 'variant'),
    'rake_by_table', private.mis_rake_rows(coalesce((select jsonb_agg(to_jsonb(r)) from rake r where r.dimension = 'table'), '[]'::jsonb)),
    'rake_by_dealer', private.mis_rake_rows(coalesce((select jsonb_agg(to_jsonb(r)) from rake r where r.dimension = 'dealer'), '[]'::jsonb)),
    'rake_by_variant', private.mis_rake_rows(coalesce((select jsonb_agg(to_jsonb(r)) from rake r where r.dimension = 'variant'), '[]'::jsonb)),
    'revenue', coalesce((select jsonb_agg(jsonb_build_object('code', p.code, 'name', p.name, 'paise', -p.amount) order by -p.amount desc, p.code)
                         from posted p where p.kind = 'revenue'), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(jsonb_build_object('code', p.code, 'name', p.name, 'paise', p.amount) order by p.amount desc, p.code)
                          from posted p where p.kind = 'expense'), '[]'::jsonb),
    'revenue_paise', (select coalesce(-sum(p.amount), 0) from posted p where p.kind = 'revenue'),
    'expense_paise', (select coalesce(sum(p.amount), 0) from posted p where p.kind = 'expense'),
    'net_paise', (select coalesce(-sum(p.amount), 0) from posted p),
    'visits', (select count(*) from visits),
    'members', (select count(distinct v.member_id) from visits v),
    'promotions', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'grants', p.grants, 'cost_paise', p.cost_paise,
                                                                'cost_to_date_paise', p.cost_to_date_paise, 'budget_paise', p.cap_paise,
                                                                'budget_grants', p.cap_count)
                                             order by p.cost_paise desc, p.name)
                            from promotions p), '[]'::jsonb),
    'cohorts', coalesce((select jsonb_agg(jsonb_build_object('month', c.cohort, 'members', c.members, 'months',
                           (select jsonb_agg(jsonb_build_object('month', m.month, 'returned', m.returned,
                                                                'percent', m.returned * 100 / m.members) order by m.month)
                            from cohort_months m where m.cohort = c.cohort)) order by c.cohort desc)
                         from cohorts c), '[]'::jsonb)
  );
$function$;

-- The console's queues: Bonus to approve, for super admins.
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
    ('tournamentInterest', (select count(*) from private.tournament_interest_list(p_venue_id) i
                            join public.tournament t on t.id = i.tournament_id
                            where i.registered_at is null and t.is_published)),
    -- Bonus a promotion calculated, waiting for a super admin, as the queue lists it (decision 0670).
    ('bonusApprovals', (select count(*) from public.promotion_grant g join public.member m on m.id = g.member_id and m.erased_at is null
                        where g.venue_id = p_venue_id and g.status = 'waiting' and private.is_super_admin(p_venue_id)
                          and not private.is_own_cage_record(g.member_id) and not coalesce(private.is_own_kyc_check(g.member_id), false))),
    -- Members who asked to delete their account, for those who erase.
    ('erasureRequests', (select count(*) from private.member_erasure_requests(p_venue_id)))
  ) as q (queue, waiting)
  where q.waiting > 0;
$function$;

-- Activity: an approval or a refusal is Bonus.
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
    when p_action in ('bonus.give', 'bonus.approve', 'bonus.refuse') or p_entity in ('bonus_grant', 'bonus_redemption', 'promotion_bonus_decision')
      then 'bonus_chips'
    when p_entity in ('member_tier_change', 'tier', 'tier_feature') then 'tiers'
    when p_action like 'member.%' or p_action like 'kyc_image.%'
         or p_entity in ('member', 'member_limit', 'member_feature_override', 'self_exclusion', 'consent', 'sign_up_attribution') then 'members'
    when p_entity in ('setting', 'venue', 'venue_config', 'device', 'tablet_assignment', 'tv_screen', 'camera', 'storage_object') then 'settings'
    when p_entity in ('game_table', 'table_type', 'waitlist_entry', 'seat_session', 'seat_move', 'visit', 'early_departure',
                      'early_departure_withdrawal', 'down_count', 'dealer_down', 'hand') then 'floor'
    else 'other'
  end;
$function$;

-- An Activity line of a decision: its total, and the member, or how many when there are more (decision 0670).
create or replace view private.activity_line with (security_invoker = true) as
 SELECT l.venue_id,
    l.id,
    l.occurred_at,
    w.name AS who,
    (l.actor_user_id IS NULL) AS is_system,
    l.action,
    l.entity,
    private.activity_kind(l.action, l.entity) AS kind,
    COALESCE(
        CASE
            WHEN (rm.erased_at IS NULL) THEN rm.full_name
            ELSE NULL::text
        END, rs.full_name,
        CASE
            WHEN (l.entity = 'table'::text) THEN l.entity_id
            WHEN (l.entity = 'promotion_bonus_decision'::text) THEN (l.after ->> 'grants'::text)
            ELSE NULL::text
        END) AS about,
        CASE
            WHEN ((rm.erased_at IS NULL) OR (l.action = 'member.erase'::text)) THEN l.reason
            ELSE NULL::text
        END AS reason,
        CASE
            WHEN (l.action = ANY (ARRAY['bonus.give'::text, 'bonus.approve'::text, 'bonus.refuse'::text])) THEN ((l.after ->> 'chips'::text))::bigint
            ELSE NULL::bigint
        END AS amount
   FROM (((((((audit_log l
     LEFT JOIN staff s ON (((s.user_id = l.actor_user_id) AND (s.venue_id = l.venue_id))))
     LEFT JOIN member a ON (((a.user_id = l.actor_user_id) AND (a.venue_id = l.venue_id))))
     LEFT JOIN device d ON (((d.id = l.device_id) AND (d.venue_id = l.venue_id))))
     CROSS JOIN LATERAL ( SELECT COALESCE(s.full_name,
                CASE
                    WHEN (a.erased_at IS NULL) THEN a.full_name
                    ELSE NULL::text
                END, d.name) AS name) w)
     LEFT JOIN LATERAL ( SELECT COALESCE(
                CASE
                    WHEN (l.entity = 'member'::text) THEN l.entity_id
                    ELSE NULL::text
                END, (l.after ->> 'member_id'::text), (l.before ->> 'member_id'::text)) AS member_id,
            COALESCE(
                CASE
                    WHEN (l.entity = 'staff'::text) THEN l.entity_id
                    ELSE NULL::text
                END, (l.after ->> 'staff_id'::text), (l.before ->> 'staff_id'::text)) AS staff_id) t ON (true))
     LEFT JOIN member rm ON (((rm.id = private.uuid_or_null(t.member_id)) AND (rm.venue_id = l.venue_id))))
     LEFT JOIN staff rs ON (((rs.id = private.uuid_or_null(t.staff_id)) AND (rs.venue_id = l.venue_id))));

-- The lists on the server: Bonus to approve.
CREATE OR REPLACE FUNCTION private.list_spec(p_list text, OUT o_source text, OUT o_columns jsonb, OUT o_search text[], OUT o_order text, OUT o_choices text[])
 RETURNS record
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select s.source, s.columns, s.search, s.sorted, s.choices
  from (values
    -- Open Feedback tickets (F-013), as private.open_feedback gives them, oldest first.
    ('feedback_open',
     $src$
       select f.id, m.id as member_id, m.full_name, m.member_number, v.closed_at as visit_closed_at, f.score, f.note, f.created_at, f.topic, f.ratings, f.nps,
              (select string_agg(distinct g.name, ', ' order by g.name)
               from public.seat_session s join public.game_table g on g.id = s.table_id where s.visit_id = f.visit_id) as tables,
              (select extract(epoch from min(s.started_at) - v.opened_at)::integer from public.seat_session s where s.visit_id = f.visit_id) as wait_seconds
       from public.feedback f
       join public.member m on m.id = f.member_id
       left join public.visit v on v.id = f.visit_id
       where f.venue_id = $1 and f.is_ticket and f.resolved_at is null and (select private.has_permission($1, 'feedback.manage'))
     $src$,
     '{"member": "full_name", "age": "extract(epoch from now() - created_at) / 3600.0", "rating": "coalesce(score, 0)", "visit": "tables", "note": "note"}'::jsonb,
     array['full_name', 'note', 'topic'], 'created_at, id', array['rating']),
    -- The ID checks' queue, as private.kyc_review_queue gives it: those to review first, then the unfinished and the
    -- refused of the last 90 days.
    ('kyc_review',
     $src$
       select k.member_id, m.full_name, k.status, k.method,
              case
                when k.status <> 'needs_review' then null
                when k.pan_recheck in ('pan_invalid', 'name_differs', 'date_of_birth_differs') then 'recheck_' || k.pan_recheck
                when k.method = 'pan' then 'pan_alone'
                when k.date_of_birth is null and k.pan is null and k.aadhaar_reference is null then 'nothing_kept'
                when k.date_of_birth is null then 'no_date_of_birth'
                when private.kyc_clashes(k.member_id) then 'clash'
              end as waiting_because,
              k.date_of_birth, k.masked_aadhaar, k.pan, k.address, k.photo_path, k.liveness_score, k.face_match_score, k.vendor_reference, k.refusal,
              array(select om.full_name from public.kyc_record o join public.member om on om.id = o.member_id
                    where private.kyc_records_clash(k, o) order by om.full_name) as clashes_with,
              k.updated_at
       from public.kyc_record k join public.member m on m.id = k.member_id
       where k.venue_id = $1 and k.status in ('needs_review', 'needs_pan', 'refused')
         and (k.status = 'needs_review' or k.updated_at > now() - interval '90 days')
         and (select private.has_permission($1, 'kyc.review'))
     $src$,
     '{"name": "full_name", "status": "status"}'::jsonb,
     array['full_name'], '(status = ''needs_review'') desc, updated_at, member_id', array['status']),
    -- A club day's orders, as private.fnb_orders_tonight gives tonight's: the day and the state are the screen's choice
    -- (today, and the orders still open, unless the view says otherwise). Open orders come oldest first; the rest newest.
    ('fnb_orders',
     $src$
       select listed.* from (
         select o.id as order_id, o.kot_number, g.name as table_name, o.seat, m.full_name as member_name, m.member_number, o.lines, o.is_comp, o.source,
                o.created_at, o.kot_sent_at, o.kot_sent_by, o.accepted_at, o.delivered_at,
                floor(extract(epoch from coalesce(o.delivered_at, o.cancelled_at, now()) - o.created_at))::integer as age_seconds,
                o.cancelled_at, o.cancel_reason, o.on_way_at,
                o.kot_sent_at is null and o.cancelled_at is null and o.accepted_at is null and o.delivered_at is null and exists (
                  select 1 from public.outbox_event e
                  join public.outbox_delivery d on d.event_id = e.id and d.venue_id = e.venue_id and d.consumer = 'bar_printer'
                  where e.venue_id = o.venue_id and e.event_type = 'fnb.ordered' and e.idempotency_key = 'fnb.ordered:' || o.id
                    and (d.status = 'failed' or d.status = 'delivered')) as kot_print_failed,
                coalesce((select case when s.leaving_at is null then 'seated' else 'leaving' end
                          from public.seat_session s
                          where s.venue_id = o.venue_id and s.member_id = o.member_id and s.ended_at is null), 'left') as seat_state,
                case when o.cancelled_at is not null then 'void' when o.delivered_at is not null then 'delivered'
                     when o.accepted_at is null then 'to_accept' else 'preparing' end as state
         from public.fnb_order o
         join public.game_table g on g.id = o.table_id
         join public.member m on m.id = o.member_id
         where o.venue_id = $1 and o.club_day = coalesce(nullif($2 #>> '{scope,day}', '')::date, private.club_day_now())
           and (select private.may_serve_fnb($1))) listed
       where case coalesce($2 #>> '{scope,state}', 'open') when 'open' then listed.state in ('to_accept', 'preparing')
                                                            when 'all' then true else listed.state = $2 #>> '{scope,state}' end
     $src$,
     '{"kot": "kot_number", "table": "table_name", "member": "member_name", "age": "age_seconds / 3600.0", "state": "state"}'::jsonb,
     array['member_name', 'table_name', 'kot_number', 'lines'],
     'case when state in (''to_accept'', ''preparing'') then created_at end, created_at desc, kot_number desc', array['state', 'table']),
    -- Everyone at the door today (#641, #72): today's players, each with their tier, their ID check and which of the
    -- door's lists they are on. In the club with a visit open; expected while on a waitlist and not yet in.
    -- KYC_STATUS stands for the ID check's words as the Members list has them (private.members_column_sql).
    ('door',
     replace($src$
       select listed.* from (
         select tp.member_id, tp.full_name, tp.member_number, t.name as tier_name,
                t.rank = (select min(x.rank) from public.tier x where x.venue_id = t.venue_id and not x.is_retired) as is_base_tier,
                case when tp.status = 'waiting' and ov.id is null then 'expected' else tp.status end as status,
                case when ov.id is not null or tp.status = 'playing' then 'in_club' when tp.status = 'waiting' then 'expected'
                     when tp.status = 'left' then 'left' else 'not_arrived' end as list,
                tp.checked_in_at, tp.checked_out_at, tp.waiting_seconds, tp.tables,
                coalesce((select sum((x ->> 'seconds')::bigint) from jsonb_array_elements(tp.tables) x), 0)::bigint as played_seconds,
                (select string_agg(x ->> 'table', ', ') from jsonb_array_elements(tp.tables) x) as table_names,
                KYC_STATUS as kyc_status,
                coalesce(ov.opened_at, (select min(e.joined_at) from public.waitlist_entry e where e.member_id = tp.member_id and e.status = 'waiting')) as since
         from private.todays_players($1) tp
         join public.member m on m.id = tp.member_id
         join public.tier t on t.id = m.tier_id
         left join public.visit ov on ov.member_id = tp.member_id and ov.closed_at is null) listed
       where coalesce($2 #>> '{scope,list}', 'all') in ('all', listed.list)
     $src$, 'KYC_STATUS', private.members_column_sql('kyc')),
     '{"player": "full_name", "number": "member_number", "tier": "tier_name", "status": "status", "in": "checked_in_at", "out": "checked_out_at",
       "waited": "waiting_seconds / 3600.0", "table": "table_names", "played": "played_seconds / 3600.0", "kyc": "kyc_status",
       "list": "list", "arrived": "(checked_in_at is not null)",
       "status:sort": "array_position(array[''waiting'', ''expected'', ''playing'', ''in_room'', ''left'', ''never_arrived''], status)"}'::jsonb,
     array['full_name', 'member_number'], 'full_name, member_id', array['status', 'tier', 'kyc', 'list', 'arrived']),
    -- The Waitlist as one list (redesign RD-31; the owner, 15 Nov): every place on every table's list, as
    -- private.waitlist_board gives them, each with its table. Each table keeps its own list and its own order: the
    -- places come table by table, in place order. The screen may ask for one table's list alone.
    ('waitlist',
     $src$
       select b.entry_id, b.table_type_id, b.member_id, b.full_name, b.joined_at, b.place, b.added_by_floor, b.priority_reason, b.call_table_name,
              b.call_seat, b.hold_until, b.away_until, b.asked_table_id, b.on_way_at, b.needs_id_check, g.name as table_name, g.position as table_position
       from private.waitlist_board($1) b
       join public.game_table g on g.id = b.asked_table_id
       where coalesce(nullif($2 #>> '{scope,table}', '')::uuid, b.asked_table_id) = b.asked_table_id
     $src$,
     '{"player": "full_name", "table": "table_name", "place": "place", "waited": "extract(epoch from now() - joined_at) / 3600.0"}'::jsonb,
     array['full_name'], 'table_position, table_name, place', array['table']),
    -- Bonus a promotion calculated, waiting for a super admin (decision 0670), the oldest first. A super admin's own
    -- record's are not theirs to decide, so not listed; nor an erased member's.
    ('bonus_waiting',
     $src$
       select g.id as grant_id, g.member_id, m.full_name, m.member_number, g.promotion_id, coalesce(v.name, p.name) as promotion_name,
              g.cost_paise as amount_paise, g.trigger, coalesce((g.event ->> 'at')::timestamptz, g.created_at) as event_at,
              (g.event ->> 'stepMinutes')::integer as step_minutes, t.name as table_name, g.club_day
       from public.promotion_grant g
       join public.member m on m.id = g.member_id and m.erased_at is null
       join public.promotion p on p.id = g.promotion_id
       left join public.promotion_version v on v.id = g.promotion_version_id
       left join public.game_table t on t.id = g.table_id
       where g.venue_id = $1 and g.status = 'waiting' and (select private.is_super_admin($1))
         and not private.is_own_cage_record(g.member_id) and not coalesce(private.is_own_kyc_check(g.member_id), false)
     $src$,
     '{"member": "full_name", "number": "member_number", "promotion": "promotion_name", "amount": "amount_paise / 100", "why": "trigger",
       "when": "club_day", "when:sort": "event_at"}'::jsonb,
     array['full_name', 'member_number', 'promotion_name'], 'event_at, full_name, grant_id', array['promotion', 'why'])
  ) as s(list, source, columns, search, sorted, choices)
  where s.list = p_list;
$function$;

-- A page of Bonus to approve, sorted, searched and filtered on the server, with how many the view leaves.
create function private.bonus_waiting_page(p_venue_id uuid, p_view jsonb)
returns table (total bigint, grant_id uuid, member_id uuid, full_name text, member_number bigint, promotion_id uuid, promotion_name text,
               amount_paise bigint, trigger text, event_at timestamptz, step_minutes integer, table_name text, club_day date)
language sql
stable
security definer
set search_path = ''
as $$
  with page as materialized (select private.list_json('bonus_waiting', p_venue_id, p_view) as found)
  select (page.found ->> 'total')::bigint, r.grant_id, r.member_id, r.full_name, r.member_number, r.promotion_id, r.promotion_name,
         r.amount_paise, r.trigger, r.event_at, r.step_minutes, r.table_name, r.club_day
  from page
  cross join lateral jsonb_to_recordset(page.found -> 'rows') as r(
    list_place bigint, grant_id uuid, member_id uuid, full_name text, member_number bigint, promotion_id uuid, promotion_name text,
    amount_paise bigint, trigger text, event_at timestamptz, step_minutes integer, table_name text, club_day date)
  order by r.list_place;
$$;

create function public.bonus_waiting_page(p_venue_id uuid, p_view jsonb default '{}')
returns table (total bigint, grant_id uuid, member_id uuid, full_name text, member_number bigint, promotion_id uuid, promotion_name text,
               amount_paise bigint, trigger text, event_at timestamptz, step_minutes integer, table_name text, club_day date)
language sql
stable
set search_path = ''
as $$ select * from private.bonus_waiting_page(p_venue_id, p_view); $$;

-- A super admin approves or refuses Bonus a promotion calculated (decision 0670), one or many at once, all or none.
-- Approved: each is posted exactly as the grant posted it before (credit_bonus: the same amount, the promotion's name and
-- the key promotion:<grant>), so the ledger has the same lines, the push says "Bonus added" and the Bonus's end counts from
-- now. Refused: nothing is posted and the member is told nothing; the promotion's limits and budget no longer count it.
-- One Activity line a decision: who, how many and the total, and the reason of a refusal. Chosen and already decided by
-- another: left as decided, and not counted. The same request again is answered with its first try. Refused, saying which:
-- nobody but a super admin (42501); one's own record, by login, phone or name (RVOWN); a frozen venue, promotions switched
-- off or a frozen member (RVFRZ, RVKIL, RVMBR); none, more than 500, no request id, or a refusal without a reason of 3 to
-- 200 characters (22023).
create function private.decide_promotion_bonus(p_venue_id uuid, p_grant_ids uuid[], p_decision text, p_reason text, p_request_id uuid)
returns table (decision_id uuid, grants integer, amount_paise bigint)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_done public.promotion_bonus_decision;
  v_grant record;
  v_ids uuid[] := '{}'::uuid[];
  v_members uuid[] := '{}'::uuid[];
  v_total bigint := 0;
  v_bonus uuid;
  v_id uuid;
begin
  if not coalesce(private.is_super_admin(p_venue_id), false) then
    raise exception 'Only a super admin approves or refuses Bonus from a promotion' using errcode = '42501';
  end if;
  if p_request_id is null or p_decision is null or p_decision not in ('approved', 'refused')
     or coalesce(cardinality(p_grant_ids), 0) not between 1 and 500
     or (p_decision = 'refused') <> (p_reason is not null) or length(btrim(coalesce(p_reason, 'none'))) not between 3 and 200 then
    raise exception 'One to 500 Bonus, a reason of 3 to 200 characters to refuse, and a request id' using errcode = '22023';
  end if;
  -- The same request waits for its first try, then is answered with it.
  perform pg_advisory_xact_lock(hashtextextended('promotion_bonus:' || p_venue_id::text || ':' || p_request_id::text, 0));
  select * into v_done from public.promotion_bonus_decision d where d.venue_id = p_venue_id and d.request_id = p_request_id;
  if v_done.id is not null then
    if v_done.decision <> p_decision then
      raise exception 'That request id was used for another decision' using errcode = '22023';
    end if;
    return query select v_done.id, v_done.grants, v_done.amount_paise;
    return;
  end if;
  if exists (select 1 from public.promotion_grant g
             where g.id = any (p_grant_ids) and g.venue_id = p_venue_id and g.status = 'waiting'
               and (private.is_own_cage_record(g.member_id) or coalesce(private.is_own_kyc_check(g.member_id), false))) then
    raise exception 'Nobody approves or refuses a Bonus for their own record' using errcode = 'RVOWN';
  end if;
  perform private.assert_writable(p_venue_id, 'promotions');
  for v_grant in
    select g.id, g.member_id, g.cost_paise, coalesce(v.name, p.name) as name
    from public.promotion_grant g
    join public.member m on m.id = g.member_id and m.erased_at is null
    join public.promotion p on p.id = g.promotion_id
    left join public.promotion_version v on v.id = g.promotion_version_id
    where g.id = any (p_grant_ids) and g.venue_id = p_venue_id and g.status = 'waiting'
    order by g.created_at, g.id
    for update of g
  loop
    if p_decision = 'approved' then
      perform private.assert_writable(p_venue_id, 'promotions', v_grant.member_id);
      v_bonus := private.credit_bonus(p_venue_id, v_grant.member_id, v_grant.cost_paise, v_grant.name, null, 'promotion:' || v_grant.id);
      update public.promotion_grant set status = 'given', bonus_grant_id = v_bonus, fulfilled_at = now() where id = v_grant.id;
    else
      update public.promotion_grant set status = 'refused' where id = v_grant.id;
    end if;
    v_ids := v_ids || v_grant.id;
    v_members := v_members || v_grant.member_id;
    v_total := v_total + v_grant.cost_paise;
  end loop;
  if cardinality(v_ids) = 0 then
    return query select null::uuid, 0, 0::bigint;
    return;
  end if;
  insert into public.promotion_bonus_decision (venue_id, request_id, decision, grants, amount_paise, reason, decided_by_staff_id)
  values (p_venue_id, p_request_id, p_decision, cardinality(v_ids), v_total, btrim(p_reason), private.current_staff_id(p_venue_id))
  returning id into v_id;
  update public.promotion_grant set decision_id = v_id where id = any (v_ids);
  -- Activity names the member when the decision is one member's, and how many otherwise.
  perform private.audit(p_venue_id, case p_decision when 'approved' then 'bonus.approve' else 'bonus.refuse' end, 'promotion_bonus_decision',
                        v_id::text, null,
                        jsonb_build_object('grants', cardinality(v_ids), 'chips', v_total / 100, 'amount_paise', v_total)
                        || case when (select count(distinct x) from unnest(v_members) x) = 1 then jsonb_build_object('member_id', v_members[1]) else '{}'::jsonb end,
                        btrim(p_reason));
  return query select v_id, cardinality(v_ids), v_total;
end;
$$;

create function public.approve_promotion_bonus(p_venue_id uuid, p_grant_ids uuid[], p_request_id uuid)
returns table (decision_id uuid, grants integer, amount_paise bigint)
language sql
set search_path = ''
as $$ select * from private.decide_promotion_bonus(p_venue_id, p_grant_ids, 'approved', null, p_request_id); $$;

create function public.refuse_promotion_bonus(p_venue_id uuid, p_grant_ids uuid[], p_reason text, p_request_id uuid)
returns table (decision_id uuid, grants integer, amount_paise bigint)
language sql
set search_path = ''
as $$ select * from private.decide_promotion_bonus(p_venue_id, p_grant_ids, 'refused', p_reason, p_request_id); $$;

revoke execute on function private.bonus_waiting_page(uuid, jsonb), public.bonus_waiting_page(uuid, jsonb),
  private.decide_promotion_bonus(uuid, uuid[], text, text, uuid), public.approve_promotion_bonus(uuid, uuid[], uuid),
  public.refuse_promotion_bonus(uuid, uuid[], text, uuid) from public, anon;
grant execute on function private.bonus_waiting_page(uuid, jsonb), public.bonus_waiting_page(uuid, jsonb),
  private.decide_promotion_bonus(uuid, uuid[], text, text, uuid), public.approve_promotion_bonus(uuid, uuid[], uuid),
  public.refuse_promotion_bonus(uuid, uuid[], text, uuid) to authenticated;
