-- The versions' status machine (decision 0471), as @rivr/domain transition has it: save a draft, store its simulation,
-- submit it, approve or reject it, pause, resume and end it. Staff who manage promotions draft, simulate, submit, pause,
-- resume and end; a super admin (promotions.approve) approves or rejects, never a version they submitted or last edited.
-- Submitting needs a simulation on the version's own terms. Editing a running version drafts the next, and the running
-- one goes on until that is approved. Every change copies the current version onto `promotion` (status, words, link),
-- so the cards, the TV, the website and the engine's old readers keep working. Not while the venue is frozen or
-- promotions are switched off.

-- Copies the promotion's current version onto its row: the running one, else the last that ended, else the open draft
-- (a draft waiting is `pending` there, as before), with its words and who submitted and decided it. A version converted
-- from a rule, with no submitter of its own, keeps the promotion's.
create function private.sync_promotion(p_promotion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.promotion_version;
begin
  select * into v_version from public.promotion_version v
  where v.promotion_id = p_promotion_id
  order by (v.status in ('scheduled', 'live', 'paused')) desc, (v.status = 'ended') desc, v.version desc
  limit 1;
  if v_version.id is null then
    return;
  end if;
  -- private.guard_versioned_promotion lets only this change a versioned promotion's status.
  perform set_config('rivr.promotion_sync', 'on', true);
  update public.promotion p
  set status = case v_version.status when 'awaiting_approval' then 'pending' else v_version.status end,
      current_version = case when v_version.status in ('draft', 'awaiting_approval') then p.current_version else v_version.version end,
      name = v_version.name, detail = v_version.detail, runs = v_version.runs, link = v_version.link, rules = v_version.rules_text,
      requested_by_staff_id = coalesce(v_version.author_staff_id, p.requested_by_staff_id), requested_at = coalesce(v_version.submitted_at, p.requested_at),
      decided_by_staff_id = coalesce(v_version.decided_by_staff_id, p.decided_by_staff_id), decided_at = coalesce(v_version.decided_at, p.decided_at),
      refused_reason = v_version.rejected_reason
  where p.id = p_promotion_id;
  perform set_config('rivr.promotion_sync', 'off', true);
end;
$$;

-- A promotion run in versions changes status only with its version (RVVER): the old builder's functions and a direct
-- write are refused, so its row never says live while its version does not. A practice reset or purge passes.
create function private.guard_versioned_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and current_setting('rivr.promotion_sync', true) is distinct from 'on'
     and not coalesce(private.purging(new.venue_id), false) and exists (select 1 from public.promotion_version v where v.promotion_id = new.id) then
    raise exception 'This promotion runs in versions: change it with its version' using errcode = 'RVVER';
  end if;
  return new;
end;
$$;

create trigger promotion_guard_versioned before update of status on public.promotion
  for each row execute function private.guard_versioned_promotion();

-- A version's terms as the simulation must have run on them: what it gives, to whom, when and how often.
create function private.version_terms(p_version public.promotion_version)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('reward', p_version.reward, 'eligibility', p_version.eligibility, 'schedule', p_version.schedule, 'limits', p_version.limits);
$$;

-- Writes a draft's terms and words into a new version.
create function private.insert_promotion_version(p_promotion public.promotion, p_version integer, p_draft jsonb, p_staff_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terms jsonb := p_draft -> 'terms';
  v_id uuid;
begin
  insert into public.promotion_version (venue_id, promotion_id, version, name, reward, eligibility, schedule, limits, channels, rules_text, link, detail,
                                        runs, edited_by_staff_id)
  values (p_promotion.venue_id, p_promotion.id, p_version, btrim(v_terms ->> 'name'), v_terms -> 'reward', v_terms -> 'eligibility',
          v_terms -> 'schedule', v_terms -> 'limits', v_terms -> 'channels',
          array(select btrim(r) from jsonb_array_elements_text(coalesce(v_terms -> 'rulesText', '[]'::jsonb)) r), nullif(btrim(v_terms ->> 'link'), ''),
          nullif(btrim(p_draft ->> 'detail'), ''), nullif(btrim(p_draft ->> 'runs'), ''), p_staff_id)
  returning id into v_id;
  perform private.sync_promotion(p_promotion.id);
  return v_id;
end;
$$;

-- Saves the builder's draft (`{terms, detail, runs, request_id}`, for the promotion named or a new one, terms as @rivr/contracts promotionTermsSchema): a new
-- promotion with its first version; the open draft, changed (its simulation then no longer holds); or, for a promotion
-- running or scheduled, the next version as a draft. Returns the version's id; a retry with the request id returns it.
create function private.save_promotion_draft(p_venue_id uuid, p_draft jsonb, p_promotion_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terms jsonb := p_draft -> 'terms';
  v_key uuid := nullif(p_draft ->> 'request_id', '')::uuid;
  v_staff_id uuid := private.current_staff_id(p_venue_id);
  v_promotion public.promotion;
  v_open public.promotion_version;
  v_last public.promotion_version;
  v_id uuid;
begin
  if p_venue_id is null or not coalesce(private.has_permission(p_venue_id, 'promotions.manage'), false) then
    raise exception 'Only staff who manage promotions draft one' using errcode = '42501';
  end if;
  if jsonb_typeof(v_terms) is distinct from 'object' then
    raise exception 'A draft is saved with its terms' using errcode = '22023';
  end if;
  if p_promotion_id is null then
    select v.id into v_id from public.promotion p join public.promotion_version v on v.promotion_id = p.id and v.version = 1
    where p.venue_id = p_venue_id and p.idempotency_key = v_key;
    if v_id is not null then
      return v_id;
    end if;
    perform private.assert_writable(p_venue_id, 'promotions');
    insert into public.promotion (venue_id, name, status, idempotency_key) values (p_venue_id, btrim(v_terms ->> 'name'), 'draft', v_key)
    returning * into v_promotion;
    return private.insert_promotion_version(v_promotion, 1, p_draft, v_staff_id);
  end if;
  select * into v_promotion from public.promotion p where p.id = p_promotion_id and p.venue_id = p_venue_id for update;
  if v_promotion.id is null then
    raise exception 'No such promotion at this venue' using errcode = 'P0002';
  end if;
  perform private.assert_writable(p_venue_id, 'promotions');
  select * into v_open from public.promotion_version v where v.promotion_id = p_promotion_id and v.status in ('draft', 'awaiting_approval');
  if v_open.status = 'awaiting_approval' then
    raise exception 'This version waits for approval: it is changed only once it is rejected' using errcode = 'RVDEC';
  end if;
  if v_open.id is not null then
    update public.promotion_version
    set name = btrim(v_terms ->> 'name'), reward = v_terms -> 'reward', eligibility = v_terms -> 'eligibility', schedule = v_terms -> 'schedule',
        limits = v_terms -> 'limits', channels = v_terms -> 'channels',
        rules_text = array(select btrim(r) from jsonb_array_elements_text(coalesce(v_terms -> 'rulesText', '[]'::jsonb)) r),
        link = nullif(btrim(v_terms ->> 'link'), ''), detail = nullif(btrim(p_draft ->> 'detail'), ''), runs = nullif(btrim(p_draft ->> 'runs'), ''),
        edited_by_staff_id = v_staff_id, simulation = null, simulated_terms = null, simulated_at = null
    where id = v_open.id;
    perform private.sync_promotion(p_promotion_id);
    return v_open.id;
  end if;
  select * into v_last from public.promotion_version v where v.promotion_id = p_promotion_id order by v.version desc limit 1;
  if v_last.id is null or v_last.status = 'ended' then
    raise exception 'Only a promotion with a running version is changed into a new one' using errcode = '22023';
  end if;
  return private.insert_promotion_version(v_promotion, v_last.version + 1, p_draft, v_staff_id);
end;
$$;

-- A version locked for a change by staff with the permission at its venue, while the venue may write promotions.
create function private.lock_promotion_version(p_version_id uuid, p_permission text)
returns public.promotion_version
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.promotion_version;
begin
  select * into v_version from public.promotion_version v where v.id = p_version_id for update;
  if v_version.id is null or not coalesce(private.has_permission(v_version.venue_id, p_permission), false) then
    raise exception 'Not allowed to change this promotion' using errcode = '42501';
  end if;
  perform private.assert_writable(v_version.venue_id, 'promotions');
  return v_version;
end;
$$;

-- Stores last week's replay of a draft (@rivr/domain simulate) with the terms it ran on.
create function private.record_promotion_simulation(p_version_id uuid, p_simulation jsonb, p_terms jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.promotion_version := private.lock_promotion_version(p_version_id, 'promotions.manage');
begin
  if v_version.status <> 'draft' then
    raise exception 'Only a draft is simulated' using errcode = 'RVDEC';
  end if;
  update public.promotion_version
  set simulation = p_simulation, simulated_at = now(),
      simulated_terms = jsonb_build_object('reward', p_terms -> 'reward', 'eligibility', p_terms -> 'eligibility', 'schedule', p_terms -> 'schedule',
                                           'limits', p_terms -> 'limits')
  where id = p_version_id;
end;
$$;

-- Submits a draft for approval: only with a simulation run on its own terms (RVSIM). Its submitter is its author.
create function private.submit_promotion_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.promotion_version := private.lock_promotion_version(p_version_id, 'promotions.manage');
begin
  if v_version.status <> 'draft' then
    raise exception 'Only a draft is submitted' using errcode = 'RVDEC';
  end if;
  if v_version.simulated_terms is distinct from private.version_terms(v_version) then
    raise exception 'Simulate this version on last week before submitting it' using errcode = 'RVSIM';
  end if;
  update public.promotion_version
  set status = 'awaiting_approval', author_staff_id = private.current_staff_id(v_version.venue_id), submitted_at = now(),
      decided_by_staff_id = null, decided_at = null, rejected_reason = null
  where id = p_version_id;
  perform private.sync_promotion(v_version.promotion_id);
end;
$$;

-- A super admin approves a waiting version, never one they submitted or last edited (RVTWO): it runs from its start
-- day (live now, or scheduled), the version that ran before ends, and the budget the wheel and the reports read is set.
create function private.approve_promotion_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.promotion_version := private.lock_promotion_version(p_version_id, 'promotions.approve');
  v_staff_id uuid := private.current_staff_id(v_version.venue_id);
begin
  if v_version.status <> 'awaiting_approval' then
    raise exception 'This version is not waiting: it was already decided' using errcode = 'RVDEC';
  end if;
  if v_staff_id is null or v_staff_id = v_version.author_staff_id or v_staff_id = v_version.edited_by_staff_id then
    raise exception 'Another super admin approves the promotion you submitted or changed' using errcode = 'RVTWO';
  end if;
  update public.promotion_version set status = 'ended' where promotion_id = v_version.promotion_id and status in ('scheduled', 'live', 'paused');
  update public.promotion_version
  set status = case when (v_version.schedule ->> 'startsOn')::date <= private.club_day_of(now()) then 'live' else 'scheduled' end,
      decided_by_staff_id = v_staff_id, decided_at = now()
  where id = p_version_id;
  delete from public.promotion_budget b where b.promotion_id = v_version.promotion_id;
  if v_version.limits ? 'budgetChips' or v_version.limits ? 'maxGrants' then
    insert into public.promotion_budget (venue_id, promotion_id, cap_paise, cap_count, period)
    values (v_version.venue_id, v_version.promotion_id, (v_version.limits ->> 'budgetChips')::bigint * 100, (v_version.limits ->> 'maxGrants')::integer,
            'promotion');
  end if;
  perform private.sync_promotion(v_version.promotion_id);
  perform private.emit(v_version.venue_id, 'promotion.published',
                       jsonb_build_object('promotion_id', v_version.promotion_id, 'promotion_version_id', v_version.id, 'name', v_version.name,
                                          'detail', v_version.detail, 'runs', v_version.runs),
                       'promotion.published:' || v_version.id);
end;
$$;

-- A super admin sends a waiting version back to draft, with the reason its author reads (3 to 300 characters).
create function private.reject_promotion_version(p_version_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.promotion_version := private.lock_promotion_version(p_version_id, 'promotions.approve');
begin
  if v_version.status <> 'awaiting_approval' then
    raise exception 'This version is not waiting: it was already decided' using errcode = 'RVDEC';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 300 then
    raise exception 'A rejection says why, in 3 to 300 characters' using errcode = '22023';
  end if;
  update public.promotion_version
  set status = 'draft', decided_by_staff_id = private.current_staff_id(v_version.venue_id), decided_at = now(), rejected_reason = btrim(p_reason)
  where id = p_version_id;
  perform private.sync_promotion(v_version.promotion_id);
end;
$$;

-- Pauses a live version or resumes a paused one; nothing is given while paused.
create function private.set_promotion_version_live(p_version_id uuid, p_is_live boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.promotion_version := private.lock_promotion_version(p_version_id, 'promotions.manage');
begin
  if p_is_live is null or (p_is_live and v_version.status <> 'paused') or (not p_is_live and v_version.status <> 'live') then
    raise exception 'Only a live promotion is paused, and only a paused one resumed' using errcode = '22023';
  end if;
  update public.promotion_version set status = case when p_is_live then 'live' else 'paused' end where id = p_version_id;
  perform private.sync_promotion(v_version.promotion_id);
end;
$$;

-- Ends a scheduled, live or paused version for good.
create function private.end_promotion_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.promotion_version := private.lock_promotion_version(p_version_id, 'promotions.manage');
begin
  if v_version.status not in ('scheduled', 'live', 'paused') then
    raise exception 'Only a scheduled, live or paused promotion is ended' using errcode = '22023';
  end if;
  update public.promotion_version set status = 'ended' where id = p_version_id;
  perform private.sync_promotion(v_version.promotion_id);
end;
$$;

-- The clock, every minute: a scheduled version goes live on its start day; a running one ends once its end day's last
-- opening can have closed (the club day after the next). Not for a venue that is frozen or has promotions off.
create function private.advance_promotions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version public.promotion_version;
begin
  for v_version in
    select v.* from public.promotion_version v
    where ((v.status = 'scheduled' and (v.schedule ->> 'startsOn')::date <= private.club_day_of(now()))
           or (v.status in ('scheduled', 'live', 'paused') and (v.schedule ->> 'endsOn')::date + 1 < private.club_day_of(now())))
      and not exists (select 1 from public.control_state c where c.venue_id = v.venue_id and c.released_at is null
                      and (c.level = 'venue_freeze' or (c.level = 'feature_kill' and c.feature = 'promotions')))
    for update
  loop
    update public.promotion_version
    set status = case when v_version.schedule ? 'endsOn' and (v_version.schedule ->> 'endsOn')::date + 1 < private.club_day_of(now()) then 'ended'
                      else 'live' end
    where id = v_version.id;
    perform private.sync_promotion(v_version.promotion_id);
  end loop;
end;
$$;

select cron.schedule('promotion-versions', '* * * * *', 'select private.advance_promotions()');

-- The console's list: each promotion with its current version (running, or the last that ran) and its open one
-- (draft or waiting), what it gives, and how many grants it gave this club week (Monday 06:00 IST on).
create function private.promotions_overview(p_venue_id uuid)
returns table (promotion_id uuid, template_key text, status text, name text, detail text, runs text, current_version_id uuid,
               current_status text, open_version_id uuid, open_status text, rejected_reason text, reward jsonb, eligibility jsonb, schedule jsonb,
               limits jsonb, channels jsonb, given_this_week bigint, is_legacy boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.template_key, p.status, coalesce(cur.name, o.name, p.name), coalesce(cur.detail, o.detail, p.detail), coalesce(cur.runs, o.runs, p.runs),
         cur.id, cur.status, o.id, o.status, o.rejected_reason, coalesce(cur.reward, o.reward), coalesce(cur.eligibility, o.eligibility),
         coalesce(cur.schedule, o.schedule), coalesce(cur.limits, o.limits), coalesce(cur.channels, o.channels),
         (select count(*) from public.promotion_grant g where g.promotion_id = p.id
            and g.club_day >= private.club_day_of(now()) - (extract(isodow from private.club_day_of(now()))::integer - 1)),
         not exists (select 1 from public.promotion_version x where x.promotion_id = p.id), p.created_at
  from public.promotion p
  left join public.promotion_version cur on cur.promotion_id = p.id and cur.version = p.current_version
  left join public.promotion_version o on o.promotion_id = p.id and o.status in ('draft', 'awaiting_approval')
  where p.venue_id = p_venue_id and private.has_permission(p_venue_id, 'promotions.manage')
  order by p.created_at desc, p.id;
$$;

-- One promotion's versions, newest first, for the builder and the approver (who reads a waiting one against the live
-- one): their terms and words, who submitted and decided each, whether the caller did, and the simulation.
create function private.promotion_versions_of(p_promotion_id uuid)
returns table (id uuid, version integer, status text, name text, reward jsonb, eligibility jsonb, schedule jsonb, limits jsonb, channels jsonb,
               rules_text text[], link text, detail text, runs text, author text, is_mine boolean, submitted_at timestamptz, decided_by text,
               decided_at timestamptz, rejected_reason text, simulation jsonb, simulated_terms jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.version, v.status, v.name, v.reward, v.eligibility, v.schedule, v.limits, v.channels, v.rules_text, v.link, v.detail, v.runs,
         a.full_name, coalesce(v.author_staff_id = private.current_staff_id(v.venue_id) or v.edited_by_staff_id = private.current_staff_id(v.venue_id), false),
         v.submitted_at, d.full_name, v.decided_at, v.rejected_reason, v.simulation, v.simulated_terms
  from public.promotion_version v
  left join public.staff a on a.id = v.author_staff_id
  left join public.staff d on d.id = v.decided_by_staff_id
  where v.promotion_id = p_promotion_id and private.has_permission(v.venue_id, 'promotions.manage')
  order by v.version desc;
$$;

-- What promotions gave a member, newest first, for the member's record (Visits): staff who read members.
create function private.member_promotion_grants(p_member_id uuid)
returns table (grant_id uuid, granted_at timestamptz, club_day date, promotion_name text, version integer, points bigint, chips bigint, spins integer,
               perk text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.created_at, g.club_day, coalesce(v.name, p.name), v.version, g.points, g.chips, g.spins, g.perk
  from public.promotion_grant g
  join public.promotion p on p.id = g.promotion_id
  left join public.promotion_version v on v.id = g.promotion_version_id
  where g.member_id = p_member_id and private.has_permission(g.venue_id, 'members.read')
  order by g.created_at desc, g.id
  limit 200;
$$;

-- The console's calls: security-invoker wrappers over the functions above, which make every check.
create function public.save_promotion_draft(p_venue_id uuid, p_draft jsonb, p_promotion_id uuid default null)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.save_promotion_draft(p_venue_id, p_draft, p_promotion_id); $$;
create function public.record_promotion_simulation(p_version_id uuid, p_simulation jsonb, p_terms jsonb)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.record_promotion_simulation(p_version_id, p_simulation, p_terms); $$;
create function public.submit_promotion_version(p_version_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.submit_promotion_version(p_version_id); $$;
create function public.approve_promotion_version(p_version_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.approve_promotion_version(p_version_id); $$;
create function public.reject_promotion_version(p_version_id uuid, p_reason text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.reject_promotion_version(p_version_id, p_reason); $$;
create function public.set_promotion_version_live(p_version_id uuid, p_is_live boolean)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_promotion_version_live(p_version_id, p_is_live); $$;
create function public.end_promotion_version(p_version_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.end_promotion_version(p_version_id); $$;
create function public.promotions_overview(p_venue_id uuid)
returns table (promotion_id uuid, template_key text, status text, name text, detail text, runs text, current_version_id uuid,
               current_status text, open_version_id uuid, open_status text, rejected_reason text, reward jsonb, eligibility jsonb, schedule jsonb,
               limits jsonb, channels jsonb, given_this_week bigint, is_legacy boolean, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.promotions_overview(p_venue_id); $$;
create function public.promotion_versions_of(p_promotion_id uuid)
returns table (id uuid, version integer, status text, name text, reward jsonb, eligibility jsonb, schedule jsonb, limits jsonb, channels jsonb,
               rules_text text[], link text, detail text, runs text, author text, is_mine boolean, submitted_at timestamptz, decided_by text,
               decided_at timestamptz, rejected_reason text, simulation jsonb, simulated_terms jsonb)
language sql stable security invoker set search_path = ''
as $$ select * from private.promotion_versions_of(p_promotion_id); $$;
create function public.member_promotion_grants(p_member_id uuid)
returns table (grant_id uuid, granted_at timestamptz, club_day date, promotion_name text, version integer, points bigint, chips bigint, spins integer,
               perk text)
language sql stable security invoker set search_path = ''
as $$ select * from private.member_promotion_grants(p_member_id); $$;

revoke execute on function private.sync_promotion(uuid), private.guard_versioned_promotion(), private.version_terms(public.promotion_version),
  private.insert_promotion_version(public.promotion, integer, jsonb, uuid), private.lock_promotion_version(uuid, text), private.advance_promotions()
  from public, anon, authenticated;
revoke execute on function private.save_promotion_draft(uuid, jsonb, uuid), private.record_promotion_simulation(uuid, jsonb, jsonb),
  private.submit_promotion_version(uuid), private.approve_promotion_version(uuid), private.reject_promotion_version(uuid, text),
  private.set_promotion_version_live(uuid, boolean), private.end_promotion_version(uuid), private.promotions_overview(uuid),
  private.promotion_versions_of(uuid), private.member_promotion_grants(uuid),
  public.save_promotion_draft(uuid, jsonb, uuid), public.record_promotion_simulation(uuid, jsonb, jsonb), public.submit_promotion_version(uuid),
  public.approve_promotion_version(uuid), public.reject_promotion_version(uuid, text), public.set_promotion_version_live(uuid, boolean),
  public.end_promotion_version(uuid), public.promotions_overview(uuid), public.promotion_versions_of(uuid), public.member_promotion_grants(uuid)
  from public, anon;
grant execute on function private.save_promotion_draft(uuid, jsonb, uuid), private.record_promotion_simulation(uuid, jsonb, jsonb),
  private.submit_promotion_version(uuid), private.approve_promotion_version(uuid), private.reject_promotion_version(uuid, text),
  private.set_promotion_version_live(uuid, boolean), private.end_promotion_version(uuid), private.promotions_overview(uuid),
  private.promotion_versions_of(uuid), private.member_promotion_grants(uuid),
  public.save_promotion_draft(uuid, jsonb, uuid), public.record_promotion_simulation(uuid, jsonb, jsonb), public.submit_promotion_version(uuid),
  public.approve_promotion_version(uuid), public.reject_promotion_version(uuid, text), public.set_promotion_version_live(uuid, boolean),
  public.end_promotion_version(uuid), public.promotions_overview(uuid), public.promotion_versions_of(uuid), public.member_promotion_grants(uuid)
  to authenticated;
