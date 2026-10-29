-- Feedback in two forms (owner, 29 Oct, #637), in Profile where the Academy was. Quick: one topic (gameplay, the
-- dealer, check-in and check-out, the app, service, the ambience or the cashier) and what the member writes. Detailed:
-- the gameplay, cashier, service and ambience each rated 1 to 5, how likely they are to recommend the club (0 to 10, the
-- NPS question), and an open answer if they like. Each is a ticket for the General Manager, as a note from Profile is.
-- A visit's rating and a plain note stay as they were (20261026100100_feedback.sql).

-- The detailed form's ratings: exactly these four, each a whole 1 to 5.
create function private.is_feedback_ratings(p_ratings jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_ratings) = 'object'
    and (select array_agg(k order by k) from jsonb_object_keys(p_ratings) k) = array['ambience', 'cashier', 'gameplay', 'service']
    and (select bool_and(jsonb_typeof(v) = 'number' and v::text in ('1', '2', '3', '4', '5')) from jsonb_each(p_ratings) e (k, v));
$$;

alter table public.feedback
  add column topic text check (topic in ('gameplay', 'dealer', 'check_in_out', 'app', 'service', 'ambience', 'cashier')),
  add column ratings jsonb check (ratings is null or private.is_feedback_ratings(ratings)),
  add column nps smallint check (nps between 0 and 10);

comment on column public.feedback.topic is 'The quick form''s topic (#637); null otherwise.';
comment on column public.feedback.ratings is 'The detailed form''s ratings, 1 to 5: gameplay, cashier, service and ambience (#637).';
comment on column public.feedback.nps is 'The detailed form''s answer to how likely the member is to recommend the club, 0 to 10 (#637).';

-- A visit's rating has a score; a detailed form its ratings and NPS, a note if the member likes; any other a note, with
-- the quick form's topic.
alter table public.feedback drop constraint feedback_check;
alter table public.feedback add constraint feedback_form_check check (
  case
    when visit_id is not null then score is not null and topic is null and ratings is null and nps is null
    when ratings is not null then nps is not null and score is null and topic is null
    else note is not null and score is null and nps is null
  end
);

-- A member's export (#498) lists every column: their answers are theirs.
insert into private.member_export_column (table_name, column_name, kind) values
  ('feedback', 'topic', 'owed'), ('feedback', 'ratings', 'owed'), ('feedback', 'nps', 'owed');

-- The quick form. Refusals: 42501 not a member; 22023 no such topic, or an empty or long note; RVFRZ/RVMBR a freeze.
create function private.send_quick_feedback(p_topic text, p_note text)
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
  if coalesce(p_topic, '') not in ('gameplay', 'dealer', 'check_in_out', 'app', 'service', 'ambience', 'cashier')
     or length(trim(coalesce(p_note, ''))) not between 1 and 1000 then
    raise exception 'A topic, and a note of 1 to 1,000 characters' using errcode = '22023';
  end if;
  perform private.assert_writable(v_member.venue_id, null, v_member.id);
  if (select count(*) from public.feedback f where f.member_id = v_member.id and f.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Ten notes an hour at most. Try again later.' using errcode = 'RVRAT';
  end if;
  insert into public.feedback (venue_id, member_id, topic, note) values (v_member.venue_id, v_member.id, p_topic, trim(p_note))
  returning id into v_id;
  return v_id;
end;
$$;

-- The detailed form. Refusals: 42501 not a member; 22023 ratings not the four 1 to 5, an NPS outside 0 to 10, or a long
-- note; RVFRZ/RVMBR a freeze.
create function private.send_detailed_feedback(p_ratings jsonb, p_nps integer, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_id uuid;
begin
  select * into v_member from public.member m where m.id = (select private.current_member_id());
  if v_member.id is null then
    raise exception 'Only a member sends the club feedback' using errcode = '42501';
  end if;
  if p_ratings is null or not private.is_feedback_ratings(p_ratings) or coalesce(p_nps, -1) not between 0 and 10
     or length(coalesce(v_note, '')) > 1000 then
    raise exception 'The four ratings 1 to 5, an answer 0 to 10, and a note of at most 1,000 characters' using errcode = '22023';
  end if;
  perform private.assert_writable(v_member.venue_id, null, v_member.id);
  if (select count(*) from public.feedback f where f.member_id = v_member.id and f.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Ten notes an hour at most. Try again later.' using errcode = 'RVRAT';
  end if;
  insert into public.feedback (venue_id, member_id, ratings, nps, note) values (v_member.venue_id, v_member.id, p_ratings, p_nps, v_note)
  returning id into v_id;
  return v_id;
end;
$$;

-- The venue's feedback, as before (20261026100100_feedback.sql), with each form's answers.
drop function public.venue_feedback(uuid);
drop function private.venue_feedback(uuid);
create function private.venue_feedback(p_venue_id uuid)
returns table (id uuid, member_id uuid, full_name text, member_number bigint, visit_closed_at timestamptz, score smallint, note text,
               is_ticket boolean, resolved_at timestamptz, resolved_by text, resolution text, created_at timestamptz,
               topic text, ratings jsonb, nps smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, m.id, m.full_name, m.member_number, v.closed_at, f.score, f.note, f.is_ticket, f.resolved_at, s.full_name, f.resolution,
         f.created_at, f.topic, f.ratings, f.nps
  from public.feedback f
  join public.member m on m.id = f.member_id
  left join public.visit v on v.id = f.visit_id
  left join public.staff s on s.id = f.resolved_by_staff_id
  where f.venue_id = p_venue_id and private.has_permission(p_venue_id, 'feedback.manage')
    and (f.created_at > now() - interval '90 days' or (f.is_ticket and f.resolved_at is null))
  order by (f.is_ticket and f.resolved_at is null) desc, f.created_at desc
  limit 500;
$$;

create function public.send_quick_feedback(p_topic text, p_note text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.send_quick_feedback(p_topic, p_note); $$;
create function public.send_detailed_feedback(p_ratings jsonb, p_nps integer, p_note text)
returns uuid language sql volatile security invoker set search_path = ''
as $$ select private.send_detailed_feedback(p_ratings, p_nps, p_note); $$;
create function public.venue_feedback(p_venue_id uuid)
returns table (id uuid, member_id uuid, full_name text, member_number bigint, visit_closed_at timestamptz, score smallint, note text,
               is_ticket boolean, resolved_at timestamptz, resolved_by text, resolution text, created_at timestamptz,
               topic text, ratings jsonb, nps smallint)
language sql stable security invoker set search_path = ''
as $$ select * from private.venue_feedback(p_venue_id); $$;

revoke execute on function private.send_quick_feedback(text, text), private.send_detailed_feedback(jsonb, integer, text),
  private.venue_feedback(uuid), public.send_quick_feedback(text, text), public.send_detailed_feedback(jsonb, integer, text),
  public.venue_feedback(uuid) from public, anon;
grant execute on function private.send_quick_feedback(text, text), private.send_detailed_feedback(jsonb, integer, text),
  private.venue_feedback(uuid), public.send_quick_feedback(text, text), public.send_detailed_feedback(jsonb, integer, text),
  public.venue_feedback(uuid) to authenticated;
revoke execute on function private.is_feedback_ratings(jsonb) from public, anon;
grant execute on function private.is_feedback_ratings(jsonb) to authenticated;
