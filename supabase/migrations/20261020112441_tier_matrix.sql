-- The console's Tiers screen (#32; additions "Tier-gated features", Console; flow 21; decision 0100).
-- Tier managers read the tier x feature matrix as it stands, with any change already scheduled, and
-- save a batch of cells from a moment they choose: now (the database's clock) or later. A change is a
-- new tier_feature row, audited as lane 0 built it. Members' apps hear it through Realtime and lock or
-- open the feature within seconds; has_feature refuses the calls behind it at once.

-- The matrix for a venue's tiers and every gateable feature: the cell in force (no cell is off and
-- hidden, as has_feature and feature_state read it), how the feature shows to a member of that tier with
-- no override (as feature_state decides), the tiers that have it, and the next change scheduled, if any.
-- Only for tier managers; nothing for anyone else.
create function private.tier_matrix(p_venue_id uuid)
returns table (tier_id uuid, tier_name text, tier_rank integer, feature_key text, feature_name text, feature_description text,
               is_enabled boolean, display_mode public.feature_display_mode, shows_as text, tiers_with_it text[],
               next_cell_id uuid, next_from timestamptz, next_is_enabled boolean, next_display_mode public.feature_display_mode)
language sql
stable
security definer
set search_path = ''
as $$
  with tiers as (
    select t.id, t.name, t.rank from public.tier t
    where t.venue_id = p_venue_id and not t.is_retired and private.has_permission(p_venue_id, 'tiers.manage')
  ),
  cells as (
    select t.id as tier_id, f.key, private.current_tier_cell(t.id, f.key) as cell
    from tiers t cross join public.feature f
    where f.is_gateable
  ),
  enabled_by as (
    select c.key, array_agg(t.name order by t.rank) as names
    from cells c join tiers t on t.id = c.tier_id
    where coalesce((c.cell).is_enabled, false)
    group by c.key
  )
  select t.id, t.name, t.rank, f.key, f.name, f.description,
         coalesce((c.cell).is_enabled, false), coalesce((c.cell).display_mode, 'hidden'),
         case when coalesce((c.cell).is_enabled, false) then 'enabled'
              when coalesce((c.cell).display_mode, 'hidden') = 'hidden' then 'hidden'
              else 'locked' end,
         coalesce(e.names, '{}'),
         n.id, n.effective_from, n.is_enabled, n.display_mode
  from cells c
  join tiers t on t.id = c.tier_id
  join public.feature f on f.key = c.key
  left join enabled_by e on e.key = c.key
  left join lateral (
    select tf.id, tf.effective_from, tf.is_enabled, tf.display_mode from public.tier_feature tf
    where tf.tier_id = c.tier_id and tf.feature_key = c.key and tf.effective_from > now()
    order by tf.effective_from limit 1
  ) n on true
  order by f.key, t.rank;
$$;

-- Saves a batch of cells, [{tier_id, feature_key, is_enabled, display_mode}], each in force from the
-- same moment: now by the database's clock when none is given, or a later one. All or none. A change
-- already saved for that same later moment is replaced, as choosing again for a day means. Refusals: 42501
-- not a tier manager; RVPST a moment already gone; 22023 nothing to save, or a tier not this venue's.
create function private.schedule_tier_cells(p_venue_id uuid, p_cells jsonb, p_effective_from timestamptz default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := coalesce(p_effective_from, now());
  v_count integer;
begin
  if not private.has_permission(p_venue_id, 'tiers.manage') then
    raise exception 'Only tier managers change the matrix' using errcode = '42501';
  end if;
  if v_from < now() - interval '1 minute' then
    raise exception 'A change takes effect now or later, never in the past' using errcode = 'RVPST';
  end if;
  if jsonb_typeof(p_cells) is distinct from 'array' or jsonb_array_length(p_cells) = 0 then
    raise exception 'Nothing to save' using errcode = '22023';
  end if;
  delete from public.tier_feature tf
  using jsonb_to_recordset(p_cells) as c (tier_id uuid, feature_key text)
  where tf.venue_id = p_venue_id and tf.tier_id = c.tier_id and tf.feature_key = c.feature_key
    and tf.effective_from = v_from and v_from > now();
  insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from, created_by_staff_id)
  select p_venue_id, t.id, c.feature_key, c.is_enabled, c.display_mode::public.feature_display_mode, v_from,
         private.current_staff_id(p_venue_id)
  from jsonb_to_recordset(p_cells) as c (tier_id uuid, feature_key text, is_enabled boolean, display_mode text)
  join public.tier t on t.id = c.tier_id and t.venue_id = p_venue_id and not t.is_retired;
  get diagnostics v_count = row_count;
  if v_count <> jsonb_array_length(p_cells) then
    raise exception 'A tier is not one of this venue''s' using errcode = '22023';
  end if;
  return v_count;
end;
$$;

create function public.tier_matrix(p_venue_id uuid)
returns table (tier_id uuid, tier_name text, tier_rank integer, feature_key text, feature_name text, feature_description text,
               is_enabled boolean, display_mode public.feature_display_mode, shows_as text, tiers_with_it text[],
               next_cell_id uuid, next_from timestamptz, next_is_enabled boolean, next_display_mode public.feature_display_mode)
language sql stable security invoker set search_path = ''
as $$ select * from private.tier_matrix(p_venue_id); $$;

create function public.schedule_tier_cells(p_venue_id uuid, p_cells jsonb, p_effective_from timestamptz default null)
returns integer
language sql security invoker set search_path = ''
as $$ select private.schedule_tier_cells(p_venue_id, p_cells, p_effective_from); $$;

revoke execute on function private.tier_matrix(uuid), private.schedule_tier_cells(uuid, jsonb, timestamptz),
  public.tier_matrix(uuid), public.schedule_tier_cells(uuid, jsonb, timestamptz) from public, anon;
grant execute on function private.tier_matrix(uuid), private.schedule_tier_cells(uuid, jsonb, timestamptz),
  public.tier_matrix(uuid), public.schedule_tier_cells(uuid, jsonb, timestamptz) to authenticated;
