-- Random referral codes and a monthly promotion budget (#562; the owner's answers to #561, 27 Oct).
--
-- A member's referral code is eight letters and digits from an alphabet with no 0, O, 1, I or L, unique across venues,
-- made once and kept: existing members get one here, and every new member one as their row is made. my_referral shows
-- it, and complete_referral looks the code a new member signed up with up by it.
--
-- A promotion's budget is for the whole promotion, as before, or for each calendar month (by the club day of each
-- grant), and a template is submitted with one.

create function private.new_referral_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_code text;
begin
  loop
    select string_agg(substr(v_alphabet, 1 + get_byte(r.bytes, i) % 31, 1), '' order by i) into v_code
    from (select extensions.gen_random_bytes(8) as bytes) r cross join generate_series(0, 7) i;
    exit when not exists (select 1 from public.member m where m.referral_code = v_code);
  end loop;
  return v_code;
end;
$$;

alter table public.member add column referral_code text;
update public.member set referral_code = private.new_referral_code() where referral_code is null;
alter table public.member alter column referral_code set default private.new_referral_code(),
  alter column referral_code set not null,
  add constraint member_referral_code_key unique (referral_code);
insert into private.member_export_column (table_name, column_name, kind) values ('member', 'referral_code', 'owed');

-- As before (20261028390800_referral_programme.sql), with the member's own code.
create or replace function private.my_referral()
returns table (code text, referred integer, bonus_paise bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.referral_code, (select count(*)::integer from public.referral r where r.referrer_member_id = m.id),
         (select (r.effect ->> 'amount_paise')::bigint
          from public.promotion p join public.promotion_rule r on r.promotion_id = p.id
          where p.venue_id = m.venue_id and p.status = 'live' and p.starts_at <= now() and (p.ends_at is null or p.ends_at > now())
            and r.trigger = 'referral' and r.effect ->> 'kind' = 'bonus'
          order by p.created_at
          limit 1)
  from public.member m
  where m.id = private.current_member_id() and m.erased_at is null and private.has_feature(m.id, 'referral.share_cards');
$$;

-- As before (20261028390800_referral_programme.sql), looking the referrer up by their code.
create or replace function private.complete_referral(p_venue_id uuid, p_member_id uuid, p_cage_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referrer public.member;
  v_code text;
  v_id uuid;
begin
  if (select v.is_practice from public.venue v where v.id = p_venue_id)
     or exists (select 1 from public.cage_transaction c
                where c.member_id = p_member_id and c.kind = 'buy_in' and c.id <> p_cage_transaction_id) then
    return;
  end if;
  select upper(btrim(a.referral_code)) into v_code from public.sign_up_attribution a where a.member_id = p_member_id;
  select m.* into v_referrer from public.member m
  where m.venue_id = p_venue_id and m.id <> p_member_id and m.erased_at is null and m.referral_code = v_code
    and private.has_feature(m.id, 'referral.share_cards')
    and not exists (select 1 from public.self_exclusion x where x.member_id = m.id and x.starts_at <= now() and x.ends_at > now());
  if v_referrer.id is null then
    return;
  end if;
  insert into public.referral (venue_id, member_id, referrer_member_id, code)
  values (p_venue_id, p_member_id, v_referrer.id, v_code)
  on conflict (member_id) do nothing
  returning id into v_id;
  if v_id is null then
    return;
  end if;
  perform private.evaluate_promotions(p_venue_id, 'referral', jsonb_build_object('member_id', p_member_id, 'key', 'referral:' || v_id || ':joined'));
  perform private.evaluate_promotions(p_venue_id, 'referral', jsonb_build_object('member_id', v_referrer.id, 'key', 'referral:' || v_id || ':referred'));
  perform private.emit(p_venue_id, 'referral.completed',
                       jsonb_build_object('referral_id', v_id, 'member_id', p_member_id, 'referrer_member_id', v_referrer.id),
                       'referral.completed:' || v_id);
end;
$$;

drop function private.referral_code(bigint);

alter table public.promotion_budget add column period text not null default 'promotion' check (period in ('promotion', 'month'));

-- As before (20261026210000_promotion_hours_in_window.sql), with a monthly budget counting this month's grants only.
create or replace function private.promotion_candidate(p_promotion public.promotion, p_trigger text, p_facts jsonb, p_context jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := (p_context ->> 'member_id')::uuid;
  v_day date := (p_facts ->> 'club_day')::date;
  v_given public.promotion_grant;
  v_rule public.promotion_rule;
  v_window record;
  v_reward record;
  v_budget public.promotion_budget;
begin
  select * into v_given from public.promotion_grant g
  where g.promotion_id = p_promotion.id and g.member_id = v_member_id and g.source_key = p_context ->> 'key';
  if v_given.id is not null then
    return jsonb_build_object('promotion', p_promotion.id, 'stacks', p_promotion.stacks, 'cost_paise', v_given.cost_paise, 'is_given', true);
  end if;
  select r.* into v_rule from public.promotion_rule r
  cross join lateral private.rule_in_window(r.conditions, p_trigger, p_context) w
  where r.promotion_id = p_promotion.id and r.trigger = p_trigger and w.o_counts
    and private.promotion_applies(w.o_conditions, p_facts || w.o_facts || jsonb_build_object(
      'granted_today', (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id and g.club_day = v_day),
      'granted_today_at_table', (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id and g.club_day = v_day
                                 and g.table_id = (p_facts ->> 'table_id')::uuid)))
  order by r.position limit 1;
  if v_rule.id is null then
    return null;
  end if;
  select * into v_window from private.rule_in_window(v_rule.conditions, p_trigger, p_context);
  select * into v_reward from private.promotion_reward(v_rule.effect,
    case when p_context ->> 'method' = 'bonus' then 0 else (p_context ->> 'amount_paise')::bigint end, v_window.o_points);
  if not found then
    return null;
  end if;
  select * into v_budget from public.promotion_budget b where b.promotion_id = p_promotion.id;
  return jsonb_build_object('promotion', p_promotion.id, 'name', p_promotion.name, 'venue_id', p_promotion.venue_id, 'rule', v_rule.id,
    'trigger', v_rule.trigger, 'effect', v_rule.effect, 'stacks', p_promotion.stacks, 'cost_paise', v_reward.cost_paise, 'points', v_reward.points,
    'budget_left_paise', v_budget.cap_paise - (select coalesce(sum(g.cost_paise), 0) from public.promotion_grant g where g.promotion_id = p_promotion.id
                                               and (v_budget.period = 'promotion' or date_trunc('month', g.club_day) = date_trunc('month', v_day))),
    'grants_left', v_budget.cap_count - (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id
                                         and (v_budget.period = 'promotion' or date_trunc('month', g.club_day) = date_trunc('month', v_day))),
    'player_left', p_promotion.per_player_limit - (select count(*) from public.promotion_grant g where g.promotion_id = p_promotion.id
                                                   and g.member_id = v_member_id and (p_promotion.per_player_period = 'promotion' or g.club_day = v_day)));
end;
$$;

-- As before (20261028320000_promotion_approval.sql), with an optional budget in rupees for the whole promotion or each
-- month. A template submitted again replaces its budget.
drop function public.submit_promotion_template(uuid);
drop function private.submit_promotion_template(uuid);
create function private.submit_promotion_template(p_promotion_id uuid, p_budget_paise bigint default null, p_budget_period text default 'promotion')
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
  if p_budget_paise is not null and (p_budget_paise <= 0 or p_budget_period is null or p_budget_period not in ('promotion', 'month')) then
    raise exception 'A budget is more than nothing, for the whole promotion or each month' using errcode = '22023';
  end if;
  delete from public.promotion_budget b where b.promotion_id = p_promotion_id;
  if p_budget_paise is not null then
    insert into public.promotion_budget (venue_id, promotion_id, cap_paise, period)
    values (v_promotion.venue_id, p_promotion_id, p_budget_paise, p_budget_period);
  end if;
  update public.promotion
  set status = 'pending', requested_by_staff_id = private.current_staff_id(v_promotion.venue_id), requested_at = now(),
      decided_by_staff_id = null, decided_at = null, refused_reason = null
  where id = p_promotion_id;
end;
$$;

create function public.submit_promotion_template(p_promotion_id uuid, p_budget_paise bigint default null, p_budget_period text default 'promotion')
returns void language sql volatile security invoker set search_path = ''
as $$ select private.submit_promotion_template(p_promotion_id, p_budget_paise, p_budget_period); $$;

revoke execute on function private.new_referral_code(), private.submit_promotion_template(uuid, bigint, text),
  public.submit_promotion_template(uuid, bigint, text) from public, anon;
revoke execute on function private.new_referral_code() from authenticated;
grant execute on function private.submit_promotion_template(uuid, bigint, text), public.submit_promotion_template(uuid, bigint, text) to authenticated;
