-- The website's words in grandpokerarena.com's way (#619, decision 0283; the owner's parity list of 29 Oct). Club facts
-- the owner has not given yet are placeholders ("Details to follow").
--
-- What is added:
-- - New pages: the Leaderboard; two journal articles; and "Is poker legal in Gurugram?", kept a draft until the
--   owner's lawyer has read it.
-- - The live blocks of #617 and #618 on Membership (the welcome offer, rewards, outstation) and Promotions (the jackpot).
-- - On the front page: the room's hours and amenities, valet and parking in hospitality, more questions, and the rulings,
--   each linked to its judgment. About gets the same rulings and links.
-- - The figures the pages wrote in words (RIVR Rewards' share, the graduate's bonus, the cab's visits) give way to words
--   that point to the rules in force, as those now come from the settings and promotions.
--
-- It only adds. A page, block, card, question or ruling already there is kept as it is, so words the club has changed
-- in the console's editor stay. The one exception is Membership's points table of example rates, which gives way to the
-- rules in force, and only while it still reads as first written. A club made from now on gets all of this through
-- private.add_website; the club made before (staging's, production's) gets it below.

-- A block placed on a page after the block at `p_after`, moving those after it down one.
create function private.place_site_block(p_page_id uuid, p_after integer, p_kind text, p_content jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_block uuid;
begin
  -- From the last up, so each moves into a place already free: a place on a page is taken once.
  for v_block in select id from public.site_block where page_id = p_page_id and position > p_after order by position desc loop
    update public.site_block set position = position + 1 where id = v_block;
  end loop;
  insert into public.site_block (venue_id, page_id, position, kind, content)
  select p.venue_id, p.id, p_after + 1, p_kind, p_content from public.site_page p where p.id = p_page_id;
end;
$$;

-- A page with its blocks in order, unless the venue has a page by that slug already.
create function private.add_site_page(p_venue_id uuid, p_page jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page_id uuid;
begin
  insert into public.site_page (venue_id, slug, title, description, nav_position, is_published)
  values (p_venue_id, p_page ->> 'slug', p_page ->> 'title', p_page ->> 'description', null, (p_page ->> 'is_published')::boolean)
  on conflict (venue_id, slug) do nothing
  returning id into v_page_id;
  if v_page_id is null then return; end if;
  insert into public.site_block (venue_id, page_id, position, kind, content)
  select p_venue_id, v_page_id, b.position, b.block ->> 'kind', b.block -> 'content'
  from jsonb_array_elements(p_page -> 'blocks') with ordinality b(block, position);
end;
$$;

-- The items of a list in a block's content, with those of `p_more` it lacks (by `p_key`) after them.
create function private.with_more(p_items jsonb, p_more jsonb, p_key text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_items, '[]'::jsonb) || coalesce((
    select jsonb_agg(m order by n) from jsonb_array_elements(p_more) with ordinality t(m, n)
    where not exists (select 1 from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i where i ->> p_key = m ->> p_key)), '[]'::jsonb);
$$;

-- The four rulings, each with its judgment, as both On the record bands list them.
create function private.on_the_record_rulings()
returns jsonb
language sql
immutable
set search_path = ''
as $json$
  select $j$[
    {"when": "1968", "title": "State of Andhra Pradesh v. K. Satyanarayana", "text": "The Supreme Court holds that rummy is mainly and preponderantly a game of skill.",
     "link": {"label": "Read the judgment", "href": "https://indiankanoon.org/doc/84963/"}},
    {"when": "1996", "title": "K.R. Lakshmanan v. State of Tamil Nadu", "text": "The Supreme Court sets the test that is still applied: whether skill predominates over chance.",
     "link": {"label": "Read the judgment", "href": "https://indiankanoon.org/doc/1248365/"}},
    {"when": "2013", "title": "Indian Poker Association v. State of Karnataka", "text": "The Karnataka High Court holds that poker played as a game of skill needs no gaming licence.",
     "link": {"label": "Read the judgment", "href": "https://indiankanoon.org/doc/28000869/"}},
    {"when": "2017", "title": "Varun Gumber v. Union Territory of Chandigarh", "text": "The Punjab and Haryana High Court, the High Court for Gurugram, holds that games where skill predominates are not gambling. The Supreme Court dismissed the appeal.",
     "link": {"label": "The Supreme Court's order", "href": "https://indiankanoon.org/doc/160942730/"}}
  ]$j$::jsonb;
$json$;

-- A timeline's items, each ruling it has given its judgment's link, then the rulings it lacks.
create function private.with_rulings(p_items jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select private.with_more((
    select jsonb_agg(case when i ? 'link' then i
                          else i || coalesce((select jsonb_build_object('link', r -> 'link') from jsonb_array_elements(private.on_the_record_rulings()) r
                                              where r ->> 'title' = i ->> 'title'), '{}'::jsonb) end order by n)
    from jsonb_array_elements(p_items) with ordinality t(i, n)), private.on_the_record_rulings(), 'title');
$$;

create function private.add_website_parity(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page uuid;
  v_after integer;
begin
  if not exists (select 1 from public.venue v where v.id = p_venue_id and not v.is_practice) then return; end if;

  perform private.add_site_page(p_venue_id, $j${"slug": "leaderboard", "title": "Leaderboard", "is_published": true,
    "description": "The RIVR League: this month's standings and this season's, from cash games and tournaments.",
    "blocks": [
      {"kind": "hero", "content": {"eyebrow": "Leaderboard", "heading": "The RIVR League", "text": "Every hour at the tables and every tournament finish earns League points. Here is where everyone stands, this month and this season.", "action": {"to": "sign-up", "label": "Join RIVR"}}},
      {"kind": "league", "content": {"heading": "This month"}},
      {"kind": "cards", "content": {"eyebrow": "How it works", "heading": "Points for playing.", "cards": [
        {"title": "Cash games", "text": "Every hour seated at a cash table earns League points, more at the higher stakes."},
        {"title": "Tournaments", "text": "Every finish earns points for taking part, and more for the final table and the top three."},
        {"title": "Your name", "text": "The standings show a first name and initial. Turn off Show my name on the club's TVs in your profile in the app, and it is hidden here too."}]}}
    ]}$j$::jsonb);

  perform private.add_site_page(p_venue_id, $j${"slug": "journal-cash-game-tips", "title": "Cash game tips for the live table", "is_published": true,
    "description": "Habits that save chips at a live cash game, from the first hand to the last.",
    "blocks": [
      {"kind": "hero", "content": {"eyebrow": "Strategy", "heading": "Cash game tips for the live table", "text": "Habits that save chips at a live cash game, from the first hand to the last."}},
      {"kind": "text", "content": {"body": "Play fewer hands, and play them harder. Most chips at a live table are lost by calling with hands that were never good enough to start with. Fold more before the flop, and raise the hands you do play rather than limping in.\n\nPosition is worth more than cards. Acting last lets you see what everyone else does first. Open more hands on the button and in the cut-off, and fewer from the blinds and the first seats after them.\n\nWatch the table while you are not in a hand. Who calls too much, who only bets when they have it, who tilts after losing a pot: the next hour is decided by what you notice now.\n\nSize your bets for a reason. Bet bigger for value against players who call too much, and smaller when you only want to take the pot down. A bet with no reason behind it costs chips either way.\n\nDo not pay off the big bet on the river without a plan. Live players bluff the river less than you think. If the story does not hold together, a fold is fine.\n\nKeep your stack in line with your bankroll, and leave when you are tired or tilted. A long session is only worth it while you are playing your best.\n\nPoker is a game of skill, and you can still lose money at it. Play with money you can afford to lose."}}
    ]}$j$::jsonb);

  perform private.add_site_page(p_venue_id, $j${"slug": "journal-tournaments-gurugram", "title": "Poker tournaments in Gurugram", "is_published": true,
    "description": "How a live tournament runs at RIVR, from the buy-in to the final table.",
    "blocks": [
      {"kind": "hero", "content": {"eyebrow": "Tournaments", "heading": "Poker tournaments in Gurugram", "text": "How a live tournament runs at RIVR, from the buy-in to the final table."}},
      {"kind": "text", "content": {"body": "A tournament is one buy-in for a stack of chips. The blinds rise on a clock, players drop out as they lose their chips, and the prize pool is paid to the places at the top.\n\nThe calendar on the Tournaments page lists every event with its start, its buy-in and any guarantee. Register in the RIVR app or at the front desk, and be seated before the first level starts.\n\nThe clock runs on the TVs and on every table's tablet, so everyone sees the same level, the same blinds and the same time to the break. A late registration window, where an event has one, is shown on the clock too.\n\nEarly on, the blinds are small next to the stacks: play patiently and pick your spots. As the blinds rise, every pot matters more, and a short stack has to push or fold. At the final table, the pay jumps make every decision count.\n\nEvery finish earns RIVR League points, more for the final table and the top three. The standings are on the Leaderboard page.\n\nPoker is a game of skill, and you can still lose money at it. Play with money you can afford to lose."}}
    ]}$j$::jsonb);

  -- General information drafted from the rulings and Haryana's Act, a draft until the owner's lawyer has read it.
  perform private.add_site_page(p_venue_id, $j${"slug": "journal-poker-legal-gurugram", "title": "Is poker legal in Gurugram?", "is_published": false,
    "description": "What India's courts and Haryana's law say about poker as a game of skill.",
    "blocks": [
      {"kind": "hero", "content": {"eyebrow": "The law", "heading": "Is poker legal in Gurugram?", "text": "What India's courts and Haryana's law say about poker as a game of skill."}},
      {"kind": "text", "content": {"body": "India's gambling laws are written by each state, and every one of them treats a game of skill differently from a game of chance.\n\nThe Supreme Court drew that line in 1968, when it held in State of Andhra Pradesh v. K. Satyanarayana that rummy is mainly and preponderantly a game of skill. In 1996, in K.R. Lakshmanan v. State of Tamil Nadu, it set the test courts still apply: whether skill predominates over chance.\n\nPoker has been tested against it. In 2013 the Karnataka High Court held, in Indian Poker Association v. State of Karnataka, that poker played as a game of skill needs no gaming licence.\n\nIn Haryana, the Haryana Prevention of Public Gambling Act, 2025 keeps games of skill outside gambling: a game of skill is one where skill predominates over chance, and the state government may notify games as games of skill. In September 2026 the state notified poker and rummy as games of skill under the Act. Clubs that host them must follow the conditions the state sets for them.\n\nAt RIVR every member is 18 or over and has had their identity checked, every table runs as a game of skill, and TDS is deducted on winnings as the law requires.\n\nThis is general information, not legal advice."}}
    ]}$j$::jsonb);

  -- Membership: the rules in force in place of the example rates, the cab and hotel nights after them, and the welcome
  -- offer after the steps to join.
  select id into v_page from public.site_page where venue_id = p_venue_id and slug = 'membership';
  if v_page is not null then
    update public.site_block set kind = 'rewards', content = '{"heading": "Points for every hour"}'::jsonb
    where page_id = v_page and kind = 'table' and content = $j${"note": "Example rates: the club confirms its rates before launch. Only time seated at a table counts, not time away from it.", "rows": [["NLH 50/100", "5"], ["NLH 100/200", "10"], ["Private Room", "20"]], "intro": "Every hour you play earns points, more at the higher stakes. Points never turn into cash: they are for rewards.", "columns": ["Stake", "Points an hour"], "heading": "Points for every hour"}$j$::jsonb;
    if not exists (select 1 from public.site_block where page_id = v_page and kind = 'rewards') then
      select coalesce((select position from public.site_block where page_id = v_page and content ->> 'eyebrow' = 'Tiers'),
                      (select max(position) from public.site_block where page_id = v_page), 0) into v_after;
      perform private.place_site_block(v_page, v_after, 'rewards', '{"heading": "Points for every hour"}'::jsonb);
    end if;
    if not exists (select 1 from public.site_block where page_id = v_page and kind = 'outstation') then
      select position into v_after from public.site_block where page_id = v_page and kind = 'rewards';
      perform private.place_site_block(v_page, v_after, 'outstation', '{"eyebrow": "Outstation", "heading": "Getting here, and staying over."}'::jsonb);
    end if;
    if not exists (select 1 from public.site_block where page_id = v_page and kind = 'promotions') then
      select coalesce((select position from public.site_block where page_id = v_page and content ->> 'eyebrow' = 'How to join'),
                      (select max(position) from public.site_block where page_id = v_page)) into v_after;
      perform private.place_site_block(v_page, v_after, 'promotions', '{"eyebrow": "Welcome offer", "heading": "Your first visit.", "only": "welcome"}'::jsonb);
    end if;
  end if;

  -- Promotions: the jackpot and the rare hands, after the hero.
  select id into v_page from public.site_page where venue_id = p_venue_id and slug = 'promotions';
  if v_page is not null and not exists (select 1 from public.site_block where page_id = v_page and kind = 'jackpot') then
    perform private.place_site_block(v_page, coalesce((select min(position) from public.site_block where page_id = v_page and kind = 'hero'), 0), 'jackpot',
      '{"eyebrow": "On the house", "heading": "Jackpots and rare hands."}'::jsonb);
  end if;

  -- The front page: the room's hours and amenities, and the questions grandpokerarena.com answers.
  select id into v_page from public.site_page where venue_id = p_venue_id and slug = 'home';
  update public.site_block set content = jsonb_set(content, '{cards}', private.with_more(content -> 'cards', $j$[
      {"label": "Hours", "title": "Open every night", "text": "14:00 to 08:00, from Sunday 15 November."},
      {"title": "Smoking terrace", "text": "Details to follow."},
      {"title": "Parking", "text": "Details to follow."}]$j$::jsonb, 'title'))
  where page_id = v_page and kind = 'cards' and content ->> 'eyebrow' = 'The room' and jsonb_array_length(content -> 'cards') <= 9;
  update public.site_block set content = jsonb_set(content, '{questions}', private.with_more(content -> 'questions', $j$[
      {"question": "Is poker a game of skill?", "answer": "India's Supreme Court treats a game where skill predominates over chance as a game of skill, not gambling, and courts have applied that test to poker. The rulings are listed under On the record."},
      {"question": "What are the house rules?", "answer": "Members only, 18 and over. One player to a hand, chips stay in the club until you cash out at the cage, and the floor's decision on a hand is final. The full list is on the House rules page."},
      {"question": "What is the RIVR League?", "answer": "The club's leaderboard, month by month and season by season. Cash game hours and tournament finishes earn League points, and the standings and prizes are on the Leaderboard page."}]$j$::jsonb, 'question'))
  where page_id = v_page and kind = 'faq' and jsonb_array_length(content -> 'questions') <= 37;

  update public.site_block set content = jsonb_set(content, '{cards}', private.with_more(content -> 'cards', $j$[
      {"title": "Valet and parking", "text": "Details to follow."}]$j$::jsonb, 'title'))
  where page_id = v_page and kind = 'cards' and content ->> 'eyebrow' = 'Hospitality' and jsonb_array_length(content -> 'cards') <= 11;

  -- Rules the pages wrote in words now come from the settings and promotions (decision 0283), so the words that named
  -- them say so without the figures, each only while it still reads as first written.
  update public.site_block b set content = replace(replace(replace(replace(b.content::text,
      '"Chauffeured rides for regulars, and a cab home from your fourth visit in a month."',
      '"Chauffeured rides for regulars, and a cab home for members who play often. Membership has the details."'),
      '"For members who finish RIVR Academy: ₹1,000 on your first buy-in after you graduate."',
      '"For members who finish RIVR Academy: a bonus on their first buy-in after they graduate."'),
      '"RIVR Rewards: 5% of your rake back as points"', '"RIVR Rewards: a share of your rake back as points"'),
      '"₹1,000 on your first buy-in after you graduate"', '"A bonus on your first buy-in after you graduate"')::jsonb
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug in ('home', 'membership') and b.kind = 'cards';

  -- On the record, on the front page and About: every ruling linked to its judgment.
  update public.site_block b set content = jsonb_set(b.content, '{items}', private.with_rulings(b.content -> 'items'))
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug in ('home', 'about') and b.kind = 'timeline'
    and b.content ->> 'eyebrow' in ('On the record', 'Legal and compliance') and jsonb_array_length(b.content -> 'items') <= 6;

  -- The journal lists the new published articles.
  update public.site_block b set content = jsonb_set(b.content, '{cards}', b.content -> 'cards' || coalesce((
      select jsonb_agg(c order by n) from jsonb_array_elements($j$[
        {"label": "Strategy", "title": "Cash game tips for the live table", "text": "Habits that save chips at a live cash game, from the first hand to the last.", "link": {"page": "journal-cash-game-tips", "label": "Read"}},
        {"label": "Tournaments", "title": "Poker tournaments in Gurugram", "text": "How a live tournament runs at RIVR, from the buy-in to the final table.", "link": {"page": "journal-tournaments-gurugram", "label": "Read"}}
      ]$j$::jsonb) with ordinality t(c, n)
      where not exists (select 1 from jsonb_array_elements(b.content -> 'cards') e where e #>> '{link,page}' = c #>> '{link,page}')), '[]'::jsonb))
  from public.site_page p
  where p.id = b.page_id and p.venue_id = p_venue_id and p.slug = 'journal' and b.kind = 'cards' and b.content ->> 'heading' = 'Articles'
    and jsonb_array_length(b.content -> 'cards') <= 10;
end;
$$;

revoke execute on function private.place_site_block(uuid, integer, text, jsonb), private.add_site_page(uuid, jsonb), private.add_website_parity(uuid)
  from public, anon, authenticated;

-- A club's website comes with all of it: private.add_website, as 20261028394100_social_wall.sql made it, then this.
alter function private.add_website(uuid) rename to add_website_with_wall;
create function private.add_website(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.add_website_with_wall(p_venue_id);
  perform private.add_website_parity(p_venue_id);
end;
$$;
revoke execute on function private.add_website(uuid), private.add_website_with_wall(uuid) from public, anon, authenticated;

-- The club made before.
select private.add_website_parity(v.id) from public.venue v where not v.is_practice;
