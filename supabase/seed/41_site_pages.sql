-- The website's information pages (#35), in the club's voice until marketing edits them in the
-- console (C-020) with the owner's final copy: house rules, questions, finding the club and
-- responsible play. Each opens with a hero, the page's one h1. Careers stays a draft (40_site.sql)
-- until the owner names the roles.

insert into public.site_page (id, venue_id, slug, title, description, nav_position, is_published) values
  ('00000000-0000-4000-8000-0000000005b1', '00000000-0000-4000-8000-000000000001', 'house-rules', 'House rules',
   'How the tables run at RIVR.', 3, true),
  ('00000000-0000-4000-8000-0000000005b2', '00000000-0000-4000-8000-000000000001', 'questions', 'Questions',
   'Joining RIVR, paying and getting a seat.', 4, true),
  ('00000000-0000-4000-8000-0000000005b3', '00000000-0000-4000-8000-000000000001', 'visit', 'Visit',
   'Upper floor, Glaza, M3M 65th Avenue, Gurugram.', 5, true),
  ('00000000-0000-4000-8000-0000000005b4', '00000000-0000-4000-8000-000000000001', 'responsible-play', 'Responsible play',
   'Limits, breaks and self-exclusion at RIVR.', 6, true)
on conflict (id) do nothing;

insert into public.site_block (venue_id, page_id, position, kind, content) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005b1', 1, 'hero',
   '{"heading": "House rules", "text": "How the tables run at RIVR. The floor applies them at every table."}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005b1', 2, 'rules', $${
    "rules": [
      "Members only, 18 and over. Check in at the front desk with the phone you signed up with.",
      "One player to a hand. No advice from the rail and no phones on the table while a hand is on.",
      "English at the table while a hand is on.",
      "Chips stay on the table until you cash out at the cage. Chips never leave the club.",
      "Seats go in waitlist order. A seat is held for 10 minutes once it is called.",
      "The floor decides any dispute at a table. Their decision on a hand is final.",
      "Treat dealers, staff and other players with respect. The floor may ask anyone to leave."
    ]
  }$$),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005b2', 1, 'hero',
   '{"heading": "Questions", "text": "Joining RIVR, paying and getting a seat."}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005b2', 2, 'faq', $${
    "questions": [
      {"question": "Who can join?", "answer": "Anyone 18 or over. Sign up in the app with your mobile number, then finish the identity check with DigiLocker and a selfie."},
      {"question": "What do you play?", "answer": "No-limit hold'em cash games from 50/100, a private room at 100/200, and tournaments on the calendar."},
      {"question": "How do I get a seat?", "answer": "Join the waitlist for a game in the app. It shows your number on the list and tells you when your seat is called."},
      {"question": "How do I pay and cash out?", "answer": "At the cage, by UPI or in cash. You cash out at the cage the same night."},
      {"question": "Can I learn to play here?", "answer": "Yes. RIVR Academy runs small batches with a coach. Book a seat from the app."}
    ]
  }$$),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005b3', 1, 'hero',
   '{"heading": "Visit RIVR", "text": "On the upper floor of Glaza, a licensed bar on M3M 65th Avenue."}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005b3', 2, 'map', $${
    "address": "Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram",
    "hours": "Open 14:00 to 08:00.",
    "directionsUrl": "https://www.google.com/maps/search/?api=1&query=Glaza%2C%20M3M%2065th%20Avenue%2C%20Gurugram"
  }$$),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005b4', 1, 'hero',
   '{"heading": "Responsible play"}'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005b4', 2, 'text', $${
    "body": "Poker is a game of skill, and you can still lose money at it. Play with money you can afford to lose, and stop when it stops being fun.\n\nSpeak to the front desk to set a limit on your play or to take a break from the club. A break you ask for is kept at the door, the waitlist and the cage until it ends."
  }$$)
on conflict (page_id, position) do nothing;

-- The careers draft gets its hero (the page's one h1) and its roles block, so the page is ready when
-- the owner publishes it.
update public.site_block set kind = 'hero', content = '{"heading": "Careers", "text": "Work at RIVR."}'
where page_id = '00000000-0000-4000-8000-0000000005a3' and position = 1;
insert into public.site_block (venue_id, page_id, position, kind, content) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000005a3', 2, 'careers', $${
    "roles": [],
    "apply": "Dealers and floor staff: openings soon."
  }$$)
on conflict (page_id, position) do nothing;
