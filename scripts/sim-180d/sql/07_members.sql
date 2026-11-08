-- 180-day simulation: the members' side. SIMULATION ONLY.
-- Sign-ups through the day (creator code, referral, website), names hidden from the TVs, feedback after a visit,
-- rewards and their hand-over, spins, points and bonus chips by hand, tournament interest, notices.

-- The joiners of the night who are not walk-ins sign up during the day; nine in ten take the selfie then.
create function sim.joiners_tick(d int) returns void language plpgsql as $$
declare
  j record;
  v_member uuid;
begin
  for j in select * from sim.joiner where n = d and source <> 'walk_in' order by idx loop
    v_member := sim.sign_up(j.n, j.idx, j.persona, j.source);
    if v_member is null then continue; end if;
    if random() < 0.9 then perform sim.selfie(v_member); end if;
    if random() < 0.05 then
      perform sim.try((sim.persona_row(v_member)).user_id, 'member.hide_name_on_tvs', 'select public.set_my_name_on_tvs(false)');
      update sim.persona set hides_name = true where member_id = v_member;
    end if;
  end loop;
  insert into sim.walk_in (n, idx, arrive_at)
  select x.n, x.idx, sim.ist(d, '19:00') + random() * interval '300 minutes' from sim.joiner x where x.n = d and x.source = 'walk_in';
end $$;

-- The morning after: a quarter of last night's players rate their visit (some one or two stars, with a note);
-- an admin answers every low rating.
create function sim.feedback_tick(d int) returns void language plpgsql as $$
declare
  p record;
  r jsonb;
  v_score int;
begin
  for p in select pe.member_id, pe.user_id from sim.plan pl join sim.persona pe using (member_id)
           where pl.session_id is not null and random() < 0.25 order by pe.number loop
    r := sim.try(p.user_id, 'member.read_feedback_visit', 'select visit_id from public.my_feedback_visit()');
    if sim.val(r) is null then continue; end if;
    v_score := (array[1, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5])[1 + floor(random() * 20)::int];
    perform sim.try(p.user_id, 'member.rate_visit', format('select public.rate_visit(p_visit_id => %L, p_score => %s, p_note => %L)',
      sim.val(r), v_score, case when v_score <= 2 then 'Waited too long for a seat and the drinks were slow' end));
  end loop;
  for p in select f.id from public.feedback f where f.venue_id = sim.venue() and f.resolved_at is null and f.score <= 2 loop
    perform sim.try(sim.who('admin'), 'admin.resolve_feedback', format('select public.resolve_feedback(p_feedback_id => %L, p_resolution => %L)',
      p.id, 'Called the member, apologised, and added a drink on their next visit'));
  end loop;
end $$;

-- A seated member who can afford a reward sometimes redeems one; the floor hands over what is waiting.
create function sim.rewards_tick() returns void language plpgsql as $$
declare
  s record;
  i record;
  r jsonb;
begin
  for s in select pl.member_id, pe.user_id from sim.plan pl join sim.persona pe using (member_id) where pl.state = 'seated' and random() < 0.01 loop
    r := sim.try(s.user_id, 'member.read_rewards', 'select points from public.my_rewards()');
    select * into i from public.reward_item ri where ri.venue_id = sim.venue() and ri.is_live and ri.points is not null
      and ri.points <= coalesce(sim.val(r)::int, 0) and coalesce(ri.stock, 1) > 0 order by ri.points desc limit 1;
    if i.id is null then continue; end if;
    perform sim.try(s.user_id, 'member.redeem_reward', format('select public.redeem_reward(p_item_id => %L, p_points => %s, p_idempotency_key => %L)',
      i.id, i.points, sim.uid('redeem:' || sim.day() || ':' || s.member_id)));
  end loop;
  for i in select x.id from public.redemption x where x.venue_id = sim.venue() and x.handed_over_at is null and x.cancelled_at is null loop
    perform sim.try(sim.floor(), 'floor.hand_over_reward', format('select public.hand_over_redemption(%L)', i.id));
  end loop;
end $$;

-- Marketing spins the wheel for every spin a promotion has given.
create function sim.spins_tick() returns void language plpgsql as $$
declare
  g record;
begin
  for g in select pg.id from public.promotion_grant pg where pg.venue_id = sim.venue() and pg.spins > pg.spins_used order by pg.created_at loop
    perform sim.try(sim.who('marketing'), 'marketing.spin', format('select spin_id from public.spin_the_wheel(p_grant_id => %L, p_venue_id => %L)', g.id, sim.venue()));
  end loop;
end $$;

-- The floor gives points by hand now and then (a birthday, a long wait); on night 20 one floor manager goes over the
-- daily cap, which must alert the owner. A super admin gives bonus chips by hand; an admin's try is refused.
create function sim.by_hand_tick(d int) returns void language plpgsql as $$
declare
  s record;
  k int := 0;
begin
  for s in select member_id from sim.plan where state = 'seated' and (random() < 0.004 or (d = 20 and k < 6)) loop
    k := k + 1;
    perform sim.try(sim.floor(), 'floor.give_points', format(
      'select public.grant_points(p_member_id => %L, p_points => %s, p_is_locked => %L, p_reason => %L, p_idempotency_key => %L)',
      s.member_id, case when d = 20 then 2000 else 250 end, random() < 0.2, 'Birthday at the club', sim.uid('points:' || sim_clock.now() || s.member_id)));
  end loop;
  if d % 7 = 3 then
    for s in select member_id from sim.persona where not erased and visits > 3 order by sim.uid(member_id || ':' || d) limit 2 loop
      perform sim.try(sim.who('super1'), 'super.give_bonus_chips', format(
        'select public.give_bonus_chips(p_member_id => %L, p_chips => 500, p_reason => %L, p_request_id => %L)',
        s.member_id, 'A thank-you for coming every week', sim.uid('bonus:' || d || ':' || s.member_id)));
    end loop;
    perform sim.try(sim.who('admin'), 'admin.give_bonus_chips', format(
      'select public.give_bonus_chips(p_member_id => %L, p_chips => 500, p_reason => %L, p_request_id => %L)',
      (select member_id from sim.persona where not erased order by number limit 1), 'Tried by an admin', gen_random_uuid()), true);
  end if;
end $$;

-- Event members say they are interested in an upcoming tournament; the admin marks some registered.
create function sim.interest_tick(d int) returns void language plpgsql as $$
declare
  p record;
  v_tournament uuid := (select id from public.tournament where venue_id = sim.venue() and starts_at > sim_clock.now() order by starts_at limit 1);
begin
  if v_tournament is null then return; end if;
  for p in select user_id from sim.persona where persona = 'event' and not erased and random() < 0.2 loop
    perform sim.try(p.user_id, 'member.tournament_interest', format('select public.register_tournament_interest(%L)', v_tournament));
  end loop;
  for p in select i.id from public.tournament_interest i where i.tournament_id = v_tournament and i.registered_at is null and random() < 0.3 loop
    perform sim.try(sim.who('admin'), 'admin.mark_registered', format('select public.mark_tournament_registered(%L)', p.id));
  end loop;
end $$;

-- Marketing posts a notice for the weekend each Thursday, ending on Monday morning.
create function sim.notice_tick(d int) returns void language plpgsql as $$
begin
  if extract(isodow from sim.night_date(d)) <> 4 then return; end if;
  perform sim.try(sim.who('marketing'), 'marketing.post_notice', format(
    'select public.post_notice(p_venue_id => %L, p_body => %L, p_starts_at => %L, p_ends_at => %L)',
    sim.venue(), 'Weekend tables open at 6 pm. Ask the floor about the play-time bonus.', sim_clock.now(), sim.ist(d + 4, '06:00')));
end $$;

-- On night 0 marketing puts prizes on the spin wheel: none are seeded.
create function sim.spin_prizes() returns void language plpgsql as $$
begin
  perform sim.try(sim.who('marketing'), 'marketing.add_spin_prize', format('select public.add_spin_prize(p_venue_id => %L, p_kind => ''bonus'', p_amount => 10000, p_weight => 30)', sim.venue()));
  perform sim.try(sim.who('marketing'), 'marketing.add_spin_prize', format('select public.add_spin_prize(p_venue_id => %L, p_kind => ''points'', p_amount => 500, p_weight => 50)', sim.venue()));
  perform sim.try(sim.who('marketing'), 'marketing.add_spin_prize', format('select public.add_spin_prize(p_venue_id => %L, p_kind => ''nothing'', p_amount => 0, p_weight => 20)', sim.venue()));
end $$;
