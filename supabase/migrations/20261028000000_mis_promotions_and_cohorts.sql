-- Promotion cost and cohort retention in the monthly MIS (#111; scope-v1 module 16; decision 0235).
-- * Each promotion that gave anything in the club month: its grants and cost in the month, its cost to the month's
--   end, and its budget (a cap in rupees, a cap on grants, both, or none).
-- * Cohort retention: the members whose first visit fell in each of the six club months up to this one, and, for each
--   month from then to this one, how many of them visited and what share that is (whole percent, rounded down).
-- As 20261026230000's private.mis_for, with `promotions` and `cohorts` added. A month stored before keeps what it
-- said: it has neither, and the console shows them as empty.

create or replace function private.mis_for(p_venue_id uuid, p_month date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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
    join public.promotion_grant g on g.promotion_id = p.id and g.club_day < (p_month + interval '1 month')::date
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
$$;
