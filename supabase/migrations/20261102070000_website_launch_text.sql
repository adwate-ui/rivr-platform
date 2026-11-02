-- The website's launch text (owner, 2 Nov): the front page without its repeated bands (W-01), the full privacy notice and
-- terms of use (W-05), and the Academy's page (W-06). Each only while the page still reads as the website came with it,
-- so a club's own words stay: a band the club renamed stays, and a page the club wrote is left alone.
create function private.website_launch_text(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page uuid;
  v_removed integer;
  v_block record;
  v_place integer := 0;
begin
  -- The cab home, the one thing Hospitality says that no other band does, joins The room's cards before Hospitality goes.
  update public.site_block r
  set content = jsonb_set(r.content, '{cards}', (r.content -> 'cards') || jsonb_build_array(c.card))
  from public.site_page p, public.site_block h,
       lateral (select e as card from jsonb_array_elements(h.content -> 'cards') e where strpos(e::text, 'Ask the front desk for a cab home.') > 0 limit 1) c
  where p.id = r.page_id and p.venue_id = p_venue_id and p.slug = 'home' and r.kind = 'cards' and r.content ->> 'eyebrow' = 'The room'
    and h.page_id = p.id and h.kind = 'cards' and h.content ->> 'heading' = 'Looked after, every hour.'
    and strpos(r.content::text, 'Ask the front desk for a cab home.') = 0;

  -- The front page's bands that said again what others say: the phrase strip, Play. Connect. Belong., the RIVR difference,
  -- Hospitality and the legal timeline (the About page keeps the legal story).
  delete from public.site_block b
  using public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug = 'home' and (
    (b.kind = 'marquee' and b.content -> 'phrases' ->> 0 = 'Play' and b.content -> 'phrases' ->> 2 = 'Belong')
    or (b.kind = 'cards' and b.content ->> 'heading' in ('Play. Connect. Belong.', 'Looked after, every hour.'))
    or (b.kind = 'statement' and b.content ->> 'eyebrow' = 'The RIVR difference')
    or (b.kind = 'timeline' and b.content ->> 'heading' = 'A game of skill, on the record.'));
  get diagnostics v_removed = row_count;
  -- The bands left close up, one by one from the top: each moves only into a place already free.
  if v_removed > 0 then
    for v_block in select b.id from public.site_block b join public.site_page p on p.id = b.page_id
                   where p.venue_id = p_venue_id and p.slug = 'home' order by b.position loop
      v_place := v_place + 1;
      update public.site_block set position = v_place where id = v_block.id;
    end loop;
  end if;

  -- Privacy: while its one text is the backups note it came with, the full notice, that note its last section.
  select p.id into v_page from public.site_page p where p.venue_id = p_venue_id and p.slug = 'privacy';
  if v_page is not null
     and (select count(*) from public.site_block b where b.page_id = v_page) = 2
     and exists (select 1 from public.site_block b where b.page_id = v_page and b.position = 2 and b.kind = 'text'
                 and b.content ->> 'body' = 'Backups. Every night RIVR takes an encrypted backup of its records, so the club can recover from a failure. Backups hold personal data, the photos from identity checks included. Each night''s backup is kept for 35 days, and one backup a month for 400 days, then deleted. Personal data can be in a backup for up to 400 days.

Erasure. When your data is erased at your request, a backup taken before then still holds it until that backup is deleted. If RIVR ever restores a backup, every erasure made since it was taken is made again before the restored records are used.') then
    delete from public.site_block b where b.page_id = v_page and b.position = 2;
    insert into public.site_block (venue_id, page_id, position, kind, content)
    select p_venue_id, v_page, 1 + e.n, 'text', e.section from jsonb_array_elements('[{"heading": "Who keeps your data", "body": "RIVR Poker Club, upper floor, Glaza, M3M 65th Avenue, Gurugram, keeps the personal data in this notice and decides how it is used. Write to info@rivrpoker.com about anything in it.\n\nThis notice covers the RIVR app, this website and the club itself."}, {"heading": "What RIVR keeps", "body": "Your mobile number, your name and the answers you give when you join.\n\nFrom the identity check: the selfie you take, your date of birth, your address, your PAN and the last four digits of your Aadhaar. RIVR never keeps your full Aadhaar number.\n\nYour visits, your places on waitlists, your seats and how long you play, your membership tier and points, your food and drink orders, and any feedback you send.\n\nThe club''s cameras record the floor, for everyone''s safety."}, {"heading": "Why RIVR keeps it", "body": "To run your membership: to check that you are 18 or over and that each member is one person, to seat you and to keep your place.\n\nTo keep the records the law asks a club like RIVR to keep, and to keep the club and its members safe.\n\nTo send you the messages you agreed to. Offers and news come only if you say yes, and you can stop them in the app at any time."}, {"heading": "Who sees it", "body": "Club staff see what their role needs: the front desk sees who is checking in, the floor sees the waitlist, and only the staff who review identity checks see your selfie.\n\nRIVR''s providers handle data for RIVR, and only for the service they give: Cashfree runs the identity check with DigiLocker, a messaging provider sends your sign-in codes, Supabase holds RIVR''s records, and Cloudflare serves the app and this website.\n\nRIVR does not sell your data, and does not use it for advertising."}, {"heading": "How long it is kept", "body": "Your data is kept while you are a member, and after that only as long as the law asks a club to keep it. Then it is erased."}, {"heading": "Your rights", "body": "You can ask to see the data RIVR keeps about you, to correct it, or to erase it. Ask at the front desk or write to info@rivrpoker.com. Some records must be kept as long as the law asks, even after you leave, and RIVR will tell you which.\n\nYou can withdraw a consent you gave, such as to offers and news, at any time.\n\nIf RIVR''s answer does not settle it, you can complain to the Data Protection Board of India."}, {"heading": "Cookies on this website", "body": "This website keeps only what it needs to work. Google Maps, on the Visit page, sets its own cookies only if you allow maps in the cookie banner. The website runs no analytics or advertising tools."}, {"heading": "Backups and erasure", "body": "Backups. Every night RIVR takes an encrypted backup of its records, so the club can recover from a failure. Backups hold personal data, the photos from identity checks included. Each night''s backup is kept for 35 days, and one backup a month for 400 days, then deleted. Personal data can be in a backup for up to 400 days.\n\nErasure. When your data is erased at your request, a backup taken before then still holds it until that backup is deleted. If RIVR ever restores a backup, every erasure made since it was taken is made again before the restored records are used."}]'::jsonb) with ordinality as e (section, n);
  end if;

  -- Terms: while its one text is the note that the terms come before the opening, the terms.
  v_page := null;
  select p.id into v_page from public.site_page p where p.venue_id = p_venue_id and p.slug = 'terms';
  if v_page is not null
     and (select count(*) from public.site_block b where b.page_id = v_page) = 2
     and exists (select 1 from public.site_block b where b.page_id = v_page and b.position = 2 and b.kind = 'text'
                 and strpos(b.content ->> 'body', 'RIVR publishes its full terms of use here before the club opens on Sunday 15 November.') = 1) then
    delete from public.site_block b where b.page_id = v_page and b.position = 2;
    insert into public.site_block (venue_id, page_id, position, kind, content)
    select p_venue_id, v_page, 1 + e.n, 'text', e.section from jsonb_array_elements('[{"heading": "These terms", "body": "These terms apply when you use the RIVR app or this website, and when you visit RIVR Poker Club, upper floor, Glaza, M3M 65th Avenue, Gurugram. The house rules apply at the tables as well. By joining RIVR or using the app, you agree to both.\n\nThese terms apply from Sunday 15 November 2026. If they change, the new version is posted here first."}, {"heading": "Membership", "body": "Members must be 18 or over. Each person may hold one membership, in their own name.\n\nBefore you play, you finish the identity check: DigiLocker and a selfie in the app, or a check in person at the front desk. Keep your details up to date.\n\nRIVR may refuse a membership, or end one, if the house rules or the law are broken."}, {"heading": "At the club", "body": "Poker at RIVR is a game of skill, played between members. The club deals and runs the game; it does not play against you.\n\nBuy-ins and cash-outs are at the cage, by UPI or in cash, and you cash out the same night. The floor decides any question about a hand, as the house rules say."}, {"heading": "Points, bonus chips and offers", "body": "Points, bonus chips and other offers follow the rules shown with each one in the app. They belong to your membership and cannot be sold or passed to anyone else. RIVR may change or end an offer."}, {"heading": "Your account", "body": "Your sign-in code is for you alone. Never share it, and tell the front desk if you lose your phone.\n\nUse the app and this website only for what they are for. Do not try to reach other members'' data or to disrupt the service."}, {"heading": "Responsible play", "body": "Play only with money you can afford to lose. The front desk can set a limit on your play or a break from the club, and a break is kept at the door, the waitlist and the cage until it ends. The Responsible play page says more."}, {"heading": "Liability", "body": "RIVR runs its app, its website and the club with care, but cannot promise they will never be interrupted. RIVR is not responsible for what you lose at play, and is responsible for other loss only as far as Indian law says."}, {"heading": "Law", "body": "These terms are governed by the laws of India. Any dispute is for the courts at Gurugram, Haryana.\n\nQuestions about these terms: info@rivrpoker.com."}]'::jsonb) with ordinality as e (section, n);
  end if;

  -- The Academy: while it is its hero alone, how it works, Level 1, who can join and the graduate's bonus.
  v_page := null;
  select p.id into v_page from public.site_page p where p.venue_id = p_venue_id and p.slug = 'academy';
  if v_page is not null
     and (select count(*) from public.site_block b where b.page_id = v_page) = 1
     and exists (select 1 from public.site_block b where b.page_id = v_page and b.kind = 'hero' and b.content ->> 'heading' = 'RIVR Academy') then
    insert into public.site_block (venue_id, page_id, position, kind, content)
    select p_venue_id, v_page, 1 + e.n, 'text', e.section from jsonb_array_elements('[{"heading": "How it works", "body": "RIVR Academy teaches no-limit hold''em in small batches, with a RIVR coach at a real table. A batch meets over a few days at the club, and you play with chips, never with money, so you can learn without risk.\n\nThe batches, their dates and the fee are in the app, where you book a seat."}, {"heading": "Level 1", "body": "For anyone new to poker or new to a live table: the rules and the order of play, hand rankings, betting and position, and how a hand is run at a club table. You finish by playing full hands with a coach beside you."}, {"heading": "Who can join", "body": "Anyone 18 or over. You book as a RIVR member, so first sign up in the app and finish the identity check, as for the tables."}, {"heading": "After the Academy", "body": "Finish the Academy and you get 1,000 bonus chips on your first buy-in at the club."}]'::jsonb) with ordinality as e (section, n);
  end if;
end;
$$;
revoke execute on function private.website_launch_text(uuid) from public, anon, authenticated;

-- A club's website comes with it: private.add_website, as 20261102060000_website_seat_hold_rule.sql made it, then this.
alter function private.add_website(uuid) rename to add_website_with_seat_hold_rule;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_with_seat_hold_rule(p_venue_id);
  perform private.website_launch_text(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_with_seat_hold_rule(uuid) from public, anon, authenticated;

-- The club made before.
select private.website_launch_text(v.id) from public.venue v where not v.is_practice;
