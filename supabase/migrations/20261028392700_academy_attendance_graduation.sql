-- Academy attendance and graduation (#128; scope-v1 modules 9 and 15). Staff who manage members mark a booked student
-- present at each class (one a day, on the batch's days), and graduate them: the Academy graduate tier is set, and the
-- graduation trigger runs the promotions, so the graduate freeroll arrives with no manual step, as the graduate bonus
-- on their first buy-in already does through the tier. Attendance is kept, naming only the member's id, on erasure.
alter table public.academy_booking add column graduated_at timestamptz;

create table public.academy_attendance (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null,
  booking_id uuid not null references public.academy_booking (id),
  member_id uuid not null,
  class_on date not null,
  marked_by_staff_id uuid references public.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, class_on),
  foreign key (member_id, venue_id) references public.member (id, venue_id)
);

comment on table public.academy_attendance is 'A student present at an Academy class (#128): the booking, the day, and who marked it.';

create index academy_attendance_member_idx on public.academy_attendance (member_id, venue_id);
create index academy_attendance_staff_idx on public.academy_attendance (marked_by_staff_id);

create trigger academy_attendance_touch_updated_at before update on public.academy_attendance
  for each row execute function private.touch_updated_at();
create trigger academy_attendance_audit after insert or update or delete on public.academy_attendance
  for each row execute function private.audit_row_change();

alter table public.academy_attendance enable row level security;
grant select (id, venue_id, booking_id, member_id, class_on, marked_by_staff_id, created_at, updated_at) on public.academy_attendance to authenticated;
create policy "members see their own attendance" on public.academy_attendance
  for select to authenticated using (member_id = (select private.current_member_id()));
create policy "staff who manage members see the venue's attendance" on public.academy_attendance
  for select to authenticated using (venue_id in (select private.venues_where('members.manage')));

insert into private.member_export_column (table_name, column_name, kind)
select 'academy_attendance', c.column_name, 'owed'
from unnest(array['id', 'venue_id', 'booking_id', 'member_id', 'class_on', 'marked_by_staff_id', 'created_at', 'updated_at']) c (column_name);
insert into private.member_export_column (table_name, column_name, kind) values ('academy_booking', 'graduated_at', 'owed');

-- An individual booking whose payment is given (its UTR) or confirmed, for staff who manage members at its venue; RVACD
-- otherwise. Attendance and graduation are the Academy's; checking the payment stays the cage's.
create function private.academy_student(p_booking_id uuid)
returns public.academy_booking
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booking public.academy_booking;
begin
  select * into v_booking from public.academy_booking b where b.id = p_booking_id;
  if v_booking.id is null or not private.has_permission(v_booking.venue_id, 'members.manage') then
    raise exception 'Only staff who manage members mark attendance and graduate' using errcode = '42501';
  end if;
  if v_booking.status not in ('payment_claimed', 'paid') or v_booking.kind <> 'individual' then
    raise exception 'An individual booking with its payment given' using errcode = 'RVACD';
  end if;
  return v_booking;
end;
$$;

-- Marks the student present at today's class (IST); once a day, and only on the batch's days (22023 otherwise).
create function private.mark_academy_attendance(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.academy_booking := private.academy_student(p_booking_id);
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  perform private.assert_writable(v_booking.venue_id);
  if not exists (select 1 from public.academy_batch b where b.id = v_booking.batch_id and v_today between b.starts_on and b.ends_on) then
    raise exception 'Attendance is marked on the batch''s days' using errcode = '22023';
  end if;
  insert into public.academy_attendance (venue_id, booking_id, member_id, class_on, marked_by_staff_id)
  values (v_booking.venue_id, v_booking.id, v_booking.member_id, v_today, private.current_staff_id(v_booking.venue_id))
  on conflict (booking_id, class_on) do nothing;
end;
$$;

-- Graduates the student: the Academy graduate tier, the booking marked, and the graduation promotions run (each grant
-- once, by its key). RVDUP when already graduated.
create function private.graduate_academy_member(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.academy_booking := private.academy_student(p_booking_id);
  v_tier uuid;
begin
  perform private.assert_writable(v_booking.venue_id, null, v_booking.member_id);
  if v_booking.graduated_at is not null then
    raise exception 'Already graduated' using errcode = 'RVDUP';
  end if;
  select t.id into v_tier from public.tier t where t.venue_id = v_booking.venue_id and t.name = 'Academy graduate' and not t.is_retired;
  if v_tier is not null and v_tier is distinct from (select m.tier_id from public.member m where m.id = v_booking.member_id) then
    perform private.set_member_tier(v_booking.venue_id, v_booking.member_id, v_tier, 'Graduated from the RIVR Academy', null);
  end if;
  update public.academy_booking set graduated_at = now() where id = v_booking.id;
  perform private.evaluate_promotions(v_booking.venue_id, 'graduation',
    jsonb_build_object('member_id', v_booking.member_id, 'key', 'graduation:' || v_booking.id));
end;
$$;

create function public.mark_academy_attendance(p_booking_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.mark_academy_attendance(p_booking_id); $$;
create function public.graduate_academy_member(p_booking_id uuid)
returns void language sql volatile security invoker set search_path = ''
as $$ select private.graduate_academy_member(p_booking_id); $$;

revoke execute on function private.academy_student(uuid) from public, anon, authenticated;
revoke execute on function private.mark_academy_attendance(uuid), private.graduate_academy_member(uuid),
  public.mark_academy_attendance(uuid), public.graduate_academy_member(uuid) from public, anon;
grant execute on function private.mark_academy_attendance(uuid), private.graduate_academy_member(uuid),
  public.mark_academy_attendance(uuid), public.graduate_academy_member(uuid) to authenticated;

-- The graduate's freeroll (#128): a promotion on the graduation trigger, in the template deck. As before
-- (20261026100000_door_kiosk.sql), with that one more template; every venue gets it now.
create or replace function private.add_promotion_templates(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_graduate_tier uuid := (select t.id from public.tier t where t.venue_id = p_venue_id and t.name = 'Academy graduate');
begin
  insert into public.promotion (venue_id, template_key, name, detail, runs, per_player_limit, per_player_period)
  values
    (p_venue_id, 'tuesday_bonus', 'Buy-in bonus Tuesday', '20% on the first five buy-ins per table', 'Tuesday · all stakes', null, null),
    (p_venue_id, 'high_hands', 'High hands', 'Royal flush ₹25,000 · Straight flush ₹10,000 · Four of a kind ₹2,000', 'Every night', null, null),
    (p_venue_id, 'bad_beat', 'Bad-beat jackpot', 'The pool pays the losing hand, the winner and the table', 'Every night', null, null),
    (p_venue_id, 'referral', 'Referral', '₹1,000 to each side', 'Every day', null, null),
    (p_venue_id, 'graduate_first_buy_in', 'Graduate first buy-in', '₹1,000 on an Academy graduate''s first buy-in', 'Every day', 1, 'promotion'),
    (p_venue_id, 'rivr_rewards', 'RIVR Rewards', '5% of your rake back as points', 'Every game', null, null),
    (p_venue_id, 'founders_priority', 'Founders'' Circle priority', 'First call on every waitlist', 'Every night', null, null),
    (p_venue_id, 'cab', 'Cab home', 'A cab home from your fourth visit in a month', 'Every night', null, null),
    (p_venue_id, 'ladies_night', 'Ladies'' Night', 'An evening for women players', null, null, null),
    (p_venue_id, 'league', 'RIVR League', 'Points from cash games and tournaments, a champion each season', 'Every month', null, null),
    (p_venue_id, 'sunday_guarantee', 'RIVR Sunday', '₹5,00,000 guaranteed', 'Sundays', null, null),
    (p_venue_id, 'hours_bonus', 'Four-hour bonus', '₹1,000 bonus after four hours at the tables', 'Every night', 1, 'day'),
    (p_venue_id, 'graduate_freeroll', 'Graduate freeroll', 'A RIVR Sunday freeroll entry when you graduate from the Academy', 'On graduation', 1, 'promotion')
  on conflict (venue_id, template_key) do nothing;
  insert into public.promotion_rule (venue_id, promotion_id, trigger, conditions, effect)
  select p_venue_id, p.id, r.trigger, r.conditions, r.effect
  from (values
    ('tuesday_bonus', 'buy_in', '{"days": [2], "first_n": {"count": 5, "per": "table"}}'::jsonb,
     '{"kind": "bonus", "percent_bps": 2000, "expires_days": 7}'::jsonb),
    ('referral', 'referral', '{}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb),
    ('graduate_first_buy_in', 'buy_in', jsonb_build_object('tier_ids', jsonb_build_array(v_graduate_tier)),
     '{"kind": "bonus", "amount_paise": 100000, "expires_days": 30}'::jsonb),
    ('hours_bonus', 'hours_played', '{"min_hours": 4}'::jsonb, '{"kind": "bonus", "amount_paise": 100000, "expires_days": 7}'::jsonb),
    ('graduate_freeroll', 'graduation', '{}'::jsonb, '{"kind": "freeroll_ticket", "tournament": "RIVR Sunday"}'::jsonb)
  ) as r (template_key, trigger, conditions, effect)
  join public.promotion p on p.venue_id = p_venue_id and p.template_key = r.template_key
  where (r.template_key <> 'graduate_first_buy_in' or v_graduate_tier is not null)
    and not exists (select 1 from public.promotion_rule x where x.promotion_id = p.id);
end;
$$;

select private.add_promotion_templates(v.id) from public.venue v;
