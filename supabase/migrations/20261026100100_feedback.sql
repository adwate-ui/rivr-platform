-- Feedback from the player app (owner, 26 Oct 2026; #160, asked in the app rather than by WhatsApp;
-- decision 0165). After a visit closes, Home asks the member how it was: a score of 1 to 5 and a note
-- if they like, once a visit, for a week. Profile sends the club a note at any time. A score of 3 or
-- below, and every note from Profile, is a ticket for the General Manager on the console's Feedback
-- screen (feedback.manage: super_admin and admin), until one of them resolves it with what was done.
-- Feedback is a core feature: every member may give it, whatever their tier. The Google review
-- request after the third visit (#159) never reads it.

insert into public.feature (key, name, description, screens, is_gateable) values
  ('core.feedback', 'Feedback', 'Rating a visit, and sending the club a note.', '{player:home,player:profile}', false);

insert into public.role_permission (role, permission)
select role::public.staff_role, 'feedback.manage' from unnest(array['super_admin', 'admin']) as role;

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  -- The visit rated, once; null for a note sent from Profile.
  visit_id uuid unique references public.visit (id),
  score smallint check (score between 1 and 5),
  note text check (note is null or length(trim(note)) between 1 and 1000),
  -- A ticket for the General Manager: a score of 3 or below, or a note from Profile.
  is_ticket boolean generated always as (coalesce(score <= 3, true)) stored,
  resolved_at timestamptz,
  resolved_by_staff_id uuid,
  resolution text check (resolution is null or length(trim(resolution)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  foreign key (resolved_by_staff_id, venue_id) references public.staff (id, venue_id),
  -- A visit's rating has a score; a note from Profile says something.
  check (case when visit_id is null then note is not null and score is null else score is not null end),
  check ((resolved_at is null) = (resolved_by_staff_id is null) and (resolved_at is null) = (resolution is null))
);

comment on table public.feedback is 'A member''s rating of a visit, or a note sent from the app; the low ones are tickets (#160).';

create index feedback_venue_open_idx on public.feedback (venue_id, created_at) where is_ticket and resolved_at is null;
create index feedback_member_venue_idx on public.feedback (member_id, venue_id);
create index feedback_staff_venue_idx on public.feedback (resolved_by_staff_id, venue_id);
create trigger feedback_touch_updated_at before update on public.feedback
  for each row execute function private.touch_updated_at();
create trigger feedback_audit after insert or update or delete on public.feedback
  for each row execute function private.audit_row_change();
alter table public.feedback enable row level security;
grant select on public.feedback to authenticated;

create policy "members see their own feedback" on public.feedback
  for select to authenticated using (member_id = (select private.current_member_id()));
create policy "the General Manager sees the venue's feedback" on public.feedback
  for select to authenticated using (venue_id in (select private.venues_where('feedback.manage')));

-- The visit Home asks the signed-in member about: their last visit, closed within the week, not yet
-- rated. Nothing while they are in the club, or when the last one is rated.
create function private.my_feedback_visit()
returns table (visit_id uuid, closed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.closed_at
  from (select * from public.visit v where v.member_id = (select private.current_member_id())
        order by v.opened_at desc limit 1) v
  where v.closed_at is not null and v.closed_at > now() - interval '7 days'
    and not exists (select 1 from public.feedback f where f.visit_id = v.id);
$$;

-- The member rates their visit: 1 to 5, with a note if they like. Refusals: 42501 not their visit or
-- not a member, 22023 a score outside 1 to 5 or a note too long, RVDUP rated already, RVOLD a visit
-- still open or closed more than a week ago, RVFRZ/RVMBR the venue or the member frozen.
create function private.rate_visit(p_visit_id uuid, p_score integer, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_visit public.visit;
  v_id uuid;
begin
  select * into v_visit from public.visit v where v.id = p_visit_id and v.member_id = (select private.current_member_id());
  if v_visit.id is null then
    raise exception 'Only the member rates their own visit' using errcode = '42501';
  end if;
  if p_score is null or p_score not between 1 and 5 or length(trim(coalesce(p_note, ''))) > 1000 then
    raise exception 'A score of 1 to 5, and a note of at most 1,000 characters' using errcode = '22023';
  end if;
  if v_visit.closed_at is null or v_visit.closed_at <= now() - interval '7 days' then
    raise exception 'A visit is rated in the week after it closes' using errcode = 'RVOLD';
  end if;
  perform private.assert_writable(v_visit.venue_id, null, v_visit.member_id);
  insert into public.feedback (venue_id, member_id, visit_id, score, note)
  values (v_visit.venue_id, v_visit.member_id, v_visit.id, p_score, nullif(trim(coalesce(p_note, '')), ''))
  on conflict (visit_id) do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'That visit is rated already' using errcode = 'RVDUP';
  end if;
  return v_id;
end;
$$;

-- The member sends the club a note from Profile: a ticket for the General Manager. Refusals as
-- rate_visit's, and 22023 for an empty note.
create function private.send_feedback(p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_id uuid;
begin
  select * into v_member from public.member m where m.id = (select private.current_member_id());
  if v_member.id is null then
    raise exception 'Only a member sends the club feedback' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_note, ''))) not between 1 and 1000 then
    raise exception 'A note of 1 to 1,000 characters' using errcode = '22023';
  end if;
  perform private.assert_writable(v_member.venue_id, null, v_member.id);
  insert into public.feedback (venue_id, member_id, note) values (v_member.venue_id, v_member.id, trim(p_note)) returning id into v_id;
  return v_id;
end;
$$;

-- The venue's feedback for the General Manager (feedback.manage), newest first: the tickets still open
-- first, then the rest of the last 90 days.
create function private.venue_feedback(p_venue_id uuid)
returns table (id uuid, member_id uuid, full_name text, member_number bigint, visit_closed_at timestamptz, score smallint, note text,
               is_ticket boolean, resolved_at timestamptz, resolved_by text, resolution text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, m.id, m.full_name, m.member_number, v.closed_at, f.score, f.note, f.is_ticket, f.resolved_at, s.full_name, f.resolution, f.created_at
  from public.feedback f
  join public.member m on m.id = f.member_id
  left join public.visit v on v.id = f.visit_id
  left join public.staff s on s.id = f.resolved_by_staff_id
  where f.venue_id = p_venue_id and private.has_permission(p_venue_id, 'feedback.manage')
    and (f.created_at > now() - interval '90 days' or (f.is_ticket and f.resolved_at is null))
  order by (f.is_ticket and f.resolved_at is null) desc, f.created_at desc
  limit 500;
$$;

-- The General Manager resolves a ticket with what was done. Refusals: 42501 not feedback.manage,
-- 22023 not a ticket, resolved already, or no resolution given, RVFRZ the venue frozen.
create function private.resolve_feedback(p_feedback_id uuid, p_resolution text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_feedback public.feedback;
begin
  select * into v_feedback from public.feedback f where f.id = p_feedback_id for update;
  if v_feedback.id is null or not private.has_permission(v_feedback.venue_id, 'feedback.manage') then
    raise exception 'Only the General Manager resolves feedback' using errcode = '42501';
  end if;
  if not v_feedback.is_ticket or v_feedback.resolved_at is not null or length(trim(coalesce(p_resolution, ''))) not between 1 and 500 then
    raise exception 'An open ticket, resolved with what was done in at most 500 characters' using errcode = '22023';
  end if;
  perform private.assert_writable(v_feedback.venue_id);
  update public.feedback
  set resolved_at = now(), resolved_by_staff_id = private.current_staff_id(v_feedback.venue_id), resolution = trim(p_resolution)
  where id = v_feedback.id;
end;
$$;

create function public.my_feedback_visit()
returns table (visit_id uuid, closed_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_feedback_visit(); $$;
create function public.rate_visit(p_visit_id uuid, p_score integer, p_note text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.rate_visit(p_visit_id, p_score, p_note); $$;
create function public.send_feedback(p_note text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.send_feedback(p_note); $$;
create function public.venue_feedback(p_venue_id uuid)
returns table (id uuid, member_id uuid, full_name text, member_number bigint, visit_closed_at timestamptz, score smallint, note text,
               is_ticket boolean, resolved_at timestamptz, resolved_by text, resolution text, created_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_feedback(p_venue_id); $$;
create function public.resolve_feedback(p_feedback_id uuid, p_resolution text)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.resolve_feedback(p_feedback_id, p_resolution); $$;

revoke execute on function private.my_feedback_visit(), private.rate_visit(uuid, integer, text), private.send_feedback(text),
  private.venue_feedback(uuid), private.resolve_feedback(uuid, text) from public, anon;
grant execute on function private.my_feedback_visit(), private.rate_visit(uuid, integer, text), private.send_feedback(text),
  private.venue_feedback(uuid), private.resolve_feedback(uuid, text) to authenticated;
revoke execute on function public.my_feedback_visit(), public.rate_visit(uuid, integer, text), public.send_feedback(text),
  public.venue_feedback(uuid), public.resolve_feedback(uuid, text) from public, anon;
grant execute on function public.my_feedback_visit(), public.rate_visit(uuid, integer, text), public.send_feedback(text),
  public.venue_feedback(uuid), public.resolve_feedback(uuid, text) to authenticated;
