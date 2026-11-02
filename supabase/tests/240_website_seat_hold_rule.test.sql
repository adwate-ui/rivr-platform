-- The house rules' seat hold (C-05): the club's website says 20 minutes, as its setting does; a club's own words stay,
-- even around the shipped ones; and a new club's website comes that way.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- How many of a venue's website blocks say these words.
create function pg_temp.saying(p_venue_id uuid, p_words text) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and strpos(b.content::text, p_words) > 0;
$$;

select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'held for 10 minutes'), 0, 'the club''s house rules say no 10-minute hold');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'A seat is held for 20 minutes once it is called.'), 1,
  'they say 20 minutes, as the setting does');

-- Words the club wrote stay as written, even around the shipped words.
update public.site_block b
set content = replace(b.content::text, '"Seats go in waitlist order. A seat is held for 20 minutes once it is called."',
                      '"Seats go in waitlist order. A seat is held for 10 minutes once it is called. Ask the floor."')::jsonb
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-000000000001' and strpos(b.content::text, 'held for 20 minutes') > 0;
select private.website_seat_hold_rule('00000000-0000-4000-8000-000000000001');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'held for 10 minutes once it is called. Ask the floor.'), 1,
  'a rule the club wrote in the editor is kept');

-- A new venue's website comes that way. Made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000af', 'RIVR Hold', 'seat-hold', false, 'RIVR test', 'Test', 'THR');
select private.add_website('00000000-0000-4000-8000-0000000000af');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000af', 'held for 10 minutes'), 0, 'a new club''s house rules say no 10-minute hold');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000af', 'A seat is held for 20 minutes once it is called.'), 1, 'but 20');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000af', '1,000 bonus chips for each side of a referral'), 1, 'and still the referral in chips');

select * from finish();
rollback;
