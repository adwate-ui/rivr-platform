-- The front page's The room without the cards other bands say (W-01): it keeps its hours, terrace and parking, the cab
-- home joins the photo tiles; a card or tile the club changed stays; running it again changes nothing; a new club's comes so.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.room_titles(p_venue_id uuid) returns text language sql as $$
  select string_agg(c ->> 'title', ', ' order by n) from public.site_block b join public.site_page p on p.id = b.page_id,
    jsonb_array_elements(b.content -> 'cards') with ordinality as e (c, n)
  where p.venue_id = p_venue_id and p.slug = 'home' and b.content ->> 'eyebrow' = 'The room';
$$;
create function pg_temp.tile_text(p_venue_id uuid) returns text language sql as $$
  select i ->> 'text' from public.site_block b join public.site_page p on p.id = b.page_id, jsonb_array_elements(b.content -> 'items') i
  where p.venue_id = p_venue_id and p.slug = 'home' and b.kind = 'gallery' and i ->> 'title' = 'Pick-up and drop';
$$;
create function pg_temp.saying(p_venue_id uuid, p_words text) returns integer language sql as $$
  select count(*)::integer from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = p_venue_id and p.slug = 'home' and strpos(b.content::text, p_words) > 0;
$$;

select is(pg_temp.room_titles('00000000-0000-4000-8000-000000000001'), 'Open every night, Smoking terrace, Parking', 'The room keeps what only it says');
select is(pg_temp.tile_text('00000000-0000-4000-8000-000000000001'), 'Chauffeured rides for regulars. Ask the front desk for a cab home.', 'the cab home joins the photo tile');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'Ask the front desk for a cab home.'), 1, 'and is on the front page once');
select is(pg_temp.saying('00000000-0000-4000-8000-000000000001', 'Buy in by UPI or in cash.'), 0, 'The room no longer repeats the cage');

-- Running it again changes nothing.
create temp table home_before as
  select b.id, b.position, b.content from public.site_block b join public.site_page p on p.id = b.page_id
  where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'home';
select private.website_room_without_repeats('00000000-0000-4000-8000-000000000001');
select set_eq($$ select b.id, b.position, b.content from public.site_block b join public.site_page p on p.id = b.page_id
                 where p.venue_id = '00000000-0000-4000-8000-000000000001' and p.slug = 'home' $$,
              $$ select id, position, content from home_before $$, 'running it again leaves the front page as it is');

-- A new venue's website comes that way. Made as the system, as in 221.
select set_config('request.jwt.claims', '', true);
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c0', 'RIVR Room', 'room-repeats', false, 'RIVR test', 'Test', 'TRR');
select private.add_website('00000000-0000-4000-8000-0000000000c0');
select is(pg_temp.room_titles('00000000-0000-4000-8000-0000000000c0'), 'Open every night, Smoking terrace, Parking', 'a new club''s The room comes without repeats');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c0', 'Ask the front desk for a cab home.'), 1, 'with the cab home once');

-- A club's own words stay: a card it rewrote, and a photo tile it rewrote, so the cab home stays in The room.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c1', 'RIVR Room Own', 'room-own', false, 'RIVR test', 'Test', 'TRO');
select private.add_website_with_launch_text('00000000-0000-4000-8000-0000000000c1');
update public.site_block b set content = jsonb_set(b.content, '{cards}', (
  select jsonb_agg(case when c ->> 'title' = 'The cage' then jsonb_set(c, '{text}', '"Our cage."') else c end order by n)
  from jsonb_array_elements(b.content -> 'cards') with ordinality as e (c, n)))
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000c1' and p.slug = 'home' and b.content ->> 'eyebrow' = 'The room';
update public.site_block b set content = jsonb_set(b.content, '{items}', (
  select jsonb_agg(case when i ->> 'title' = 'Pick-up and drop' then jsonb_set(i, '{text}', '"Our rides."') else i end order by n)
  from jsonb_array_elements(b.content -> 'items') with ordinality as e (i, n)))
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000c1' and p.slug = 'home' and b.kind = 'gallery';
select private.website_room_without_repeats('00000000-0000-4000-8000-0000000000c1');
select is(pg_temp.room_titles('00000000-0000-4000-8000-0000000000c1'), 'The cage, Open every night, Smoking terrace, Parking, Pick-up and drop',
  'a card the club rewrote stays, and the cab home stays in The room while the tile is the club''s');
select is(pg_temp.tile_text('00000000-0000-4000-8000-0000000000c1'), 'Our rides.', 'and the club''s tile is left alone');

-- A room the club cut to one card of its own is left as it is, never below the two cards a band needs; and a cab card the
-- club labelled is the club's, so the cab home is not also put on the tile.
select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c2', 'RIVR Room Few', 'room-few', false, 'RIVR test', 'Test', 'TRF');
select private.add_website_with_launch_text('00000000-0000-4000-8000-0000000000c2');
update public.site_block b set content = jsonb_set(b.content, '{cards}', (
  select jsonb_agg(c order by n)
  from jsonb_array_elements(b.content -> 'cards') with ordinality as e (c, n) where c ->> 'title' not in ('Smoking terrace', 'Parking')))
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000c2' and p.slug = 'home' and b.content ->> 'eyebrow' = 'The room';
select private.website_room_without_repeats('00000000-0000-4000-8000-0000000000c2');
select is(pg_temp.room_titles('00000000-0000-4000-8000-0000000000c2'),
  'The main room, The Private Room, Trained dealers, The cage, The chef''s menu, Safe and secure, Open every night, Pick-up and drop',
  'a room with one card of its own left is left as it is');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c2', 'Ask the front desk for a cab home.'), 1, 'with the cab home once');

select private.bootstrap_venue('00000000-0000-4000-8000-0000000000c3', 'RIVR Room Label', 'room-label', false, 'RIVR test', 'Test', 'TRL');
select private.add_website_with_launch_text('00000000-0000-4000-8000-0000000000c3');
update public.site_block b set content = jsonb_set(b.content, '{cards}', (
  select jsonb_agg(case when c ->> 'title' = 'Pick-up and drop' then c || '{"label": "Late"}' else c end order by n)
  from jsonb_array_elements(b.content -> 'cards') with ordinality as e (c, n)))
from public.site_page p
where p.id = b.page_id and p.venue_id = '00000000-0000-4000-8000-0000000000c3' and p.slug = 'home' and b.content ->> 'eyebrow' = 'The room';
select private.website_room_without_repeats('00000000-0000-4000-8000-0000000000c3');
select is(pg_temp.saying('00000000-0000-4000-8000-0000000000c3', 'Ask the front desk for a cab home.'), 1,
  'a cab card the club labelled stays its own, and the tile does not say it again');
select is(pg_temp.room_titles('00000000-0000-4000-8000-0000000000c3'), 'Open every night, Smoking terrace, Parking, Pick-up and drop',
  'while the repeats still go');

select * from finish();
rollback;
