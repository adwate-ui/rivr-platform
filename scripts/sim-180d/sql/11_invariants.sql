-- 180-day simulation: invariants. SIMULATION ONLY.
-- Each check is a query returning the violating rows; sim.check records pass, fail (with up to five sample rows)
-- or error. 'night' checks run after every close (still inside the club day); 'month' checks also run at nights
-- 30, 60, 90, 120, 150 and 180. Codes: L ledger, S state, P privacy, N features since 28 Oct, R races, X harness.
-- src/invariants/codes.ts names every code; a test keeps the two in step.

create table sim.invariant_result (
  id bigserial primary key, day int not null, scope text not null, code text not null, title text not null,
  status text not null, violations bigint, sample jsonb);
create index on sim.invariant_result (code, status);
-- The calls the apps make (from catalogue.json), for X03.
create table sim.rpc (name text primary key);
grant all on sim.invariant_result, sim.rpc to public;
grant all on sim.invariant_result_id_seq to public;

create function sim.since() returns timestamptz language sql immutable as $$ select sim.ist(1, '12:00') $$;

create function sim.check(p_day int, p_scope text, p_code text, p_title text, p_sql text, p_actor uuid default null)
returns void language plpgsql as $$
declare
  v_n bigint;
  v_sample jsonb;
  v_msg text;
begin
  begin
    if p_actor is not null then
      perform set_config('request.jwt.claims', sim.claims(p_actor)::text, true);
      perform set_config('role', 'authenticated', true);
    end if;
    execute format('select count(*), coalesce(jsonb_agg(x) filter (where rn <= 5), ''[]'') from (select row_number() over () rn, to_jsonb(q) x from (%s) q) z', p_sql)
    into v_n, v_sample;
    perform set_config('role', 'none', true);
    perform set_config('request.jwt.claims', '', true);
    insert into sim.invariant_result (day, scope, code, title, status, violations, sample)
    values (p_day, p_scope, p_code, p_title, case when v_n = 0 then 'pass' else 'fail' end, v_n, v_sample);
  exception when others then
    get stacked diagnostics v_msg = message_text;
    insert into sim.invariant_result (day, scope, code, title, status, violations, sample)
    values (p_day, p_scope, p_code, p_title, 'error', null, jsonb_build_object('error', left(v_msg, 300)));
  end;
end $$;

-- Any row in public or private whose text holds an erased member's name or phone.
create function sim.erased_traces() returns table (tbl text, n bigint) language plpgsql as $$
declare
  t record;
  p record;
  v_n bigint;
begin
  for p in select full_name, phone from sim.persona where erased loop
    for t in select c.oid::regclass as rel from pg_class c join pg_namespace s on s.oid = c.relnamespace
             where s.nspname in ('public', 'private') and c.relkind = 'r' loop
      execute format('select count(*) from %s x where x::text ilike %L or x::text like %L', t.rel, '%' || p.full_name || '%', '%' || ltrim(p.phone, '+') || '%') into v_n;
      if v_n > 0 then tbl := t.rel::text; n := v_n; return next; end if;
    end loop;
    select count(*) into v_n from auth.users where phone = ltrim(p.phone, '+');
    if v_n > 0 then tbl := 'auth.users'; n := v_n; return next; end if;
  end loop;
end $$;

-- Names of members who chose to stay off the TVs, found in what the TV boards return (as the paired TV) or in a
-- public view. A board shows a first name and initial (private.first_name_and_initial); another member who shows
-- their name may share it, so a hidden member is looked for only when no member on the TVs shares their short name.
create function sim.hidden_name_leaks() returns table (source text, full_name text) language plpgsql as $$
declare
  p record;
  v record;
  v_hidden jsonb;
  v_boards text := 'select display_name as name from public.tv_waitlist_board() union all select display_name from public.tv_call_time_board()
    union all select display_name from public.tv_rewards_ticker() union all select display_name from public.tv_spin_wheel()';
  v_n bigint;
begin
  -- Chosen as postgres: the TV's own login cannot read members.
  select coalesce(jsonb_agg(jsonb_build_object('full_name', pe.full_name, 'short', private.first_name_and_initial(pe.full_name))), '[]') into v_hidden
  from sim.persona pe
  where pe.hides_name and not exists (
    select 1 from public.member m left join public.member_preference mp on mp.member_id = m.id
    where m.venue_id = sim.venue() and m.id <> pe.member_id and coalesce(mp.name_on_tvs, true)
      and private.first_name_and_initial(m.full_name) = private.first_name_and_initial(pe.full_name));
  perform set_config('request.jwt.claims', sim.claims((select login from sim.device where key = 'tv'))::text, true);
  perform set_config('role', 'authenticated', true);
  for p in select * from jsonb_to_recordset(v_hidden) as x(full_name text, short text) loop
    execute format('select count(*) from (%s) b where b.name = %L or b.name ilike %L', v_boards, p.short, p.full_name) into v_n;
    if v_n > 0 then source := 'tv boards'; full_name := p.full_name; return next; end if;
  end loop;
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
  for v in select table_name from information_schema.views where table_schema = 'public' and table_name like 'public_%' loop
    for p in select pe.full_name from sim.persona pe where pe.hides_name loop
      execute format('select count(*) from public.%I x where x::text ilike %L', v.table_name, '%' || p.full_name || '%') into v_n;
      if v_n > 0 then source := v.table_name; full_name := p.full_name; return next; end if;
    end loop;
  end loop;
end $$;
