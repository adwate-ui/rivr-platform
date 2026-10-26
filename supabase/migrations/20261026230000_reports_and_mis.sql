-- Reports and the monthly investor MIS (#99; scope-v1 modules 4 and 16; decision 0188).
--
-- Tonight: the rake of the hands played since tonight began (private.tonight_began), by table, dealer and
-- variant, from hand records, for staff who read reports. The month: the investor MIS, the same rake for
-- the club's month (from its first club day's 06:00 IST to the next month's), the month's revenue and
-- expenses by ledger account and the net, and its visits and members. Each morning at 07:00 IST, once
-- the night has ended, pg_cron stores each venue's MIS for the last month that has ended if it is not
-- stored yet: the 1st's run stores it, and a missed or failed run is made up the next morning, with an
-- alert for a venue that could not be stored. A month is stored once. The console shows a stored month,
-- or the month so far as a preview. The Glaza F&B import (#109) joins the
-- MIS when it is built. The practice venue has no reports.

-- The rake and jackpot drop of the hands played from p_from until p_until, by table, by dealer and by
-- variant, the most rake first.
create function private.rake_by(p_venue_id uuid, p_from timestamptz, p_until timestamptz)
returns table (dimension text, key text, label text, hands bigint, rake_paise bigint, drop_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with played as (
    select h.table_id, g.name as table_name, h.staff_id, s.full_name as dealer_name, h.variant::text as variant, h.rake_paise, h.drop_paise
    from public.hand h
    join public.game_table g on g.id = h.table_id
    join public.staff s on s.id = h.staff_id
    where h.venue_id = p_venue_id and h.played_at >= p_from and h.played_at < p_until
  )
  select 'table', p.table_id::text, p.table_name, count(*), sum(p.rake_paise)::bigint, sum(p.drop_paise)::bigint
  from played p group by p.table_id, p.table_name
  union all
  select 'dealer', p.staff_id::text, p.dealer_name, count(*), sum(p.rake_paise)::bigint, sum(p.drop_paise)::bigint
  from played p group by p.staff_id, p.dealer_name
  union all
  select 'variant', p.variant, p.variant, count(*), sum(p.rake_paise)::bigint, sum(p.drop_paise)::bigint
  from played p group by p.variant
  order by 1, 5 desc, 3;
$$;

-- Refuses anyone who does not read reports at the venue, and the practice venue.
create function private.assert_reports(p_venue_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'reports.read') then
    raise exception 'Only staff who read reports see them' using errcode = '42501';
  end if;
  if exists (select 1 from public.venue v where v.id = p_venue_id and v.is_practice) then
    raise exception 'The practice venue has no reports' using errcode = '22023';
  end if;
end;
$$;

-- Tonight's rake by table, dealer and variant.
create function private.rake_tonight(p_venue_id uuid)
returns table (dimension text, key text, label text, hands bigint, rake_paise bigint, drop_paise bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_reports(p_venue_id);
  return query select * from private.rake_by(p_venue_id, private.tonight_began(now()), 'infinity');
end;
$$;

-- Rake rows as the MIS keeps them: key, label, hands, rake and drop, the most rake first.
create function private.mis_rake_rows(p_rows jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', r ->> 'key', 'label', r ->> 'label', 'hands', (r ->> 'hands')::bigint,
                                               'rake_paise', (r ->> 'rake_paise')::bigint, 'drop_paise', (r ->> 'drop_paise')::bigint)
                            order by (r ->> 'rake_paise')::bigint desc, r ->> 'label'), '[]'::jsonb)
  from jsonb_array_elements(p_rows) r;
$$;

-- The MIS of a club month, p_month its first day: the rake by table, dealer and variant with their
-- totals; the month's revenue and expenses by ledger account (money, not players' money; revenue is
-- credited, so turned round) and the net; the visits opened and the members who made them.
create function private.mis_for(p_venue_id uuid, p_month date)
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
    'members', (select count(distinct v.member_id) from visits v)
  );
$$;

create table public.mis_report (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  -- The club month's first day.
  month date not null check (extract(day from month) = 1),
  -- private.mis_for as it stood when stored.
  report jsonb not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, month),
  unique (id, venue_id)
);
comment on table public.mis_report is 'Each club month''s investor MIS, stored once on the 1st after it ends (#99).';
create trigger mis_report_touch_updated_at before update on public.mis_report
  for each row execute function private.touch_updated_at();
alter table public.mis_report enable row level security;
grant select on public.mis_report to authenticated;
create policy "report readers see the MIS" on public.mis_report
  for select to authenticated using (venue_id in (select private.venues_where('reports.read')));

-- Stores each venue's MIS for a club month (the last one ended, by default) where it is not stored yet: a
-- month already stored keeps what it said. A venue whose MIS cannot be stored raises an alert, and the
-- next run tries again. The practice venue has none. Returns how many it stored.
create function private.store_mis(p_month date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := coalesce(p_month, (date_trunc('month', (now() at time zone 'Asia/Kolkata') - interval '6 hours') - interval '1 month')::date);
  v_venue_id uuid;
  v_stored integer := 0;
begin
  for v_venue_id in
    select v.id from public.venue v
    where not v.is_practice and not exists (select 1 from public.mis_report m where m.venue_id = v.id and m.month = v_month)
  loop
    begin
      insert into public.mis_report (venue_id, month, report) values (v_venue_id, v_month, private.mis_for(v_venue_id, v_month));
      v_stored := v_stored + 1;
    exception when others then
      perform private.raise_alert(v_venue_id, 'mis.not_stored', jsonb_build_object('month', v_month, 'reason', sqlerrm));
    end;
  end loop;
  return v_stored;
end;
$$;

-- 01:30 UTC is 07:00 IST, an hour after the night ends, as the rake invoice runs.
select cron.schedule('monthly-mis', '30 1 * * *', 'select private.store_mis()');

-- A club month's MIS (p_month its first day): as stored, or, before it is, the month so far as a preview.
create function private.mis_report_for(p_venue_id uuid, p_month date)
returns table (report jsonb, generated_at timestamptz, is_preview boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_reports(p_venue_id);
  if p_month is null or extract(day from p_month) <> 1
     or p_month > date_trunc('month', (now() at time zone 'Asia/Kolkata') - interval '6 hours')::date then
    raise exception 'A club month''s first day, this month or before' using errcode = '22023';
  end if;
  return query select m.report, m.generated_at, false from public.mis_report m where m.venue_id = p_venue_id and m.month = p_month;
  if not found then
    return query select private.mis_for(p_venue_id, p_month), null::timestamptz, true;
  end if;
end;
$$;

create function public.rake_tonight(p_venue_id uuid)
returns table (dimension text, key text, label text, hands bigint, rake_paise bigint, drop_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.rake_tonight(p_venue_id); $$;
create function public.mis_report_for(p_venue_id uuid, p_month date)
returns table (report jsonb, generated_at timestamptz, is_preview boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.mis_report_for(p_venue_id, p_month); $$;

revoke execute on function private.rake_by(uuid, timestamptz, timestamptz), private.mis_for(uuid, date), private.mis_rake_rows(jsonb),
  private.store_mis(date) from public, anon, authenticated;
revoke execute on function private.assert_reports(uuid), private.rake_tonight(uuid), private.mis_report_for(uuid, date) from public, anon;
grant execute on function private.assert_reports(uuid), private.rake_tonight(uuid), private.mis_report_for(uuid, date) to authenticated;
revoke execute on function public.rake_tonight(uuid), public.mis_report_for(uuid, date) from public, anon;
grant execute on function public.rake_tonight(uuid), public.mis_report_for(uuid, date) to authenticated;
