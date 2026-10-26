-- The website comes with the club's venue (#406, #472; decision 0195). Its pages lived only in the local and
-- staging seed, and production is never seeded: its venue is made once with private.bootstrap_venue
-- (docs/runbooks/create-a-venue.md), and the console can't create a website page (the website editor, #129,
-- edits existing pages). So the bootstrap of the club's first venue now adds the website, as the seed had it on
-- 26 Oct, and this migration adds it to the club's venue made before, production's, through CI's release like
-- any migration. The website is the club's (decision 0036): a later room shares it, and the practice venue has
-- none. Marketing edits the pages in the console once #129 lands.

-- Every page of the club's website with its blocks, in the shape @rivr/contracts siteBlockSchema checks: the
-- front page and the header's pages in order, the footer's (house rules, questions, responsible play, the
-- Privacy page with the backups the privacy notice promises (#386), terms), the journal's articles, the
-- link-in-bio page and the careers draft. Once per page: a venue that has a page by that slug keeps it as it
-- is, edits included.
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pages constant jsonb := $site$
[
  {"slug": "about", "title": "About", "description": "RIVR, a members' poker club in Gurugram: the room, the standard and the rules.", "nav_position": 1, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "A members' poker club in Gurugram, built for players who want more from their game.", "eyebrow": "About us", "heading": "About RIVR"}, "position": 1},
    {"kind": "story", "content": {"alt": "A dealer in a waistcoat deals at a table", "image": "/media/dealers.webp", "eyebrow": "A new standard", "figures": [{"label": "Tables", "value": "6"}, {"label": "Rooms", "value": "2"}, {"label": "Doors open, until 08:00", "value": "14:00"}], "heading": "Poker, run properly.", "paragraphs": ["RIVR was born from a love of the game and impatience with how it is usually run: home games that end in arguments, rooms where nobody counts the pot, and cash-outs that take days.", "So we built the opposite. Trained dealers who log every hand, a cage that pays out the same night, a floor that applies one set of rules to everyone, and members who are verified before they sit down."]}, "position": 2},
    {"kind": "cards", "content": {"cards": [{"text": "Five in the main room and the Private Room.", "title": "Six tables"}, {"text": "Cash games from 50/100 up to the Private Room.", "title": "No-limit hold'em"}, {"text": "RIVR Sunday, our flagship, and the calendar around it.", "title": "Tournament nights"}, {"text": "UPI or cash in, and paid out the same night.", "title": "The cage"}, {"text": "Complimentary, and served at your seat.", "title": "The chef's menu"}, {"text": "18 and over, checked before they play.", "title": "Verified members"}], "eyebrow": "At a glance", "heading": "RIVR in six lines."}, "position": 3},
    {"kind": "timeline", "content": {"intro": "India's Supreme Court has long drawn the line between games of skill and games of chance. RIVR runs every table as a game of skill.", "items": [{"text": "The Supreme Court holds that rummy is mainly and preponderantly a game of skill.", "when": "1968", "title": "State of Andhra Pradesh v. K. Satyanarayana"}, {"text": "The Supreme Court sets the test that is still applied: whether skill predominates over chance.", "when": "1996", "title": "K.R. Lakshmanan v. State of Tamil Nadu"}], "eyebrow": "Legal and compliance", "heading": "Poker is a game of skill."}, "position": 4},
    {"kind": "cards", "content": {"cards": [{"text": "Deducted at the cage as the Income Tax Act requires.", "title": "TDS on winnings"}, {"text": "The cage asks for it, as the law requires for the amounts it pays.", "title": "Your PAN"}, {"text": "No lending between players, and no third-party buy-ins.", "title": "No credit between players"}, {"text": "Every buy-in, cash-out and hand is logged, so every night balances.", "title": "A full record"}], "eyebrow": "Tax and compliance", "heading": "Clean money, every night."}, "position": 5},
    {"kind": "cards", "content": {"cards": [{"link": {"page": "house-rules", "label": "Read the house rules"}, "text": "How the tables run at RIVR, applied at every table.", "title": "House rules"}, {"link": {"page": "responsible-play", "label": "Responsible play"}, "text": "Limits and breaks, kept at the door, the waitlist and the cage.", "title": "Responsible play"}], "heading": "Club policies"}, "position": 6},
    {"kind": "faq", "content": {"heading": "Questions", "questions": [{"answer": "On the upper floor of Glaza, M3M 65th Avenue, Sector 65, Gurugram.", "question": "Where is RIVR?"}, {"answer": "From 14:00 to 08:00, from Sunday 15 November.", "question": "When is it open?"}, {"answer": "Anyone 18 or over. Sign up in the app and finish the identity check with DigiLocker and a selfie.", "question": "Who can join?"}]}, "position": 7}
  ]},
  {"slug": "careers", "title": "Careers", "description": null, "nav_position": 2, "is_published": false, "blocks": [
    {"kind": "hero", "content": {"text": "Work at RIVR.", "heading": "Careers"}, "position": 1},
    {"kind": "careers", "content": {"apply": "Dealers and floor staff: openings soon.", "roles": []}, "position": 2}
  ]},
  {"slug": "membership", "title": "Membership", "description": "Join RIVR: tiers earned at the table, points for every hour, and how to sign up.", "nav_position": 2, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "RIVR is members only. Sign up in the app, finish your identity check, and take your seat.", "action": {"to": "sign-up", "label": "Join RIVR"}, "eyebrow": "Membership", "heading": "RIVR membership"}, "position": 1},
    {"kind": "cards", "content": {"cards": [{"text": "Six tables, the Private Room among them, and a floor that runs them properly.", "title": "The room"}, {"text": "Join from the app and get called to your seat.", "title": "The waitlist from home"}, {"text": "Brought to your seat while you play.", "title": "Food and drink"}, {"text": "Cash out at the cage by UPI or in cash.", "title": "Paid the same night"}], "heading": "What membership gives you"}, "position": 2},
    {"kind": "cards", "content": {"cards": [{"label": "Every member", "title": "Member", "points": ["Points for every hour you play", "RIVR Rewards: 5% of your rake back as points", "The waitlist from the app"]}, {"label": "After the Academy", "title": "Academy graduate", "points": ["Everything a member has", "₹1,000 on your first buy-in after you graduate"]}, {"label": "From the first night", "title": "Founders' Circle", "points": ["Everything a member has", "Waitlist priority, after a Black card at its stake"]}, {"label": "By invitation", "title": "Black card", "points": ["For the club's regulars at the higher stakes", "Its terms are set out before launch"]}], "eyebrow": "Tiers", "heading": "Earned at the table."}, "position": 3},
    {"kind": "table", "content": {"note": "Example rates: the club confirms its rates before launch. Only time seated at a table counts, not time away from it.", "rows": [["NLH 50/100", "5"], ["NLH 100/200", "10"], ["Private Room", "20"]], "intro": "Every hour you play earns points, more at the higher stakes. Points never turn into cash: they are for rewards.", "columns": ["Stake", "Points an hour"], "heading": "Points for every hour"}, "position": 4},
    {"kind": "cards", "content": {"cards": [{"text": "With your mobile number. It takes a minute.", "label": "01", "title": "Sign up in the app"}, {"text": "With DigiLocker and a selfie. You must be 18 or over.", "label": "02", "title": "Verify your identity"}, {"text": "Check in at the front desk with the card in your app, and the floor seats you.", "label": "03", "title": "Take your seat"}], "action": {"to": "sign-up", "label": "Join RIVR"}, "eyebrow": "How to join", "heading": "Three steps to your seat."}, "position": 5},
    {"kind": "faq", "content": {"heading": "Membership questions", "questions": [{"answer": "Signing up is free. You pay only for what you play, at the cage.", "question": "Does membership cost anything?"}, {"answer": "A phone with the RIVR app, and DigiLocker for the identity check. You must be 18 or over.", "question": "What do I need to join?"}, {"answer": "RIVR is members only, so every player at the table is verified. You can sign up on your way in.", "question": "Can I come without a membership?"}]}, "position": 6}
  ]},
  {"slug": "promotions", "title": "Promotions", "description": "What RIVR runs on the house, live from the floor.", "nav_position": 3, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "What RIVR runs for its members, live from the floor.", "action": {"to": "sign-up", "label": "Join RIVR"}, "eyebrow": "On the house", "heading": "Promotions"}, "position": 1},
    {"kind": "promotions", "content": {"heading": "Running now"}, "position": 2},
    {"kind": "cards", "content": {"cards": [{"text": "Every promotion is for verified members, and shows in the app as it runs.", "title": "Members only"}, {"text": "A bonus is credited to your balance and kept for its play; points are for rewards and never turn into cash.", "title": "Paid as bonus or points"}, {"text": "On who qualified and when, as with every rule at RIVR.", "title": "The floor's word is final"}], "eyebrow": "How they work", "heading": "Fair, and the same for everyone."}, "position": 3}
  ]},
  {"slug": "tournaments", "title": "Tournaments", "description": "RIVR's tournament calendar, from RIVR Sunday to the weekly games.", "nav_position": 4, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "RIVR Sunday, our flagship, and the tournament nights around it.", "eyebrow": "Tournaments", "heading": "Championship nights"}, "position": 1},
    {"kind": "calendar", "content": {"heading": "The calendar"}, "position": 2},
    {"kind": "cards", "content": {"cards": [{"text": "Buy in for the event at the cage, as for a cash game.", "title": "Register at the cage"}, {"text": "The same night, with TDS deducted as the law requires.", "title": "Paid at the cage"}], "eyebrow": "How they run", "heading": "A clock you can trust."}, "position": 3}
  ]},
  {"slug": "academy", "title": "RIVR Academy", "description": "Learn poker in a small batch with a RIVR coach.", "nav_position": 5, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "Learn the game in a small batch with a RIVR coach. Level 1 starts with the first batch.", "action": {"to": "academy", "label": "Book a seat"}, "heading": "RIVR Academy"}, "position": 1}
  ]},
  {"slug": "journal", "title": "Journal", "description": "Strategy, rules and etiquette, written by people who play.", "nav_position": 6, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "Strategy, rules and etiquette, written by people who play.", "eyebrow": "The journal", "heading": "Sharpen your game."}, "position": 1},
    {"kind": "cards", "content": {"cards": [{"link": {"page": "journal-holdem-basics", "label": "Read"}, "text": "The rules of no-limit hold'em, from the blinds to the showdown.", "label": "Learn", "title": "Texas Hold'em for beginners"}, {"link": {"page": "journal-plo-basics", "label": "Read"}, "text": "Four cards, two of them used, and a bet no bigger than the pot.", "label": "Learn", "title": "Pot-Limit Omaha: what changes"}, {"link": {"page": "journal-live-etiquette", "label": "Read"}, "text": "How a live table runs, and how to be the player others want beside them.", "label": "The room", "title": "Live poker etiquette"}, {"link": {"page": "journal-bankroll", "label": "Read"}, "text": "Playing within your means, so a bad night stays a bad night.", "label": "Strategy", "title": "Bankroll basics"}], "heading": "Articles"}, "position": 2}
  ]},
  {"slug": "visit", "title": "Visit", "description": "Upper floor, Glaza, M3M 65th Avenue, Gurugram.", "nav_position": 7, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "On the upper floor of Glaza, a licensed bar on M3M 65th Avenue.", "heading": "Visit RIVR"}, "position": 1},
    {"kind": "map", "content": {"email": "info@rivrpoker.com", "hours": "Open 14:00 to 08:00.", "address": "Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram", "directionsUrl": "https://www.google.com/maps/search/?api=1&query=Glaza%2C%20M3M%2065th%20Avenue%2C%20Gurugram"}, "position": 2}
  ]},
  {"slug": "home", "title": "RIVR Poker Club", "description": "Bring your poker face. A members' poker club at Glaza, M3M 65th Avenue, Gurugram. Opens Sunday 15 November.", "nav_position": null, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"note": "Concept visualisation", "text": "A members' poker club at Glaza, M3M 65th Avenue. Dealers at every table, a cage that pays out the same night, and a floor you follow from your phone. Opens Sunday 15 November.", "video": {"src": "/media/hero-room.mp4", "poster": "/media/hero-room.webp"}, "action": {"to": "sign-up", "label": "Join RIVR"}, "eyebrow": "RIVR Poker Club · Gurugram", "heading": "Bring your poker face."}, "position": 1},
    {"kind": "marquee", "content": {"phrases": ["Play", "Connect", "Belong", "Members only", "Six tables", "Opens 15 November", "Hold your nerve", "Gurugram"]}, "position": 2},
    {"kind": "story", "content": {"alt": "The main room under its chandeliers", "image": "/media/room.webp", "action": {"to": "sign-up", "label": "Join RIVR"}, "eyebrow": "Our story", "figures": [{"label": "Tables, from 50/100 to the Private Room", "value": "6"}, {"label": "Verified members at every seat", "value": "18+"}, {"label": "The smallest chip", "value": "₹50"}, {"label": "Cash-outs at the cage", "value": "Same night"}], "heading": "Good hands. Better company.", "paragraphs": ["RIVR opens on Sunday 15 November with one idea: Gurugram's serious players deserve a room built for them.", "Not a casino, and not a card table in the corner of a bar. A members' club on the upper floor of Glaza, where every player is verified, every dealer is trained, and every decision at the table is yours."]}, "position": 3},
    {"kind": "cards", "content": {"cards": [{"text": "Poker is a game of skill, so we run it like one.", "label": "01 · Play", "title": "The game, done properly.", "points": ["Trained dealers on a rotation", "No-limit hold'em, from 50/100", "Every hand logged at the table", "The floor's decision is final"]}, {"text": "The best part of a good game is who sits across from you.", "label": "02 · Connect", "title": "A room full of regulars.", "points": ["Tournament nights", "RIVR Sunday, our flagship", "Promotions for members"]}, {"link": {"page": "membership", "label": "See membership"}, "text": "Everyone here is verified, known and looked after.", "label": "03 · Belong", "title": "Members, not customers.", "points": ["Points for every hour you play", "Waitlist priority for the Founders' Circle", "A host who knows your game"]}], "intro": "Three words, and three promises to every member who walks in.", "eyebrow": "What we stand for", "heading": "Play. Connect. Belong."}, "position": 4},
    {"kind": "statement", "content": {"text": "Cash games and tournaments dealt by casino-trained dealers, with every hand logged at the table.", "lines": ["Not luck.", "A game of skill."], "eyebrow": "The RIVR difference"}, "position": 5},
    {"kind": "gallery", "content": {"note": "Concept visualisation", "intro": "Everything around the table is looked after, so the game is all you think about.", "items": [{"alt": "A host greets members at the club's door", "text": "Members and their guests only.", "image": "/media/members.webp", "title": "A private members' club"}, {"alt": "A dealer in a waistcoat deals at a table", "text": "Fast, accurate, fair.", "image": "/media/dealers.webp", "title": "Casino-trained dealers"}, {"alt": "A cashier counts chips at the cage", "text": "Clean counts, paid out the same night.", "image": "/media/cashier.webp", "title": "Instant, secure cashier"}, {"alt": "A private table under a single lamp", "text": "Discreet, for bigger action.", "image": "/media/private-room.webp", "title": "Private high-stakes room"}, {"alt": "A plate served beside a table in play", "text": "Served at your seat.", "image": "/media/chefs-menu.webp", "title": "Complimentary chef's menu"}, {"alt": "A chauffeur holds a car door outside the club at night", "text": "Chauffeured rides for regulars.", "image": "/media/pick-up.webp", "title": "Pick-up and drop"}, {"alt": "Friends laughing together at a table in the club", "text": "A room where everyone is at home at the table.", "image": "/media/built-for-her.webp", "title": "Built for her, too"}, {"alt": "The main room under its chandeliers", "text": "A dealer at every table, every night.", "image": "/media/room.webp", "title": "The main room"}], "eyebrow": "Inside RIVR", "heading": "Built for the long session."}, "position": 6},
    {"kind": "cards", "content": {"cards": [{"text": "Five tables of no-limit hold'em, from 50/100 to 100/200, each with its dealer and its tablet.", "title": "The main room"}, {"text": "One table at 100/200 with a compulsory ₹500 straddle, for the game you want behind a door.", "title": "The Private Room"}, {"text": "On a rotation, with every pot counted and every hand logged on the table's tablet.", "title": "Trained dealers"}, {"text": "Buy in by UPI or in cash. Cash out the same night.", "title": "The cage"}, {"text": "Complimentary, and served at your seat.", "title": "The chef's menu"}, {"text": "CCTV across the club, staff on the floor, and verified members only.", "title": "Safe and secure"}], "intro": "The upper floor of Glaza, on M3M 65th Avenue. Built so the only thing on your mind is the next decision.", "eyebrow": "The room", "heading": "Everything around the felt."}, "position": 7},
    {"kind": "games", "content": {"heading": "Pick your table."}, "position": 8},
    {"kind": "cards", "content": {"cards": [{"text": "The chef's menu, served without leaving the table.", "title": "At your seat"}, {"text": "A host who knows your game and takes care of the details.", "title": "Your host"}, {"text": "Chauffeured rides for regulars, and a cab home from your fourth visit in a month.", "title": "Pick-up and drop"}, {"text": "See tonight's tables, join the waitlist from home and get called to your seat.", "title": "The RIVR app"}], "intro": "You come for the game. Everything else is our job.", "quote": "The only thing on your mind should be the next decision.", "eyebrow": "Hospitality", "heading": "Looked after, every hour."}, "position": 9},
    {"kind": "cards", "content": {"cards": [{"text": "18 and over, with your identity checked by DigiLocker and a selfie before you take a seat.", "title": "Members only"}, {"text": "CCTV across the club, and a floor manager on every shift.", "title": "Watched, always"}, {"link": {"page": "house-rules", "label": "Read the house rules"}, "text": "Collusion, chip dumping and soft play are banned. One player to a hand. The floor's decision is final.", "title": "Fair play"}, {"text": "No credit between players. Chips never leave the club, and the cage pays out to you and you alone.", "title": "Clean money"}, {"text": "TDS is deducted on winnings as the law requires, and the cage asks for your PAN.", "title": "Tax compliant"}, {"link": {"page": "responsible-play", "label": "Responsible play"}, "text": "Set a limit or take a break whenever you like. The door, the waitlist and the cage keep it.", "title": "Play responsibly"}], "intro": "A members' club is only as good as the rules behind it. Ours are simple, strict and the same for everyone.", "eyebrow": "The standard", "heading": "Played straight. Every hand."}, "position": 10},
    {"kind": "timeline", "content": {"intro": "India's Supreme Court has long drawn the line between games of skill and games of chance.", "items": [{"text": "The Supreme Court holds that rummy is mainly and preponderantly a game of skill.", "when": "1968", "title": "State of Andhra Pradesh v. K. Satyanarayana"}, {"text": "The Supreme Court sets the test that is still applied: whether skill predominates over chance.", "when": "1996", "title": "K.R. Lakshmanan v. State of Tamil Nadu"}], "eyebrow": "On the record", "heading": "A game of skill, on the record."}, "position": 11},
    {"kind": "cards", "content": {"cards": [{"text": "Where everyone starts: the waitlist from the app, points for every hour, and RIVR Rewards on your rake.", "label": "Every member", "title": "Member"}, {"text": "For members who finish RIVR Academy: ₹1,000 on your first buy-in after you graduate.", "label": "After the Academy", "title": "Academy graduate"}, {"text": "For the members who open the club with us: waitlist priority, after a Black card at its stake.", "label": "From the first night", "title": "Founders' Circle"}, {"text": "For the club's regulars at the higher stakes. The club sets out its terms before launch.", "label": "By invitation", "title": "Black card"}], "intro": "RIVR is members only. Every player signs up and is verified before they play.", "action": {"to": "sign-up", "label": "Join RIVR"}, "eyebrow": "Join the inner circle", "heading": "Earned at the table. Not bought."}, "position": 12},
    {"kind": "feature", "content": {"alt": "The RIVR app's Home: tonight's tables with their open seats, the bad-beat jackpot and the next tournament", "text": "See tonight's tables and their open seats, join the waitlist before you leave home, and get called to your seat.", "image": "/media/app-home.webp", "action": {"to": "waitlist", "label": "Join the waitlist"}, "points": ["Live tables", "The waitlist", "Your seat, held"], "eyebrow": "The RIVR app", "heading": "Done waiting for a seat?"}, "position": 13},
    {"kind": "cards", "content": {"cards": [{"link": {"page": "tournaments", "label": "Full calendar"}, "text": "RIVR Sunday, our flagship, and the tournament nights around it.", "label": "Tournaments", "title": "Tournament nights", "points": ["RIVR Sunday", "The calendar, live"]}, {"link": {"page": "promotions", "label": "See promotions"}, "text": "Rewards dealt at every table, for members only.", "label": "House promotions", "title": "On the house", "points": ["High hands", "The bad-beat jackpot", "Buy-in bonus Tuesday", "₹1,000 for each side of a referral"]}], "intro": "Tournament nights and house promotions, for members who like a little more on the line.", "eyebrow": "What's on", "heading": "Always something on the felt."}, "position": 14},
    {"kind": "calendar", "content": {"heading": "Tournaments"}, "position": 15},
    {"kind": "cards", "content": {"cards": [{"link": {"page": "journal-holdem-basics", "label": "Read"}, "label": "Learn", "title": "Texas Hold'em for beginners"}, {"link": {"page": "journal-plo-basics", "label": "Read"}, "label": "Learn", "title": "Pot-Limit Omaha: what changes"}, {"link": {"page": "journal-live-etiquette", "label": "Read"}, "label": "The room", "title": "Live poker etiquette"}, {"link": {"page": "journal-bankroll", "label": "Read"}, "label": "Strategy", "title": "Bankroll basics"}], "intro": "Strategy, rules and etiquette, written by people who play.", "eyebrow": "The journal", "heading": "Sharpen your game."}, "position": 16},
    {"kind": "faq", "content": {"heading": "Good questions.", "questions": [{"answer": "A members' poker club on the upper floor of Glaza, M3M 65th Avenue, Gurugram: six tables of no-limit hold'em from 50/100, the Private Room among them, tournaments every week, and a cage that pays out the same night. It opens on Sunday 15 November.", "question": "What is RIVR?"}, {"answer": "Sign up in the RIVR app with your mobile number, then finish the identity check with DigiLocker and a selfie. You must be 18 or over. Check in at the front desk with the card in your app.", "question": "How do I become a member?"}, {"answer": "Yes. The dealers and the floor will walk you through how the room runs, 50/100 is a comfortable place to start, and RIVR Academy teaches the game in small batches with a coach.", "question": "I'm new to live poker. Is RIVR for me?"}, {"answer": "At the cage, by UPI or in cash. You cash out at the cage the same night. TDS is deducted on winnings as the law requires, and the cage asks for your PAN.", "question": "How do I pay and cash out?"}, {"answer": "From 14:00 to 08:00, from Sunday 15 November.", "question": "When is RIVR open?"}]}, "position": 17},
    {"kind": "statement", "content": {"note": "Concept visualisation", "text": "Upper floor, Glaza, M3M 65th Avenue, Gurugram.", "image": "/media/chips.webp", "lines": ["Hold your nerve."], "action": {"to": "sign-up", "label": "Join RIVR"}, "eyebrow": "Opens Sunday 15 November"}, "position": 18},
    {"kind": "map", "content": {"email": "info@rivrpoker.com", "hours": "Open 14:00 to 08:00.", "address": "Upper floor, Glaza, M3M 65th Avenue, Gurugram", "heading": "Find us", "directionsUrl": "https://www.google.com/maps/search/?api=1&query=Glaza%2C%20M3M%2065th%20Avenue%2C%20Gurugram"}, "position": 19}
  ]},
  {"slug": "house-rules", "title": "House rules", "description": "How the tables run at RIVR.", "nav_position": null, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "How the tables run at RIVR. The floor applies them at every table.", "heading": "House rules"}, "position": 1},
    {"kind": "rules", "content": {"rules": ["Members only, 18 and over. Check in at the front desk with the phone you signed up with.", "One player to a hand. No advice from the rail and no phones on the table while a hand is on.", "English at the table while a hand is on.", "Chips stay on the table until you cash out at the cage. Chips never leave the club.", "Seats go in waitlist order. A seat is held for 10 minutes once it is called.", "The floor decides any dispute at a table. Their decision on a hand is final.", "Treat dealers, staff and other players with respect. The floor may ask anyone to leave."]}, "position": 2}
  ]},
  {"slug": "journal-bankroll", "title": "Bankroll basics", "description": "Playing within your means, so a bad night stays a bad night.", "nav_position": null, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "Playing within your means, so a bad night stays a bad night.", "eyebrow": "Strategy", "heading": "Bankroll basics"}, "position": 1},
    {"kind": "text", "content": {"body": "Your bankroll is the money you set aside for poker, and only for poker. It is not rent, savings or anything you would miss. Decide it before you play, and keep it apart from everything else.\n\nPlay a stake your bankroll can carry. Even the best players lose for nights or weeks at a time. A common guide for cash games is to hold twenty buy-ins or more for the stake you play: at 50/100, with a ₹5,000 buy-in, that is ₹1,00,000.\n\nMove down when you lose, not up. Chasing losses at a higher stake turns a bad night into a bad month.\n\nSet a stop for the night, win or lose, and keep to it. RIVR can hold a limit or a break for you if you ask: speak to the front desk, and the door, the waitlist and the cage will keep it until it ends.\n\nPoker is a game of skill, and you can still lose money at it. Play with money you can afford to lose."}, "position": 2}
  ]},
  {"slug": "journal-holdem-basics", "title": "Texas Hold'em for beginners", "description": "The rules of No-Limit Hold'em, from the blinds to the showdown.", "nav_position": null, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "The rules of no-limit hold'em, from the blinds to the showdown.", "eyebrow": "Learn", "heading": "Texas Hold'em for beginners"}, "position": 1},
    {"kind": "text", "content": {"body": "Each player gets two cards face down. Five cards are dealt face up in the middle over three rounds: three at once (the flop), then one (the turn), then one more (the river). Your hand is the best five cards from your two and the five on the table.\n\nBefore any card is dealt, the two players left of the button put in the blinds: the small blind and the big blind. At 50/100 that is ₹50 and ₹100. Then each player in turn folds, calls the bet, or raises. In no-limit, a raise can be any amount up to everything in front of you.\n\nThere is a round of betting before the flop, after the flop, after the turn and after the river. If more than one player is left at the end, the hands are shown and the best one wins the pot.\n\nThe hands, best first: royal flush, straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, one pair, high card.\n\nWhere to start: play fewer hands than you think, and play them with a raise. Position matters: acting last tells you what everyone else did first. And at a live table, take your time. The dealer will wait."}, "position": 2}
  ]},
  {"slug": "journal-live-etiquette", "title": "Live poker etiquette", "description": "How a live table runs, and how to be the player others want beside them.", "nav_position": null, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "How a live table runs, and how to be the player others want beside them.", "eyebrow": "The room", "heading": "Live poker etiquette"}, "position": 1},
    {"kind": "text", "content": {"body": "Act in turn. Wait until the action reaches you before you fold, call or raise, even when you know what you will do. Acting early gives away information and can change the hand for others.\n\nSay what you are doing. A clear \"call\" or \"raise to five hundred\" is binding and avoids disputes. Put your chips in one motion: a bet made in several trips can be read as a string bet, which the floor will not allow.\n\nKeep your cards on the table and in view. Protect them with a chip, and never show them to a player still in the hand.\n\nOne player to a hand. Nobody advises a player during a hand, from the table or the rail. Phones stay off the table while a hand is on.\n\nIf something goes wrong, call the floor. The floor decides any dispute, and their decision on a hand is final. Tip the dealer if you like: it is not expected, and it is always appreciated."}, "position": 2}
  ]},
  {"slug": "journal-plo-basics", "title": "Pot-Limit Omaha: what changes", "description": "Four cards, two of them used, and a bet no bigger than the pot.", "nav_position": null, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "Four cards, two of them used, and a bet no bigger than the pot.", "eyebrow": "Learn", "heading": "Pot-Limit Omaha: what changes"}, "position": 1},
    {"kind": "text", "content": {"body": "Omaha is dealt like hold'em, with a flop, a turn and a river, but each player gets four cards instead of two. The catch: your hand must use exactly two of your four cards and exactly three from the table. Four hearts in your hand and one on the table is not a flush.\n\nIn pot-limit, the largest bet you can make is the size of the pot, counting the call you would make first. The dealer will tell you the figure if you ask for the pot.\n\nWhat changes in play: with four cards each, hands run closer together, and big hands are common. A set or two pair that wins often in hold'em is often behind in Omaha. Draws are stronger too, because there are more ways to complete them.\n\nStart with hands whose four cards work together: pairs that can make sets, suited cards that can make the best flush, and connected cards that can make straights. Four cards that do not help one another rarely win a big pot."}, "position": 2}
  ]},
  {"slug": "links", "title": "RIVR Poker Club", "description": "Join the waitlist, tonight's games, RIVR Academy and how to find us.", "nav_position": null, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "A members' poker club on the upper floor of Glaza, Gurugram.", "heading": "RIVR Poker Club"}, "position": 1},
    {"kind": "links", "content": {"links": [{"to": "waitlist", "label": "Join the waitlist"}, {"to": "academy", "label": "Book RIVR Academy"}, {"to": "sign-up", "label": "Join RIVR"}]}, "position": 2},
    {"kind": "games", "content": {"heading": "Tonight's games"}, "position": 3},
    {"kind": "map", "content": {"hours": "Open 14:00 to 08:00.", "address": "Upper floor, Glaza, M3M 65th Avenue, Sector 65, Gurugram", "heading": "Find us", "directionsUrl": "https://www.google.com/maps/search/?api=1&query=Glaza%2C%20M3M%2065th%20Avenue%2C%20Gurugram"}, "position": 4}
  ]},
  {"slug": "privacy", "title": "Privacy", "description": "The personal data RIVR keeps, and its backups.", "nav_position": null, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "The personal data RIVR keeps, and its backups.", "heading": "Privacy"}, "position": 1},
    {"kind": "text", "content": {"body": "Backups. Every night RIVR takes an encrypted backup of its records, so the club can recover from a failure. Backups hold personal data, the photos from identity checks included. Each night's backup is kept for 35 days, and one backup a month for 400 days, then deleted. Personal data can be in a backup for up to 400 days.\n\nErasure. When your data is erased at your request, a backup taken before then still holds it until that backup is deleted. If RIVR ever restores a backup, every erasure made since it was taken is made again before the restored records are used."}, "position": 2}
  ]},
  {"slug": "questions", "title": "Questions", "description": "Joining RIVR, paying and getting a seat.", "nav_position": null, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "Joining RIVR, paying and getting a seat.", "heading": "Questions"}, "position": 1},
    {"kind": "faq", "content": {"questions": [{"answer": "Anyone 18 or over. Sign up in the app with your mobile number, then finish the identity check with DigiLocker and a selfie.", "question": "Who can join?"}, {"answer": "No-limit hold'em cash games from 50/100, a private room at 100/200, and tournaments on the calendar.", "question": "What do you play?"}, {"answer": "Join the waitlist for a game in the app. It shows your number on the list and tells you when your seat is called.", "question": "How do I get a seat?"}, {"answer": "At the cage, by UPI or in cash. You cash out at the cage the same night.", "question": "How do I pay and cash out?"}, {"answer": "Yes. RIVR Academy runs small batches with a coach. Book a seat from the app.", "question": "Can I learn to play here?"}]}, "position": 2}
  ]},
  {"slug": "responsible-play", "title": "Responsible play", "description": "Limits, breaks and self-exclusion at RIVR.", "nav_position": null, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"heading": "Responsible play"}, "position": 1},
    {"kind": "text", "content": {"body": "Poker is a game of skill, and you can still lose money at it. Play with money you can afford to lose, and stop when it stops being fun.\n\nSpeak to the front desk to set a limit on your play or to take a break from the club. A break you ask for is kept at the door, the waitlist and the cage until it ends."}, "position": 2}
  ]},
  {"slug": "terms", "title": "Terms of use", "description": "The terms of RIVR's website and app.", "nav_position": null, "is_published": true, "blocks": [
    {"kind": "hero", "content": {"text": "The terms of RIVR's website and app.", "heading": "Terms of use"}, "position": 1},
    {"kind": "text", "content": {"body": "RIVR publishes its full terms of use here before the club opens on Sunday 15 November. Until then, the house rules apply at the club, and the privacy notice says what personal data RIVR keeps.\n\nQuestions about these terms: info@rivrpoker.com."}, "position": 2}
  ]}
]
$site$::jsonb;
  v_page jsonb;
  v_page_id uuid;
begin
  for v_page in select p.value from jsonb_array_elements(v_pages) p loop
    v_page_id := null;
    insert into public.site_page (venue_id, slug, title, description, nav_position, is_published)
    values (p_venue_id, v_page ->> 'slug', v_page ->> 'title', v_page ->> 'description', (v_page ->> 'nav_position')::integer,
            (v_page ->> 'is_published')::boolean)
    on conflict (venue_id, slug) do nothing
    returning id into v_page_id;
    if v_page_id is not null then
      insert into public.site_block (venue_id, page_id, position, kind, content)
      select p_venue_id, v_page_id, (b.value ->> 'position')::integer, b.value ->> 'kind', b.value -> 'content'
      from jsonb_array_elements(v_page -> 'blocks') b;
    end if;
  end loop;
end;
$$;

revoke execute on function private.add_website(uuid) from public, anon, authenticated;

-- As before (20261026235100_tournament_accounts.sql), adding the website to the club's first venue.
create or replace function private.bootstrap_venue(
  p_venue_id uuid,
  p_name text,
  p_slug text,
  p_is_practice boolean,
  p_legal_name text,
  p_address text,
  p_invoice_prefix text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_tier_id uuid;
begin
  if exists (select 1 from public.venue v where v.id = p_venue_id) then
    return p_venue_id;
  end if;

  insert into public.venue (id, name, slug, is_practice) values (p_venue_id, p_name, p_slug, p_is_practice);
  insert into public.venue_config (venue_id, legal_name, address, invoice_prefix)
  values (p_venue_id, p_legal_name, p_address, p_invoice_prefix);
  insert into public.invoice_series (venue_id, code, name) values (p_venue_id, 'S', 'Club services');

  insert into public.tier (venue_id, name, rank) values
    (p_venue_id, 'Member', 1), (p_venue_id, 'Academy graduate', 2),
    (p_venue_id, 'Founders'' Circle', 3), (p_venue_id, 'Black card', 4);
  select t.id into member_tier_id from public.tier t where t.venue_id = p_venue_id and t.name = 'Member';

  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tier.default', '', jsonb_build_object('tier_id', member_tier_id), '-infinity', 'Venue created');
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'tds.config', '',
          '{"enabled": false, "section": "194B", "rate_basis_points": 3000, "threshold_paise": 1000000, "basis": "financial_year", "pan_required": true, "no_pan_rate_basis_points": 3000}',
          '-infinity', 'Switched off until the owner sets TDS (#22)');
  insert into public.setting (venue_id, key, subject, value, effective_from, reason)
  values (p_venue_id, 'gst.config', '', '{"rate_basis_points": 1800, "basis": "rake"}', '-infinity', 'A placeholder until the owner sets GST (#23)');

  insert into public.tier_feature (venue_id, tier_id, feature_key, is_enabled, display_mode, effective_from)
  select p_venue_id, t.id, f.key, true, 'locked', '-infinity'
  from public.tier t cross join public.feature f
  where t.venue_id = p_venue_id and f.is_gateable;

  insert into public.ledger_account (venue_id, code, name, kind, unit, is_players_money) values
    (p_venue_id, 'venue.cash_drawer', 'Cash drawer', 'asset', 'paise', false),
    (p_venue_id, 'venue.bank', 'Bank and UPI', 'asset', 'paise', false),
    (p_venue_id, 'venue.chips_outstanding', 'Chips in play', 'liability', 'paise', true),
    (p_venue_id, 'venue.rake', 'Rake', 'revenue', 'paise', false),
    (p_venue_id, 'venue.jackpot.main', 'Bad-beat jackpot', 'liability', 'paise', true),
    (p_venue_id, 'venue.jackpot.season', 'Season jackpot pool', 'liability', 'paise', true),
    (p_venue_id, 'venue.jackpot.freeroll', 'Freeroll jackpot pool', 'liability', 'paise', true),
    (p_venue_id, 'venue.bonus_expense', 'Bonus issued', 'expense', 'paise', false),
    (p_venue_id, 'venue.high_hand_expense', 'High hands paid', 'expense', 'paise', false),
    (p_venue_id, 'venue.withdrawals_pending', 'Withdrawals waiting to be paid', 'liability', 'paise', true),
    (p_venue_id, 'venue.tds_payable', 'TDS withheld, to be paid to the government', 'liability', 'paise', false),
    (p_venue_id, 'venue.tournament_pool', 'Tournament prize pools', 'liability', 'paise', true),
    (p_venue_id, 'venue.tournament_fees', 'Tournament fees', 'revenue', 'paise', false),
    (p_venue_id, 'venue.tournament_overlay', 'Tournament overlay', 'expense', 'paise', false),
    (p_venue_id, 'venue.points_issued', 'Points issued', 'expense', 'points', false),
    (p_venue_id, 'venue.opening_balance', 'Opening balances', 'equity', 'paise', false),
    (p_venue_id, 'venue.points_opening_balance', 'Opening points', 'equity', 'points', false);

  insert into public.chip_denomination (venue_id, value_paise, name)
  select p_venue_id, rupees * 100, '₹' || to_char(rupees, 'FM99,99,999')
  from unnest(array[50, 100, 500, 1000, 5000, 25000]) as rupees;

  if p_is_practice then
    perform private.add_certification_quizzes(p_venue_id);
  end if;

  perform private.add_training_sops(p_venue_id);
  perform private.add_promotion_templates(p_venue_id);
  if not p_is_practice and not exists (select 1 from public.venue v where not v.is_practice and v.id <> p_venue_id) then
    perform private.add_website(p_venue_id);
  end if;

  return p_venue_id;
end;
$$;

-- The club's venue made before this, if any: production's, and staging's, which keeps its seeded pages.
select private.add_website(club.id)
from (select v.id from public.venue v where not v.is_practice order by v.created_at limit 1) club;
