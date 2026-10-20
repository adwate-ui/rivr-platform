-- Certification quizzes (#50; tech plan item 18 and "Practice venue"). Staff train in the practice venue on
-- the same apps, and the dealer and cashier certification quizzes run there. A quiz is a few questions,
-- each with its choices; the right answers stay in the database, which marks an attempt and records it
-- against the staff record of whoever took it. A score at or above the quiz's pass mark is a pass. The
-- questions are this system's own procedures, written for it (decision 0073). Neither table is in the
-- audit log, which would keep the answers where readers of the audit log could see them: quizzes change
-- only by migration, and an attempt is itself the record of who took it when.

create table public.quiz (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  -- Who it certifies: one quiz each for dealers and cashiers.
  role public.staff_role not null check (role in ('dealer', 'cashier')),
  title text not null check (length(trim(title)) > 0),
  -- The share of questions a pass needs, in percent.
  pass_percent smallint not null check (pass_percent between 1 and 100),
  -- What staff see: [{"prompt": "...", "choices": ["...", "..."]}, ...].
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) > 0),
  -- The right choice for each question, counted from 0. No client reads it.
  answer_key smallint[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, venue_id),
  unique (venue_id, role),
  check (jsonb_array_length(questions) = cardinality(answer_key))
);

comment on table public.quiz is 'Dealer and cashier certification quizzes, in the practice venue (#50). answer_key is never granted to a client.';

create trigger quiz_touch_updated_at before update on public.quiz
  for each row execute function private.touch_updated_at();

-- Every attempt, kept: what was answered, the score and whether it passed.
create table public.quiz_attempt (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venue (id),
  quiz_id uuid not null,
  staff_id uuid not null,
  answers smallint[] not null,
  correct_count smallint not null check (correct_count >= 0),
  question_count smallint not null check (question_count > 0 and correct_count <= question_count),
  is_passed boolean not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now(),
  foreign key (quiz_id, venue_id) references public.quiz (id, venue_id),
  foreign key (staff_id, venue_id) references public.staff (id, venue_id)
);

comment on table public.quiz_attempt is 'Each certification quiz attempt, on the staff record of who took it; a pass certifies them (#50).';

create index quiz_attempt_quiz_venue_idx on public.quiz_attempt (quiz_id, venue_id);
create index quiz_attempt_staff_venue_idx on public.quiz_attempt (staff_id, venue_id);
create index quiz_attempt_venue_created_idx on public.quiz_attempt (venue_id, created_at desc);
create trigger quiz_attempt_append_only before update or delete on public.quiz_attempt
  for each row execute function private.refuse_change();
create trigger quiz_attempt_no_truncate before truncate on public.quiz_attempt
  for each statement execute function private.refuse_change();

-- No client reads the answers: not the key, nor what was answered (a perfect attempt's answers are the key).
alter table public.quiz enable row level security;
alter table public.quiz_attempt enable row level security;
grant select (id, venue_id, role, title, pass_percent, questions, created_at, updated_at) on public.quiz to authenticated;
grant select (id, venue_id, quiz_id, staff_id, correct_count, question_count, is_passed, created_at, updated_at)
  on public.quiz_attempt to authenticated;

create policy "staff see their venue's quizzes" on public.quiz
  for select to authenticated
  using (venue_id in (select private.staff_venues()));

-- Each staff member their own attempts; staff who manage staff everyone's at the venue.
create policy "staff see their own attempts, and staff managers the venue's" on public.quiz_attempt
  for select to authenticated
  using (staff_id in (select s.id from public.staff s where s.user_id = (select auth.uid()))
         or venue_id in (select private.venues_where('staff.manage')));

-- Marks an attempt by the caller, active staff at the quiz's venue, and records it: one choice for every
-- question, else 22023. Not while the venue is frozen.
create function private.submit_quiz(p_quiz_id uuid, p_answers integer[])
returns table (correct_count integer, question_count integer, is_passed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_quiz public.quiz;
  v_staff_id uuid;
  v_correct integer;
  v_attempt public.quiz_attempt;
begin
  select * into v_quiz from public.quiz q where q.id = p_quiz_id;
  v_staff_id := private.current_staff_id(v_quiz.venue_id);
  if v_staff_id is null then
    raise exception 'Only staff at the venue take its quizzes' using errcode = '42501';
  end if;
  perform private.assert_writable(v_quiz.venue_id, null, null);
  if cardinality(p_answers) is distinct from cardinality(v_quiz.answer_key) or exists (
    select 1 from unnest(p_answers) with ordinality as a (choice, n)
    where a.choice is null or a.choice < 0 or a.choice >= jsonb_array_length(v_quiz.questions -> (a.n::integer - 1) -> 'choices')) then
    raise exception 'Answer every question with one of its choices' using errcode = '22023';
  end if;
  select count(*) into v_correct from unnest(p_answers, v_quiz.answer_key) as a (given, expected) where a.given = a.expected;
  insert into public.quiz_attempt (venue_id, quiz_id, staff_id, answers, correct_count, question_count, is_passed)
  values (v_quiz.venue_id, v_quiz.id, v_staff_id, p_answers::smallint[], v_correct, cardinality(v_quiz.answer_key),
          v_correct * 100 >= v_quiz.pass_percent * cardinality(v_quiz.answer_key))
  returning * into v_attempt;
  return query select v_attempt.correct_count::integer, v_attempt.question_count::integer, v_attempt.is_passed;
end;
$$;

create function public.submit_quiz(p_quiz_id uuid, p_answers integer[])
returns table (correct_count integer, question_count integer, is_passed boolean)
language sql volatile security invoker set search_path = ''
as $$ select * from private.submit_quiz(p_quiz_id, p_answers); $$;

-- The training set: the dealer and cashier certification quizzes, added to a practice venue.
create function private.add_certification_quizzes(p_venue_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.quiz (venue_id, role, title, pass_percent, questions, answer_key) values
  (p_venue_id, 'dealer', 'Dealer certification', 80, $q$[
    {"prompt": "When do you log a hand on the tablet?",
     "choices": ["Before the cards are dealt", "Once the pot is pushed to the winner", "At the end of your down, all together"]},
    {"prompt": "What do you enter on the tablet for each hand?",
     "choices": ["The pot: the tablet works out the rake and the jackpot drop", "The rake you took", "The winner's stack"]},
    {"prompt": "A player shows down a straight flush.",
     "choices": ["Pay it from the tray", "Leave it until the end of the down", "Claim the high hand on the tablet with that hand, for the floor to approve"]},
    {"prompt": "A seated player wants more chips.",
     "choices": ["Take their cash at the table", "Send a buy-in request from the tablet: the cage brings the chips", "Ask another player to sell them chips"]},
    {"prompt": "The tablet loses its connection during your down.",
     "choices": ["Keep logging hands: they wait on the tablet and go once it reconnects", "Stop dealing until it is back", "Write the hands down and type them in tomorrow"]},
    {"prompt": "Your down is over.",
     "choices": ["Hand the tablet to the next dealer still signed in", "Walk away: the next dealer's sign-in ends it", "End the down on the tablet and enter the drop-box count"]}
  ]$q$, array[1, 0, 2, 1, 0, 2]),
  (p_venue_id, 'cashier', 'Cashier certification', 80, $q$[
    {"prompt": "A member wants to buy in but has not finished the identity check.",
     "choices": ["Sell the chips and check later", "Send them to finish the identity check first", "Ask a dealer to vouch for them"]},
    {"prompt": "You have prepared a withdrawal. Who approves it?",
     "choices": ["Nobody: you send it", "The member, in the app", "A second staff member, never the one who prepared it"]},
    {"prompt": "A member says they have paid a deposit by UPI. When do you confirm it?",
     "choices": ["Once the amount with its UTR is found in the bank", "When they show a screenshot", "Straight away, to save time"]},
    {"prompt": "A member asks for a marker.",
     "choices": ["Issue the amount they ask for", "Only within the credit limit set for them, signed by the member on the cage screen", "Only if a dealer agrees"]},
    {"prompt": "Your shift is ending.",
     "choices": ["Count the chips and cash and close the shift: a difference needs a reason", "Leave the drawer for the next cashier to count", "Count only the cash"]},
    {"prompt": "The console shows the venue is frozen.",
     "choices": ["Carry on with cash only", "Restart the console", "Stop: no money moves until the freeze is released"]}
  ]$q$, array[1, 2, 0, 1, 0, 2])
  on conflict (venue_id, role) do nothing;
$$;

revoke execute on function private.add_certification_quizzes(uuid) from public, anon, authenticated;
revoke execute on function private.submit_quiz(uuid, integer[]), public.submit_quiz(uuid, integer[]) from public, anon;
grant execute on function private.submit_quiz(uuid, integer[]), public.submit_quiz(uuid, integer[]) to authenticated;

select private.add_certification_quizzes(v.id) from public.venue v where v.is_practice;

-- A new practice venue gets the quizzes too: #23's bootstrap with three lines more.
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
    (p_venue_id, 'venue.points_issued', 'Points issued', 'expense', 'points', false),
    (p_venue_id, 'venue.opening_balance', 'Opening balances', 'equity', 'paise', false),
    (p_venue_id, 'venue.points_opening_balance', 'Opening points', 'equity', 'points', false);

  insert into public.chip_denomination (venue_id, value_paise, name)
  select p_venue_id, rupees * 100, '₹' || to_char(rupees, 'FM99,99,999')
  from unnest(array[50, 100, 500, 1000, 5000, 25000]) as rupees;

  if p_is_practice then
    perform private.add_certification_quizzes(p_venue_id);
  end if;

  return p_venue_id;
end;
$$;

-- The dealer tablet says when it stands in the practice venue, so nobody takes a training tablet for a live one.
drop function public.my_device();
drop function private.my_device();

create function private.my_device()
returns table (device_id uuid, venue_id uuid, name text, kind public.device_kind, table_id uuid, table_name text, is_practice boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.venue_id, d.name, d.kind, t.id, t.name, v.is_practice
  from public.device d
  join public.venue v on v.id = d.venue_id
  left join public.tablet_assignment a on a.device_id = d.id
  left join public.game_table t on t.id = a.table_id
  where d.id = (select private.current_device_id());
$$;

create function public.my_device()
returns table (device_id uuid, venue_id uuid, name text, kind public.device_kind, table_id uuid, table_name text, is_practice boolean)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_device(); $$;

revoke execute on function private.my_device(), public.my_device() from public, anon;
grant execute on function private.my_device(), public.my_device() to authenticated;
