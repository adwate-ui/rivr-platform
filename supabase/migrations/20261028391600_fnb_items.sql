-- Table-side food and drink: the menu (#123; question #531, the owner's answer of 27 Oct). RIVR keeps Glaza's items
-- with no prices: paid food and drink are Glaza's alone (#490), and comps are costed through the monthly import (#109).
-- Staff who run F&B (fnb.manage) keep the list and switch items on and off. Alcohol is offered in the player app only to
-- members 21 or over by their KYC date of birth (#565); the bar still checks age.
create type public.fnb_item_kind as enum ('food', 'soft_drink', 'alcohol');

create table public.fnb_item (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  name text not null check (length(trim(name)) between 1 and 60),
  kind public.fnb_item_kind not null,
  is_available boolean not null default true,
  -- Where it sits on the menu, first to last.
  position smallint not null default 1 check (position between 1 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, name),
  unique (id, venue_id)
);

comment on table public.fnb_item is 'Glaza''s food and drink as the table-side menu offers it (#123): a name and kind, no price.';

create index fnb_item_venue_idx on public.fnb_item (venue_id, position);

create trigger fnb_item_touch_updated_at before update on public.fnb_item
  for each row execute function private.touch_updated_at();
create trigger fnb_item_audit after insert or update or delete on public.fnb_item
  for each row execute function private.audit_row_change();

alter table public.fnb_item enable row level security;
grant select (id, venue_id, name, kind, is_available, position, created_at, updated_at) on public.fnb_item to authenticated;
create policy "staff who run F&B see the venue's menu" on public.fnb_item
  for select to authenticated using (venue_id in (select private.venues_where('fnb.manage')));

-- A starter menu for every venue, for staff to change: Glaza's own list replaces it.
insert into public.fnb_item (venue_id, name, kind, position)
select v.id, m.name, m.kind::public.fnb_item_kind, m.position
from public.venue v
cross join (values ('Masala chai', 'soft_drink', 1), ('Fresh lime soda', 'soft_drink', 2), ('Mineral water', 'soft_drink', 3),
                   ('Club sandwich', 'food', 10), ('Paneer tikka', 'food', 11), ('French fries', 'food', 12),
                   ('Beer', 'alcohol', 20), ('Whisky', 'alcohol', 21)) as m (name, kind, position);

-- Whether a member may be offered alcohol: 21 or over by their KYC date of birth; with none on record, not.
create function private.may_order_alcohol(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select k.date_of_birth <= (private.club_day_now() - interval '21 years')::date
                   from public.kyc_record k where k.member_id = p_member_id), false);
$$;

-- The menu for whoever asks: staff of the venue, its paired dealer tablet, or a member of it whose tier has table-side
-- ordering, who sees alcohol only at 21 or over. Available items only, in menu order.
create function private.fnb_menu(p_venue_id uuid)
returns table (item_id uuid, name text, kind public.fnb_item_kind)
language sql
stable
security definer
set search_path = ''
as $$
  with asker as (
    select private.current_member_id() as member_id,
           exists (select 1 from public.staff s where s.id = private.current_staff_id(p_venue_id)) as is_staff,
           exists (select 1 from public.device d where d.id = private.current_device_id() and d.venue_id = p_venue_id
                   and d.kind = 'dealer_tablet' and d.revoked_at is null) as is_tablet
  )
  select i.id, i.name, i.kind
  from public.fnb_item i cross join asker a
  where i.venue_id = p_venue_id and i.is_available
    and (a.is_staff or a.is_tablet
         or (exists (select 1 from public.member m where m.id = a.member_id and m.venue_id = p_venue_id)
             and private.has_feature(a.member_id, 'fnb.table_side')
             and (i.kind <> 'alcohol' or private.may_order_alcohol(a.member_id))))
  order by i.position, i.name;
$$;

-- The signed-in member's menu, at their own venue, for the player app.
create function private.my_fnb_menu()
returns table (item_id uuid, name text, kind public.fnb_item_kind)
language sql
stable
security definer
set search_path = ''
as $$ select * from private.fnb_menu((select m.venue_id from public.member m where m.id = private.current_member_id())); $$;

-- Adds an item, or changes one: its name, kind, place on the menu, and whether it is on offer. fnb.manage.
create function private.save_fnb_item(p_venue_id uuid, p_name text, p_kind public.fnb_item_kind, p_is_available boolean, p_position integer,
                                      p_item_id uuid default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.has_permission(p_venue_id, 'fnb.manage') then
    raise exception 'Only staff who run F&B change the menu' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  if p_item_id is null then
    insert into public.fnb_item (venue_id, name, kind, is_available, position)
    values (p_venue_id, trim(p_name), p_kind, coalesce(p_is_available, true), coalesce(p_position, 1))
    returning id into v_id;
  else
    update public.fnb_item i set name = trim(p_name), kind = p_kind, is_available = coalesce(p_is_available, i.is_available),
                                 position = coalesce(p_position, i.position)
    where i.id = p_item_id and i.venue_id = p_venue_id
    returning id into v_id;
    if v_id is null then
      raise exception 'No such item at this venue' using errcode = '22023';
    end if;
  end if;
  return v_id;
end;
$$;

create function public.fnb_menu(p_venue_id uuid)
returns table (item_id uuid, name text, kind public.fnb_item_kind)
language sql stable security invoker set search_path = ''
as $$ select * from private.fnb_menu(p_venue_id); $$;
create function public.my_fnb_menu()
returns table (item_id uuid, name text, kind public.fnb_item_kind)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_fnb_menu(); $$;
create function public.save_fnb_item(p_venue_id uuid, p_name text, p_kind public.fnb_item_kind, p_is_available boolean, p_position integer,
                                     p_item_id uuid default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.save_fnb_item(p_venue_id, p_name, p_kind, p_is_available, p_position, p_item_id); $$;

revoke execute on function private.may_order_alcohol(uuid) from public, anon, authenticated;
revoke execute on function private.my_fnb_menu(), public.my_fnb_menu() from public, anon;
grant execute on function private.my_fnb_menu(), public.my_fnb_menu() to authenticated;
revoke execute on function private.fnb_menu(uuid), public.fnb_menu(uuid),
  private.save_fnb_item(uuid, text, public.fnb_item_kind, boolean, integer, uuid), public.save_fnb_item(uuid, text, public.fnb_item_kind, boolean, integer, uuid)
  from public, anon;
grant execute on function private.fnb_menu(uuid), public.fnb_menu(uuid),
  private.save_fnb_item(uuid, text, public.fnb_item_kind, boolean, integer, uuid), public.save_fnb_item(uuid, text, public.fnb_item_kind, boolean, integer, uuid)
  to authenticated;

-- As before (20261028330000_purge_live_venue.sql), with the menu kept, as the rewards catalogue is: a live purge
-- removes what was ordered, not what the bar offers.
create or replace function private.live_purge_keeps()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['blind_structure', 'expense_category', 'fnb_item', 'league_season', 'payment_account', 'reward_item', 'shareholder',
               'shareholding', 'tally_ledger_map', 'tournament_template'];
$$;

-- The practice venue's reset reloads its starter menu.
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
