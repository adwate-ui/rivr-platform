-- The website's words in grandpokerarena.com's way (#619). The club has its new pages, with the legal article a draft.
-- Membership reads the rules in force in place of the example rates; Promotions shows the jackpot; the front page
-- carries the room's hours and amenities and more questions; every ruling links to its judgment. It only adds:
-- running it again changes nothing, and words the club changed stay as they are. The practice venue gets none of it,
-- and a club made from now on gets all of it.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temporary table club as select '00000000-0000-4000-8000-000000000001'::uuid as venue_id;
create function pg_temp.page_kinds(p_venue_id uuid, p_slug text) returns text[] language sql as $$
  select array_agg(b.kind order by b.position) from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and p.slug = p_slug;
$$;

select results_eq($$ select slug, is_published from public.site_page
                     where venue_id = (select venue_id from club) and slug in ('leaderboard', 'journal-cash-game-tips', 'journal-tournaments-gurugram', 'journal-poker-legal-gurugram')
                     order by slug $$,
  $$ values ('journal-cash-game-tips'::text, true), ('journal-poker-legal-gurugram', false), ('journal-tournaments-gurugram', true), ('leaderboard', true) $$,
  'the club has the Leaderboard and the new articles, with "Is poker legal in Gurugram?" a draft');
select is(pg_temp.page_kinds((select venue_id from club), 'leaderboard'), array['hero', 'league', 'cards'], 'the Leaderboard shows the League''s standings');
select is(pg_temp.page_kinds((select venue_id from club), 'membership'),
  array['hero', 'cards', 'cards', 'rewards', 'outstation', 'cards', 'promotions', 'faq'],
  'Membership reads the rules in force in place of the example rates, the cab and hotel after them, and the welcome offer after the steps to join');
select is((select b.content ->> 'only' from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = (select venue_id from club) and p.slug = 'membership' and b.kind = 'promotions'), 'welcome', 'which shows the welcome offer alone');
select is(pg_temp.page_kinds((select venue_id from club), 'promotions'), array['hero', 'jackpot', 'promotions', 'cards'], 'Promotions shows the jackpot after its hero');

select ok((select b.content -> 'questions' @> '[{"question": "Is poker a game of skill?"}]' and b.content -> 'questions' @> '[{"question": "What is the RIVR League?"}]'
           from public.site_block b join public.site_page p on p.id = b.page_id where p.venue_id = (select venue_id from club) and p.slug = 'home' and b.kind = 'faq'),
  'the front page answers whether poker is legal and what the League is');
select ok((select b.content -> 'cards' @> '[{"title": "Open every night"}, {"title": "Parking"}, {"title": "Smoking terrace"}]'
           from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = (select venue_id from club) and p.slug = 'home' and b.content ->> 'eyebrow' = 'The room'),
  'the room carries its hours and amenities');
select results_eq($$ select p.slug, jsonb_array_length(b.content -> 'items'),
                            (select count(*)::integer from jsonb_array_elements(b.content -> 'items') i where i #>> '{link,href}' like 'https://indiankanoon.org/doc/%')
                     from public.site_block b join public.site_page p on p.id = b.page_id
                     where p.venue_id = (select venue_id from club) and b.kind = 'timeline' order by p.slug $$,
  $$ values ('about'::text, 4, 4), ('home', 4, 4) $$, 'On the record lists four rulings on both pages, each linked to its judgment');

select ok((select b.content -> 'cards' @> '[{"link": {"page": "journal-cash-game-tips"}}, {"link": {"page": "journal-tournaments-gurugram"}}]'
             and not b.content::text like '%journal-poker-legal-gurugram%'
           from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = (select venue_id from club) and p.slug = 'journal' and b.content ->> 'heading' = 'Articles'),
  'the journal lists the new published articles, and not the draft');
select is((select count(*) from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = (select venue_id from club) and p.slug in ('home', 'membership')
             and (b.content::text like '%5\% of your rake%' or b.content::text like '%₹1,000 on your first%' or b.content::text like '%fourth visit%')), 0::bigint,
  'no page writes in words a rule the settings and promotions now hold');
select ok((select b.content -> 'cards' @> '[{"title": "Valet and parking"}]' from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = (select venue_id from club) and p.slug = 'home' and b.content ->> 'eyebrow' = 'Hospitality'),
  'hospitality lists valet and parking');

-- Again: nothing changes.
create temporary table before as select b.id, b.position, b.kind, b.content from public.site_block b where b.venue_id = (select venue_id from club);
select private.add_website_parity((select venue_id from club));
select is((select count(*) from public.site_block b where b.venue_id = (select venue_id from club)
           and not exists (select 1 from before o where o.id = b.id and o.position = b.position and o.kind = b.kind and o.content = b.content)), 0::bigint,
  'running it again changes nothing');

-- A club whose points table was edited keeps it, with the rules in force after its tiers.
insert into public.venue (id, name, slug, is_practice) values ('00000000-0000-4000-8000-0000000000e9', 'Test Edited Room', 'test-edited-room', false);
select private.add_website_with_wall('00000000-0000-4000-8000-0000000000e9');
update public.site_block b set content = jsonb_set(b.content, '{note}', '"Our own rates."') from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000e9' and p.slug = 'membership' and b.kind = 'table';
select private.add_website_parity('00000000-0000-4000-8000-0000000000e9');
select is(pg_temp.page_kinds('00000000-0000-4000-8000-0000000000e9', 'membership'),
  array['hero', 'cards', 'cards', 'rewards', 'outstation', 'table', 'cards', 'promotions', 'faq'], 'an edited points table stays, the rules in force placed after the tiers');

select is((select count(*) from public.site_page p where p.venue_id = '00000000-0000-4000-8000-000000000002' and p.slug = 'leaderboard'), 0::bigint,
  'the practice venue gets none of it');
insert into public.venue (id, name, slug, is_practice) values ('00000000-0000-4000-8000-0000000000ea', 'Test New Room', 'test-new-room', false);
select private.add_website('00000000-0000-4000-8000-0000000000ea');
select is(pg_temp.page_kinds('00000000-0000-4000-8000-0000000000ea', 'membership'), pg_temp.page_kinds((select venue_id from club), 'membership'),
  'and a club made from now on gets all of it');

select * from finish();
rollback;
