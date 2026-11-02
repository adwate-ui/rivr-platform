-- The owner hears of a visit rated 1 or 2, an in-person check that failed its recheck, and a break taken while seated
-- (decision 0301).

-- The owner hears of a visit rated 1 or 2, alone or in any part of a detailed form, once a member a night however many
-- forms they send; the General Manager's ticket is made as before. The alert names the feedback, never the member nor
-- what they wrote.
create function private.alert_low_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.score <= 2 or exists (select 1 from jsonb_each(coalesce(new.ratings, '{}'::jsonb)) r (k, v) where r.v::text in ('1', '2')))
     and not exists (select 1 from public.alert a join public.feedback f on f.id = (a.detail ->> 'feedback_id')::uuid
                     where a.venue_id = new.venue_id and a.kind = 'feedback.low_rating' and f.member_id = new.member_id
                       and a.created_at >= private.tonight_began(now())) then
    perform private.raise_alert(new.venue_id, 'feedback.low_rating', jsonb_build_object('feedback_id', new.id));
  end if;
  return null;
end;
$$;

create trigger alert_low_rating after insert on public.feedback
  for each row execute function private.alert_low_rating();

-- An in-person check that failed its PAN recheck goes back to review, and the member is seated nowhere until it is
-- decided: the owner hears of it, as the member was playing yesterday. A check is rechecked once, so it alerts once; the
-- alert names the check, not the member.
create function private.alert_kyc_recheck_failed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.raise_alert(new.venue_id, 'kyc.recheck_failed', jsonb_build_object('kyc_record_id', new.id));
  return null;
end;
$$;

create trigger alert_kyc_recheck_failed after update of status on public.kyc_record
  for each row when (old.status = 'verified' and new.status = 'needs_review' and new.pan_recheck is distinct from old.pan_recheck
                     and new.pan_recheck <> 'matched')
  execute function private.alert_kyc_recheck_failed();

-- A break keeps no one from a seat they already hold: the owner hears of a break that starts while the member is seated,
-- once: a break that lengthens one already running is no new break. The alert names the break, not the member.
create function private.alert_break_while_seated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.seat_session s where s.member_id = new.member_id and s.ended_at is null)
     and not exists (select 1 from public.self_exclusion b where b.member_id = new.member_id and b.id <> new.id
                     and b.starts_at <= new.starts_at and b.ends_at > new.starts_at) then
    perform private.raise_alert(new.venue_id, 'member.break_while_seated', jsonb_build_object('break_id', new.id));
  end if;
  return null;
end;
$$;

create trigger alert_break_while_seated after insert on public.self_exclusion
  for each row execute function private.alert_break_while_seated();

revoke execute on function private.alert_low_rating(), private.alert_kyc_recheck_failed(), private.alert_break_while_seated()
  from public, anon, authenticated;
