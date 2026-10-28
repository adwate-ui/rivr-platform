-- The Learn library (#133): a member with learn.library sees their club's licensed sources that their tier has
-- (learn.source.<key>, ended with its licence), and reads the encoding itself, for the drill engine in the app.

create policy "members see the licensed sources they have" on public.learn_source
  for select to authenticated
  using (venue_id = (select private.current_member_venue_id())
         and private.has_feature((select private.current_member_id()), 'learn.library')
         and private.has_feature((select private.current_member_id()), 'learn.source.' || source_key));

-- Whether the signed-in member may read the encoding at this bucket path: their club's folder and a source they have.
create function private.may_read_learn_source(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9_-]{1,60}\.json$'
              then split_part(p_name, '/', 1)::uuid = private.current_member_venue_id()
                   and private.has_feature(private.current_member_id(), 'learn.library')
                   and private.has_feature(private.current_member_id(), 'learn.source.' || split_part(split_part(p_name, '/', 2), '.json', 1))
              else false end;
$$;
revoke execute on function private.may_read_learn_source(text) from public, anon;
grant execute on function private.may_read_learn_source(text) to authenticated;
create policy "members read the licensed encodings they have" on storage.objects
  for select to authenticated using (bucket_id = 'learn-sources' and (select private.may_read_learn_source(name)));
