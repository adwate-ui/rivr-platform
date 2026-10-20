-- The website's blocks (#35): every kind the contract knows is allowed, nothing else; the club's
-- information pages are published and readable by anyone; the practice venue's never are; the live
-- views and the tournament schedule's policies.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A venue the seeded staff do not work at, with a published tournament of its own.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000e1', 'Elsewhere', 'elsewhere', false, 'Elsewhere Ltd', 'Somewhere', 'ELS');
insert into public.tournament (venue_id, name, starts_at, buy_in_paise, is_published)
values ('00000000-0000-4000-8000-0000000000e1', 'Elsewhere Open', now() + interval '1 day', 100000, true);

select results_eq(
  $$ select distinct kind from public.site_block order by kind $$,
  $$ values ('calendar'::text), ('careers'), ('faq'), ('games'), ('hero'), ('links'), ('map'), ('rules'), ('text') $$,
  'the seed uses every kind of block');
select throws_ok(
  $$ insert into public.site_block (venue_id, page_id, position, kind, content)
     values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005b1', 9, 'video', '{}') $$,
  '23514', null, 'a kind the website does not know is refused');

set local role anon;
select results_eq(
  $$ select slug from public.public_site_page where nav_position is not null order by nav_position $$,
  $$ values ('academy'::text), ('house-rules'), ('questions'), ('visit'), ('responsible-play'), ('privacy') $$,
  'anyone sees the published pages in the navigation, in order; careers stays a draft');
select results_eq(
  $$ select kind from public.public_site_block where page_slug = 'house-rules' order by position $$,
  $$ values ('hero'::text), ('rules') $$, 'and their blocks, each page opening with its hero');
select is_empty($$ select * from public.public_site_block where content::text like '%Training only%' $$,
  'never the practice venue''s');

-- The live blocks' views: the club's tables and coming tournaments, never the practice venue's.
select results_eq(
  $$ select table_name, is_open, table_type_name, small_blind_paise, big_blind_paise from public.public_table_status order by table_position $$,
  $$ values ('Table 1'::text, true, 'NLH 50/100'::text, 5000::bigint, 10000::bigint), ('Table 2', true, 'NLH 100/200', 10000, 20000),
            ('Table 3', true, 'NLH 100/200', 10000, 20000), ('Table 4', false, 'NLH 100/200', 10000, 20000),
            ('Table 5', true, 'NLH 100/200', 10000, 20000), ('Private Room', true, 'Private Room', 10000, 20000) $$,
  'anyone reads the club''s tables, games and stakes, and only the club''s');
select is((select count(distinct venue_slug)::int from public.public_table_status), 1, 'one venue, never the practice venue');
-- How many wait for each game (#39): counts only, the club's only.
select results_eq($$ select table_type_code, waiting from public.public_waitlist_length order by table_type_code $$,
  $$ values ('nlh_100_200'::text, 3), ('nlh_50_100', 0), ('private_room', 0) $$,
  'anyone reads how many wait for each of the club''s games, never who');
select is((select count(distinct venue_slug)::int from public.public_waitlist_length), 1, 'and never the practice venue''s');
select columns_are('public', 'public_waitlist_length', array['venue_slug', 'table_type_code', 'waiting'],
  'the view holds a venue, a game and a count, never a member');
reset role;
update public.waitlist_entry set status = 'left', left_at = now(), left_reason = 'left'
where member_id = '00000000-0000-4000-8000-000000000204' and status = 'waiting';
set local role anon;
select is((select waiting from public.public_waitlist_length where table_type_code = 'nlh_100_200'), 2,
  'a member who left is not counted');
reset role;
-- The calendar keeps a tournament until twelve hours after its start, so tonight's stays up while it
-- runs. Dates are set from now, so this holds on any day.
update public.tournament set starts_at = now() + interval '1 day' where name in ('RIVR Sunday', 'Practice Sit and Go');
update public.tournament set starts_at = now() - interval '11 hours' where name = 'Weeknight Turbo';
insert into public.tournament (venue_id, name, starts_at, buy_in_paise, is_published) values
  ('00000000-0000-4000-8000-000000000001', 'Draft Freeroll', now() + interval '2 days', 100000, false),
  ('00000000-0000-4000-8000-000000000001', 'Last Week', now() - interval '13 hours', 100000, true);
set local role anon;
select results_eq($$ select name, buy_in_paise, guarantee_paise from public.public_tournament_calendar
                     where venue_slug = 'gurugram' order by starts_at $$,
  $$ values ('Weeknight Turbo'::text, 300000::bigint, null::bigint), ('RIVR Sunday', 1000000, 50000000) $$,
  'anyone reads the club''s published tournaments, one started within twelve hours too: not older, nor a draft');
select results_eq($$ select venue_slug, name from public.public_tournament_calendar where venue_slug <> 'gurugram' $$,
  $$ values ('elsewhere'::text, 'Elsewhere Open'::text) $$, 'another real venue''s under its own name, never the practice venue''s');
select throws_ok($$ select * from public.tournament $$, '42501', null, 'never the schedule itself');
reset role;

-- Who reads the schedule: a member, their venue's published tournaments; staff, every tournament at
-- the venues they work at, drafts too, and none at a venue they do not.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select results_eq($$ select name from public.tournament order by name $$,
  $$ values ('Last Week'::text), ('RIVR Sunday'), ('Weeknight Turbo') $$, 'a member reads their venue''s published tournaments, past ones too');
select throws_ok($$ insert into public.tournament (venue_id, name, starts_at, buy_in_paise)
                   values ('00000000-0000-4000-8000-000000000001', 'Mine', now(), 5000) $$, '42501', null, 'and writes none');
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000103", "role": "authenticated"}';
select results_eq($$ select name from public.tournament order by name $$,
  $$ values ('Draft Freeroll'::text), ('Last Week'), ('Practice Sit and Go'), ('RIVR Sunday'), ('Weeknight Turbo') $$,
  'staff read every tournament at the venues they work at, drafts too, and none elsewhere');
select throws_ok($$ update public.tournament set name = 'Changed' $$, '42501', null, 'and change none');
reset role;
select throws_ok($$ insert into public.tournament (venue_id, name, starts_at, buy_in_paise)
                   values ('00000000-0000-4000-8000-000000000001', 'Odd', now(), 1234) $$, '23514', null,
  'a buy-in is whole chips, multiples of ₹50');

select * from finish();
rollback;
