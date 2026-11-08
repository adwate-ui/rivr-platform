-- 180-day simulation: staff and the club's events. SIMULATION ONLY.
-- The roster and attendance, the host queue, and each scripted event of the calendar (src/calendar/calendar.ts).

-- Each Monday (and on night 1) the admin rosters the coming week's evening shifts; each night they record attendance.
create function sim.roster_tick(d int) returns void language plpgsql as $$
declare
  s record;
begin
  if d = 1 or extract(isodow from sim.night_date(d)) = 1 then
    perform sim.try(sim.who('admin'), 'admin.add_shifts', format(
      'select public.add_shifts(p_venue_id => %L, p_staff_ids => %L::uuid[], p_days => %L::date[], p_starts => ''18:00'', p_ends => ''04:00'')',
      sim.venue(), (select array_agg(x.staff_id) from sim.staff x join public.staff y on y.id = x.staff_id
                    where y.is_active and x.role in ('floor', 'host', 'dealer', 'service', 'cashier')),
      (select array_agg(sim.night_date(k)) from generate_series(d, case when d = 1 then 1 else d + 6 end) k)));
  end if;
  for s in select x.id from public.staff_shift x where x.venue_id = sim.venue() and x.club_day = sim.night_date(d) loop
    perform sim.try(sim.who('admin'), 'admin.record_attendance', format('select public.record_attendance(p_shift_id => %L, p_status => %L, p_note => %L)',
      s.id, case when random() < 0.06 then 'late' else 'present' end, null));
  end loop;
end $$;

-- The host works the queue of members to win back: an offer to some, and the item closed.
create function sim.host_tick() returns void language plpgsql as $$
declare
  h record;
begin
  for h in select i.id from public.host_queue_item i where i.venue_id = sim.venue() and i.handled_at is null and random() < 0.4 loop
    perform sim.try(sim.who('host'), 'host.close_item', format('select public.close_host_item(%L)', h.id));
  end loop;
end $$;

-- A staff member removed from the console (their login is turned off at once), and taken back on later.
create function sim.staff_active(p_key text, p_is_active boolean) returns void language plpgsql as $$
begin
  perform sim.try(sim.who('super1'), case when p_is_active then 'staff.rejoin' else 'staff.remove' end, format(
    'update public.staff set is_active = %L where id = %L returning id', p_is_active, (select staff_id from sim.staff where key = p_key)));
  if not p_is_active then
    -- Refused at once: the removed floor manager tries to approve a request.
    perform sim.try(sim.who(p_key), 'staff.removed_acts', format('select public.set_table_open(p_table_id => %L, p_is_open => true)',
      (select table_id from sim.tbl order by name limit 1)), true);
  end if;
end $$;

-- A member takes a 30-day break from the app; the door, the waitlist and the floor must then refuse them.
create function sim.self_exclusion() returns void language plpgsql as $$
declare
  p sim.persona := (select x from sim.persona x where x.persona = 'regular' and x.verified and not x.erased order by x.number limit 1);
begin
  if not sim.ok(sim.try(p.user_id, 'member.take_break', 'select public.take_break(30)')) then return; end if;
  update sim.persona set excluded_until = sim.night_date(sim.day()) + 30 where member_id = p.member_id;
  perform sim.event('self_excluded', jsonb_build_object('member', p.number));
  perform sim.try(p.user_id, 'excluded.join_waitlist', format('select public.join_waitlist_at(p_table_id => %L, p_idempotency_key => %L)',
    (select table_id from sim.tbl order by name limit 1), gen_random_uuid()), true);
  perform sim.try(sim.floor(), 'excluded.seat', format('select public.seat_member(p_table_id => %L, p_seat => 9, p_phone => %L)',
    (select table_id from sim.tbl order by name limit 1), p.phone), true);
  perform sim.try(sim.who('desk'), 'excluded.check_in', format('select public.check_in_by_phone(%L, %L)', sim.venue(), p.phone), true);
end $$;

-- The super admin freezes the venue for ten minutes (a drill); actions in between are refused.
create function sim.venue_freeze(d int) returns void language plpgsql as $$
declare
  r jsonb;
begin
  perform sim.goto(sim.ist(d, '15:00'));
  r := sim.try(sim.who('super1'), 'super.freeze_venue', format(
    'select public.engage_control(p_venue_id => %L, p_level => ''venue_freeze'', p_reason => %L)', sim.venue(), 'Quarterly freeze drill'));
  perform sim.try(sim.who('admin'), 'frozen.give_points', format(
    'select public.grant_points(p_member_id => %L, p_points => 100, p_is_locked => false, p_reason => %L, p_idempotency_key => %L)',
    (select member_id from sim.persona where not erased order by number limit 1), 'During the drill', gen_random_uuid()), true);
  perform sim.goto(sim.ist(d, '15:10'));
  if sim.ok(r) then
    perform sim.try(sim.who('super1'), 'super.release_freeze', format('select public.release_control(p_control_id => %L, p_reason => %L)',
      sim.val(r), 'Drill over'));
  end if;
end $$;

-- A lapsed member asks to be erased: the super admin reads the preview, then erases them.
create function sim.erasure() returns void language plpgsql as $$
declare
  p sim.persona := (select x from sim.persona x where x.persona = 'lapsed' and not x.erased order by x.number limit 1);
begin
  perform sim.try(sim.who('super1'), 'super.erasure_preview', format('select blockers from public.member_erasure_preview(%L)', p.member_id));
  if sim.ok(sim.try(sim.who('super1'), 'super.erase_member', format('select blocked_until from public.erase_member(p_member_id => %L, p_full_name => %L, p_reason => %L)',
       p.member_id, p.full_name, 'The member asked by email to be forgotten'))) then
    update sim.persona set erased = true where member_id = p.member_id;
  end if;
end $$;

-- Each scripted event on its night, during the day before the club opens.
create function sim.events_day(d int) returns void language plpgsql as $$
declare
  e text;
  v_member uuid;
begin
  foreach e in array (select events from sim.night where n = d) loop
    perform sim.event(e, '{}');
    case e
      when 'staff_removed' then perform sim.staff_active('floor2', false);
      when 'staff_rejoins' then perform sim.staff_active('floor2', true);
      when 'self_exclusion' then perform sim.self_exclusion();
      when 'tier_change' then
        for v_member in select member_id from sim.persona where persona = 'grinder' and not erased order by visits desc limit 3 loop
          perform sim.try(sim.who('super1'), 'super.set_tier', format('select public.set_member_tier(p_venue_id => %L, p_member_id => %L, p_tier_id => %L, p_reason => %L)',
            sim.venue(), v_member, (select id from public.tier where venue_id = sim.venue() and name = 'Black card'), 'Plays four nights a week'));
        end loop;
      when 'reward_stock_runs_out' then
        perform sim.try(sim.who('marketing'), 'marketing.save_reward', format(
          'select public.save_reward_item(p_venue_id => %L, p_kind => ''merchandise'', p_name => ''RIVR cap'', p_detail => ''A black cap with the RIVR mark'', p_points => 500, p_stock => 2, p_is_live => true)', sim.venue()));
      when 'venue_freeze' then perform sim.venue_freeze(d);
      when 'practice_reset' then
        perform sim.try(sim.who('super1'), 'super.practice_reset', format('select table_name from public.reset_practice_venue(p_venue_id => %L, p_venue_name => %L)',
          sim.practice(), (select name from public.venue where id = sim.practice())));
      when 'erasure' then perform sim.erasure();
      when 'promotion_ends' then
        perform sim.try(sim.who('super1'), 'super.end_promotion', format('select public.end_promotion_version(%L)', (select version_id from sim.promo where key = 'spin')));
      when 'kyc_reopened' then
        v_member := (select member_id from sim.persona where verified and not erased and persona = 'casual' order by number limit 1);
        if sim.ok(sim.try(sim.who('super1'), 'super.reopen_kyc', format('select public.reopen_kyc_check(p_member_id => %L, p_reason => %L)', v_member, 'The PAN photo was unreadable'))) then
          update sim.persona set verified = false where member_id = v_member;
        end if;
      else null;  -- launch, welcome_promotion, notice_posted, whatsapp_outage (the runner), year_start: no extra action
    end case;
  end loop;
end $$;
