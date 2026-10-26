-- Rate limits on the cage's money calls (#342; decision 0199; .claude/rules/security.md). Buy-ins, cash-outs,
-- marker issues and marker repayments are limited to 30 a minute for each staff member and 120 a minute for the
-- venue. private.assert_rate counts the calls of one kind in the last minute, one call at a time per venue and
-- kind. The call that reaches a limit goes through and alerts the owner, at most once in 15 minutes per kind (a
-- refusal would roll its alert back with it); the calls past it are refused with RVRAT. Only staff calls count:
-- the database's own jobs, the seed and the practice venue's reset have no caller of their own.

create table private.rate_hit (
  venue_id uuid not null,
  actor uuid not null,
  action text not null,
  at timestamptz not null default now()
);
create index rate_hit_window_idx on private.rate_hit (venue_id, action, at);
comment on table private.rate_hit is 'One rate-limited call: who, what and when (#342). Kept ten minutes.';
alter table private.rate_hit enable row level security;
revoke all on private.rate_hit from public, anon, authenticated;

-- Limits one kind of call (`cage.buy_in`) at a venue to so many a minute for the signed-in staff member, and
-- for the venue. Refusal: RVRAT.
create function private.assert_rate(p_venue_id uuid, p_action text, p_per_staff integer default 30, p_per_venue integer default 120)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_mine integer;
  v_venue integer;
begin
  if v_actor is null then
    return;
  end if;
  -- Two calls at once would otherwise both count the same hits and both pass.
  perform pg_advisory_xact_lock(hashtextextended('rate:' || p_venue_id::text || ':' || p_action, 0));
  delete from private.rate_hit h where h.venue_id = p_venue_id and h.action = p_action and h.at < now() - interval '10 minutes';
  select count(*) filter (where h.actor = v_actor), count(*) into v_mine, v_venue
  from private.rate_hit h
  where h.venue_id = p_venue_id and h.action = p_action and h.at > now() - interval '1 minute';
  if v_mine >= p_per_staff or v_venue >= p_per_venue then
    raise exception 'Too many % calls in a minute. Wait a moment and try again.', p_action using errcode = 'RVRAT';
  end if;
  insert into private.rate_hit (venue_id, actor, action) values (p_venue_id, v_actor, p_action);
  if (v_mine + 1 >= p_per_staff or v_venue + 1 >= p_per_venue)
     and not exists (select 1 from public.alert a
                     where a.venue_id = p_venue_id and a.kind = 'cage.rate_limit' and a.detail ->> 'action' = p_action
                       and a.raised_at > now() - interval '15 minutes') then
    perform private.raise_alert(p_venue_id, 'cage.rate_limit', jsonb_build_object(
      'action', p_action, 'limit', case when v_mine + 1 >= p_per_staff then 'staff' else 'venue' end));
  end if;
end;
$$;

-- The cage's money rows, as they are written: a buy-in, cash-out or marker repayment, and a marker issued. The
-- practice venue's reset reloads its seed's rows, which are no one's calls.
create function private.limit_cage_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.purging(new.venue_id) then
    return new;
  end if;
  perform private.assert_rate(new.venue_id, coalesce(tg_argv[0], 'cage.' || (to_jsonb(new) ->> 'kind')));
  return new;
end;
$$;

create trigger cage_transaction_rate before insert on public.cage_transaction
  for each row when (new.kind in ('buy_in', 'cash_out', 'marker_repayment')) execute function private.limit_cage_rate();
create trigger marker_rate before insert on public.marker
  for each row execute function private.limit_cage_rate('marker.issue');

revoke execute on function private.assert_rate(uuid, text, integer, integer), private.limit_cage_rate() from public, anon, authenticated;
