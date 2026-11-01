-- Sign-up asks one more question (#653; the owner, 1 Nov): the games the member plays, any of poker, PLO, bomb pots and
-- ROE (a round of each). Kept with the other sign-up answers (#631), and in the member's export.

alter table public.member_preference
  add column games_played text[] not null default '{}'
    check (games_played <@ array['poker', 'plo', 'bomb', 'roe']::text[] and cardinality(games_played) <= 4);

insert into private.member_export_column (table_name, column_name, kind) values ('member_preference', 'games_played', 'owed');

-- As in 20261029190000_sign_up_answers.sql, with the games played.
drop function public.set_my_sign_up_answers(text, text, text[]);
drop function private.set_my_sign_up_answers(text, text, text[]);
create function private.set_my_sign_up_answers(p_city text, p_occupation text, p_play_times text[], p_games_played text[] default '{}')
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
  v_games text[] := array(select distinct x from unnest(coalesce(p_games_played, '{}')) x order by 1);
begin
  if v_member_id is null then
    raise exception 'Only a member answers' using errcode = '42501';
  end if;
  perform private.assert_writable(v_venue_id, null, v_member_id);
  if v_city = '' or p_occupation is null then
    raise exception 'The city and what best describes you are needed' using errcode = '22023';
  end if;
  begin
    insert into public.member_preference (member_id, venue_id, city, occupation, play_times, games_played)
    values (v_member_id, v_venue_id, v_city, p_occupation, v_times, v_games)
    on conflict (member_id) do update
    set city = excluded.city, occupation = excluded.occupation, play_times = excluded.play_times, games_played = excluded.games_played;
  exception when check_violation then
    raise exception 'Answer from the lists' using errcode = '22023';
  end;
end;
$$;
create function public.set_my_sign_up_answers(p_city text, p_occupation text, p_play_times text[], p_games_played text[] default '{}')
returns void language sql volatile security invoker set search_path = ''
as $$ select private.set_my_sign_up_answers(p_city, p_occupation, p_play_times, p_games_played); $$;

revoke execute on function private.set_my_sign_up_answers(text, text, text[], text[]), public.set_my_sign_up_answers(text, text, text[], text[])
  from public, anon;
grant execute on function private.set_my_sign_up_answers(text, text, text[], text[]), public.set_my_sign_up_answers(text, text, text[], text[])
  to authenticated;

-- The practice venue's seed is taken again with the new column (decision 0117).
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
