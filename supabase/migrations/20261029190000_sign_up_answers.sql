-- Sign-up asks more (#631; owner's feedback doc of 29 Oct): beside the phone they signed in with and their name, an
-- optional photo, the city, what best describes the member (one choice) and when they usually play (any of). The answers
-- are the member's preferences. The photo sits with their identity images in the private kyc bucket, so erasure and the
-- venue purge remove it with them, and staff see it as they see a KYC image (kyc-image-url). Only the kyc Edge Function
-- writes it, as it writes the selfie: a JPEG without its metadata, once begin_sign_up_photo allows it.

alter table public.member_preference
  add column city text check (city is null or (length(city) between 2 and 60 and city ~ '^[A-Za-z][A-Za-z .''-]*$')),
  add column occupation text check (occupation in ('salaried', 'business_owner', 'independent_professional', 'student', 'homemaker',
                                                   'retired', 'prefer_not_to_say')),
  add column play_times text[] not null default '{}'
    check (play_times <@ array['weekday_afternoons', 'weekday_evenings', 'late_night', 'weekends']::text[] and cardinality(play_times) <= 4);

insert into private.member_export_column (table_name, column_name, kind) values
  ('member_preference', 'city', 'owed'), ('member_preference', 'occupation', 'owed'), ('member_preference', 'play_times', 'owed');

-- The member's sign-up answers, saved once sign_up has made them a member, and changed the same way. The city in English
-- letters; the occupation and the times from the lists above. Refusals: 42501 not a member, 22023 an answer that does not
-- fit, RVMBR/RVFRZ the member or the venue frozen.
create function private.set_my_sign_up_answers(p_city text, p_occupation text, p_play_times text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
  v_venue_id uuid := private.current_member_venue_id();
  v_city text := btrim(regexp_replace(coalesce(p_city, ''), '\s+', ' ', 'g'));
  v_times text[] := array(select distinct x from unnest(coalesce(p_play_times, '{}')) x order by 1);
begin
  if v_member_id is null then
    raise exception 'Only a member answers' using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id, null, v_member_id);
  if v_city = '' or p_occupation is null then
    raise exception 'The city and what best describes you are needed' using errcode = '22023';
  end if;
  begin
    insert into public.member_preference (member_id, venue_id, city, occupation, play_times)
    values (v_member_id, v_venue_id, v_city, p_occupation, v_times)
    on conflict (member_id) do update set city = excluded.city, occupation = excluded.occupation, play_times = excluded.play_times;
  exception when check_violation then
    raise exception 'Answer from the lists' using errcode = '22023';
  end;
end;
$$;
create function public.set_my_sign_up_answers(p_city text, p_occupation text, p_play_times text[])
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_my_sign_up_answers(p_city, p_occupation, p_play_times); $$;

revoke execute on function private.set_my_sign_up_answers(text, text, text[]), public.set_my_sign_up_answers(text, text, text[]) from public, anon;
grant execute on function private.set_my_sign_up_answers(text, text, text[]), public.set_my_sign_up_answers(text, text, text[]) to authenticated;

-- Asked as the member by the kyc Edge Function before it stores their sign-up photo, <venue>/<member>/photo.jpg: true while
-- they have none, false once they have one, which is kept. Refusals: 42501 not a member (an erased one is none),
-- RVKIL/RVFRZ/RVMBR sign-up switched off, the venue or the member frozen.
create function private.begin_sign_up_photo()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
  v_venue_id uuid := private.current_member_venue_id();
begin
  if v_member_id is null then
    raise exception 'Only a member adds a photo' using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id, 'kyc_signup', v_member_id);
  return not exists (select 1 from storage.objects o where o.bucket_id = 'kyc' and o.name = v_venue_id || '/' || v_member_id || '/photo.jpg');
end;
$$;
create function public.begin_sign_up_photo()
returns boolean language sql volatile security invoker set search_path = ''
as $$ select private.begin_sign_up_photo(); $$;

revoke execute on function private.begin_sign_up_photo(), public.begin_sign_up_photo() from public, anon;
grant execute on function private.begin_sign_up_photo(), public.begin_sign_up_photo() to authenticated;

-- The practice venue's seed is taken again with the columns this batch added (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
