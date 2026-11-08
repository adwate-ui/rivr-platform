-- 180-day simulation: the checks about people, messages and races. SIMULATION ONLY.

create function sim.checks_privacy(d int, p_scope text) returns void language plpgsql as $$
begin
  perform sim.check(d, p_scope, 'P04', 'Nobody releases a freeze they need a second person for',
    'select id from public.control_state where venue_id = sim.venue() and released_by_staff_id = release_second_staff_id');
  perform sim.check(d, p_scope, 'P05', 'No money, points or bonus chips move while the venue is frozen',
    'select t.id, t.kind, t.occurred_at from public.ledger_transaction t, public.control_state cs
     where t.venue_id = sim.venue() and cs.venue_id = t.venue_id and cs.level = ''venue_freeze''
       and t.occurred_at > cs.engaged_at and t.occurred_at < coalesce(cs.released_at, sim_clock.now())');
  perform sim.check(d, p_scope, 'N09', 'A member on a break is never checked in, put on a waitlist or seated',
    'with b as (select p.member_id, e.at as from_at, sim.ist((p.excluded_until - date ''2026-11-14'')::int, ''06:00'') as to_at
               from sim.persona p join sim.event e on e.kind = ''self_excluded'' and (e.detail ->> ''member'')::bigint = p.number)
     select ''visit'' as kind, v.id from b join public.visit v on v.member_id = b.member_id and v.opened_at between b.from_at and b.to_at
     union all select ''place'', w.id from b join public.waitlist_entry w on w.member_id = b.member_id and w.joined_at between b.from_at and b.to_at
     union all select ''seat'', s.id from b join public.seat_session s on s.member_id = b.member_id and s.started_at between b.from_at and b.to_at');
  perform sim.check(d, p_scope, 'N10', 'The investor reads no member names or phones',
    'select id::text from public.member where full_name is not null or phone is not null
     union all select id::text from public.audit_log where coalesce(after, before) ?| array[''phone'', ''full_name'']', sim.who('investor'));
  if p_scope <> 'night' then
    perform sim.check(d, p_scope, 'P07', 'An erased member''s name and phone appear nowhere', 'select * from sim.erased_traces()');
    perform sim.check(d, p_scope, 'N11', 'A name hidden from the TVs reaches no TV board and no public view', 'select * from sim.hidden_name_leaks()');
  end if;
end $$;

-- What the consumers sent: once for each event and consumer, to the member the event is about, never for practice.
create function sim.checks_messages(d int, p_scope text) returns void language plpgsql as $$
begin
  perform sim.check(d, p_scope, 'N07', 'Each event is delivered at most once by each consumer',
    'select event_id, consumer, count(*) from public.outbox_delivery where venue_id = sim.venue() and status = ''delivered''
     group by 1, 2 having count(*) > 1');
  perform sim.check(d, p_scope, 'N08', 'A member''s WhatsApp goes to that member''s number; an alert to the owner''s number only',
    'select m.id, m.kind, m.recipient from sim.message m left join public.member x on x.id = m.member_id
     where m.channel = ''whatsapp'' and m.day = ' || d || '
       and case when m.consumer like ''%alert%'' then ltrim(m.recipient, ''+'') <> ''919999000999''
                else x.phone is null or ltrim(m.recipient, ''+'') <> ltrim(x.phone, ''+'') end');
end $$;

-- Two people at once: exactly one of them wins, and nothing is done twice.
create function sim.checks_races(d int, p_scope text) returns void language plpgsql as $$
begin
  perform sim.check(d, p_scope, 'R01', 'Two staff seating one member at once: one seat',
    'select r.id from sim.race r where r.day = ' || d || ' and r.kind = ''seat_same_member''
       and (select count(*) from public.seat_session s where s.member_id = (r.subject ->> ''member'')::uuid and s.started_at = r.at) > 1');
  perform sim.check(d, p_scope, 'R02', 'A double tap on an order: exactly one order',
    'select r.id, (select count(*) from public.fnb_order o where o.idempotency_key = (r.subject ->> ''key'')::uuid) as orders
     from sim.race r where r.day = ' || d || ' and r.kind = ''double_order''
       and (select count(*) from public.fnb_order o where o.idempotency_key = (r.subject ->> ''key'')::uuid) <> 1');
  perform sim.check(d, p_scope, 'R03', 'A double tap on a top-up: one request',
    'select r.id from sim.race r where r.day = ' || d || ' and r.kind = ''double_top_up''
       and (select count(*) from public.top_up_request t where t.member_id = (r.subject ->> ''member'')::uuid and t.requested_at = r.at) > 1');
  perform sim.check(d, p_scope, 'R04', 'A double tap on a reward: one redemption, points spent once',
    'select r.id from sim.race r where r.day = ' || d || ' and r.kind = ''double_redeem''
       and (select count(*) from public.redemption x where x.idempotency_key = r.subject ->> ''key'') > 1');
  perform sim.check(d, p_scope, 'R05', 'Approving a request as the member leaves: the place is left, or approved, never both',
    'select r.id, e.status from sim.race r join public.waitlist_entry e on e.id = (r.subject ->> ''entry'')::uuid
     where r.day = ' || d || ' and r.kind = ''approve_vs_leave'' and e.status = ''waiting''
       and exists (select 1 from sim.log l where l.action = ''race.leave'' and l.ok and l.at = r.at)');
end $$;

create function sim.checks_harness(d int, p_scope text) returns void language plpgsql as $$
begin
  perform sim.check(d, p_scope, 'X02', 'Harness: no call failed because the harness named a function, column or type wrongly',
    'select action, sqlstate, message, count(*) from sim.log where day = ' || d || ' and not ok
       and sqlstate in (''42883'', ''42703'', ''42P01'', ''42601'', ''42804'', ''22P02'', ''42702'', ''P0001'') group by 1, 2, 3');
  perform sim.check(d, p_scope, 'X03', 'Every call an app makes exists and a signed-in or anonymous person may run it',
    'select r.name from sim.rpc r where r.name not like ''edge:%'' and not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = ''public'' and p.proname = r.name
         and (has_function_privilege(''authenticated'', p.oid, ''execute'') or has_function_privilege(''anon'', p.oid, ''execute'')))');
end $$;

-- At 23:00, with the room full, what the paired TV shows: no name a member hid from the TVs.
create function sim.checks_midnight(d int, p_scope text default 'midnight') returns void language plpgsql as $$
begin
  perform sim.check(d, p_scope, 'N13', 'A name hidden from the TVs never shows on a TV board while the club is open',
    'select * from sim.hidden_name_leaks() where source = ''tv boards''');
end $$;

create function sim.check_invariants(d int, p_scope text) returns void language plpgsql as $$
begin
  perform sim.checks_state(d, p_scope);
  perform sim.checks_features(d, p_scope);
  perform sim.checks_privacy(d, p_scope);
  perform sim.checks_messages(d, p_scope);
  perform sim.checks_races(d, p_scope);
  perform sim.checks_harness(d, p_scope);
end $$;
