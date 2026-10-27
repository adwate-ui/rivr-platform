-- At most one marketing send a day to a member (#501; question #494 item 6, the owner's answer of 27 Oct; decision
-- 0249). Marketing WhatsApp sends today are promotion offers (promotion.offered): a promotion going live offers itself
-- to each member who opted in. A member already offered one this club day (06:00 to 06:00 IST) is not offered a second
-- until the next. The other half of #501, a super admin's approval for a large or unbudgeted bonus promotion, is every
-- promotion's since #144 (decision 0244).

-- As before (20261028320000_promotion_approval.sql), offering a promotion only to members not offered one tonight. One
-- venue's promotions are announced one at a time, so two going live together cannot both offer to the same member.
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
    perform pg_advisory_xact_lock(hashtext('promotion-offers:' || new.venue_id::text));
    perform private.emit(new.venue_id, 'promotion.offered',
                         jsonb_build_object('promotion_id', new.id, 'member_id', m.id, 'title', new.name, 'detail', new.detail, 'runs', new.runs),
                         'promotion.offered:' || new.id || ':' || m.id)
    from public.member m
    where m.venue_id = new.venue_id and private.has_consent(m.id, 'marketing') and private.has_feature(m.id, 'promotions.feed')
      and not exists (select 1 from public.control_state c where c.venue_id = new.venue_id and c.level = 'feature_kill'
                      and c.feature = 'marketing_sends' and c.released_at is null)
      and not exists (select 1 from public.outbox_event e
                      where e.event_type = 'promotion.offered' and e.occurred_at >= private.tonight_began(now())
                        and e.venue_id = new.venue_id and e.payload ->> 'member_id' = m.id::text);
  end if;
  return null;
end;
$$;
