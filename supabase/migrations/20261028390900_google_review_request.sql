-- A Google review request after a member's third visit (#159; tech plan item 15; additions, "Resolved conflicts"): once
-- per member, whatever their feedback, which it never reads, and with no reward. The venue's review link is a setting,
-- reviews.google_url; with none set, nothing is asked. The WhatsApp consumer sends it as a marketing message, so only to
-- a member who opted in to marketing, and never from the practice venue.
insert into public.setting_key (key, description, scope, value_schema) values
  ('reviews.google_url',
   'The venue''s Google review link, sent once to each member after their third visit, whatever their feedback and with no reward; none set asks for none.',
   'venue',
   '{"type":"object","properties":{"url":{"type":"string","pattern":"^https://","maxLength":500}},"required":["url"],"additionalProperties":false}');

create table public.review_request (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  member_id uuid not null unique,
  -- The third visit, whose close asked.
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

-- When a member's third visit closes, asks once for a review, with the venue's link.
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
     or (select m.erased_at from public.member m where m.id = new.member_id) is not null
     or (select count(*) from public.visit v where v.member_id = new.member_id and v.closed_at is not null) <> 3 then
    return null;
  end if;
  v_url := private.setting_at(new.venue_id, 'reviews.google_url', '', now()) ->> 'url';
  if v_url is null then
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

revoke execute on function private.request_review() from public, anon, authenticated;
