-- Lessons (#134; decision 0275): each unit of a book is a lesson. The member reads the unit's principles as cards, then
-- answers a short quiz the drill engine deals from the unit's label and count rules, graded in the app. Each lesson's
-- latest result is kept here, so the member sees which lessons they have done. Members with learn.academy_lessons
-- (rule 8). Erasure deletes a member's lessons.

create table public.learn_lesson (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  member_id uuid not null,
  source_key text not null check (source_key ~ '^[a-z0-9_-]{1,60}$'),
  unit_id text not null check (length(unit_id) between 1 and 200),
  -- The quiz: right answers of those asked; none asked for a lesson with no quiz.
  correct integer not null check (correct >= 0),
  asked integer not null check (asked between 0 and 50 and correct <= asked),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, venue_id) references public.member (id, venue_id),
  unique (member_id, source_key, unit_id)
);

comment on table public.learn_lesson is 'A lesson a member finished (#134): the book''s unit, and their quiz''s right answers of those asked.';

create index learn_lesson_venue_id_idx on public.learn_lesson (venue_id);
create trigger learn_lesson_touch_updated_at before update on public.learn_lesson
  for each row execute function private.touch_updated_at();

alter table public.learn_lesson enable row level security;
grant select on public.learn_lesson to authenticated;
create policy "members see their own lessons" on public.learn_lesson for select to authenticated
  using (member_id = (select private.current_member_id()) and private.has_feature((select private.current_member_id()), 'learn.academy_lessons'));

-- A member's export gives their lessons whole.
insert into private.member_export_column (table_name, column_name, kind)
select 'learn_lesson', c.column_name, 'owed' from information_schema.columns c where c.table_schema = 'public' and c.table_name = 'learn_lesson';

-- The signed-in member finished a lesson: its latest result is kept.
create function private.complete_learn_lesson(p_source_key text, p_unit_id text, p_correct integer, p_asked integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member_id uuid := private.current_member_id();
begin
  if v_member_id is null or not private.has_feature(v_member_id, 'learn.academy_lessons') then
    raise exception 'Only a member with the Academy lessons keeps one' using errcode = '42501';
  end if;
  perform private.assert_writable(private.current_member_venue_id(), null, v_member_id);
  if coalesce(p_source_key, '') !~ '^[a-z0-9_-]{1,60}$' or coalesce(length(p_unit_id), 0) not between 1 and 200
     or p_correct is null or p_asked is null or p_correct < 0 or p_asked > 50 or p_correct > p_asked then
    raise exception 'A book, its unit, and the right answers of those asked' using errcode = '22023';
  end if;
  -- At most 500 lessons kept for a member: a script cannot fill the table, or their export.
  if (select count(*) from public.learn_lesson l where l.member_id = v_member_id) >= 500
     and not exists (select 1 from public.learn_lesson l where l.member_id = v_member_id and l.source_key = p_source_key and l.unit_id = p_unit_id) then
    raise exception 'Lessons kept are at their limit' using errcode = '22023';
  end if;
  insert into public.learn_lesson (venue_id, member_id, source_key, unit_id, correct, asked)
  values (private.current_member_venue_id(), v_member_id, p_source_key, p_unit_id, p_correct, p_asked)
  on conflict (member_id, source_key, unit_id) do update set correct = excluded.correct, asked = excluded.asked, completed_at = now();
end;
$$;

-- As 20261028395000_winner_cards.sql made it, deleting the member's lessons too.
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
  delete from public.inbox_message x where x.lead_id in (select l.id from public.lead l where l.member_id = p_member.id);
  delete from public.lead x where x.member_id = p_member.id;
  delete from public.push_subscription x where x.member_id = p_member.id;
  delete from public.winner_card x where x.member_id = p_member.id;
  delete from public.learn_lesson x where x.member_id = p_member.id;
  delete from public.kyc_review x where x.member_id = p_member.id;
  delete from public.outbox_event x where x.venue_id = p_member.venue_id and x.payload ->> 'member_id' = p_member.id::text;
  delete from public.payout_account p
  where p.member_id = p_member.id
    and not exists (select 1 from public.withdrawal_request w where w.payout_account_id = p.id)
    and not exists (select 1 from public.deposit_request d where d.payout_account_id = p.id);
end;
$$;

create function public.complete_learn_lesson(p_source_key text, p_unit_id text, p_correct integer, p_asked integer)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.complete_learn_lesson(p_source_key, p_unit_id, p_correct, p_asked); $$;

revoke execute on function private.complete_learn_lesson(text, text, integer, integer), public.complete_learn_lesson(text, text, integer, integer)
  from public, anon;
grant execute on function private.complete_learn_lesson(text, text, integer, integer), public.complete_learn_lesson(text, text, integer, integer)
  to authenticated;
