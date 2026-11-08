-- The dealer's ring (audit 8 Nov, F-189): who has said they are leaving, and the table's blinds for the felt. As
-- 20261019092100_call_time.sql made it, with leaving_at and the blinds at the end.
drop function public.tablet_seats();
drop function private.tablet_seats();

create function private.tablet_seats()
returns table (seat integer, session_id uuid, member_id uuid, full_name text, away_since timestamptz, minimum_paise bigint,
               pending_buy_in_paise bigint, call_time_left integer, leaving_at timestamptz, small_blind_paise bigint, big_blind_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select n.seat, s.id, m.id, m.full_name, s.away_since, tt.buy_in_min_paise,
         (select r.amount_paise from public.buy_in_request r where r.session_id = s.id and r.status = 'waiting'),
         case when s.id is not null then private.session_call_time(s, now()) end,
         s.leaving_at, tt.small_blind_paise, tt.big_blind_paise
  from private.my_tablet_table() t
  join public.game_table g on g.id = t.o_table_id
  join public.table_type tt on tt.id = g.table_type_id
  cross join generate_series(1, g.seats) as n (seat)
  left join public.seat_session s on s.table_id = g.id and s.seat = n.seat and s.ended_at is null
  left join public.member m on m.id = s.member_id
  order by n.seat;
$$;

create function public.tablet_seats()
returns table (seat integer, session_id uuid, member_id uuid, full_name text, away_since timestamptz, minimum_paise bigint,
               pending_buy_in_paise bigint, call_time_left integer, leaving_at timestamptz, small_blind_paise bigint, big_blind_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.tablet_seats(); $$;

revoke execute on function private.tablet_seats(), public.tablet_seats() from public, anon;
grant execute on function private.tablet_seats(), public.tablet_seats() to authenticated;
