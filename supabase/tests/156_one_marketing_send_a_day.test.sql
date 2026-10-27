-- At most one marketing send a day to a member (#501; decision 0249). Vihaan (212) has opted in to marketing; 107 Ishita
-- (marketing) submits promotions and 101, a super admin, approves them. Every promotion waits for a super admin (#144),
-- which is #501's other half.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

update public.promotion set status = 'draft' where status = 'live';

create function pg_temp.as_person(p_person text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', jsonb_build_object('sub', p_person, 'role', 'authenticated')::text, true);
$$;
grant execute on function pg_temp.as_person(text) to authenticated;
create function pg_temp.offered(p_name text) returns text language sql as $$
  select coalesce(string_agg(right(e.payload ->> 'member_id', 3), ' ' order by e.payload ->> 'member_id'), 'none')
  from public.outbox_event e join public.promotion p on p.id::text = e.payload ->> 'promotion_id'
  where e.event_type = 'promotion.offered' and p.name = p_name;
$$;
create function pg_temp.publish(p_name text) returns void language plpgsql as $$
declare
  v_id uuid;
begin
  perform pg_temp.as_person('00000000-0000-4000-8000-000000000107');
  v_id := public.submit_promotion('00000000-0000-4000-8000-000000000001', jsonb_build_object(
    'name', p_name, 'runs', 'Every night',
    'rule', jsonb_build_object('trigger', 'hours_played', 'conditions', '{}'::jsonb, 'effect', '{"kind": "points", "multiplier_percent": 200}'::jsonb)));
  perform pg_temp.as_person('00000000-0000-4000-8000-000000000101');
  perform public.approve_promotion(v_id);
  reset role;
end;
$$;

insert into public.consent (venue_id, member_id, purpose)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000212', 'marketing');

-- A promotion waits for a super admin before it is offered to anyone.
select pg_temp.as_person('00000000-0000-4000-8000-000000000107');
select public.submit_promotion('00000000-0000-4000-8000-000000000001', jsonb_build_object(
  'name', 'Waiting', 'runs', 'Every night',
  'rule', jsonb_build_object('trigger', 'hours_played', 'conditions', '{}'::jsonb, 'effect', '{"kind": "points", "multiplier_percent": 200}'::jsonb)));
reset role;
select is(pg_temp.offered('Waiting'), 'none', 'a submitted promotion is offered to nobody until a super admin approves it');

-- The first promotion tonight is offered to Vihaan; the second, the same night, is not.
select pg_temp.publish('Double points');
select is(pg_temp.offered('Double points'), '212', 'the first promotion tonight is offered to Vihaan');
select pg_temp.publish('Triple points');
select is(pg_temp.offered('Triple points'), 'none', 'a second the same night is not: one marketing send a day');

-- Per member: Yash, who opts in now and has had none tonight, is offered the next one; Vihaan still not.
insert into public.consent (venue_id, member_id, purpose)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000214', 'marketing');
select pg_temp.publish('Bonus night');
select is(pg_temp.offered('Bonus night'), '214', 'Yash, offered nothing tonight, is offered the next; Vihaan still not');

select * from finish();
rollback;
