-- The offline pack (#168; scope-v1 module 11; decision 0260): what the nightly job prints for a venue's cage computer to
-- keep for when the system is down. The service role alone reads it: the screens' own readers answer the signed-in
-- staff member's permissions, and the nightly job signs in as nobody, so this reads the tables itself. Never the
-- practice venue's. The PDFs are kept in a private bucket that only the service role reaches, seven nights at most.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('offline-packs', 'offline-packs', false, 10485760, array['application/pdf']);

-- A venue's offline pack as the template `document.offlinePack` takes it: who to call, every member with money held
-- or owed and the totals, the cage's float and the chips in play, each open table with who sits where, the waitlist,
-- and every SOP in force.
create function private.offline_pack(p_venue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_venue public.venue;
  v_pack jsonb;
begin
  select * into v_venue from public.venue v where v.id = p_venue_id;
  if v_venue.id is null then
    raise exception 'No such venue' using errcode = '22023';
  end if;
  if v_venue.is_practice then
    raise exception 'The practice venue has no offline pack' using errcode = 'RVPRA';
  end if;
  with ledger as (
    select a.code, a.member_id, sum(e.amount)::bigint as paise
    from public.ledger_account a join public.ledger_entry e on e.account_id = a.id
    where a.venue_id = p_venue_id and a.unit = 'paise' and a.code in ('member.cash', 'venue.chips_outstanding')
    group by a.code, a.member_id
  ),
  owed as (
    select k.member_id, sum(k.outstanding_paise)::bigint as paise
    from public.marker k where k.venue_id = p_venue_id and k.settled_at is null
    group by k.member_id
  ),
  -- A wallet is a liability, so it is the negative of its entries.
  balance as (
    select m.full_name, m.member_number, coalesce(-w.paise, 0) as wallet, coalesce(o.paise, 0) as markers
    from public.member m
    left join ledger w on w.code = 'member.cash' and w.member_id = m.id
    left join owed o on o.member_id = m.id
    where m.venue_id = p_venue_id and (coalesce(w.paise, 0) <> 0 or coalesce(o.paise, 0) <> 0)
  )
  select jsonb_build_object(
    'issuer', (select jsonb_build_object('legal_name', c.legal_name, 'address', c.address, 'gstin', c.gstin)
               from public.venue_config c where c.venue_id = p_venue_id),
    'venue_name', v_venue.name,
    'generated_at', now(),
    'contacts', coalesce((select jsonb_agg(jsonb_build_object('kind', c.kind, 'name', c.name, 'role', nullif(c.role, ''),
                                                             'phone', c.phone, 'note', nullif(c.notes, ''))
                                           order by c.kind, c.position, c.name)
                          from public.contact c where c.venue_id = p_venue_id), '[]'::jsonb),
    'balances', coalesce((select jsonb_agg(jsonb_build_object('name', b.full_name, 'member_number', b.member_number::text,
                                                             'wallet_paise', b.wallet, 'markers_paise', b.markers) order by b.full_name)
                          from balance b), '[]'::jsonb),
    'wallets_paise', (select coalesce(sum(b.wallet), 0)::bigint from balance b),
    'markers_paise', (select coalesce(sum(b.markers), 0)::bigint from balance b),
    'chips_in_play_paise', coalesce((select -l.paise from ledger l where l.code = 'venue.chips_outstanding' and l.member_id is null), 0),
    'cage_float_paise', coalesce((select s.float_paise from public.cage_shift s where s.venue_id = p_venue_id and s.closed_at is null), 0),
    'tables', coalesce((select jsonb_agg(jsonb_build_object(
                          'name', g.name, 'game', tt.name,
                          'seats', coalesce((select jsonb_agg(jsonb_build_object('seat', s.seat, 'name', m.full_name, 'member_number', m.member_number::text)
                                                              order by s.seat)
                                             from public.seat_session s join public.member m on m.id = s.member_id
                                             where s.table_id = g.id and s.ended_at is null), '[]'::jsonb))
                          order by g.position)
                        from public.game_table g join public.table_type tt on tt.id = g.table_type_id
                        where g.venue_id = p_venue_id and g.is_open), '[]'::jsonb),
    'waitlist', coalesce((select jsonb_agg(jsonb_build_object('game', tt.name, 'place', r.place, 'name', m.full_name,
                                                             'member_number', m.member_number::text) order by tt.name, r.place)
                          from private.ranked_waitlist(array(select t.id from public.table_type t where t.venue_id = p_venue_id)) r
                          join public.table_type tt on tt.id = r.table_type_id
                          join public.member m on m.id = r.member_id), '[]'::jsonb),
    'sops', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'version', v.version, 'in_force_from', v.effective_on, 'body', v.body)
                                       order by s.title)
                      from public.sop s cross join lateral private.sop_version_in_force(s.id) v
                      where s.venue_id = p_venue_id and v.id is not null), '[]'::jsonb))
  into v_pack;
  return v_pack;
end;
$$;

-- The venues the nightly job makes a pack for: every one but the practice venue.
create function private.offline_pack_venues()
returns table (venue_id uuid)
language sql
stable
security definer
set search_path = ''
as $$ select v.id from public.venue v where not v.is_practice order by v.name; $$;

create function public.offline_pack_venues()
returns table (venue_id uuid) language sql stable security invoker set search_path = ''
as $$ select * from private.offline_pack_venues(); $$;

create function public.offline_pack(p_venue_id uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.offline_pack(p_venue_id); $$;

revoke execute on function private.offline_pack(uuid), public.offline_pack(uuid), private.offline_pack_venues(), public.offline_pack_venues()
  from public, anon, authenticated;
grant execute on function private.offline_pack(uuid), public.offline_pack(uuid), private.offline_pack_venues(), public.offline_pack_venues()
  to service_role;
