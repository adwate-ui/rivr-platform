-- Seats left open overnight are noticed (the trial run, 13 Nov). Nobody ended the seats at close: six sessions stayed open
-- until the next morning, each stamped at the night's end (private.seat_end_stamp) and so read seven to nine hours of play,
-- and nothing said so. Once a night, a quarter of an hour after the club's day turns over (06:00 IST, private.tonight_began),
-- each venue but the practice one with a seat taken before then and still open raises floor.seats_left_open with the
-- count, once. A player who really stays past 06:00 is not cut short (decision 0561): the alert only says seats are open.

create function private.alert_seats_left_open()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue record;
  v_alerted integer := 0;
begin
  for v_venue in
    select s.venue_id, count(*) as seats
    from public.seat_session s
    join public.venue v on v.id = s.venue_id
    where not v.is_practice and s.ended_at is null and s.seated_here_at < private.tonight_began(now())
    group by s.venue_id
  loop
    if not exists (select 1 from public.alert a where a.venue_id = v_venue.venue_id and a.kind = 'floor.seats_left_open'
                     and a.raised_at >= private.tonight_began(now())) then
      perform private.raise_alert(v_venue.venue_id, 'floor.seats_left_open', jsonb_build_object('seats', v_venue.seats));
      v_alerted := v_alerted + 1;
    end if;
  end loop;
  return v_alerted;
end;
$$;

revoke execute on function private.alert_seats_left_open() from public, anon, authenticated;

-- 00:45 UTC is 06:15 IST.
select cron.schedule('seats-left-open', '45 0 * * *', 'select private.alert_seats_left_open()');
