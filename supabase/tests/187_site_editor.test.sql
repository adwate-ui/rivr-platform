-- The website editor (#129; decision 0270): marketing (107, website.edit) saves a draft of House rules, which the
-- website previews by its token but does not show; publishes it; schedules another, which pg_cron's run publishes when
-- its time comes; and publishes the first version again. A cashier (104) does none of it; a block the website cannot show
-- is refused; another club's versions are not seen.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000aa', 'RIVR Test', 'test-editor', false, 'RIVR test', 'Test', 'TST');

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create temporary table rules on commit drop as
select p.id as page_id, private.site_page_blocks(p.id) as blocks from public.site_page p
where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'house-rules';
grant select on rules to authenticated, anon;
-- The page's blocks with the first one's heading changed.
create function pg_temp.headed(p_heading text) returns jsonb language sql as $$
  select jsonb_set(blocks, '{0,content,heading}', to_jsonb(p_heading)) from rules;
$$;
grant execute on function pg_temp.headed(text) to authenticated;
-- The first block's heading as the website shows it.
create function pg_temp.live_heading() returns text language sql security definer as $$
  select content ->> 'heading' from public.public_site_block where page_slug = 'house-rules' order by position limit 1;
$$;
grant execute on function pg_temp.live_heading() to authenticated, anon;
create temporary table original on commit drop as select pg_temp.live_heading() as heading;
grant select on original to authenticated, anon;

select pg_temp.as_person('00000000-0000-4000-8000-000000000104');
select throws_ok($$ select public.save_site_draft('00000000-0000-4000-8000-000000000001', (select page_id from rules), pg_temp.headed('Cashier''s rules')) $$,
  '42501', null, 'a cashier edits no page');
select is_empty($$ select * from public.site_revision $$, 'nor sees its versions');

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
create temporary table draft on commit drop as
select public.save_site_draft('00000000-0000-4000-8000-000000000001', (select page_id from rules), pg_temp.headed('Rules of the house')) as token;
grant select on draft to anon;
select results_eq($$ select status from public.site_revision where page_id = (select page_id from rules) order by created_at $$,
  $$ values ('published'::text), ('draft') $$, 'the first edit keeps what the page showed, then the draft');
select is(pg_temp.live_heading(), (select heading from original), 'a draft is not on the website');

select set_config('role', 'anon', true), set_config('request.jwt.claims', '', true);
select is_empty($$ select * from public.public_site_preview $$, 'the website previews nothing without a token');
select set_config('request.headers', jsonb_build_object('x-site-preview', (select token from draft))::text, true);
select is((select content ->> 'heading' from public.public_site_preview order by position limit 1), 'Rules of the house',
  'and the draft by its token');
select set_config('request.headers', jsonb_build_object('x-site-preview', gen_random_uuid())::text, true);
select is_empty($$ select * from public.public_site_preview $$, 'and nothing by any other');
select set_config('request.headers', '{"x-site-preview": "not-a-token"}', true);
select is_empty($$ select * from public.public_site_preview $$, 'nor by something that is not a token');
select set_config('request.headers', '{}', true), set_config('role', 'postgres', true);

select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.publish_site_draft('00000000-0000-4000-8000-000000000001', (select page_id from rules), null) $$, 'marketing publishes it');
select is(pg_temp.live_heading(), 'Rules of the house', 'and the website shows it at once');
select throws_ok($$ select public.publish_site_draft('00000000-0000-4000-8000-000000000001', (select page_id from rules), null) $$,
  'P0002', null, 'a page with no draft has nothing to publish');

-- A scheduled draft goes live when its time comes.
select lives_ok($$ select public.save_site_draft('00000000-0000-4000-8000-000000000001', (select page_id from rules), pg_temp.headed('Tonight''s rules')) $$,
  'marketing saves another draft');
select lives_ok($$ select public.publish_site_draft('00000000-0000-4000-8000-000000000001', (select page_id from rules), now() + interval '1 hour') $$,
  'and schedules it');
select lives_ok($$ select public.save_site_draft('00000000-0000-4000-8000-000000000001', (select page_id from rules), pg_temp.headed('Tonight''s rules')) $$,
  'saving it again');
select is((select status from public.site_revision where page_id = (select page_id from rules) and status in ('draft', 'scheduled')), 'scheduled',
  'keeps it scheduled');
select is(pg_temp.live_heading(), 'Rules of the house', 'which waits for its time');
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
update public.site_revision set publish_at = now() - interval '1 minute' where status = 'scheduled';
insert into public.control_state (venue_id, level, reason) values ('00000000-0000-4000-8000-000000000001', 'venue_freeze', 'Test');
select is(private.publish_due_site_revisions(), 0, 'while the venue is frozen a scheduled page waits');
update public.control_state set released_at = now(), release_reason = 'Test over',
  released_by_staff_id = (select s.id from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000101' and s.venue_id = '00000000-0000-4000-8000-000000000001'),
  release_second_staff_id = (select s.id from public.staff s where s.user_id = '00000000-0000-4000-8000-000000000102' and s.venue_id = '00000000-0000-4000-8000-000000000001')
where reason = 'Test' and level = 'venue_freeze';
select is(private.publish_due_site_revisions(), 1, 'pg_cron''s run publishes it when its time has come');
select is(pg_temp.live_heading(), 'Tonight''s rules', 'and the website shows it');

-- One click puts the first version back.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select lives_ok($$ select public.rollback_site_page('00000000-0000-4000-8000-000000000001', (select page_id from rules),
                     (select id from public.site_revision where page_id = (select page_id from rules) order by created_at limit 1)) $$,
  'marketing publishes the first version again');
select is(pg_temp.live_heading(), (select heading from original), 'and the website shows the page as it was');
select is((select count(*)::integer from public.site_revision where page_id = (select page_id from rules) and status = 'published'), 1,
  'one version is on the website at a time');

-- A block the website cannot show is refused at publishing, and at scheduling.
select lives_ok($$ select public.save_site_draft('00000000-0000-4000-8000-000000000001', (select page_id from rules),
                     '[{"kind": "nonsense", "content": {}}]'::jsonb) $$, 'a draft with a block of no kind the website knows is saved');
select throws_ok($$ select public.publish_site_draft('00000000-0000-4000-8000-000000000001', (select page_id from rules), null) $$,
  '22023', null, 'but not published');
select throws_ok($$ select public.publish_site_draft('00000000-0000-4000-8000-000000000001', (select page_id from rules), now() + interval '1 hour') $$,
  '22023', null, 'nor scheduled');

-- A scheduled draft that cannot go ahead goes back to being a draft, with one alert, not one a minute.
select lives_ok($$ select public.save_site_draft('00000000-0000-4000-8000-000000000001', (select page_id from rules), pg_temp.headed('Late rules')) $$,
  'marketing saves a good draft');
select lives_ok($$ select public.publish_site_draft('00000000-0000-4000-8000-000000000001', (select page_id from rules), now() + interval '1 hour') $$,
  'and schedules it');
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
update public.site_revision set publish_at = now() - interval '1 minute' where status = 'scheduled';
update public.staff set is_active = false where user_id = '00000000-0000-4000-8000-000000000107';
create temporary table alerts_before on commit drop as select count(*)::integer as alerts from public.alert where kind = 'website.publish_failed';
select is(private.publish_due_site_revisions(), 0, 'a page its scheduler can no longer edit is not published');
select is((select status from public.site_revision where page_id = (select page_id from rules) and status in ('draft', 'scheduled')), 'draft',
  'it goes back to being a draft');
select is((select count(*)::integer from public.alert where kind = 'website.publish_failed') - (select alerts from alerts_before), 1, 'with one alert');
select is(private.publish_due_site_revisions(), 0, 'and the next run does nothing');
select is((select count(*)::integer from public.alert where kind = 'website.publish_failed') - (select alerts from alerts_before), 1, 'and alerts no more');
update public.staff set is_active = true where user_id = '00000000-0000-4000-8000-000000000107';
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select throws_ok($$ select public.save_site_draft('00000000-0000-4000-8000-000000000001', (select page_id from rules), '[]'::jsonb) $$,
  '22023', null, 'and a page needs a block');

-- A super admin edits the website too.
select pg_temp.as_person('00000000-0000-4000-8000-000000000629');
select lives_ok($$ select public.save_site_draft('00000000-0000-4000-8000-000000000001', (select page_id from rules), pg_temp.headed('Super admin''s rules')) $$,
  'a super admin saves a draft');

-- The practice venue's drafts are never on the website's preview.
select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
insert into public.site_revision (venue_id, page_id, blocks, status, created_by_staff_id, preview_token)
select p.venue_id, p.id, '[{"kind": "text", "content": {"heading": "Practice draft", "body": "x"}}]'::jsonb, 'draft', s.id, '00000000-0000-4000-8000-0000000f1870'
from public.site_page p join public.staff s on s.venue_id = p.venue_id
where p.venue_id = '00000000-0000-4000-8000-000000000002' limit 1;
select set_config('role', 'anon', true), set_config('request.headers', '{"x-site-preview": "00000000-0000-4000-8000-0000000f1870"}', true);
select is_empty($$ select * from public.public_site_preview $$, 'the practice venue''s drafts are never previewed');
select set_config('request.headers', '{}', true), set_config('role', 'postgres', true);

select set_config('role', 'postgres', true), set_config('request.jwt.claims', '', true);
insert into public.site_page (venue_id, slug, title, is_published) values ('00000000-0000-4000-8000-0000000000aa', 'elsewhere', 'Elsewhere', true);
insert into auth.users (id, instance_id, aud, role, phone) values
  ('00000000-0000-4000-8000-00000000e188', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '999000000001881');
insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
values ('00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-00000000e188', 'Other marketing', 'Marketing', 'marketing', '+919990001881');
insert into public.site_revision (venue_id, page_id, blocks, status, created_by_staff_id)
select p.venue_id, p.id, '[]'::jsonb, 'draft', s.id from public.site_page p, public.staff s
where p.slug = 'elsewhere' and s.user_id = '00000000-0000-4000-8000-00000000e188';
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select is_empty($$ select * from public.site_revision where venue_id = '00000000-0000-4000-8000-0000000000aa' $$, 'marketing sees no other club''s versions');
select throws_ok($$ select public.save_site_draft('00000000-0000-4000-8000-000000000001', (select id from public.site_page where slug = 'elsewhere'),
                     pg_temp.headed('x')) $$, 'P0002', null, 'nor edits its pages');

select * from finish();
rollback;
