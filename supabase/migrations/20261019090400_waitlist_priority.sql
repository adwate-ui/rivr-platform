-- Waitlist priority (#40, scope-v1 module 2, decision S-D11): a scoring rule, never a manual
-- override. A tier's weight lives in the effective-dated setting waitlist.priority_weights, with the
-- tier's id as the subject, so an admin can tune it without a release. The black card's counts only
-- on the list for the member's qualifying stake; elsewhere they queue by join time. Every list orders
-- by weight, highest first, then join time. @rivr/domain/waitlist is the rule's twin; both are proved
-- against packages/testing/golden/waitlist.json (decision 0037).

insert into public.setting_key (key, description, scope, value_schema) values
  ('waitlist.priority_weights',
   'A tier''s waitlist priority: its weight (higher goes first; 0 or unset is none) and whether it counts only on the list for the member''s qualifying stake, as the black card''s does (scope-v1 module 2).',
   'tier',
   '{"type":"object","properties":{"weight":{"type":"integer","minimum":0,"maximum":100},"only_at_qualifying_stake":{"type":"boolean"}},"required":["weight","only_at_qualifying_stake"],"additionalProperties":false}');

-- The rule: a tier's weight on the list for one stake, 0 for none. Pure, so pgTAP proves it against
-- the golden file.
create function private.priority_weight(p_weight integer, p_only_at_qualifying_stake boolean, p_qualifying_small bigint,
                                        p_qualifying_big bigint, p_list_small bigint, p_list_big bigint)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_weight, 0) <= 0 then 0
    when coalesce(p_only_at_qualifying_stake, false)
         and not (p_qualifying_small is not null and p_qualifying_small = p_list_small and p_qualifying_big = p_list_big) then 0
    else p_weight
  end;
$$;

-- A member's priority on the list for a table type now: the weight, and the tier's name as the reason
-- when there is one.
create function private.place_priority(p_member_id uuid, p_table_type_id uuid)
returns table (weight integer, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select w.weight, case when w.weight > 0 then t.name end
  from public.member m
  join public.tier t on t.id = m.tier_id
  join public.table_type tt on tt.id = p_table_type_id
  cross join lateral (select private.setting_at(m.venue_id, 'waitlist.priority_weights', t.id::text, now()) as value) s
  cross join lateral (
    select private.priority_weight((s.value ->> 'weight')::integer, (s.value ->> 'only_at_qualifying_stake')::boolean,
                                   m.qualifying_small_blind, m.qualifying_big_blind, tt.small_blind_paise, tt.big_blind_paise) as weight
  ) w
  where m.id = p_member_id;
$$;

revoke execute on function private.priority_weight(integer, boolean, bigint, bigint, bigint, bigint), private.place_priority(uuid, uuid)
  from public, anon, authenticated;

-- The waiting places on the given lists, each with its priority and its place: weight, then join time.
create function private.ranked_waitlist(p_table_type_ids uuid[])
returns table (entry_id uuid, table_type_id uuid, member_id uuid, joined_at timestamptz, added_by_staff_id uuid,
               place integer, priority_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.table_type_id, e.member_id, e.joined_at, e.added_by_staff_id,
         row_number() over (partition by e.table_type_id order by coalesce(p.weight, 0) desc, e.joined_at, e.id)::integer,
         p.reason
  from public.waitlist_entry e
  left join lateral private.place_priority(e.member_id, e.table_type_id) p on true
  where e.status = 'waiting' and e.table_type_id = any (p_table_type_ids);
$$;

revoke execute on function private.ranked_waitlist(uuid[]) from public, anon, authenticated;

-- The signed-in member's places, with their place on each list in priority order.
create or replace function private.my_waitlist()
returns table (entry_id uuid, table_type_id uuid, table_type_name text, small_blind_paise bigint, big_blind_paise bigint,
               joined_at timestamptz, place integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.entry_id, t.id, t.name, t.small_blind_paise, t.big_blind_paise, r.joined_at, r.place
  from private.ranked_waitlist(array(
         select e.table_type_id from public.waitlist_entry e
         where e.member_id = private.current_member_id() and e.status = 'waiting')) r
  join public.table_type t on t.id = r.table_type_id
  where r.member_id = private.current_member_id()
  order by r.joined_at;
$$;

-- The venue's lists for the floor, in priority order, with the reason for a place ahead of join time.
drop function public.waitlist_board(uuid);
drop function private.waitlist_board(uuid);

create function private.waitlist_board(p_venue_id uuid)
returns table (entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz, place integer,
               added_by_floor boolean, priority_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.entry_id, r.table_type_id, m.id, m.full_name, r.joined_at, r.place, r.added_by_staff_id is not null, r.priority_reason
  from private.ranked_waitlist(array(select t.id from public.table_type t where t.venue_id = p_venue_id)) r
  join public.member m on m.id = r.member_id
  where private.has_permission(p_venue_id, 'waitlist.manage')
  order by r.table_type_id, r.place;
$$;

grant execute on function private.waitlist_board(uuid) to authenticated;

create function public.waitlist_board(p_venue_id uuid)
returns table (entry_id uuid, table_type_id uuid, member_id uuid, full_name text, joined_at timestamptz, place integer,
               added_by_floor boolean, priority_reason text)
language sql security invoker set search_path = ''
as $$ select * from private.waitlist_board(p_venue_id); $$;

grant execute on function public.waitlist_board(uuid) to authenticated;
