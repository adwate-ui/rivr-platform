-- The front page's referral in bonus chips (W-08): the club's website says 1,000 bonus chips for each side, as its
-- promotions do; words a club wrote stay; and a new club's website comes that way.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- How many of a venue's website blocks say these words.
create function pg_temp.saying(p_venue_id uuid, p_words text) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and strpos(b.content::text, p_words) > 0;
$$;

select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', '₹1,000 for each side'), 0, 'the club''s front page says no rupees for a referral');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', '1,000 bonus chips for each side of a referral'), 1,
  'it says 1,000 bonus chips for each side, as its promotions do');

-- Words the club wrote stay as written, even around the shipped words; the shipped line alone changes.
update public.site_block b
set content = replace(b.content::text, '"1,000 bonus chips for each side of a referral"', '"₹1,000 for each side of a referral, paid the same night"')::jsonb
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-000000000001' and strpos(b.content::text, '1,000 bonus chips for each side') > 0;
select private.website_referral_in_chips('00000000-0000-4000-8000-000000000001');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', '₹1,000 for each side of a referral, paid the same night'), 1,
  'a line the club wrote in the editor is kept, though it holds the shipped words');
update public.site_block b
set content = replace(b.content::text, '"₹1,000 for each side of a referral, paid the same night"', '"₹1,000 for each side of a referral"')::jsonb
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-000000000001' and strpos(b.content::text, 'paid the same night') > 0;
select private.website_referral_in_chips('00000000-0000-4000-8000-000000000001');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', '1,000 bonus chips for each side of a referral'), 1, 'and the shipped line itself changes');

-- A new venue's website comes that way. Made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000ae', 'RIVR Chips', 'chips-referral', false, 'RIVR test', 'Test', 'TCR');
select private.add_website('00000000-0000-4000-8000-0000000000ae');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000ae', '₹1,000 for each side'), 0, 'a new club''s front page says no rupees for a referral');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000ae', '1,000 bonus chips for each side of a referral'), 1, 'but bonus chips');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000ae', 'hand logged'), 0, 'and still without the old claims');

select * from finish();
rollback;
