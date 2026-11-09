-- The privacy notice says the desk keeps photos of the PAN and the Aadhaar front, with most of the Aadhaar hidden, and who can
-- open them (decision 0573); it still says the desk's other records, and that the full number is never kept.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.saying(p_slug text, p_words text) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = p_slug and strpos(b.content::text, p_words) > 0;
$$;

select is(pg_temp.saying('privacy', 'a photo of your PAN card and a photo of the front of your Aadhaar, with its first eight digits and QR code hidden.'), 1,
  'the notice says the desk keeps the two photos');
select is(pg_temp.saying('privacy', 'RIVR never keeps your full Aadhaar number.'), 1, 'and that the full number is never kept');
select is(pg_temp.saying('privacy', 'Only RIVR''s most senior administrators can open the photos of your PAN and Aadhaar, and each opening is recorded.'), 1,
  'and who can open them');

-- Running it again changes nothing: each sentence is there once.
create function pg_temp.times(p_words text) returns integer language sql as $$
  select coalesce(sum((length(b.content::text) - length(replace(b.content::text, p_words, ''))) / length(p_words)), 0)::integer
  from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'privacy';
$$;
select private.website_keeps_id_photos('00000000-0000-4000-8000-000000000001');
select is(pg_temp.times('The desk also keeps a photo of your PAN card'), 1, 'run twice, it says what is kept once');
select is(pg_temp.times('Only RIVR''s most senior administrators'), 1, 'and who can open them once');

select * from finish();
rollback;
