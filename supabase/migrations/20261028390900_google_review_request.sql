-- A Google review request after a member's third visit (#159; tech plan item 15; additions, "Resolved conflicts"): once
-- per member, whatever their feedback, which it never reads, and with no reward. The venue's review link is a setting,
-- reviews.google_url, on Google's own review addresses; with none set, nothing is asked. The WhatsApp consumer sends it
-- as a marketing message, so it keeps the marketing rules (decision 0249): only to a member who opted in, never while
-- marketing sends are switched off, at most one marketing send a club day, and never from the practice venue. Held
-- back, it is asked at a later visit's close. Erasure deletes it.
insert into public.setting_key (key, description, scope, value_schema) values
  ('reviews.google_url',
   'The venue''s Google review link, sent once to each member after their third visit, whatever their feedback and with no reward; none set asks for none.',
   'venue',
   '{"type":"object","properties":{"url":{"type":"string","pattern":"^https:\\/\\/(g\\.page|search\\.google\\.com|www\\.google\\.com|maps\\.google\\.com|maps\\.app\\.goo\\.gl)\\/","maxLength":500}},"required":["url"],"additionalProperties":false}');

create table public.review_request (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  member_id uuid not null unique,
  -- The visit whose close asked: the third, or a later one when no marketing send could go at the third's.
  visit_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (visit_id) references public.visit (id)
);

comment on table public.review_request is 'A Google review asked of a member after their third visit (#159), once each.';

create index review_request_member_idx on public.review_request (member_id, venue_id);
create index review_request_visit_idx on public.review_request (visit_id);

create trigger review_request_touch_updated_at before update on public.review_request
  for each row execute function private.touch_updated_at();
create trigger review_request_audit after insert or update or delete on public.review_request
  for each row execute function private.audit_row_change();

alter table public.review_request enable row level security;
grant select (id, venue_id, member_id, visit_id, created_at, updated_at) on public.review_request to authenticated;
create policy "staff who read members see the venue's review requests" on public.review_request
  for select to authenticated using (venue_id in (select private.venues_where('members.read')));

-- A member's export gives the request whole.
insert into private.member_export_column (table_name, column_name, kind)
select 'review_request', c.column_name, 'owed'
from unnest(array['id', 'venue_id', 'member_id', 'visit_id', 'created_at', 'updated_at']) c (column_name);

-- Whether a marketing message may go to a member now (decision 0249): they opted in, marketing sends are not switched
-- off at the venue, and none went to them this club day (06:00 to 06:00 IST): a promotion offer or a review request.
-- Callers hold the venue's promotion-offers lock, so two sends at once cannot both pass.
create function private.may_send_marketing(p_venue_id uuid, p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_consent(p_member_id, 'marketing')
     and not exists (select 1 from public.control_state c where c.venue_id = p_venue_id and c.level = 'feature_kill'
                     and c.feature = 'marketing_sends' and c.released_at is null)
     and not exists (select 1 from public.outbox_event e
                     where e.event_type in ('promotion.offered', 'review.requested') and e.occurred_at >= private.tonight_began(now())
                       and e.venue_id = p_venue_id and e.payload ->> 'member_id' = p_member_id::text);
$$;

-- As before (20261028380600_one_marketing_send_a_day.sql), with a review request counted in the one marketing send a
-- day, through may_send_marketing.
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
    where m.venue_id = new.venue_id and private.has_feature(m.id, 'promotions.feed') and private.may_send_marketing(new.venue_id, m.id);
  end if;
  return null;
end;
$$;

-- When a member's visit closes, from their third on, asks them once for a review, with the venue's link: at the first
-- such close when a marketing send may go to them.
create function private.request_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_id uuid;
begin
  if (select v.is_practice from public.venue v where v.id = new.venue_id)
     or exists (select 1 from public.review_request r where r.member_id = new.member_id)
     or (select m.erased_at from public.member m where m.id = new.member_id) is not null
     or (select count(*) from public.visit v where v.member_id = new.member_id and v.closed_at is not null) < 3 then
    return null;
  end if;
  v_url := private.setting_at(new.venue_id, 'reviews.google_url', '', now()) ->> 'url';
  if v_url is null then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtext('promotion-offers:' || new.venue_id::text));
  if not private.may_send_marketing(new.venue_id, new.member_id) then
    return null;
  end if;
  insert into public.review_request (venue_id, member_id, visit_id)
  values (new.venue_id, new.member_id, new.id)
  on conflict (member_id) do nothing
  returning id into v_id;
  if v_id is not null then
    perform private.emit(new.venue_id, 'review.requested', jsonb_build_object('review_request_id', v_id, 'member_id', new.member_id, 'url', v_url),
                         'review.requested:' || v_id);
  end if;
  return null;
end;
$$;

create trigger visit_review_request after update of closed_at on public.visit
  for each row when (old.closed_at is null and new.closed_at is not null) execute function private.request_review();

-- As before (20261027130000_member_erasure.sql), with the member's review request.
create or replace function private.delete_member_records(p_member public.member)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.member_preference x where x.member_id = p_member.id;
  delete from public.notification_preference x where x.member_id = p_member.id;
  delete from public.member_limit x where x.member_id = p_member.id;
  delete from public.member_feature_override x where x.member_id = p_member.id;
  delete from public.sign_up_attribution x where x.member_id = p_member.id;
  delete from public.membership_card x where x.member_id = p_member.id;
  delete from public.feedback x where x.member_id = p_member.id;
  delete from public.review_request x where x.member_id = p_member.id;
  delete from public.kyc_review x where x.member_id = p_member.id;
  delete from public.outbox_event x where x.venue_id = p_member.venue_id and x.payload ->> 'member_id' = p_member.id::text;
  delete from public.payout_account p
  where p.member_id = p_member.id
    and not exists (select 1 from public.withdrawal_request w where w.payout_account_id = p.id)
    and not exists (select 1 from public.deposit_request d where d.payout_account_id = p.id);
end;
$$;

revoke execute on function private.request_review(), private.may_send_marketing(uuid, uuid) from public, anon, authenticated;
