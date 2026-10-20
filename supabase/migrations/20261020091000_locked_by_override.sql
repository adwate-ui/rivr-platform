-- A feature taken away from one member by an override (#61) is locked with no tier as the way in (#353):
-- their notice says it is not available on their account, never "Member, ... and Black card only.",
-- which names their own tier. A feature locked by the member's tier still names the tiers that have it.

-- As lane 0's (20261018090500_tier_gated_features.sql), with the override's lock.
create or replace function private.feature_state(p_member_id uuid, p_feature_key text)
returns table (state text, tiers text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  member_row public.member;
  cell public.tier_feature;
begin
  if private.has_feature(p_member_id, p_feature_key) then
    return query select 'enabled'::text, '{}'::text[];
    return;
  end if;
  select * into member_row from public.member m where m.id = p_member_id;
  cell := private.current_tier_cell(member_row.tier_id, p_feature_key);
  if coalesce(cell.display_mode, 'hidden') = 'hidden' then
    return query select 'hidden'::text, '{}'::text[];
    return;
  end if;
  -- Taken away from this member alone: no tier is the way in.
  if (private.active_override(p_member_id, p_feature_key)).id is not null then
    return query select 'locked'::text, '{}'::text[];
    return;
  end if;
  return query
    select 'locked'::text, coalesce(array_agg(t.name order by t.rank), '{}')
    from public.tier t
    where t.venue_id = member_row.venue_id and not t.is_retired
      and coalesce((private.current_tier_cell(t.id, p_feature_key)).is_enabled, false);
end;
$$;
