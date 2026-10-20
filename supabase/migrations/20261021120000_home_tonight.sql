-- Home's tonight (#87; scope-v1 "Player app"; design prompt "Home"; decision 0116). Each table's open
-- seats: its seats less those sat in or held for a called member, each once, on the same terms as the
-- waitlist lengths (a member of the venue with the live floor, or its staff). And the member's own:
-- whether their identity check is done, which Join needs; the bad-beat jackpot (lane B's main_pool), with the live floor; and
-- the next published tournament at their venue, with tournament registration. A member reads their own
-- venue's only, so a practice member reads the practice venue's.

create function private.floor_open_seats()
returns table (table_id uuid, open_seats integer)
language sql
stable
security definer
set search_path = ''
as $$
  -- A seat counts once: the floor may seat a called member in the seat held for them before their place closes.
  select t.id, greatest(t.seats - (select count(*)::integer from (
    select s.seat from public.seat_session s where s.table_id = t.id and s.ended_at is null
    union
    select e.call_seat from public.waitlist_entry e where e.call_table_id = t.id and e.status = 'waiting' and e.called_at is not null
  ) taken), 0)
  from public.game_table t
  where (t.venue_id = private.current_member_venue_id() and private.has_feature(private.current_member_id(), 'floor.live_view'))
     or t.venue_id in (select private.staff_venues());
$$;

create function private.my_tonight()
returns table (is_kyc_complete boolean, jackpot_paise bigint, tournament_name text, tournament_starts_at timestamptz,
               tournament_buy_in_paise bigint, tournament_guarantee_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_kyc_complete(me.member_id),
         case when private.has_feature(me.member_id, 'floor.live_view') then private.main_pool(me.venue_id) end,
         n.name, n.starts_at, n.buy_in_paise, n.guarantee_paise
  from (select private.current_member_id() as member_id, private.current_member_venue_id() as venue_id) me
  left join lateral (
    select t.name, t.starts_at, t.buy_in_paise, t.guarantee_paise from public.tournament t
    where t.venue_id = me.venue_id and t.is_published and t.starts_at >= now()
      and private.has_feature(me.member_id, 'tournaments.register')
    order by t.starts_at
    limit 1
  ) n on true
  where me.member_id is not null;
$$;

revoke execute on function private.floor_open_seats(), private.my_tonight() from public, anon;
grant execute on function private.floor_open_seats(), private.my_tonight() to authenticated;

create function public.floor_open_seats()
returns table (table_id uuid, open_seats integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.floor_open_seats(); $$;

create function public.my_tonight()
returns table (is_kyc_complete boolean, jackpot_paise bigint, tournament_name text, tournament_starts_at timestamptz,
               tournament_buy_in_paise bigint, tournament_guarantee_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_tonight(); $$;

revoke execute on function public.floor_open_seats(), public.my_tonight() from public, anon;
grant execute on function public.floor_open_seats(), public.my_tonight() to authenticated;
