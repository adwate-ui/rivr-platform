-- Tournament templates and blind structures (#115, decision 0200), with the formats of decision 0202
-- (#116). A blind structure is a venue's named run of levels and breaks; a template names a
-- structure with a format, a buy-in and its fee, a stack, the last registration level, the most buys,
-- an add-on and the places paid. A tournament made from a template copies all of it, levels included,
-- so changing a template never changes a tournament already made. Staff with tournaments.manage keep
-- them; the clock is the next migration's.

create table public.blind_structure (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  name text not null check (length(btrim(name)) between 1 and 80),
  levels jsonb not null check (private.blind_levels_problem(levels) is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, name),
  unique (id, venue_id)
);

comment on table public.blind_structure is 'A venue''s blind structure (#115): its levels (blinds and ante in chips) and breaks, in minutes.';

create table public.tournament_template (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  name text not null check (length(btrim(name)) between 1 and 80),
  format text not null check (format in ('freezeout', 're_entry', 'rebuy')),
  -- The whole buy-in, fee included; the pool gets the buy-in less the fee. Chips are multiples of ₹50.
  buy_in_paise bigint not null check (buy_in_paise > 0 and buy_in_paise % 5000 = 0),
  fee_paise bigint not null check (fee_paise >= 0 and fee_paise % 5000 = 0),
  starting_stack integer not null check (starting_stack > 0),
  blind_structure_id uuid not null,
  -- Registration, re-entry and rebuys stay open to the end of this level and the break after it; 0 closes them at the start.
  last_registration_level integer not null check (last_registration_level >= 0),
  -- The most buys a player may make, the first entry included; null for no limit. A freezeout has one.
  max_buys integer check (max_buys >= 1),
  add_on_paise bigint check (add_on_paise > 0 and add_on_paise % 5000 = 0),
  add_on_fee_paise bigint check (add_on_fee_paise >= 0 and add_on_fee_paise % 5000 = 0),
  add_on_chips integer check (add_on_chips > 0),
  places_paid integer not null check (places_paid between 1 and 100),
  guarantee_paise bigint check (guarantee_paise > 0 and guarantee_paise % 5000 = 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, name),
  unique (id, venue_id),
  foreign key (blind_structure_id, venue_id) references public.blind_structure (id, venue_id),
  check (fee_paise < buy_in_paise),
  check (format <> 'freezeout' or max_buys is null),
  check ((add_on_paise is null) = (add_on_chips is null) and (add_on_paise is null) = (add_on_fee_paise is null)),
  check (add_on_fee_paise is null or add_on_fee_paise < add_on_paise),
  check (add_on_paise is null or last_registration_level >= 1)
);

comment on table public.tournament_template is 'A tournament template (#115, #116): format, buy-in and fee, stack, blind structure, registration, buys, add-on and places paid.';

create index tournament_template_structure_idx on public.tournament_template (blind_structure_id, venue_id);

-- The tournament keeps its own copy of everything the template set, and its clock. A calendar entry made
-- before templates has no levels and its clock cannot start.
alter table public.tournament
  add column template_id uuid,
  add column format text not null default 'freezeout' check (format in ('freezeout', 're_entry', 'rebuy')),
  add column fee_paise bigint not null default 0 check (fee_paise >= 0 and fee_paise % 5000 = 0),
  add column starting_stack integer check (starting_stack > 0),
  add column levels jsonb check (levels is null or private.blind_levels_problem(levels) is null),
  add column last_registration_level integer not null default 0 check (last_registration_level >= 0),
  add column max_buys integer check (max_buys >= 1),
  add column add_on_paise bigint check (add_on_paise > 0 and add_on_paise % 5000 = 0),
  add column add_on_fee_paise bigint check (add_on_fee_paise >= 0 and add_on_fee_paise % 5000 = 0),
  add column add_on_chips integer check (add_on_chips > 0),
  add column places_paid integer check (places_paid between 1 and 100),
  add constraint tournament_template_fk foreign key (template_id, venue_id) references public.tournament_template (id, venue_id),
  add constraint tournament_fee_below_buy_in check (fee_paise < buy_in_paise),
  add constraint tournament_freezeout_one_buy check (format <> 'freezeout' or max_buys is null),
  add constraint tournament_add_on_whole check ((add_on_paise is null) = (add_on_chips is null) and (add_on_paise is null) = (add_on_fee_paise is null)
                                                and (add_on_fee_paise is null or add_on_fee_paise < add_on_paise)),
  add constraint tournament_add_on_after_level_one check (add_on_paise is null or last_registration_level >= 1);

create index tournament_template_idx on public.tournament (template_id, venue_id);

create trigger blind_structure_touch_updated_at before update on public.blind_structure
  for each row execute function private.touch_updated_at();
create trigger blind_structure_audit after insert or update or delete on public.blind_structure
  for each row execute function private.audit_row_change();
create trigger tournament_template_touch_updated_at before update on public.tournament_template
  for each row execute function private.touch_updated_at();
create trigger tournament_template_audit after insert or update or delete on public.tournament_template
  for each row execute function private.audit_row_change();

alter table public.blind_structure enable row level security;
alter table public.tournament_template enable row level security;
grant select on public.blind_structure, public.tournament_template to authenticated;

create policy "staff who run tournaments see the venue's structures" on public.blind_structure
  for select to authenticated using (venue_id in (select private.venues_where('tournaments.manage')));
create policy "staff who run tournaments see the venue's templates" on public.tournament_template
  for select to authenticated using (venue_id in (select private.venues_where('tournaments.manage')));

-- A tournament now carries its template's rules and its clock: members read it with tournament
-- registration only (additions, "Tier-gated features"); staff read every one at their venues.
drop policy "staff and members see the venue's published tournaments" on public.tournament;
create policy "staff see the venue's tournaments" on public.tournament
  for select to authenticated using (venue_id in (select private.staff_venues()));
create policy "members with tournament registration see the venue's published tournaments" on public.tournament
  for select to authenticated
  using (is_published and venue_id = (select private.current_member_venue_id())
         and private.has_feature((select private.current_member_id()), 'tournaments.register'));

-- How many levels of play a structure has, breaks aside.
create function private.blind_level_count(p_levels jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select count(*)::integer from jsonb_array_elements(p_levels) s where s.value ->> 'kind' = 'level';
$$;

-- Refuses unless the caller runs tournaments at the venue.
create function private.assert_runs_tournaments(p_venue_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'tournaments.manage') then
    raise exception 'Only tournaments.manage runs tournaments here' using errcode = '42501';
  end if;
end;
$$;

-- Adds a blind structure (none given) or changes one, for tournaments.manage. Refusals: 42501 not
-- tournaments.manage or not this venue's structure, 22023 a name out of bounds or levels the clock
-- cannot run, 23505 a name the venue has; RVFRZ the venue frozen. Tournaments already made keep their levels.
create function private.save_blind_structure(p_venue_id uuid, p_name text, p_levels jsonb, p_structure_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_runs_tournaments(p_venue_id);
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 or private.blind_levels_problem(p_levels) is not null then
    raise exception 'A name of 1 to 80 characters, and levels the clock can run' using errcode = '22023';
  end if;
  perform private.assert_writable(p_venue_id);
  -- A template on the structure keeps registration within its levels, or registration would never close.
  if exists (select 1 from public.tournament_template t where t.blind_structure_id = p_structure_id and t.venue_id = p_venue_id
             and t.last_registration_level > private.blind_level_count(p_levels)) then
    raise exception 'A template on this structure registers past its last level' using errcode = '22023';
  end if;
  if p_structure_id is null then
    insert into public.blind_structure (venue_id, name, levels) values (p_venue_id, btrim(p_name), p_levels) returning id into v_id;
  else
    update public.blind_structure set name = btrim(p_name), levels = p_levels
    where id = p_structure_id and venue_id = p_venue_id returning id into v_id;
  end if;
  if v_id is null then
    raise exception 'No such structure at this venue' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

-- Adds a template (none given) or changes one, for tournaments.manage. p_template holds the template's
-- columns by name (name, format, buy_in_paise, fee_paise, starting_stack, blind_structure_id,
-- last_registration_level, max_buys, add_on_paise, add_on_fee_paise, add_on_chips, places_paid,
-- guarantee_paise). Refusals: 42501 not tournaments.manage or not this venue's template, 22023 anything
-- out of bounds, a structure not the venue's or a last registration level past its levels, 23505 a name
-- the venue has; RVFRZ the venue frozen. Tournaments already made keep what they copied.
create function private.save_tournament_template(p_venue_id uuid, p_template jsonb, p_template_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tournament_template;
  v_id uuid;
begin
  perform private.assert_runs_tournaments(p_venue_id);
  perform private.assert_writable(p_venue_id);
  begin
    v_row := jsonb_populate_record(null::public.tournament_template, p_template);
    if v_row.last_registration_level > (select private.blind_level_count(s.levels) from public.blind_structure s
                                        where s.id = v_row.blind_structure_id and s.venue_id = p_venue_id) then
      raise exception 'The last registration level is one of the structure''s' using errcode = '22023';
    end if;
    if p_template_id is null then
      insert into public.tournament_template (venue_id, name, format, buy_in_paise, fee_paise, starting_stack, blind_structure_id,
                                              last_registration_level, max_buys, add_on_paise, add_on_fee_paise, add_on_chips, places_paid,
                                              guarantee_paise)
      values (p_venue_id, btrim(v_row.name), v_row.format, v_row.buy_in_paise, v_row.fee_paise, v_row.starting_stack, v_row.blind_structure_id,
              v_row.last_registration_level, v_row.max_buys, v_row.add_on_paise, v_row.add_on_fee_paise, v_row.add_on_chips, v_row.places_paid,
              v_row.guarantee_paise)
      returning id into v_id;
    else
      update public.tournament_template
      set name = btrim(v_row.name), format = v_row.format, buy_in_paise = v_row.buy_in_paise, fee_paise = v_row.fee_paise,
          starting_stack = v_row.starting_stack, blind_structure_id = v_row.blind_structure_id,
          last_registration_level = v_row.last_registration_level, max_buys = v_row.max_buys, add_on_paise = v_row.add_on_paise,
          add_on_fee_paise = v_row.add_on_fee_paise, add_on_chips = v_row.add_on_chips, places_paid = v_row.places_paid,
          guarantee_paise = v_row.guarantee_paise
      where id = p_template_id and venue_id = p_venue_id
      returning id into v_id;
    end if;
  exception when check_violation or not_null_violation or foreign_key_violation or invalid_text_representation
                 or numeric_value_out_of_range or datatype_mismatch then
    raise exception 'A template within its bounds, on a structure of this venue' using errcode = '22023';
  end;
  if v_id is null then
    raise exception 'No such template at this venue' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

-- Makes a tournament from a template, for tournaments.manage: its name, its start and whether the
-- calendar and the app show it; everything else, the levels included, copied from the template and its
-- structure. Refusals: 42501 not tournaments.manage where the template is, 22023 a name out of bounds
-- or no start; RVFRZ the venue frozen.
create function private.create_tournament(p_template_id uuid, p_name text, p_starts_at timestamptz, p_is_published boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select t.venue_id from public.tournament_template t where t.id = p_template_id);
  v_id uuid;
begin
  perform private.assert_runs_tournaments(v_venue_id);
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 or p_starts_at is null or p_is_published is null then
    raise exception 'A name of 1 to 80 characters, and a start' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue_id);
  insert into public.tournament (venue_id, name, starts_at, buy_in_paise, guarantee_paise, is_published, template_id, format, fee_paise,
                                 starting_stack, levels, last_registration_level, max_buys, add_on_paise, add_on_fee_paise, add_on_chips,
                                 places_paid)
  select t.venue_id, btrim(p_name), p_starts_at, t.buy_in_paise, t.guarantee_paise, p_is_published, t.id, t.format, t.fee_paise,
         t.starting_stack, s.levels, t.last_registration_level, t.max_buys, t.add_on_paise, t.add_on_fee_paise, t.add_on_chips, t.places_paid
  from public.tournament_template t join public.blind_structure s on s.id = t.blind_structure_id
  where t.id = p_template_id
  returning id into v_id;
  return v_id;
end;
$$;

-- Renames a tournament, moves its start, or puts it on the calendar and in the app or takes it off,
-- for tournaments.manage. Refusals: 42501 not tournaments.manage where it is, 22023 a name out of bounds
-- or no start; RVFRZ the venue frozen.
create function private.set_tournament_listing(p_tournament_id uuid, p_name text, p_starts_at timestamptz, p_is_published boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select t.venue_id from public.tournament t where t.id = p_tournament_id);
begin
  perform private.assert_runs_tournaments(v_venue_id);
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 or p_starts_at is null or p_is_published is null then
    raise exception 'A name of 1 to 80 characters, and a start' using errcode = '22023';
  end if;
  perform private.assert_writable(v_venue_id);
  update public.tournament set name = btrim(p_name), starts_at = p_starts_at, is_published = p_is_published where id = p_tournament_id;
end;
$$;

-- Removes a tournament made by mistake, for tournaments.manage: one nothing yet refers to, such as an
-- entry or a League finish (23503 otherwise). Refusals: 42501 not tournaments.manage where it is; RVFRZ the venue frozen.
create function private.remove_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (select t.venue_id from public.tournament t where t.id = p_tournament_id);
begin
  perform private.assert_runs_tournaments(v_venue_id);
  perform private.assert_writable(v_venue_id);
  delete from public.tournament where id = p_tournament_id;
end;
$$;

create function public.save_blind_structure(p_venue_id uuid, p_name text, p_levels jsonb, p_structure_id uuid default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.save_blind_structure(p_venue_id, p_name, p_levels, p_structure_id); $$;
create function public.save_tournament_template(p_venue_id uuid, p_template jsonb, p_template_id uuid default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.save_tournament_template(p_venue_id, p_template, p_template_id); $$;
create function public.create_tournament(p_template_id uuid, p_name text, p_starts_at timestamptz, p_is_published boolean)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.create_tournament(p_template_id, p_name, p_starts_at, p_is_published); $$;
create function public.set_tournament_listing(p_tournament_id uuid, p_name text, p_starts_at timestamptz, p_is_published boolean)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_tournament_listing(p_tournament_id, p_name, p_starts_at, p_is_published); $$;
create function public.remove_tournament(p_tournament_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.remove_tournament(p_tournament_id); $$;

revoke execute on function private.blind_level_count(jsonb), private.assert_runs_tournaments(uuid), private.save_blind_structure(uuid, text, jsonb, uuid),
  private.save_tournament_template(uuid, jsonb, uuid), private.create_tournament(uuid, text, timestamptz, boolean),
  private.set_tournament_listing(uuid, text, timestamptz, boolean), private.remove_tournament(uuid) from public, anon, authenticated;
grant execute on function private.save_blind_structure(uuid, text, jsonb, uuid), private.save_tournament_template(uuid, jsonb, uuid),
  private.create_tournament(uuid, text, timestamptz, boolean), private.set_tournament_listing(uuid, text, timestamptz, boolean),
  private.remove_tournament(uuid) to authenticated;
revoke execute on function public.save_blind_structure(uuid, text, jsonb, uuid), public.save_tournament_template(uuid, jsonb, uuid),
  public.create_tournament(uuid, text, timestamptz, boolean), public.set_tournament_listing(uuid, text, timestamptz, boolean),
  public.remove_tournament(uuid) from public, anon;
grant execute on function public.save_blind_structure(uuid, text, jsonb, uuid), public.save_tournament_template(uuid, jsonb, uuid),
  public.create_tournament(uuid, text, timestamptz, boolean), public.set_tournament_listing(uuid, text, timestamptz, boolean),
  public.remove_tournament(uuid) to authenticated;

-- The tournament gains columns, and the practice venue's seed keeps them (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;

