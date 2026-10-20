-- The promotions builder (#84; design prompt Promotions and flow 7). A promotion now carries its
-- card's words as the builder wrote them: what
-- it gives (`detail`) and who and when (`runs`), for the player card, the TV slide and the WhatsApp
-- message (#86). Staff who manage promotions publish one with its rule in a single step, which goes
-- live at once and sends promotion.published, and pause and resume a live one; neither while the
-- venue is frozen or promotions are switched off. Completed call time (#80) is the next migration.

alter table public.promotion
  add column detail text check (detail is null or length(btrim(detail)) between 1 and 200),
  add column runs text check (runs is null or length(btrim(runs)) between 1 and 120),
  drop constraint promotion_status_check,
  add constraint promotion_status_check check (status in ('draft', 'live', 'paused', 'ended'));
grant update (detail, runs) on public.promotion to authenticated;

-- Publishes a promotion from the builder: its name and card words, its one rule (trigger, conditions,
-- effect, checked as promotion_rule checks them) and a per-player limit, live from now. Staff who
-- manage promotions only; not while the venue is frozen or promotions are switched off.
create function public.publish_promotion(p_venue_id uuid, p_promotion jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'promotions.manage') then
    raise exception 'Only staff who manage promotions publish one' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id, 'promotions');
  if jsonb_typeof(p_promotion -> 'rule') is distinct from 'object' then
    raise exception 'A promotion is published with its rule' using errcode = '22023';
  end if;
  insert into public.promotion (venue_id, name, status, detail, runs, per_player_limit, per_player_period)
  values (p_venue_id, btrim(p_promotion ->> 'name'), 'live', nullif(btrim(p_promotion ->> 'detail'), ''), btrim(p_promotion ->> 'runs'),
          (p_promotion ->> 'per_player_limit')::integer, p_promotion ->> 'per_player_period')
  returning id into v_id;
  insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
  values (p_venue_id, v_id, p_promotion #>> '{rule,trigger}', coalesce(p_promotion #> '{rule,conditions}', '{}'::jsonb), p_promotion #> '{rule,effect}');
  perform private.emit(p_venue_id, 'promotion.published',
                       jsonb_build_object('promotion_id', v_id, 'name', btrim(p_promotion ->> 'name'),
                                          'detail', nullif(btrim(p_promotion ->> 'detail'), ''), 'runs', btrim(p_promotion ->> 'runs')),
                       'promotion.published:' || v_id);
  return v_id;
end;
$$;

revoke execute on function public.publish_promotion(uuid, jsonb) from public, anon;
grant execute on function public.publish_promotion(uuid, jsonb) to authenticated;


-- Pauses a live promotion or resumes a paused one: nothing is given while paused. Staff who manage
-- promotions at its venue; not while the venue is frozen or promotions are switched off. Status
-- changes only through here, so the kill switch holds.
create function public.set_promotion_live(p_promotion_id uuid, p_is_live boolean)
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
    raise exception 'Only staff who manage promotions pause or resume one' using errcode = '42501';
  end if;
  perform private.assert_writable(v_promotion.venue_id, 'promotions');
  if p_is_live is null or (p_is_live and v_promotion.status <> 'paused') or (not p_is_live and v_promotion.status <> 'live') then
    raise exception 'Only a live promotion is paused, and only a paused one resumed' using errcode = '22023';
  end if;
  if p_is_live then
    update public.promotion set status = 'live' where id = p_promotion_id;
  else
    update public.promotion set status = 'paused' where id = p_promotion_id;
  end if;
end;
$$;

revoke update (status) on public.promotion from authenticated;
revoke execute on function public.set_promotion_live(uuid, boolean) from public, anon;
grant execute on function public.set_promotion_live(uuid, boolean) to authenticated;
