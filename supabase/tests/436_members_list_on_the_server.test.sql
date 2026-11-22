-- Members on the server (redesign RD-29): public.members_page gives one page of a view, sorted, searched and filtered
-- there, with how many members the view leaves; public.members_choices gives a column menu's counts over every member.
-- Vikram (101, super admin) reads full numbers; Aditya (103, an admin) their last four digits; Pema (106, a dealer)
-- reads no members. Each row is checked against private.members_of_tier, which the list read whole until now.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.view(p_view jsonb) returns jsonb language sql as $$ select '{"page_size": 1000}'::jsonb || p_view $$;
grant execute on function pg_temp.view(jsonb) to authenticated;

-- Member 211 played 90 and 45 minutes in two closed sessions and lives in Gurugram; 212 is in a seat now.
create temporary table played (id uuid, minutes integer, seat integer);
insert into played values (gen_random_uuid(), 90, 4), (gen_random_uuid(), 45, 5);
insert into public.visit (id, venue_id, member_id, opened_at, closed_at, close_reason)
select p.id, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211',
       now() - make_interval(mins => p.minutes + 2), now() - interval '30 seconds', 'door'
from played p;
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, ended_at, end_reason, call_time_minutes)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000211', p.id,
       (select id from public.game_table where venue_id = '00000000-0000-4000-8000-000000000001' and name = 'Table 3'), p.seat,
       now() - make_interval(mins => p.minutes + 1), now() - make_interval(mins => p.minutes + 1), now() - interval '1 minute', 'left', 0
from played p;
insert into public.member_preference (member_id, venue_id, city)
values ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000001', 'Gurugram')
on conflict (member_id) do update set city = excluded.city;
delete from public.seat_session where member_id = '00000000-0000-4000-8000-000000000212' and ended_at is null;
update public.visit set closed_at = now(), close_reason = 'door' where member_id = '00000000-0000-4000-8000-000000000212' and closed_at is null;
with opened as (
  insert into public.visit (venue_id, member_id, opened_at) values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', now() - interval '10 minutes')
  returning id)
insert into public.seat_session (venue_id, member_id, visit_id, table_id, seat, started_at, seated_here_at, call_time_minutes)
select '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', opened.id, g.id, s.seat, now() - interval '9 minutes', now() - interval '9 minutes', 0
from opened, public.game_table g
cross join lateral (select n as seat from generate_series(1, 9) n
                    where not exists (select 1 from public.seat_session o where o.table_id = g.id and o.seat = n and o.ended_at is null) limit 1) s
where g.venue_id = '00000000-0000-4000-8000-000000000001' and g.name = 'Table 3';

-- A verified check whose member is under age is not complete (private.is_kyc_complete), and one member is on a break.
create temporary table under_age as
select k.member_id from public.kyc_record k join public.member m on m.id = k.member_id
where m.venue_id = '00000000-0000-4000-8000-000000000001' and k.status = 'verified' order by m.member_number limit 1;
update public.kyc_record set date_of_birth = (now() - interval '10 years')::date where member_id = (select member_id from under_age);
insert into public.self_exclusion (venue_id, member_id, starts_at, ends_at)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000213', now() - interval '1 day', now() + interval '30 days');

-- The club's members as the tables hold them, read here before any role is taken.
create temporary table club as
select m.id, m.full_name, m.member_number, m.phone, m.tier_id, m.created_at,
       private.bonus_in_force(m.id, now()) as bonus,
       exists (select 1 from public.seat_session s where s.member_id = m.id and s.ended_at is null) as is_seated
from public.member m where m.venue_id = '00000000-0000-4000-8000-000000000001';
grant select on club, under_age to authenticated;

-- Indexes to match: the list by name, number and joining day; a name or mobile by any part; a mobile's last four.
select has_index('public', 'member', 'member_venue_name_idx', 'the list by name has its index');
select has_index('public', 'member', 'member_name_trgm_idx', 'a name is found by any part of it');
select has_index('public', 'member', 'member_venue_phone_last4_idx', 'and a mobile by its last four digits');

select pg_temp.as_person('00000000-0000-4000-8000-000000000101');
-- The view the screen opens on: fifty by name, and how many there are in all.
select is((select array_agg(member_id) from public.members_page('00000000-0000-4000-8000-000000000001')),
  (select array_agg(id) from (select id from club order by full_name, id limit 50) c), 'the first page is fifty members by name');
select is((select distinct total from public.members_page('00000000-0000-4000-8000-000000000001')), (select count(*) from club),
  'each row says how many members the view leaves');
select is((select array_agg(member_id) from public.members_page('00000000-0000-4000-8000-000000000001', '{"page": 3, "page_size": 10}')),
  (select array_agg(id) from (select id from club order by full_name, id limit 10 offset 20) c), 'a later page starts where the one before ended');
select is((select array_agg(member_id) from public.members_page('00000000-0000-4000-8000-000000000001', '{"page_size": 5, "sort": {"key": "name", "direction": "descending"}}')),
  (select array_agg(id) from (select id from club order by full_name desc, id desc limit 5) c), 'the order turns round');
select is((select array_agg(member_id) from public.members_page('00000000-0000-4000-8000-000000000001', '{"page_size": 5, "sort": {"key": "number", "direction": "descending"}}')),
  (select array_agg(id) from (select id from club order by member_number desc limit 5) c), 'by member number');
select is((select array_agg(member_id) from public.members_page('00000000-0000-4000-8000-000000000001', '{"page_size": 5, "sort": {"key": "since", "direction": "ascending"}}')),
  (select array_agg(id) from (select id from club order by created_at, full_name, id limit 5) c), 'by the day they joined');
select is((select member_id from public.members_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1, "sort": {"key": "tonight", "direction": "ascending"}}')),
  (select c.id from club c join public.seat_session s on s.member_id = c.id and s.ended_at is null join public.game_table g on g.id = s.table_id
   order by g.name || ' ' || lpad(s.seat::text, 2, '0'), c.full_name limit 1), 'by where they are tonight, a seat first');

-- Each row is the member as the whole list gave them, with their Bonus.
select is_empty($$ select 1 from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{}')) p
                   full join public.members_of_tier('00000000-0000-4000-8000-000000000001') l on l.member_id = p.member_id
                   where (p.member_id, p.member_number, p.full_name, p.phone, p.phone_last4, p.tier_name, p.visits, p.last_visit_at, p.kyc_status, p.minutes_played,
                          p.city, p.member_since, p.known_as, p.own_referral_code, p.occupation, p.play_times, p.games_played, p.referral_code, p.creator_code,
                          p.kyc_method, p.kyc_verified_at, p.date_of_birth, p.pan, p.masked_aadhaar, p.aadhaar_name, p.address)
                         is distinct from
                         (l.member_id, l.member_number, l.full_name, l.phone, l.phone_last4, l.tier_name, l.visits, l.last_visit_at, l.kyc_status, l.minutes_played,
                          l.city, l.member_since, l.known_as, l.own_referral_code, l.occupation, l.play_times, l.games_played, l.referral_code, l.creator_code,
                          l.kyc_method, l.kyc_verified_at, l.date_of_birth, l.pan, l.masked_aadhaar, l.aadhaar_name, l.address) $$,
  'a super admin reads each member as before, full number and identity documents with them');
select is_empty($$ select 1 from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{}')) p join club c on c.id = p.member_id
                   where p.bonus_paise is distinct from c.bonus $$, 'and their Bonus in force');
select is((select kyc_status from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{}')) where member_id = (select member_id from under_age)),
  'not_done', 'a verified check of a member under age is not done, as the record has it');

-- The search: a name by any part, a member number exactly, a mobile by four or more digits.
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"query": " VERMA "}')) $$,
  $$ select id from club where full_name ilike '%verma%' $$, 'a name is found by any part, whatever its case');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view(jsonb_build_object('query', (select member_number::text from club where id = '00000000-0000-4000-8000-000000000211')))) $$,
  $$ select id from club where member_number = (select member_number from club where id = '00000000-0000-4000-8000-000000000211')
        or full_name ilike '%' || (select member_number::text from club where id = '00000000-0000-4000-8000-000000000211') || '%'
        or (length((select member_number::text from club where id = '00000000-0000-4000-8000-000000000211')) >= 4
            and phone like '%' || (select member_number::text from club where id = '00000000-0000-4000-8000-000000000211') || '%') $$,
  'a member number is found exactly');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"query": "00002"}')) $$,
  $$ select id from club where phone like '%00002%' or member_number = 2 $$, 'a super admin finds a mobile by any five digits of it');
select is_empty($$ select 1 from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"query": "x'') or true; drop table public.member; --"}')) $$,
  'words that look like SQL are only words');
select is_empty($$ select 1 from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"query": "100%"}')) $$,
  'and a percent sign is itself');

-- Every column's filter is applied there.
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"filters": {"played": {"kind": "range", "min": "2", "max": ""}}}')) $$,
  $$ select member_id from public.members_of_tier('00000000-0000-4000-8000-000000000001') where minutes_played >= 120 $$, 'hours played, from two hours');
select ok((select bool_or(member_id = '00000000-0000-4000-8000-000000000211') from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"filters": {"played": {"kind": "range", "min": "2", "max": "2.5"}}}'))),
  'member 211, with 135 minutes, is between two hours and two and a half');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"filters": {"city": {"kind": "choice", "chosen": ["Gurugram"]}}}')) $$,
  $$ select member_id from public.members_of_tier('00000000-0000-4000-8000-000000000001') where city = 'Gurugram' $$, 'a city chosen');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"filters": {"kyc": {"kind": "choice", "chosen": ["verified", "refused"]}}}')) $$,
  $$ select member_id from public.members_of_tier('00000000-0000-4000-8000-000000000001') where kyc_status in ('verified', 'refused') $$, 'two states of the ID check');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"filters": {"tonight": {"kind": "choice", "chosen": ["seated"]}}}')) $$,
  $$ select id from club where is_seated $$, 'the members in a seat tonight');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"filters": {"number": {"kind": "range", "min": "1", "max": "3"}, "name": {"kind": "text", "typed": "a"}}}')) $$,
  $$ select id from club where member_number between 1 and 3 and full_name ilike '%a%' $$, 'a number from and to, with words in the name: both hold');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"filters": {"visits": {"kind": "range", "min": "1", "max": ""}}}')) $$,
  $$ select member_id from public.members_of_tier('00000000-0000-4000-8000-000000000001') where visits >= 1 $$, 'visits, one or more');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"filters": {"bonus": {"kind": "range", "min": "1", "max": ""}}}')) $$,
  $$ select id from club where bonus >= 100 $$, 'Bonus, in whole Bonus');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"filters": {"since": {"kind": "date", "preset": "today"}}}')) $$,
  $$ select id from club where ((created_at at time zone 'Asia/Kolkata') - interval '6 hours')::date = ((now() at time zone 'Asia/Kolkata') - interval '6 hours')::date $$,
  'joined on this club day');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"filters": {"since": {"kind": "dateRange", "from": "", "to": "2020-01-01"}}}')) $$,
  $$ select id from club where created_at < '2020-01-01' $$, 'or up to a day long ago');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"filters": {"status": {"kind": "choice", "chosen": ["active"]}}}')) $$,
  $$ select id from club where id not in (select member_id from public.member_account_statuses('00000000-0000-4000-8000-000000000001')) $$,
  'the members whose account is simply active');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"filters": {"status": {"kind": "choice", "chosen": ["on_break"]}}}')) $$,
  $$ select member_id from public.member_account_statuses('00000000-0000-4000-8000-000000000001') where status = 'on_break' $$, 'and the members on a break');
select ok((select bool_or(member_id = '00000000-0000-4000-8000-000000000213' and status = 'on_break' and until > now()) from public.member_account_statuses('00000000-0000-4000-8000-000000000001')),
  'member 213 among them, with the day the break ends');
select is((select member_id from public.members_page('00000000-0000-4000-8000-000000000001', '{"page_size": 1, "sort": {"key": "status", "direction": "descending"}}')),
  (select s.member_id from public.member_account_statuses('00000000-0000-4000-8000-000000000001') s join club c on c.id = s.member_id where s.status = 'on_break' order by c.full_name, c.id limit 1),
  'and first when the list is turned by status');
select is((select count(*) from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"filters": {"nonsense": {"kind": "text", "typed": "x"}, "kyc": {"kind": "range", "min": "", "max": ""}}, "sort": {"key": "drop table"}}'))),
  (select count(*) from club), 'a column the list does not have, a filter that asks nothing and an order it does not know change nothing');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view(jsonb_build_object('tier_id', (select tier_id from club where id = '00000000-0000-4000-8000-000000000211')))) $$,
  $$ select id from club where tier_id = (select tier_id from club where id = '00000000-0000-4000-8000-000000000211') $$, 'a tier chosen above the table');

-- A column menu's counts are over every member the other filters leave.
select is((select sum(members) from public.members_choices('00000000-0000-4000-8000-000000000001') where column_key = 'kyc'), (select count(*) from club)::numeric,
  'the ID check''s values count every member once');
select results_eq($$ select value, members from public.members_choices('00000000-0000-4000-8000-000000000001') where column_key = 'kyc' order by value $$,
  $$ select kyc_status, count(*) from public.members_of_tier('00000000-0000-4000-8000-000000000001') group by 1 order by 1 $$, 'each as the list words it');
select is((select members from public.members_choices('00000000-0000-4000-8000-000000000001') where column_key = 'tonight' and value = 'seated'),
  (select count(*) from club where is_seated), 'Tonight counts the members in a seat');
select is((select members from public.members_choices('00000000-0000-4000-8000-000000000001') where column_key = 'city' and value = 'Gurugram'),
  (select count(*) from public.members_of_tier('00000000-0000-4000-8000-000000000001') where city = 'Gurugram'), 'City counts each city given');
select is((select sum(members) from public.members_choices('00000000-0000-4000-8000-000000000001', '{"filters": {"tonight": {"kind": "choice", "chosen": ["seated"]}}}') where column_key = 'kyc'),
  (select count(*) from club where is_seated)::numeric, 'another column''s filter narrows a menu''s counts');
select is((select sum(members) from public.members_choices('00000000-0000-4000-8000-000000000001', '{"filters": {"tonight": {"kind": "choice", "chosen": ["seated"]}}}') where column_key = 'tonight'),
  (select count(*) from club)::numeric, 'a column''s own filter does not, so its other values stay on offer');
select is((select sum(members) from public.members_choices('00000000-0000-4000-8000-000000000001', '{"query": "verma"}') where column_key = 'status'),
  (select count(*) from club where full_name ilike '%verma%')::numeric, 'and the search narrows them too');

-- An admin, as the floor (members.phone), reads every full number on a page of the list and finds one by any of its digits,
-- but no identity document, and no number in a bulk read, as an export (the owner, 22 Nov).
select pg_temp.as_person('00000000-0000-4000-8000-000000000103');
select is_empty($$ select 1 from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"page_size": 50}')) p join club c on c.id = p.member_id
                   where p.phone is distinct from c.phone or p.date_of_birth is not null or p.pan is not null or p.masked_aadhaar is not null
                      or p.address is not null $$,
  'an admin is given each full number on a page and no identity document');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"query": "90000 002", "page_size": 50}')) $$,
  $$ select id from club where phone like '%90000002%' $$, 'and finds a mobile by digits from its middle');
select is_empty($$ select 1 from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{}')) where phone is not null $$,
  'but no full number in a bulk read');

-- A host reads no full number, and finds a mobile only by its last four digits.
select pg_temp.as_person('00000000-0000-4000-8000-000000000108');
select is_empty($$ select 1 from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{}')) where phone is not null
                   or date_of_birth is not null or pan is not null or masked_aadhaar is not null or address is not null $$,
  'a host is given no full number and no identity document');
select is_empty($$ select 1 from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{}')) p join club c on c.id = p.member_id
                   where p.phone_last4 is distinct from right(c.phone, 4) $$, 'but each number''s last four digits');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"query": "0211"}')) $$,
  $$ select id from club where right(phone, 4) = '0211' or member_number = 211 or full_name ilike '%0211%' $$, 'four digits find a mobile by its end');
select set_eq($$ select member_id from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"query": "90000 002"}')) $$,
  $$ select id from club where right(phone, 4) = '0002' $$, 'more digits still find it only by its last four, never by its middle');
select is((select count(*) from public.members_page('00000000-0000-4000-8000-000000000001', pg_temp.view('{"filters": {"mobile": {"kind": "text", "typed": "90000"}}}'))),
  (select count(*) from club), 'and the mobile column, which a host does not have, filters nothing');

-- Staff who read no members are given none.
select pg_temp.as_person('00000000-0000-4000-8000-000000000106');
select is_empty($$ select 1 from public.members_page('00000000-0000-4000-8000-000000000001') $$, 'a dealer is given no page');
select is_empty($$ select 1 from public.members_choices('00000000-0000-4000-8000-000000000001') $$, 'and no counts');
reset role;
select is(has_function_privilege('anon', 'public.members_page(uuid, jsonb)', 'execute'), false, 'nobody signed out reads the list');
select is(has_function_privilege('anon', 'public.members_choices(uuid, jsonb)', 'execute'), false, 'nor its counts');
select is(has_function_privilege('authenticated', 'private.members_list_sql(jsonb, boolean)', 'execute'), false, 'and nobody is handed the statement itself');
select ok((select count(*) > 100 from public.member), 'the members are all still there');

-- What is typed is read to 200 characters where the statement is built (the security review of the pull request).
select ok((select position(repeat('x', 200) in o_where) > 0 and position(repeat('x', 201) in o_where) = 0
           from private.members_list_sql(jsonb_build_object('query', repeat('x', 5000)), false)), 'a search of 5,000 characters is read to its first 200');
select ok(position(repeat('y', 201) in private.list_filter_sql('m.full_name', jsonb_build_object('kind', 'text', 'typed', repeat('y', 5000)), current_date)) = 0,
          'and a column''s typed filter');
select ok(position(repeat('z', 201) in private.list_filter_sql('m.full_name', jsonb_build_object('kind', 'choice', 'chosen', jsonb_build_array(repeat('z', 5000))), current_date)) = 0,
          'and a value chosen');
select ok(position(repeat('w', 201) in private.list_where_sql('{"name": "full_name"}'::jsonb, array['full_name'], jsonb_build_object('query', repeat('w', 5000)), null)) = 0,
          'and the search of every other list');

select * from finish();
rollback;
