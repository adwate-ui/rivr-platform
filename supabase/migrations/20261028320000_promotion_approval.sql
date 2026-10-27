-- A promotion waits for a super admin (#144; question #507, the owner's answers of 27 Oct; decision 0244). Staff who
-- manage promotions submit one, from the builder or a template; it goes live only when a super admin approves it, and
-- never on the word of the one who submitted it. A refused one goes back to draft. The direct table writes that let a
-- promotions manager insert a live promotion are closed: promotions, their rules and budgets change only through the
-- functions here and the engine.

insert into public.role_permission (role, permission)
select 'super_admin', permission
from unnest(array['promotions.approve']) as permission;

alter table public.role_permission drop constraint super_admin_only_permissions;
alter table public.role_permission add constraint super_admin_only_permissions check (
  role = 'super_admin'
  or permission not in ('purge.run', 'exports.full', 'control.engage', 'members.override_features', 'venue.configure', 'shareholding.manage',
                        'members.erase', 'promotions.approve')
);

alter table public.promotion
  drop constraint promotion_status_check,
  add constraint promotion_status_check check (status in ('draft', 'pending', 'live', 'paused', 'ended')),
  add column requested_by_staff_id uuid references public.staff (id),
  add column requested_at timestamptz,
  add column decided_by_staff_id uuid references public.staff (id),
  add column decided_at timestamptz,
  -- Why a super admin sent it back, for the one who submitted it.
  add column refused_reason text check (refused_reason is null or length(btrim(refused_reason)) between 3 and 300),
  add constraint promotion_pending_has_requester check (status <> 'pending' or (requested_by_staff_id is not null and requested_at is not null));
create index promotion_requested_by_staff_id_idx on public.promotion (requested_by_staff_id);
create index promotion_decided_by_staff_id_idx on public.promotion (decided_by_staff_id);

-- Only the functions below and the engine write promotions, rules and budgets.
revoke insert, update, delete on public.promotion, public.promotion_rule, public.promotion_budget from authenticated;
drop policy "promotion managers add promotions" on public.promotion;
drop policy "promotion managers change promotions" on public.promotion;
drop policy "promotion managers add rules" on public.promotion_rule;
drop policy "promotion managers change rules" on public.promotion_rule;
drop policy "promotion managers remove rules" on public.promotion_rule;
drop policy "promotion managers set budgets" on public.promotion_budget;
drop policy "promotion managers change budgets" on public.promotion_budget;
drop policy "promotion managers remove budgets" on public.promotion_budget;

drop function public.publish_promotion(uuid, jsonb);
drop function private.publish_promotion(uuid, jsonb);
drop function public.publish_promotion_template(uuid);
drop function private.publish_promotion_template(uuid);

-- Submits a promotion from the builder, as publish_promotion made one (20261020180450_promotions_builder.sql): its
-- name and card words, its one rule and a per-player limit, waiting for a super admin.
create function private.submit_promotion(p_venue_id uuid, p_promotion jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'promotions.manage') then
    raise exception 'Only staff who manage promotions submit one' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id, 'promotions');
  if jsonb_typeof(p_promotion -> 'rule') is distinct from 'object' then
    raise exception 'A promotion is submitted with its rule' using errcode = '22023';
  end if;
  insert into public.promotion (venue_id, name, status, detail, runs, per_player_limit, per_player_period, requested_by_staff_id, requested_at)
  values (p_venue_id, btrim(p_promotion ->> 'name'), 'pending', nullif(btrim(p_promotion ->> 'detail'), ''), btrim(p_promotion ->> 'runs'),
          (p_promotion ->> 'per_player_limit')::integer, p_promotion ->> 'per_player_period', private.current_staff_id(p_venue_id), now())
  returning id into v_id;
  insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
  values (p_venue_id, v_id, p_promotion #>> '{rule,trigger}', coalesce(p_promotion #> '{rule,conditions}', '{}'::jsonb), p_promotion #> '{rule,effect}');
  return v_id;
end;
$$;

-- Submits a draft template as it stands, card and rule, as publish_promotion_template published one.
create function private.submit_promotion_template(p_promotion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promotion public.promotion;
begin
  select * into v_promotion from public.promotion p where p.id = p_promotion_id for update;
  if v_promotion.id is null or not private.has_permission(v_promotion.venue_id, 'promotions.manage') then
    raise exception 'Only staff who manage promotions submit one' using errcode = '42501';
  end if;
  perform private.assert_writable(v_promotion.venue_id, 'promotions');
  if v_promotion.template_key is null or v_promotion.status <> 'draft' then
    raise exception 'Only a draft template is submitted this way' using errcode = '22023';
  end if;
  update public.promotion
  set status = 'pending', requested_by_staff_id = private.current_staff_id(v_promotion.venue_id), requested_at = now(),
      decided_by_staff_id = null, decided_at = null, refused_reason = null
  where id = p_promotion_id;
end;
$$;

-- A super admin approves a waiting promotion, never their own: it goes live and is announced, as publishing did.
create function private.approve_promotion(p_promotion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promotion public.promotion;
  v_staff_id uuid;
begin
  select * into v_promotion from public.promotion p where p.id = p_promotion_id for update;
  if v_promotion.id is null or not private.has_permission(v_promotion.venue_id, 'promotions.approve') then
    raise exception 'Only a super admin approves a promotion' using errcode = '42501';
  end if;
  perform private.assert_writable(v_promotion.venue_id, 'promotions');
  if v_promotion.status <> 'pending' then
    raise exception 'This promotion is not waiting: it was already decided' using errcode = 'RVDEC';
  end if;
  v_staff_id := private.current_staff_id(v_promotion.venue_id);
  if v_staff_id is null or v_staff_id = v_promotion.requested_by_staff_id then
    raise exception 'Another super admin approves the promotion you submitted' using errcode = 'RVTWO';
  end if;
  update public.promotion
  set status = 'live', decided_by_staff_id = v_staff_id, decided_at = now(),
      starts_at = now()
  where id = p_promotion_id;
  perform private.emit(v_promotion.venue_id, 'promotion.published',
                       jsonb_build_object('promotion_id', v_promotion.id, 'name', v_promotion.name, 'detail', v_promotion.detail,
                                          'runs', v_promotion.runs),
                       'promotion.published:' || v_promotion.id);
end;
$$;

-- A super admin sends a waiting promotion back to draft, with the reason the one who submitted it reads.
create function private.refuse_promotion(p_promotion_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_promotion public.promotion;
begin
  select * into v_promotion from public.promotion p where p.id = p_promotion_id for update;
  if v_promotion.id is null or not private.has_permission(v_promotion.venue_id, 'promotions.approve') then
    raise exception 'Only a super admin refuses a promotion' using errcode = '42501';
  end if;
  perform private.assert_writable(v_promotion.venue_id, 'promotions');
  if v_promotion.status <> 'pending' then
    raise exception 'This promotion is not waiting: it was already decided' using errcode = 'RVDEC';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 300 then
    raise exception 'A refusal says why, in 3 to 300 characters' using errcode = '22023';
  end if;
  update public.promotion
  set status = 'draft', decided_by_staff_id = private.current_staff_id(v_promotion.venue_id), decided_at = now(),
      refused_reason = btrim(p_reason)
  where id = p_promotion_id;
end;
$$;

-- The venue's promotions waiting for a super admin, oldest first: who submitted each, whether it was the caller, and
-- what each actually does: its rules as stored, its per-member limit and its budget. The approver reads those, not
-- only the card words the submitter typed, which nothing ties to the rule.
create function private.promotions_awaiting_approval(p_venue_id uuid)
returns table (promotion_id uuid, name text, detail text, runs text, template_key text, requested_by text, requested_at timestamptz,
               is_mine boolean, rules jsonb, per_player_limit integer, per_player_period text, budget_paise bigint, budget_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.detail, p.runs, p.template_key, s.full_name, p.requested_at,
         p.requested_by_staff_id = private.current_staff_id(p_venue_id),
         coalesce((select jsonb_agg(jsonb_build_object('trigger', r.trigger, 'conditions', r.conditions, 'effect', r.effect) order by r.position)
                   from public.promotion_rule r where r.promotion_id = p.id), '[]'::jsonb),
         p.per_player_limit, p.per_player_period, b.cap_paise, b.cap_count
  from public.promotion p
  join public.staff s on s.id = p.requested_by_staff_id
  left join public.promotion_budget b on b.promotion_id = p.id
  where p.venue_id = p_venue_id and p.status = 'pending' and private.has_permission(p_venue_id, 'promotions.manage')
  order by p.requested_at, p.id;
$$;

-- The venue's promotions a super admin sent back in the last fortnight, newest first, with the reason: the one who
-- submitted it reads why. A sent-back template is also a draft again under Templates; a builder's is built anew.
create function private.promotions_sent_back(p_venue_id uuid)
returns table (promotion_id uuid, name text, detail text, runs text, template_key text, refused_by text, refused_at timestamptz,
               refused_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, p.detail, p.runs, p.template_key, s.full_name, p.decided_at, p.refused_reason
  from public.promotion p
  join public.staff s on s.id = p.decided_by_staff_id
  where p.venue_id = p_venue_id and p.status = 'draft' and p.refused_reason is not null and p.decided_at > now() - interval '14 days'
    and private.has_permission(p_venue_id, 'promotions.manage')
  order by p.decided_at desc, p.id;
$$;

-- As before (20261021130000_practice_reset.sql), announcing a promotion when it goes live from a draft or once approved.
create or replace function private.announce_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.purging(new.venue_id) then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  perform private.signal_tv(new.venue_id, 'promotions');
  if new.status = 'live' and (tg_op = 'INSERT' or old.status in ('draft', 'pending')) then
    perform private.assert_writable(new.venue_id, 'promotions');
    perform private.emit(new.venue_id, 'promotion.offered',
                         jsonb_build_object('promotion_id', new.id, 'member_id', m.id, 'title', new.name, 'detail', new.detail, 'runs', new.runs),
                         'promotion.offered:' || new.id || ':' || m.id)
    from public.member m
    where m.venue_id = new.venue_id and private.has_consent(m.id, 'marketing') and private.has_feature(m.id, 'promotions.feed')
      and not exists (select 1 from public.control_state c where c.venue_id = new.venue_id and c.level = 'feature_kill'
                      and c.feature = 'marketing_sends' and c.released_at is null);
  end if;
  return null;
end;
$$;

-- The console's calls: security-invoker wrappers over the functions above, which make every check.
create function public.submit_promotion(p_venue_id uuid, p_promotion jsonb)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.submit_promotion(p_venue_id, p_promotion); $$;
create function public.submit_promotion_template(p_promotion_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.submit_promotion_template(p_promotion_id); $$;
create function public.approve_promotion(p_promotion_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.approve_promotion(p_promotion_id); $$;
create function public.refuse_promotion(p_promotion_id uuid, p_reason text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.refuse_promotion(p_promotion_id, p_reason); $$;
create function public.promotions_sent_back(p_venue_id uuid)
returns table (promotion_id uuid, name text, detail text, runs text, template_key text, refused_by text, refused_at timestamptz,
               refused_reason text)
language sql stable security invoker set search_path = ''
as $$ select * from private.promotions_sent_back(p_venue_id); $$;
create function public.promotions_awaiting_approval(p_venue_id uuid)
returns table (promotion_id uuid, name text, detail text, runs text, template_key text, requested_by text, requested_at timestamptz,
               is_mine boolean, rules jsonb, per_player_limit integer, per_player_period text, budget_paise bigint, budget_count integer)
language sql stable security invoker set search_path = ''
as $$ select * from private.promotions_awaiting_approval(p_venue_id); $$;

revoke execute on function private.submit_promotion(uuid, jsonb), private.submit_promotion_template(uuid), private.approve_promotion(uuid),
  private.refuse_promotion(uuid, text), private.promotions_awaiting_approval(uuid), private.promotions_sent_back(uuid),
  public.submit_promotion(uuid, jsonb), public.submit_promotion_template(uuid), public.approve_promotion(uuid),
  public.refuse_promotion(uuid, text), public.promotions_awaiting_approval(uuid), public.promotions_sent_back(uuid) from public, anon;
grant execute on function private.submit_promotion(uuid, jsonb), private.submit_promotion_template(uuid), private.approve_promotion(uuid),
  private.refuse_promotion(uuid, text), private.promotions_awaiting_approval(uuid), private.promotions_sent_back(uuid),
  public.submit_promotion(uuid, jsonb), public.submit_promotion_template(uuid), public.approve_promotion(uuid),
  public.refuse_promotion(uuid, text), public.promotions_awaiting_approval(uuid), public.promotions_sent_back(uuid) to authenticated;

select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
