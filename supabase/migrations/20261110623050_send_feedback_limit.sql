-- A note from Profile, limited as the app's other two forms are (8 Nov audit, security review of I-64): the list cap that used to
-- contain an endless sender is gone. As 20261026100100_feedback.sql made it, with the limit of 20261029140000_feedback_forms.sql.
create or replace function private.send_feedback(p_note text)
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
  if (select count(*) from public.feedback f where f.member_id = v_member.id and f.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Ten notes an hour at most. Try again later.' using errcode = 'RVRAT';
  end if;
  insert into public.feedback (venue_id, member_id, note) values (v_member.venue_id, v_member.id, trim(p_note)) returning id into v_id;
  return v_id;
end;
$$;
