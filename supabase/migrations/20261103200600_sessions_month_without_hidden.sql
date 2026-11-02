-- Sessions' "This month" and "Hours played" (decision 0320) read the club month's totals from my_sessions. Those were
-- counted before the sessions a member hid were left out (20261029100000), so a hidden session still counted. As that
-- migration made it, with the month's count, time and net counted over the sessions the member still sees.
create or replace function public.my_sessions()
returns table (visit_id uuid, opened_at timestamptz, closed_at timestamptz, table_name text, small_blind_paise bigint,
               big_blind_paise bigint, other_tables integer, played_seconds bigint, buy_in_paise bigint, bonus_paise bigint,
               cash_out_paise bigint, tds_paise bigint, paid_paise bigint, net_paise bigint, receipt text, month date,
               month_sessions integer, month_played_seconds bigint, month_net_paise bigint, tds_basis text,
               kind text, place integer, entrants integer)
language sql stable security invoker set search_path = ''
as $$
  select s.visit_id, s.opened_at, s.closed_at, s.table_name, s.small_blind_paise, s.big_blind_paise, s.other_tables, s.played_seconds,
         s.buy_in_paise, s.bonus_paise, s.cash_out_paise, s.tds_paise, s.paid_paise, s.net_paise, s.receipt, s.month,
         (count(*) over w)::integer, (sum(s.played_seconds) over w)::bigint, (sum(s.net_paise) over w)::bigint,
         s.tds_basis, s.kind, s.place, s.entrants
  from private.my_sessions() s
  where not s.visit_id = any (coalesce((select p.hidden_sessions from public.member_preference p where p.member_id = private.current_member_id()), '{}'))
  window w as (partition by s.month)
  order by s.opened_at desc;
$$;
