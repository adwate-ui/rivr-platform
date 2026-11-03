-- A repair (decision 0501; money audit of #833). 20261107140000 made a version of a rule giving the first N grants a club
-- day with no limit a member as `{"perMember": "none", "maxMembersPerDay": N}`: N members a day, each given it again and
-- again, where the rule meant N grants a club day in all. Each such version 1 now says one a club day a member, N
-- members a day, so never more than N grants a club day; a member can no longer take two of the N (the safest reading
-- the typed model has). The version keeps its status: a live one changes its limits at once. Its grants are keyed again
-- by their club day, numbered as the engine numbers them, so a member already given it today has it no more today. On
-- the repair's own club day, if one member took several of today's grants first, up to N less the members given it
-- today may still be given it: at most N a club day from the next day on (decision 0501). A promotion with a later
-- version is left alone: that version was written and approved by people.
-- Read-only checks on 4 Nov found no such version on staging and production has no such rule; the repair stays for any
-- database the conversion ran on, and 20261108020000's conversion now gives the right limits directly.

create function private.repair_first_n_a_day_versions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.promotion_version;
  v_repaired integer := 0;
begin
  for v_version in
    select v.* from public.promotion_version v
    join public.promotion p on p.id = v.promotion_id
    -- Only a promotion still on its converted version: a later one was written and approved by people, and its own
    -- grants keep the keys its limits gave them (money audit).
    where v.version = 1 and p.per_player_limit is null
      and not exists (select 1 from public.promotion_version w where w.promotion_id = v.promotion_id and w.version > 1)
      and v.limits ->> 'perMember' = 'none' and v.limits ? 'maxMembersPerDay'
      and (select count(*) from public.promotion_rule r where r.promotion_id = p.id) = 1
      and exists (select 1 from public.promotion_rule r where r.promotion_id = p.id and r.conditions #>> '{first_n,per}' = 'day'
                    and (r.conditions #>> '{first_n,count}')::integer = (v.limits ->> 'maxMembersPerDay')::integer)
    for update of v
  loop
    update public.promotion_version set limits = jsonb_set(v_version.limits, '{perMember}', '"per_day"') where id = v_version.id;
    -- Keys never meet: the old ones begin `event:`, the new `day:`.
    update public.promotion_grant g
    set period_key = private.promo_slot_key(k.base, k.n - 1)
    from (select x.id, 'day:' || to_char(x.club_day, 'YYYY-MM-DD') as base,
                 row_number() over (partition by x.member_id, x.club_day order by x.created_at, x.id)::integer as n
          from public.promotion_grant x where x.promotion_id = v_version.promotion_id) k
    where g.id = k.id;
    v_repaired := v_repaired + 1;
  end loop;
  return v_repaired;
end;
$$;

revoke execute on function private.repair_first_n_a_day_versions() from public, anon, authenticated;

select private.repair_first_n_a_day_versions();

-- The practice venue's reset keeps the repaired limits (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
