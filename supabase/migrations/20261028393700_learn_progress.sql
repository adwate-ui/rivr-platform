-- Learn progress on the server (#132, #135; scope-v1 "What has to change", module 9). Each member's FSRS cards and every
-- answer they give are kept here, not only in the phone; the app queues them while offline (@rivr/offline) and syncs
-- them, each answer once. A completed session earns Learn points: its own and each principle mastered for the first
-- time, capped by the IST day (private.learn_points, the twin of @rivr/domain learnPoints). Members with learn.drills.

insert into public.setting_key (key, description, scope, value_schema) values
  ('learn.session_points',
   'Learn points for a completed drill session and for each principle mastered for the first time; none set is 10 and 25.',
   'venue',
   '{"type":"object","properties":{"per_session":{"type":"integer","minimum":0,"maximum":1000},"per_principle":{"type":"integer","minimum":0,"maximum":1000}},"required":["per_session","per_principle"],"additionalProperties":false}'),
  ('learn.daily_points_cap',
   'The most Learn points a member earns in an IST day, so re-drilling cannot farm them; none set is 100.',
   'venue',
   '{"type":"object","properties":{"points":{"type":"integer","minimum":0,"maximum":10000}},"required":["points"],"additionalProperties":false}');

-- @rivr/domain learnPoints: what a completed session earns, the session's and each principle newly mastered, but no
-- more than the day's cap less what Learn gave today, never below nothing.
create function private.learn_points(p_mastered bigint, p_earned_today bigint, p_per_session bigint, p_per_principle bigint, p_daily_cap bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select greatest(0, least(p_per_session + p_mastered * p_per_principle, p_daily_cap - p_earned_today));
$$;

-- A member's FSRS card for one spot of one source: its state as @rivr/drills keeps it, and when it is due.
create table public.learn_card (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  source_key text not null check (source_key ~ '^[a-z0-9_-]{1,60}$'),
  card_key text not null check (length(card_key) between 1 and 300),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  unique (member_id, source_key, card_key)
);
-- One answer: its own id from the app, so a resend is the same answer, and @rivr/drills' attempt row whole.
create table public.learn_attempt (
  id uuid primary key,
  venue_id uuid not null,
  member_id uuid not null,
  session_id uuid not null,
  source_key text not null check (source_key ~ '^[a-z0-9_-]{1,60}$'),
  principle_id text not null check (length(principle_id) between 1 and 200),
  answered_at timestamptz not null,
  attempt jsonb not null check (jsonb_typeof(attempt) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);
-- A completed session: the points it earned and the principles first mastered in it.
create table public.learn_session (
  id uuid primary key,
  venue_id uuid not null,
  member_id uuid not null,
  source_key text not null check (source_key ~ '^[a-z0-9_-]{1,60}$'),
  principles text[] not null default '{}',
  points bigint not null check (points >= 0),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);
comment on table public.learn_card is 'A member''s FSRS card for a Learn spot (#132).';
comment on table public.learn_attempt is 'One answer a member gave in a Learn drill (#132).';
comment on table public.learn_session is 'A completed Learn drill session and the points it earned (#135).';
create index learn_card_member_idx on public.learn_card (member_id, venue_id);
create index learn_card_venue_idx on public.learn_card (venue_id);
create index learn_attempt_member_idx on public.learn_attempt (member_id, venue_id, answered_at);
create index learn_attempt_session_idx on public.learn_attempt (session_id);
create index learn_attempt_venue_idx on public.learn_attempt (venue_id);
create index learn_session_member_idx on public.learn_session (member_id, venue_id, completed_at);
create index learn_session_venue_idx on public.learn_session (venue_id);
create trigger learn_card_touch_updated_at before update on public.learn_card for each row execute function private.touch_updated_at();
create trigger learn_attempt_touch_updated_at before update on public.learn_attempt for each row execute function private.touch_updated_at();
create trigger learn_session_touch_updated_at before update on public.learn_session for each row execute function private.touch_updated_at();

alter table public.learn_card enable row level security;
alter table public.learn_attempt enable row level security;
alter table public.learn_session enable row level security;
grant select on public.learn_card, public.learn_attempt, public.learn_session to authenticated;
create policy "members see their own learn cards" on public.learn_card for select to authenticated
  using (member_id = (select private.current_member_id()) and private.has_feature((select private.current_member_id()), 'learn.drills'));
create policy "members see their own learn answers" on public.learn_attempt for select to authenticated
  using (member_id = (select private.current_member_id()) and private.has_feature((select private.current_member_id()), 'learn.drills'));
create policy "members see their own learn sessions" on public.learn_session for select to authenticated
  using (member_id = (select private.current_member_id()) and private.has_feature((select private.current_member_id()), 'learn.drills'));

-- A member's export gives their Learn progress whole (decision 0240).
insert into private.member_export_column (table_name, column_name, kind)
select t.table_name, c.column_name, 'owed'
from (values ('learn_card'), ('learn_attempt'), ('learn_session')) t (table_name)
join information_schema.columns c on c.table_schema = 'public' and c.table_name = t.table_name;

-- The signed-in member with learn.drills, and their venue; 42501 otherwise.
create function private.learning_member()
returns public.member
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member public.member;
begin
  select * into v_member from public.member m where m.id = private.current_member_id() and m.erased_at is null;
  if v_member.id is null or not private.has_feature(v_member.id, 'learn.drills') then
    raise exception 'A member with Learn drills' using errcode = '42501';
  end if;
  return v_member;
end;
$$;

-- Keeps what the app queued: answers ({id, session_id, source_key, principle_id, answered_at, attempt}), each once by
-- its id, and cards ({source_key, card_key, state, due_at}), the latest state of each. At most 500 of each a call.
-- Returns the answers newly kept. Refusals: 42501; 22023 too many or malformed; RVFRZ/RVMBR a freeze.
create function private.sync_learn_progress(p_attempts jsonb, p_cards jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member := private.learning_member();
  v_kept integer;
begin
  perform private.assert_writable(v_member.venue_id, null, v_member.id);
  if jsonb_typeof(p_attempts) is distinct from 'array' or jsonb_typeof(p_cards) is distinct from 'array'
     or jsonb_array_length(p_attempts) > 500 or jsonb_array_length(p_cards) > 500 then
    raise exception 'At most 500 answers and 500 cards a sync' using errcode = '22023';
  end if;
  insert into public.learn_attempt (id, venue_id, member_id, session_id, source_key, principle_id, answered_at, attempt)
  select (a ->> 'id')::uuid, v_member.venue_id, v_member.id, (a ->> 'session_id')::uuid, a ->> 'source_key', a ->> 'principle_id',
         (a ->> 'answered_at')::timestamptz, a -> 'attempt'
  from jsonb_array_elements(p_attempts) a
  on conflict (id) do nothing;
  get diagnostics v_kept = row_count;
  insert into public.learn_card (venue_id, member_id, source_key, card_key, state, due_at)
  select v_member.venue_id, v_member.id, c ->> 'source_key', c ->> 'card_key', c -> 'state', (c ->> 'due_at')::timestamptz
  from jsonb_array_elements(p_cards) c
  on conflict (member_id, source_key, card_key) do update set state = excluded.state, due_at = excluded.due_at;
  return v_kept;
exception
  when check_violation or not_null_violation or invalid_text_representation or invalid_datetime_format then
    raise exception 'Answers and cards as the app keeps them' using errcode = '22023';
end;
$$;

-- Completes a session the member answered in, once: credits the session's points and each principle given that the
-- member had not mastered before, within the IST day's cap. Returns the points earned (again, the same, for a session
-- already completed). Refusals: 42501; 22023 a session with no answer kept; RVFRZ/RVMBR a freeze.
create function private.complete_learn_session(p_session_id uuid, p_principles text[])
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.member := private.learning_member();
  v_done public.learn_session;
  v_source text;
  v_new text[];
  v_rates jsonb;
  v_cap bigint;
  v_today bigint;
  v_points bigint;
begin
  perform private.assert_writable(v_member.venue_id, null, v_member.id);
  -- One completion at a time per member, so two sessions never both take the day's last points.
  perform pg_advisory_xact_lock(hashtext('learn-points:' || v_member.id));
  select * into v_done from public.learn_session s where s.id = p_session_id and s.member_id = v_member.id;
  if v_done.id is not null then
    return v_done.points;
  end if;
  select a.source_key into v_source from public.learn_attempt a where a.session_id = p_session_id and a.member_id = v_member.id limit 1;
  if v_source is null then
    raise exception 'A session with answers kept' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct p), '{}') into v_new
  from unnest(coalesce(p_principles, '{}')) p
  where length(p) between 1 and 200
    and not exists (select 1 from public.learn_session s where s.member_id = v_member.id and p = any (s.principles));
  v_rates := private.setting_at(v_member.venue_id, 'learn.session_points', '', now());
  v_cap := coalesce((private.setting_at(v_member.venue_id, 'learn.daily_points_cap', '', now()) ->> 'points')::bigint, 100);
  select coalesce(sum(s.points), 0) into v_today from public.learn_session s
  where s.member_id = v_member.id and (s.completed_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;
  v_points := private.learn_points(cardinality(v_new), v_today, coalesce((v_rates ->> 'per_session')::bigint, 10),
                                   coalesce((v_rates ->> 'per_principle')::bigint, 25), v_cap);
  insert into public.learn_session (id, venue_id, member_id, source_key, principles, points)
  values (p_session_id, v_member.venue_id, v_member.id, v_source, v_new, v_points);
  if v_points > 0 then
    perform private.credit_points(v_member.venue_id, v_member.id, v_points, 'Learn', 'learn_session:' || p_session_id);
  end if;
  return v_points;
end;
$$;

create function public.sync_learn_progress(p_attempts jsonb, p_cards jsonb)
returns integer language sql volatile security invoker set search_path = ''
as $$ select private.sync_learn_progress(p_attempts, p_cards); $$;
create function public.complete_learn_session(p_session_id uuid, p_principles text[])
returns bigint language sql volatile security invoker set search_path = ''
as $$ select private.complete_learn_session(p_session_id, p_principles); $$;
revoke execute on function private.learning_member(), private.sync_learn_progress(jsonb, jsonb), private.complete_learn_session(uuid, text[]),
  public.sync_learn_progress(jsonb, jsonb), public.complete_learn_session(uuid, text[]) from public, anon;
grant execute on function private.learning_member(), private.sync_learn_progress(jsonb, jsonb), private.complete_learn_session(uuid, text[]),
  public.sync_learn_progress(jsonb, jsonb), public.complete_learn_session(uuid, text[]) to authenticated;
revoke execute on function private.learn_points(bigint, bigint, bigint, bigint, bigint) from public, anon, authenticated;

-- As before (20261028393500_club_events.sql), deleting the member's Learn progress too.
create or replace function private.delete_member_records(p_member public.member)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.member_preference x where x.member_id = p_member.id;
  delete from public.notification_preference x where x.member_id = p_member.id;
  delete from public.member_limit x where x.member_id = p_member.id;
  delete from public.member_feature_override x where x.member_id = p_member.id;
  delete from public.sign_up_attribution x where x.member_id = p_member.id;
  delete from public.membership_card x where x.member_id = p_member.id;
  delete from public.feedback x where x.member_id = p_member.id;
  delete from public.review_request x where x.member_id = p_member.id;
  delete from public.cab_request x where x.member_id = p_member.id;
  delete from public.club_event_booking x where x.member_id = p_member.id;
  delete from public.learn_attempt x where x.member_id = p_member.id;
  delete from public.learn_card x where x.member_id = p_member.id;
  delete from public.learn_session x where x.member_id = p_member.id;
  delete from public.kyc_review x where x.member_id = p_member.id;
  delete from public.outbox_event x where x.venue_id = p_member.venue_id and x.payload ->> 'member_id' = p_member.id::text;
  delete from public.payout_account p
  where p.member_id = p_member.id
    and not exists (select 1 from public.withdrawal_request w where w.payout_account_id = p.id)
    and not exists (select 1 from public.deposit_request d where d.payout_account_id = p.id);
end;
$$;
