-- The live floor's night (#81; design prompt "Live floor"; the prototype's console): each table's
-- hands and rake since tonight began (06:00 IST, private.tonight_began), hands in the last hour, the
-- dealer down now, and the rake rule in force; the venue's rake tonight; a table's recent hands. Staff
-- who read members see the floor; the rake only staff who read the ledger.

-- Which room a table stands in, as the prototype groups them: the main room or the Private Room.
alter table public.game_table add column room text not null default 'main' check (room in ('main', 'private'));
-- Tables already made: the Private Room's type puts its tables in the Private Room.
update public.game_table g set room = 'private' from public.table_type tt where tt.id = g.table_type_id and tt.code = 'private_room';

create function private.floor_tonight(p_venue_id uuid, p_at timestamptz)
returns table (table_id uuid, hands integer, hands_last_hour integer, dealer_name text, rake_paise bigint,
               venue_rake_paise bigint, rake_basis_points integer, rake_cap_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with night as (
    select g.id, tt.code,
           (select count(*) from public.hand h where h.table_id = g.id and h.played_at >= private.tonight_began(p_at) and h.played_at <= p_at)::integer as hands,
           (select count(*) from public.hand h where h.table_id = g.id and h.played_at > p_at - interval '1 hour' and h.played_at <= p_at)::integer as hands_last_hour,
           (select s.full_name from public.dealer_down d join public.staff s on s.id = d.staff_id
            where d.table_id = g.id and d.ended_at is null order by d.started_at desc limit 1) as dealer_name,
           (select coalesce(sum(h.rake_paise), 0) from public.hand h
            where h.table_id = g.id and h.played_at >= private.tonight_began(p_at) and h.played_at <= p_at)::bigint as rake_paise
    from public.game_table g
    join public.table_type tt on tt.id = g.table_type_id
    where g.venue_id = p_venue_id and private.has_permission(p_venue_id, 'members.read')
  )
  select n.id, n.hands, n.hands_last_hour, n.dealer_name,
         case when private.has_permission(p_venue_id, 'ledger.read') then n.rake_paise end,
         case when private.has_permission(p_venue_id, 'ledger.read') then sum(n.rake_paise) over ()::bigint end,
         (private.setting_at(p_venue_id, 'rake.config', n.code, p_at) ->> 'rate_basis_points')::integer,
         (private.setting_at(p_venue_id, 'rake.config', n.code, p_at) ->> 'cap_paise')::bigint
  from night n;
$$;

-- A table's hands tonight, latest first: its number in the night, when, the game, and its pot and
-- rake for staff who read the ledger (a pot and the rule in force would give the rake away).
create function private.table_hands(p_table_id uuid, p_limit integer, p_at timestamptz)
returns table (hand_id uuid, number integer, played_at timestamptz, variant public.hand_variant, pot_paise bigint, rake_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select n.id, n.number, n.played_at, n.variant,
         case when private.has_permission(n.venue_id, 'ledger.read') then n.pot_paise end,
         case when private.has_permission(n.venue_id, 'ledger.read') then n.rake_paise end
  from (select h.id, h.venue_id, h.played_at, h.variant, h.pot_paise, h.rake_paise,
               (row_number() over (order by h.played_at, h.id))::integer as number
        from public.hand h
        where h.table_id = p_table_id and h.played_at >= private.tonight_began(p_at) and h.played_at <= p_at
          and private.has_permission(h.venue_id, 'members.read')) n
  order by n.played_at desc, n.id desc
  limit least(greatest(coalesce(p_limit, 0), 0), 50);
$$;

revoke execute on function private.floor_tonight(uuid, timestamptz), private.table_hands(uuid, integer, timestamptz) from public, anon;
grant execute on function private.floor_tonight(uuid, timestamptz), private.table_hands(uuid, integer, timestamptz) to authenticated;

create function public.floor_tonight(p_venue_id uuid)
returns table (table_id uuid, hands integer, hands_last_hour integer, dealer_name text, rake_paise bigint,
               venue_rake_paise bigint, rake_basis_points integer, rake_cap_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.floor_tonight(p_venue_id, now()); $$;
create function public.table_hands(p_table_id uuid, p_limit integer)
returns table (hand_id uuid, number integer, played_at timestamptz, variant public.hand_variant, pot_paise bigint, rake_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.table_hands(p_table_id, p_limit, now()); $$;

revoke execute on function public.floor_tonight(uuid), public.table_hands(uuid, integer) from public, anon;
grant execute on function public.floor_tonight(uuid), public.table_hands(uuid, integer) to authenticated;
