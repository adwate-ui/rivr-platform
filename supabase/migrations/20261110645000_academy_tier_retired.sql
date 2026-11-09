-- The Academy is dropped (owner, 3 Nov), so its tier and its two draft promotions leave the console (audit F-120). Members
-- on the tier move to Member, each with a line in their tier history. A tier is retired and kept, as its history names it;
-- a retired tier is on no chip. Only a draft with no grant is deleted. A tier change that ends never returns a member to a
-- retired tier: they go to the venue's starting tier.
create function private.retire_academy_tier(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_graduate uuid := (select t.id from public.tier t where t.venue_id = p_venue_id and t.name = 'Academy graduate' and not t.is_retired);
  v_member uuid := (select t.id from public.tier t where t.venue_id = p_venue_id and t.name = 'Member');
  v_drafts uuid[];
begin
  if v_graduate is null or v_member is null then
    return;
  end if;
  -- is_expiry marks a change no staff member made.
  insert into public.member_tier_change (venue_id, member_id, from_tier_id, to_tier_id, reason, is_expiry)
  select m.venue_id, m.id, v_graduate, v_member, 'The Academy is no longer offered', true
  from public.member m where m.venue_id = p_venue_id and m.tier_id = v_graduate;
  update public.member m set tier_id = v_member where m.venue_id = p_venue_id and m.tier_id = v_graduate;
  update public.tier t set is_retired = true where t.id = v_graduate;

  v_drafts := array(
    select p.id from public.promotion p
    where p.venue_id = p_venue_id and p.status = 'draft' and p.template_key in ('graduate_first_buy_in', 'graduate_freeroll')
      and not exists (select 1 from public.promotion_grant g where g.promotion_id = p.id)
      and not exists (select 1 from public.promotion_version v where v.promotion_id = p.id and v.status <> 'draft'));
  delete from public.promotion_version v where v.promotion_id = any(v_drafts);
  delete from public.promotion_rule r where r.promotion_id = any(v_drafts);
  delete from public.promotion_budget b where b.promotion_id = any(v_drafts);
  delete from public.promotion p where p.id = any(v_drafts);
end;
$$;
revoke execute on function private.retire_academy_tier(uuid) from public, anon, authenticated;

-- As 20261019092800_member_record.sql made it, but for a retired tier: its history can still name one.
create or replace function private.end_tier_changes()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member record;
  v_tier uuid;
  v_was uuid;
begin
  for v_member in
    select distinct c.member_id, c.venue_id from public.member_tier_change c where not c.is_expiry and c.ends_at <= now()
  loop
    select m.tier_id into v_was from public.member m where m.id = v_member.member_id for update;
    v_tier := private.tier_in_force(v_member.member_id, now());
    if exists (select 1 from public.tier t where t.id = v_tier and t.is_retired) then
      v_tier := (private.setting_at(v_member.venue_id, 'tier.default', '', now()) ->> 'tier_id')::uuid;
    end if;
    continue when v_tier is null or v_tier = v_was;
    update public.member set tier_id = v_tier where id = v_member.member_id;
    insert into public.member_tier_change (venue_id, member_id, from_tier_id, to_tier_id, reason, is_expiry)
    values (v_member.venue_id, v_member.member_id, v_was, v_tier, 'The change ended', true);
  end loop;
end;
$$;

select private.retire_academy_tier(v.id) from public.venue v;
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
