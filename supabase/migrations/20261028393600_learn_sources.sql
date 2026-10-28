-- Learn sources (#131; scope-v1 "Learn"; decision 0016). A super admin (learn.manage_sources) uploads a licensed
-- encoding; the console runs the drill engine's validator and all eight gates over it first (@rivr/drills/gates), and
-- only an encoding that passes is stored, in the private learn-sources bucket at <venue>/<source key>.json. Registering
-- it records its licence and adds the feature key learn.source.<source key>, on for every tier of the venue. When the
-- licence lapses the feature ends for everyone, overrides included: a feature's available_until.

alter table public.feature add column available_until date;
comment on column public.feature.available_until is
  'The last day anyone has this feature, in IST (#131): a licensed Learn source''s licence end. Null for always.';

-- As 20261018090500_tier_gated_features.sql left it, but a feature past its last day is no one's.
create or replace function private.has_feature(p_member_id uuid, p_feature_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  feature_row public.feature;
  override_row public.member_feature_override;
begin
  select * into feature_row from public.feature f where f.key = p_feature_key;
  if not found then return false; end if;
  if feature_row.available_until < (now() at time zone 'Asia/Kolkata')::date then return false; end if;
  if not feature_row.is_gateable then return true; end if;
  override_row := private.active_override(p_member_id, p_feature_key);
  if override_row.id is not null then return override_row.is_granted; end if;
  return coalesce((
    select (private.current_tier_cell(m.tier_id, p_feature_key)).is_enabled
    from public.member m where m.id = p_member_id
  ), false);
end;
$$;

-- As 20261020091000_locked_by_override.sql left it, but a feature past its last day is hidden.
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
  -- A feature past its end, such as a lapsed licence, is gone for everyone: no tier is the way in.
  if exists (select 1 from public.feature f where f.key = p_feature_key
             and f.available_until < (now() at time zone 'Asia/Kolkata')::date) then
    return query select 'hidden'::text, '{}'::text[];
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('learn-sources', 'learn-sources', false, 10485760, array['application/json']);

-- Whether the caller keeps Learn sources at the venue a bucket path starts with; any other name is refused.
create function private.may_handle_learn_sources(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9_-]{1,60}\.json$'
              then private.has_permission(split_part(p_name, '/', 1)::uuid, 'learn.manage_sources')
              else false end;
$$;
create policy "super admins upload learn sources" on storage.objects
  for insert to authenticated with check (bucket_id = 'learn-sources' and (select private.may_handle_learn_sources(name)));
create policy "super admins replace learn sources" on storage.objects
  for update to authenticated using (bucket_id = 'learn-sources' and (select private.may_handle_learn_sources(name)));
create policy "super admins read learn sources" on storage.objects
  for select to authenticated using (bucket_id = 'learn-sources' and (select private.may_handle_learn_sources(name)));

create table public.learn_source (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  source_key text not null check (source_key ~ '^[a-z0-9_-]{1,60}$'),
  title text not null check (length(btrim(title)) between 1 and 200),
  author text check (length(author) <= 200),
  -- @rivr/drills hashSource of the encoding: which exact file was accepted.
  source_hash text not null check (source_hash ~ '^[0-9a-f]{1,64}$'),
  licence_terms text not null check (length(btrim(licence_terms)) between 3 and 2000),
  licence_ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, source_key),
  unique (id, venue_id)
);
comment on table public.learn_source is 'A licensed Learn source a super admin uploaded (#131): its licence and the file accepted.';
create trigger learn_source_touch_updated_at before update on public.learn_source for each row execute function private.touch_updated_at();
create trigger learn_source_audit after insert or update or delete on public.learn_source for each row execute function private.audit_row_change();
alter table public.learn_source enable row level security;
grant select on public.learn_source to authenticated;
create policy "super admins see the venue's learn sources" on public.learn_source
  for select to authenticated using (venue_id in (select private.venues_where('learn.manage_sources')));

-- Records an uploaded, checked encoding and its licence, once the file is in the bucket; again for a new file or
-- licence. Adds learn.source.<key>, on for each of the venue's tiers, ending with the licence. Refusals: 42501 not a
-- super admin; 22023 out of bounds, a key another venue holds, or no file uploaded at <venue>/<key>.json; RVFRZ the
-- venue frozen.
create function private.register_learn_source(p_venue_id uuid, p_source_key text, p_title text, p_author text, p_source_hash text,
                                              p_licence_terms text, p_licence_ends_on date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_key text := 'learn.source.' || p_source_key;
begin
  if not coalesce(private.has_permission(p_venue_id, 'learn.manage_sources'), false) then
    raise exception 'A super admin keeps the Learn sources' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id);
  -- Its feature key is the whole platform's, so one venue's licence decides it: a key is one venue's.
  if exists (select 1 from public.learn_source s where s.source_key = p_source_key and s.venue_id <> p_venue_id) then
    raise exception 'Another venue holds that source' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'learn-sources' and o.name = p_venue_id || '/' || p_source_key || '.json') then
    raise exception 'Upload the encoding first' using errcode = '22023';
  end if;
  insert into public.learn_source (venue_id, source_key, title, author, source_hash, licence_terms, licence_ends_on)
  values (p_venue_id, p_source_key, btrim(coalesce(p_title, '')), nullif(btrim(coalesce(p_author, '')), ''), p_source_hash,
          btrim(coalesce(p_licence_terms, '')), p_licence_ends_on)
  on conflict (venue_id, source_key) do update
    set title = excluded.title, author = excluded.author, source_hash = excluded.source_hash, licence_terms = excluded.licence_terms,
        licence_ends_on = excluded.licence_ends_on
  returning id into v_id;
  insert into public.feature (key, name, description, screens, is_gateable, available_until)
  values (v_key, left(btrim(p_title), 100), 'A licensed Learn source.', '{player:learn}', true, p_licence_ends_on)
  on conflict (key) do update set name = excluded.name, available_until = excluded.available_until;
  insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
  select t.venue_id, t.id, v_key, true, 'locked', '-infinity'
  from public.tier t
  where t.venue_id = p_venue_id
    and not exists (select 1 from public.tier_feature f where f.tier_id = t.id and f.feature_key = v_key);
  return v_id;
exception
  when check_violation or not_null_violation then
    raise exception 'A source key of lowercase letters and digits, a title, licence terms and the licence''s last day' using errcode = '22023';
end;
$$;

create function public.register_learn_source(p_venue_id uuid, p_source_key text, p_title text, p_author text, p_source_hash text,
                                             p_licence_terms text, p_licence_ends_on date)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.register_learn_source(p_venue_id, p_source_key, p_title, p_author, p_source_hash, p_licence_terms, p_licence_ends_on); $$;
revoke execute on function private.may_handle_learn_sources(text) from public, anon;
grant execute on function private.may_handle_learn_sources(text) to authenticated;
revoke execute on function private.register_learn_source(uuid, text, text, text, text, text, date),
  public.register_learn_source(uuid, text, text, text, text, text, date) from public, anon;
grant execute on function private.register_learn_source(uuid, text, text, text, text, text, date),
  public.register_learn_source(uuid, text, text, text, text, text, date) to authenticated;
