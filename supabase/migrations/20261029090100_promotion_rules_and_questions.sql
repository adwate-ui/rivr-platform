-- Promotions in grandpokerarena.com's way (#618, decision 0283): a promotion carries its rules and its questions with
-- their answers, written in the console's builder, and the website shows each live one with them. A promotion for new
-- players (a rule with the new-player condition) is the welcome offer. The Bad Beat Jackpot and the rare-hand bonuses
-- are read from the club's rules (jackpot.payout and high_hand.payouts, through public_club_rules) and the live pool
-- (public_jackpot), never written into a page.

-- At most 12 rules of up to 200 characters, each with words in it.
create function private.is_promotion_rules(p_rules text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(p_rules) <= 12 and not exists (select 1 from unnest(p_rules) r where r is null or length(btrim(r)) not between 1 and 200);
$$;

-- At most 10 questions, each {question, answer} and nothing else: a question of up to 160 characters, an answer of up to 600.
create function private.is_promotion_questions(p_questions jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_questions) = 'array' and jsonb_array_length(p_questions) <= 10 and not exists (
    select 1 from jsonb_array_elements(p_questions) q
    where jsonb_typeof(q) is distinct from 'object'
       or jsonb_typeof(q -> 'question') is distinct from 'string' or jsonb_typeof(q -> 'answer') is distinct from 'string'
       or length(btrim(q ->> 'question')) not between 1 and 160 or length(btrim(q ->> 'answer')) not between 1 and 600
       or (select count(*) from jsonb_object_keys(q)) <> 2);
$$;

alter table public.promotion
  add column rules text[] not null default '{}' check (private.is_promotion_rules(rules)),
  add column questions jsonb not null default '[]' check (private.is_promotion_questions(questions));

comment on column public.promotion.rules is 'The promotion''s rules as the website lists them (#618): who qualifies, what it pays, the conditions.';
comment on column public.promotion.questions is 'The promotion''s questions and their answers, [{question, answer}], as the website shows them (#618).';

-- Submits a promotion from the builder, as 20261028320000_promotion_approval.sql made it, with its rules and questions.
create or replace function private.submit_promotion(p_venue_id uuid, p_promotion jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_venue_id is null or not private.has_permission(p_venue_id, 'promotions.manage') then
    raise exception 'Only staff who manage promotions submit one' using errcode = '42501';
  end if;
  perform private.assert_writable(p_venue_id, 'promotions');
  if jsonb_typeof(p_promotion -> 'rule') is distinct from 'object' then
    raise exception 'A promotion is submitted with its rule' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_promotion -> 'rules', '[]'::jsonb)) is distinct from 'array' then
    raise exception 'A promotion''s rules are a list' using errcode = '22023';
  end if;
  insert into public.promotion (venue_id, name, status, detail, runs, per_player_limit, per_player_period, requested_by_staff_id, requested_at,
                                rules, questions)
  values (p_venue_id, btrim(p_promotion ->> 'name'), 'pending', nullif(btrim(p_promotion ->> 'detail'), ''), btrim(p_promotion ->> 'runs'),
          (p_promotion ->> 'per_player_limit')::integer, p_promotion ->> 'per_player_period', private.current_staff_id(p_venue_id), now(),
          array(select btrim(r) from jsonb_array_elements_text(coalesce(p_promotion -> 'rules', '[]'::jsonb)) r),
          coalesce(p_promotion -> 'questions', '[]'::jsonb))
  returning id into v_id;
  insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
  values (p_venue_id, v_id, p_promotion #>> '{rule,trigger}', coalesce(p_promotion #> '{rule,conditions}', '{}'::jsonb), p_promotion #> '{rule,effect}');
  return v_id;
end;
$$;

-- Every club's live cards for the website, by the venue's slug, with each one's rules and questions, and whether it is
-- for new players: no personal data, never the practice venue.
drop view public.public_promotion_cards;
drop function private.public_promotion_card_rows();

create function private.public_promotion_card_rows()
returns table (venue_slug text, title text, detail text, runs text, rules text[], questions jsonb, is_welcome boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select v.slug, c.title, c.detail, c.runs, p.rules, p.questions,
         exists (select 1 from public.promotion_rule r where r.promotion_id = c.promotion_id and r.conditions ? 'new_player')
  from public.venue v
  cross join lateral private.promotion_cards(v.id) c
  join public.promotion p on p.id = c.promotion_id
  where not v.is_practice;
$$;

revoke execute on function private.public_promotion_card_rows() from public;
grant execute on function private.public_promotion_card_rows() to anon, authenticated;

create view public.public_promotion_cards
with (security_invoker = true)
as
select venue_slug, title, detail, runs, rules, questions, is_welcome from private.public_promotion_card_rows();

grant select on public.public_promotion_cards to anon, authenticated;

alter table public.site_block drop constraint site_block_kind_check;
alter table public.site_block add constraint site_block_kind_check
  check (kind in ('hero', 'statement', 'gallery', 'feature', 'text', 'rules', 'faq', 'careers', 'map', 'games', 'calendar', 'links',
                  'story', 'cards', 'marquee', 'timeline', 'table', 'promotions', 'social_wall', 'league', 'rewards', 'outstation', 'jackpot'));

-- The keys the website reads for each kind of block, as 20261029090000_website_live_rules.sql left them, with the
-- promotions block's choice of the welcome offer alone and the jackpot block's.
create or replace function private.site_block_public_keys(p_kind text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'hero' then array['eyebrow', 'heading', 'text', 'action', 'video', 'note']
    when 'statement' then array['eyebrow', 'lines', 'text', 'action', 'image', 'note']
    when 'gallery' then array['eyebrow', 'heading', 'intro', 'items', 'note']
    when 'feature' then array['eyebrow', 'heading', 'text', 'points', 'action', 'image', 'alt']
    when 'text' then array['heading', 'body']
    when 'rules' then array['heading', 'rules']
    when 'faq' then array['heading', 'questions']
    when 'careers' then array['heading', 'roles', 'apply']
    when 'map' then array['heading', 'address', 'hours', 'directionsUrl', 'phone', 'email']
    when 'games' then array['heading']
    when 'calendar' then array['heading']
    when 'links' then array['heading', 'links']
    when 'story' then array['eyebrow', 'heading', 'paragraphs', 'figures', 'action', 'image', 'alt']
    when 'cards' then array['eyebrow', 'heading', 'intro', 'cards', 'quote', 'action']
    when 'marquee' then array['phrases']
    when 'timeline' then array['eyebrow', 'heading', 'intro', 'items']
    when 'table' then array['heading', 'intro', 'columns', 'rows', 'note']
    when 'promotions' then array['eyebrow', 'heading', 'only']
    when 'social_wall' then array['heading']
    when 'league' then array['heading']
    when 'rewards' then array['heading']
    when 'outstation' then array['eyebrow', 'heading']
    when 'jackpot' then array['eyebrow', 'heading']
    else array[]::text[]
  end;
$$;
