-- The legality article's card on the Journal (#623), now the article is published (decision 0308): the club's Journal
-- lists it once, last among the articles; running it again adds nothing; a new club's comes with it; and an article the
-- club has unpublished gets no card, so no card leads to a page that is not there.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

create function pg_temp.legal_cards(p_venue_id uuid) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id,
    jsonb_array_elements(b.content -> 'cards') c
  where p.venue_id = p_venue_id and p.slug = 'journal' and b.content ->> 'heading' = 'Articles'
    and c #>> '{link,page}' = 'journal-poker-legal-gurugram';
$$;

select is((select b.content -> 'cards' -> -1 ->> 'title' from public.site_block b join public.site_page p on p.id = b.page_id
           where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'journal' and b.content ->> 'heading' = 'Articles'),
  'Is poker legal in Gurugram?', 'the club''s Journal lists the legality article last among its articles');
select private.journal_legal_card('00000000-0000-4000-8000-000000000001');
select is(pg_temp.legal_cards('00000000-0000-4000-8000-000000000001'), 1, 'once, however often it runs');

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000b2', 'RIVR Journal', 'journal-card', false, 'RIVR test', 'Test', 'TJC');
select private.add_website('00000000-0000-4000-8000-0000000000b2');
select is(pg_temp.legal_cards('00000000-0000-4000-8000-0000000000b2'), 1, 'a new club''s Journal comes with the card');

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000b3', 'RIVR Unpublished', 'journal-unpublished', false, 'RIVR test', 'Test', 'TJU');
select private.add_website_with_launch_answers('00000000-0000-4000-8000-0000000000b3');
update public.site_page set is_published = false where venue_id = '00000000-0000-4000-8000-0000000000b3' and slug = 'journal-poker-legal-gurugram';
select private.journal_legal_card('00000000-0000-4000-8000-0000000000b3');
select is(pg_temp.legal_cards('00000000-0000-4000-8000-0000000000b3'), 0, 'an article the club unpublished gets no card');

select is((select count(*)::integer from public.site_page p join public.venue v on v.id = p.venue_id where v.is_practice and p.slug = 'journal'), 0,
  'and the practice venue has no website to change');

select * from finish();
rollback;
