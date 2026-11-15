-- Members sorts, searches, filters and pages on the server (redesign RD-29; slice 12, "Lists at scale"). The list
-- loaded up to 5,000 members and narrowed them in the browser; a five-figure club needs one page asked of the server,
-- with every filter applied there, counts for a column's menu over every member, and a Bonus column.
--
-- A page is read by public.members_page and a menu's counts by public.members_choices. Both are handed the table's
-- view as it stands: {"tier_id", "query", "sort": {"key", "direction"}, "filters": {<column>: <filter>}, "page",
-- "page_size"}. The order and the filters vary, so the statement is put together for each view: a fixed list of
-- columns, each with its own SQL (private.members_column_sql), and every typed value written as a quoted literal
-- (format's %L), never as SQL. That keeps the member index in use for the view the screen opens on.

create extension if not exists pg_trgm with schema extensions;

-- The list by name, by number and by joining day, a venue at a time; a name or a mobile by any part of it; and a
-- mobile's last four digits, which is all most staff search by.
create index member_venue_name_idx on public.member (venue_id, full_name, id);
create index member_venue_number_idx on public.member (venue_id, member_number);
create index member_venue_created_idx on public.member (venue_id, created_at);
create index member_venue_phone_last4_idx on public.member (venue_id, (right(phone, 4)));
create index member_name_trgm_idx on public.member using gin (full_name extensions.gin_trgm_ops);
create index member_phone_trgm_idx on public.member using gin (phone extensions.gin_trgm_ops);

-- A figure as a range filter's box takes it (@rivr/ui boundOf): commas, spaces and a unit aside; blank or not a
-- figure, no bound.
create function private.list_bound(p_typed text)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when f.figure ~ '^-?[0-9]+(\.[0-9]+)?$' and length(f.figure) <= 15 then f.figure::numeric end
  from (select regexp_replace(coalesce(p_typed, ''), '[,\s₹h]', '', 'g') as figure) f;
$$;

-- One column's filter as SQL, for any list a data table reads from the server: `p_expr` is the column's own SQL, from
-- the list's fixed columns, and `p_filter` the filter as the table holds it (@rivr/ui ColumnFilter): words it
-- contains, values chosen, a figure from and to, a preset of days, or days from and to. A filter that asks nothing
-- is `true`. Every value typed or chosen goes in as a quoted literal.
create function private.list_filter_sql(p_expr text, p_filter jsonb, p_today date)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_kind text := p_filter ->> 'kind';
  v_typed text := btrim(coalesce(p_filter ->> 'typed', ''));
  v_low numeric := private.list_bound(p_filter ->> 'min');
  v_high numeric := private.list_bound(p_filter ->> 'max');
  v_from date;
  v_to date;
begin
  if v_kind = 'text' and v_typed <> '' then
    return format('coalesce((%s)::text, '''') ilike %L', p_expr,
                  '%' || replace(replace(replace(v_typed, '\', '\\'), '%', '\%'), '_', '\_') || '%');
  elsif v_kind = 'choice' and jsonb_typeof(p_filter -> 'chosen') = 'array' and jsonb_array_length(p_filter -> 'chosen') > 0 then
    return format('(%s)::text = any (%L::text[])', p_expr, array(select jsonb_array_elements_text(p_filter -> 'chosen')));
  elsif v_kind = 'range' and (v_low is not null or v_high is not null) then
    return format('(%s) is not null', p_expr)
           || case when v_low is null then '' else format(' and (%s) >= %L::numeric', p_expr, v_low) end
           || case when v_high is null then '' else format(' and (%s) <= %L::numeric', p_expr, v_high) end;
  elsif v_kind = 'date' then
    v_to := p_today;
    v_from := case p_filter ->> 'preset' when 'today' then p_today when 'last7' then p_today - 6 when 'last30' then p_today - 29
                                        when 'thisMonth' then date_trunc('month', p_today)::date end;
    if v_from is null then return 'true'; end if;
  elsif v_kind = 'dateRange' then
    v_from := case when p_filter ->> 'from' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then (p_filter ->> 'from')::date end;
    v_to := case when p_filter ->> 'to' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then (p_filter ->> 'to')::date end;
    if v_from is null and v_to is null then return 'true'; end if;
  else
    return 'true';
  end if;
  return format('(%s) is not null', p_expr)
         || case when v_from is null then '' else format(' and (%s) >= %L::date', p_expr, v_from) end
         || case when v_to is null then '' else format(' and (%s) <= %L::date', p_expr, v_to) end;
end;
$$;

-- The members whose account is not simply active (F-121), as before, but found from the records that say so: erased
-- members, freezes in force and breaks in force. It asked whether the caller may read, twice, of every member of
-- the venue, which at fifty thousand members took the Members screen twenty seconds. The rows are the same.
create or replace function private.member_account_statuses(p_venue_id uuid)
returns table (member_id uuid, status text, until timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with access as materialized (
    select coalesce(private.has_permission(p_venue_id, 'members.read'), false) as reads,
           coalesce(private.has_permission(p_venue_id, 'activity.read'), false) as sees_freezes
  ),
  frozen as (
    select distinct c.member_id from public.control_state c
    where c.venue_id = p_venue_id and c.level = 'member_freeze' and c.released_at is null and c.member_id is not null
      and (select sees_freezes from access)
  ),
  on_break as (
    select s.member_id, max(s.ends_at) as ends_at from public.self_exclusion s
    where s.venue_id = p_venue_id and s.starts_at <= now() and s.ends_at > now()
    group by s.member_id
  ),
  marked as (
    select m.id from public.member m where m.venue_id = p_venue_id and m.erased_at is not null
    union select f.member_id from frozen f
    union select b.member_id from on_break b
  )
  select m.id,
         case when m.erased_at is not null then 'erased' when f.member_id is not null then 'frozen' else 'on_break' end,
         case when m.erased_at is null and f.member_id is null then b.ends_at end
  from marked
  join public.member m on m.id = marked.id and m.venue_id = p_venue_id
  left join frozen f on f.member_id = m.id
  left join on_break b on b.member_id = m.id
  where (select reads from access);
$$;

-- Erased members, found without reading every member.
create index member_venue_erased_idx on public.member (venue_id) where erased_at is not null;

-- Members' columns a view may sort or filter by, each as SQL over `m`, a member; null for any other word. Status and
-- Tonight read a join the list adds only when a view asks for them (private.members_list_sql).
create function private.members_column_sql(p_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_key
    when 'name' then 'm.full_name'
    when 'number' then 'm.member_number'
    when 'mobile' then 'm.phone'
    when 'tier' then '(select t.name from public.tier t where t.id = m.tier_id)'
    when 'status' then 'coalesce(st.status, ''active'')'
    -- As private.members_of_tier words it: verified only once the check is complete, by the rule private.is_kyc_complete
    -- holds (a photo, and of age by the venue's day), written here over the record itself, as a call for each of
    -- fifty thousand members takes seconds. The venue's time zone and its least age are read once. $1 is the venue.
    when 'kyc' then '(select case when k.status = ''verified'' then
                                    case when k.photo_path is not null
                                              and k.date_of_birth <= (now() at time zone (select v.time_zone from public.venue v where v.id = $1))::date
                                                                     - make_interval(years => (select private.kyc_minimum_age($1)))
                                         then ''verified'' else ''not_done'' end
                                  when k.status = ''needs_review'' then ''in_review'' when k.status = ''refused'' then ''refused''
                                  when k.status = ''started'' and k.at_club_from is not null then ''at_desk'' else ''not_done'' end
                     from (select 1) one left join public.kyc_record k on k.member_id = m.id)'
    -- Counted hours, in minutes: from the moment a reset set (20261118100300).
    when 'played' then '(select coalesce(sum(private.counted_minutes(s, now(), coalesce(m.hours_counted_from, ''-infinity''::timestamptz))), 0)::bigint
                         from public.seat_session s where s.member_id = m.id)'
    when 'city' then '(select pr.city from public.member_preference pr where pr.member_id = m.id)'
    when 'since' then 'm.created_at'
    when 'tonight' then 'coalesce(tn.kind, ''not_here'')'
    when 'visits' then '(select count(*)::integer from public.visit v where v.member_id = m.id)'
    when 'bonus' then 'private.bonus_in_force(m.id, now())'
  end;
$$;

-- A view of the Members list as the parts of a statement over `public.member m`, with the venue as $1: the joins it
-- needs, what narrows it and its order. The search is the list's own: a name by any part, a member number exactly,
-- or four or more digits of a mobile, anywhere in it for staff who read mobiles (`p_sees_phone`) and its last four
-- for everyone else, so trying digits never spells out a number they may not read.
create function private.members_list_sql(p_view jsonb, p_sees_phone boolean, out o_joins text, out o_where text, out o_order text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_filters jsonb := case when jsonb_typeof(p_view -> 'filters') = 'object' then p_view -> 'filters' else '{}'::jsonb end;
  v_sort text := coalesce(p_view #>> '{sort,key}', 'name');
  v_way text := case when p_view #>> '{sort,direction}' = 'descending' then 'desc' else 'asc' end;
  v_query text := btrim(coalesce(p_view ->> 'query', ''));
  v_digits text := regexp_replace(coalesce(p_view ->> 'query', ''), '[^0-9]', '', 'g');
  v_found text[];
  v_key text;
  v_expr text;
begin
  if private.members_column_sql(v_sort) is null or v_sort = 'mobile' then v_sort := 'name'; end if;
  o_where := 'm.venue_id = $1';
  if coalesce(p_view ->> 'tier_id', '') <> '' then
    o_where := o_where || format(' and m.tier_id = %L::uuid', (p_view ->> 'tier_id')::uuid);
  end if;

  if v_query <> '' then
    v_found := array[format('m.full_name ilike %L', '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%')];
    if v_query ~ '^[0-9]{1,18}$' then v_found := v_found || format('m.member_number = %L::bigint', v_query); end if;
    if length(v_digits) >= 4 and p_sees_phone then v_found := v_found || format('m.phone like %L', '%' || right(v_digits, 10) || '%'); end if;
    if length(v_digits) >= 4 and not p_sees_phone then v_found := v_found || format('right(m.phone, 4) = %L', right(v_digits, 4)); end if;
    o_where := o_where || ' and (' || array_to_string(v_found, ' or ') || ')';
  end if;

  for v_key in select jsonb_object_keys(v_filters) loop
    v_expr := private.members_column_sql(v_key);
    -- The tier is the chips above the table; the mobile is a column only for staff who read it.
    continue when v_expr is null or v_key = 'tier' or (v_key = 'mobile' and not p_sees_phone);
    -- Hours are filtered in hours, Bonus in whole Bonus, and the joining day by the club's day.
    v_expr := case v_key when 'played' then v_expr || ' / 60.0' when 'bonus' then v_expr || ' / 100.0'
                         when 'since' then 'private.club_day_of(m.created_at)' else v_expr end;
    o_where := o_where || ' and ' || private.list_filter_sql(v_expr, v_filters -> v_key, private.club_day_of(now()));
  end loop;

  o_joins := '';
  if v_sort = 'status' or v_filters ? 'status' then
    o_joins := o_joins || ' left join private.member_account_statuses($1) st on st.member_id = m.id';
  end if;
  if v_sort = 'tonight' or v_filters ? 'tonight' then
    -- Where each member is tonight, as the day's list says it; a seat sorts by its table and number.
    o_joins := o_joins || ' left join (
      select tp.member_id,
             case tp.status when ''playing'' then ''seated'' when ''never_arrived'' then ''not_here'' else tp.status end as kind,
             case tp.status when ''playing'' then ''0 '' || coalesce((select g.name || '' '' || lpad(s.seat::text, 2, ''0'')
                                                                    from public.seat_session s join public.game_table g on g.id = s.table_id
                                                                    where s.member_id = tp.member_id and s.ended_at is null), '''')
                            when ''waiting'' then ''1'' when ''in_room'' then ''2'' when ''left'' then ''3'' else ''4'' end as place
      from private.todays_players($1) tp) tn on tn.member_id = m.id';
  end if;

  -- Each column in the order the table gave it in the browser: a status and an ID check by their words, a seat first.
  v_expr := case v_sort
    when 'status' then 'array_position(array[''active'', ''erased'', ''frozen'', ''on_break''], coalesce(st.status, ''active''))'
    when 'kyc' then 'array_position(array[''at_desk'', ''in_review'', ''not_done'', ''refused'', ''verified''], ' || private.members_column_sql('kyc') || ')'
    when 'city' then 'coalesce(' || private.members_column_sql('city') || ', '''')'
    when 'tonight' then 'coalesce(tn.place, ''4'')'
    else private.members_column_sql(v_sort) end;
  o_order := case when v_sort = 'name' then format('m.full_name %s, m.id %s', v_way, v_way)
                  else format('%s %s, m.full_name, m.id', v_expr, v_way) end;
end;
$$;

-- A view's page as JSON, {"total": <members the view leaves>, "rows": [<a member>, ...]}, for private.members_page to
-- give out as rows: the statement is put together here, and its result has to leave as one value for the columns to
-- be declared once, there. Staff who do not read members are given no row; that is part of the statement ($5).
create function private.members_page_json(p_venue_id uuid, p_view jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_view jsonb := coalesce(p_view, '{}'::jsonb);
  v_reads boolean := coalesce(private.has_permission(p_venue_id, 'members.read'), false);
  v_sees_phone boolean := coalesce(private.has_permission(p_venue_id, 'members.change_phone'), false);
  v_sees_identity boolean := coalesce(private.is_super_admin(p_venue_id), false);
  v_size integer := least(greatest(coalesce((v_view ->> 'page_size')::integer, 50), 1), 1000);
  v_page integer := greatest(coalesce((v_view ->> 'page')::integer, 1), 1);
  v_list record;
  v_total bigint;
  v_rows jsonb;
begin
  select * into v_list from private.members_list_sql(v_view, v_sees_phone);
  execute 'select count(*) from public.member m' || v_list.o_joins || ' where $2 and ' || v_list.o_where into v_total using p_venue_id, v_reads;
  execute
    'select coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) from (
       select listed.place, m.id as member_id, m.member_number, m.full_name, case when $4 then m.phone end as phone, right(m.phone, 4) as phone_last4,
              t.name as tier_name, ' || private.members_column_sql('visits') || ' as visits,
              (select max(v.opened_at) from public.visit v where v.member_id = m.id) as last_visit_at,
              ' || private.members_column_sql('kyc') || ' as kyc_status,
              ' || private.members_column_sql('played') || ' as minutes_played,
              pr.city, m.created_at as member_since, m.known_as, m.referral_code as own_referral_code, pr.occupation,
              coalesce(pr.play_times, ''{}'') as play_times, coalesce(pr.games_played, ''{}'') as games_played,
              sa.referral_code, sa.creator_code, sa.utm_source, sa.utm_medium, sa.utm_campaign, sa.utm_content, sa.utm_term, sa.first_seen_at,
              case when k.verified_at is not null then k.method end as kyc_method, k.verified_at as kyc_verified_at,
              case when $6 and m.erased_at is null then k.date_of_birth end as date_of_birth,
              case when $6 and m.erased_at is null then k.pan end as pan,
              case when $6 and m.erased_at is null then k.masked_aadhaar end as masked_aadhaar,
              case when $6 and m.erased_at is null then k.aadhaar_name end as aadhaar_name,
              case when $6 and m.erased_at is null then k.address end as address,
              ' || private.members_column_sql('bonus') || ' as bonus_paise
       from unnest(array(select m.id from public.member m' || v_list.o_joins || ' where $5 and ' || v_list.o_where
                        || ' order by ' || v_list.o_order || ' limit $2 offset $3)) with ordinality as listed(id, place)
       join public.member m on m.id = listed.id
       join public.tier t on t.id = m.tier_id
       left join public.kyc_record k on k.member_id = m.id
       left join public.member_preference pr on pr.member_id = m.id
       left join public.sign_up_attribution sa on sa.member_id = m.id) r'
    into v_rows using p_venue_id, v_size, (v_page - 1)::bigint * v_size, v_sees_phone, v_reads, v_sees_identity;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

-- One page of the Members list for staff who read members (members.read): the rows of the view's page, each as
-- private.members_of_tier gives a member, with their Bonus in force, and how many members the view leaves in all. A
-- page holds 50 unless the view says otherwise, 1,000 at most, which is what an export asks for, page after page.
-- The full mobile is for staff who change one (members.change_phone); identity documents for super admins.
create function private.members_page(p_venue_id uuid, p_view jsonb)
returns table (total bigint, member_id uuid, member_number bigint, full_name text, phone text, phone_last4 text, tier_name text, visits integer,
               last_visit_at timestamptz, kyc_status text, minutes_played bigint, city text, member_since timestamptz, known_as text,
               own_referral_code text, occupation text, play_times text[], games_played text[], referral_code text, creator_code text,
               utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text, first_seen_at timestamptz,
               kyc_method text, kyc_verified_at timestamptz, date_of_birth date, pan text, masked_aadhaar text, aadhaar_name text,
               address text, bonus_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  -- Read once: left in line, the planner would ask for the page again for every row of it.
  with page as materialized (select private.members_page_json(p_venue_id, p_view) as found)
  select (page.found ->> 'total')::bigint, r.member_id, r.member_number, r.full_name, r.phone, r.phone_last4, r.tier_name, r.visits, r.last_visit_at,
         r.kyc_status, r.minutes_played, r.city, r.member_since, r.known_as, r.own_referral_code, r.occupation, r.play_times, r.games_played,
         r.referral_code, r.creator_code, r.utm_source, r.utm_medium, r.utm_campaign, r.utm_content, r.utm_term, r.first_seen_at, r.kyc_method,
         r.kyc_verified_at, r.date_of_birth, r.pan, r.masked_aadhaar, r.aadhaar_name, r.address, r.bonus_paise
  from page
  cross join lateral jsonb_to_recordset(page.found -> 'rows') as r(
    place bigint, member_id uuid, member_number bigint, full_name text, phone text, phone_last4 text, tier_name text, visits integer,
    last_visit_at timestamptz, kyc_status text, minutes_played bigint, city text, member_since timestamptz, known_as text,
    own_referral_code text, occupation text, play_times text[], games_played text[], referral_code text, creator_code text,
    utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text, first_seen_at timestamptz,
    kyc_method text, kyc_verified_at timestamptz, date_of_birth date, pan text, masked_aadhaar text, aadhaar_name text,
    address text, bonus_paise bigint)
  order by r.place;
$$;

create function public.members_page(p_venue_id uuid, p_view jsonb default '{}')
returns table (total bigint, member_id uuid, member_number bigint, full_name text, phone text, phone_last4 text, tier_name text, visits integer,
               last_visit_at timestamptz, kyc_status text, minutes_played bigint, city text, member_since timestamptz, known_as text,
               own_referral_code text, occupation text, play_times text[], games_played text[], referral_code text, creator_code text,
               utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text, first_seen_at timestamptz,
               kyc_method text, kyc_verified_at timestamptz, date_of_birth date, pan text, masked_aadhaar text, aadhaar_name text,
               address text, bonus_paise bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.members_page(p_venue_id, p_view); $$;

-- A column menu's counts as JSON, [{"column_key", "value", "members"}, ...], for private.members_choices to give out
-- as rows. A column's own filter is left out of its own counts, so its other values stay on offer.
create function private.members_choices_json(p_venue_id uuid, p_view jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_view jsonb := coalesce(p_view, '{}'::jsonb);
  v_reads boolean := coalesce(private.has_permission(p_venue_id, 'members.read'), false);
  v_sees_phone boolean := coalesce(private.has_permission(p_venue_id, 'members.change_phone'), false);
  v_key text;
  v_list record;
  v_counted jsonb;
  v_all jsonb := '[]'::jsonb;
begin
  foreach v_key in array array['status', 'kyc', 'city', 'tonight'] loop
    -- Sorted by the column, the list joins what the column reads; without the column's own filter.
    select * into v_list from private.members_list_sql(
      v_view || jsonb_build_object('sort', jsonb_build_object('key', v_key),
                                   'filters', case when jsonb_typeof(v_view -> 'filters') = 'object' then (v_view -> 'filters') - v_key else '{}'::jsonb end),
      v_sees_phone);
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(top)), ''[]''::jsonb)
       from (select %L::text as column_key, counted.value, counted.members
             from (select (%s)::text as value, count(*) as members from public.member m%s where $2 and %s group by 1) counted
             where counted.value is not null order by counted.members desc, counted.value limit 200) top',
      v_key, private.members_column_sql(v_key), v_list.o_joins, v_list.o_where)
      into v_counted using p_venue_id, v_reads;
    v_all := v_all || v_counted;
  end loop;
  return v_all;
end;
$$;

-- What a column's menu offers on the Members list (redesign correction 4): each value of Status, ID check, City and
-- Tonight with how many members hold it, over every member the search, the tier and the other columns' filters
-- leave, not the page. The 200 values most members hold, which bounds City.
create function private.members_choices(p_venue_id uuid, p_view jsonb)
returns table (column_key text, value text, members bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.column_key, r.value, r.members
  from jsonb_to_recordset(private.members_choices_json(p_venue_id, p_view)) as r(column_key text, value text, members bigint);
$$;

create function public.members_choices(p_venue_id uuid, p_view jsonb default '{}')
returns table (column_key text, value text, members bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.members_choices(p_venue_id, p_view); $$;

revoke execute on function private.list_bound(text), private.list_filter_sql(text, jsonb, date), private.members_column_sql(text),
  private.members_list_sql(jsonb, boolean), private.members_page_json(uuid, jsonb), private.members_choices_json(uuid, jsonb)
  from public, anon, authenticated;
revoke execute on function private.members_page(uuid, jsonb), public.members_page(uuid, jsonb),
  private.members_choices(uuid, jsonb), public.members_choices(uuid, jsonb) from public, anon;
grant execute on function private.members_page(uuid, jsonb), public.members_page(uuid, jsonb),
  private.members_choices(uuid, jsonb), public.members_choices(uuid, jsonb) to authenticated;
