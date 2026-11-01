-- The website's claims of what the app no longer does (UI polish audit A-27, decision 0289): every hand logged at the
-- table, points for every hour, a share of the rake as points, League points earned by hours and finishes, every night's
-- money on record, and a jackpot in the picture of the app (AS-03 retook it). Hands are logged only where a table has a
-- tablet, points and League points are given by hand (decision 0284; the owner, 2 Nov: League by hand or CSV), and no
-- money is tracked, so the lines that said so give way to neutral ones, or the parity pages' "Details to follow.", until
-- the club writes its own in the console's Website editor (owner, 2 Nov: placeholders for now). How League points are
-- earned is a question for the owner (#710). Each only while it still reads as the website came with it, so a club's own words
-- stay.
create function private.website_without_old_claims(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Each line as the website came with it, and its stand-in.
  v_lines constant text[][] := array[
    ['"Every hand logged at the table"', '"Call time kept for every seat"'],
    ['"Cash games and tournaments dealt by casino-trained dealers, with every hand logged at the table."',
     '"Cash games and tournaments dealt by casino-trained dealers."'],
    ['"On a rotation, with every pot counted and every hand logged on the table''s tablet."', '"On a rotation, at every table."'],
    ['"Every buy-in, cash-out and hand is logged, so every night balances."', '"Details to follow."'],
    ['"Points for every hour you play"', '"Points from the club, spent on rewards"'],
    ['"RIVR Rewards: a share of your rake back as points"', '"RIVR Rewards"'],
    ['"Where everyone starts: the waitlist from the app, points for every hour, and RIVR Rewards on your rake."',
     '"Where everyone starts: the waitlist from the app and RIVR Rewards."'],
    ['"Every hour at the tables and every tournament finish earns League points. Here is where everyone stands, this month and this season."',
     '"Here is where everyone stands, this month and this season."'],
    ['"Every hour seated at a cash table earns League points, more at the higher stakes."', '"Details to follow."'],
    ['"Every finish earns points for taking part, and more for the final table and the top three."', '"Details to follow."'],
    ['Every finish earns RIVR League points, more for the final table and the top three. ', ''],
    ['Cash game hours and tournament finishes earn League points, and the standings and prizes are on the Leaderboard page.',
     'The standings and prizes are on the Leaderboard page.'],
    ['"heading": "Points for every hour"', '"heading": "Points and rewards"'],
    ['"The RIVR app''s Home: tonight''s tables with their open seats, the bad-beat jackpot and the next tournament"',
     '"The RIVR app''s Home: tonight''s tables with their open seats and the tournaments coming up"']
  ];
  v_line text[];
begin
  foreach v_line slice 1 in array v_lines loop
    update public.site_block b set content = replace(b.content::text, v_line[1], v_line[2])::jsonb
    from public.site_page p
    where p.id = b.page_id and p.venue_id = p_venue_id and strpos(b.content::text, v_line[1]) > 0;
  end loop;
  update public.site_page set description = 'Join RIVR: tiers earned at the table, rewards, and how to sign up.'
  where venue_id = p_venue_id and slug = 'membership'
    and description = 'Join RIVR: tiers earned at the table, points for every hour, and how to sign up.';
end;
$$;
revoke execute on function private.website_without_old_claims(uuid) from public, anon, authenticated;

-- A club's website comes with it: private.add_website, as 20261101160000_cab_requests_off.sql made it, then this.
alter function private.add_website(uuid) rename to add_website_with_cab_by_staff;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_with_cab_by_staff(p_venue_id);
  perform private.website_without_old_claims(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_with_cab_by_staff(uuid) from public, anon, authenticated;

-- The club made before.
select private.website_without_old_claims(v.id) from public.venue v where not v.is_practice;
