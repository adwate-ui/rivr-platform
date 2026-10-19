-- The website's blocks (#35): every kind the contract knows is allowed, nothing else; the club's
-- information pages are published and readable by anyone; the practice venue's never are.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select results_eq(
  $$ select distinct kind from public.site_block order by kind $$,
  $$ values ('calendar'::text), ('careers'), ('faq'), ('games'), ('hero'), ('map'), ('rules'), ('text') $$,
  'the seed uses every kind of block');
select throws_ok(
  $$ insert into public.site_block (venue_id, page_id, position, kind, content)
     values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005b1', 9, 'video', '{}') $$,
  '23514', null, 'a kind the website does not know is refused');

set local role anon;
select results_eq(
  $$ select slug from public.public_site_page where nav_position is not null order by nav_position $$,
  $$ values ('academy'::text), ('house-rules'), ('questions'), ('visit'), ('responsible-play') $$,
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
reset role;
-- The calendar keeps a tournament from twelve hours before its start, so tonight's stays up while it runs.
update public.tournament set starts_at = now() + interval '1 day' where name = 'RIVR Sunday';
update public.tournament set starts_at = now() - interval '13 hours' where name = 'Tuesday Turbo';
insert into public.tournament (venue_id, name, starts_at, buy_in_paise, is_published)
values ('00000000-0000-4000-8000-000000000001', 'Draft Freeroll', now() + interval '2 days', 100000, false);
set local role anon;
select results_eq($$ select name, buy_in_paise, guarantee_paise from public.public_tournament_calendar order by starts_at $$,
  $$ values ('RIVR Sunday'::text, 1000000::bigint, 50000000::bigint) $$,
  'anyone reads the coming published tournaments: not a past one, a draft or the practice venue''s');
select throws_ok($$ select * from public.tournament $$, '42501', null, 'never the schedule itself');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-000000000201", "role": "authenticated"}';
select is((select count(*)::int from public.tournament), 2, 'a member reads their venue''s published tournaments, past ones too');
select throws_ok($$ insert into public.tournament (venue_id, name, starts_at, buy_in_paise)
                   values ('00000000-0000-4000-8000-000000000001', 'Mine', now(), 5000) $$, '42501', null, 'and writes none');
reset role;
select throws_ok($$ insert into public.tournament (venue_id, name, starts_at, buy_in_paise)
                   values ('00000000-0000-4000-8000-000000000001', 'Odd', now(), 1234) $$, '23514', null,
  'a buy-in is whole chips, multiples of ₹50');

select * from finish();
rollback;
