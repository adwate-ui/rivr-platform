-- The fallback runbooks (#52; scope-v1 module 11): app down, Wi-Fi down, power cut, UPI down and KYC
-- vendor down, each with the paper form to use and the step that brings the paper back into the system.
-- They join the training set in every venue's SOP library, so staff read and acknowledge them on the
-- console (decision 0121); docs/runbooks/paper-fallback.md has the printable forms and the drill.
-- add_training_sops is #51's with five more; a title the library has is left as it is.

create or replace function private.add_training_sops(p_venue_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sop record;
  v_sop_id uuid;
begin
  for v_sop in
    select * from (values
      ('Dealer certification', 'Floor manager', '{dealer}'::public.staff_role[],
       E'1. Sign in on the tablet at your table with your PIN before the first hand of your down.\n'
       '2. Log every hand once the pot is pushed: enter the pot, and the tablet works out the rake and the jackpot drop.\n'
       '3. Claim a high hand on the tablet with the hand it was dealt in; the floor approves it before anything is paid.\n'
       '4. Chips come only from the cage: send a buy-in request from the tablet and wait for the runner.\n'
       '5. If the tablet loses its connection, keep logging: hands wait on the tablet and go once it reconnects.\n'
       '6. At the end of your down, end it on the tablet and enter the drop-box count before you leave the table.\n'
       '7. Pass the dealer certification quiz in the practice venue before your first live down.'),
      ('Cage', 'Duty manager', '{cashier}'::public.staff_role[],
       E'1. Open the cage''s shift on the console and count the float by denomination before the first transaction.\n'
       '2. Sell chips only to a member whose identity check is complete, and record every buy-in and cash-out against the member.\n'
       '3. Confirm a UPI deposit only once its amount and UTR are found in the bank.\n'
       '4. Prepare withdrawals; a second staff member approves each one, never the one who prepared it.\n'
       '5. Issue a marker only within the member''s credit limit, signed by the member on the cage screen.\n'
       '6. While the venue is frozen, record nothing in the system: run the cage on paper until it is released.\n'
       '7. At the end of the shift, count the chips and cash and close the shift; a difference needs a reason from the floor manager.'),
      ('Women''s safety', 'General manager', '{super_admin,admin,cashier,dealer,marketing,host,owner_view}'::public.staff_role[],
       E'1. Every guest and every member of staff may ask any manager for help at any time.\n'
       '2. The duty manager answers a report at once, in person, and keeps the people involved apart.\n'
       '3. A guest who makes anyone feel unsafe is asked to leave, and is not seated again until the general manager decides.\n'
       '4. Walk any guest or member of staff who asks to their car or cab.\n'
       '5. Log every report in the incident log the same night, with the camera reference.\n'
       '6. Never discuss a report outside the managers handling it.'),
      ('Anti-money laundering', 'General manager', '{super_admin,admin,cashier}'::public.staff_role[],
       E'1. Sell chips only to a member with a complete identity check, and only for themselves.\n'
       '2. Record every buy-in and cash-out in the system as it happens; never split one into several.\n'
       '3. Pay withdrawals only to the member''s own verified payout account.\n'
       '4. Tell the duty manager about anything unusual: large cash with little play, chips passed between players, or a refusal to finish the identity check.\n'
       '5. The duty manager records the concern for review. Do not discuss it with the member.'),
      ('Table-side food and drink', 'Floor manager', '{dealer,host}'::public.staff_role[],
       E'1. Take a seated player''s order between hands and pass it to the host, who sends it to the bar.\n'
       '2. Food and drink never touch the felt: use the side tables and holders.\n'
       '3. A comp is given only when the floor manager allows it.\n'
       '4. Clear empty glasses and plates between hands, never during one.\n'
       '5. Tell the floor at once about a spill on the table; play waits until it is dry.'),
      ('Fallback: app down', 'Duty manager', '{super_admin,admin,cashier,dealer,host}'::public.staff_role[],
       E'1. When the console cannot be reached, or the venue is frozen, the duty manager calls the paper fallback and writes the time on the outage sheet.\n'
       '2. Cage: write every buy-in on the cage paper log, one numbered slip each: slip number, time, member and mobile number, table and seat, amount, cash, cashier''s initials. Use the slips in order; never skip or reuse a number.\n'
       '3. No cash-outs on paper: a player''s chips stay with them until the system is back. Take cash only: no UPI, wallet, bonus or markers.\n'
       '4. Floor: write every seat taken and left on the floor sheet: time, member, mobile number, table, seat.\n'
       '5. Dealers keep logging hands on the tablet: hands wait on it and send once the system is back. Only for a tablet that has died, write each pot on the table''s hand sheet.\n'
       '6. Back in the system: the floor seats each player from the floor sheet, then the cage enters every slip in number order and ticks it.\n'
       '7. The duty manager checks that every slip is ticked, the numbers run without a gap, and the slips add up to the cash taken on paper, then signs the sheets and keeps them with the night''s end of day. A slip left out would show at the end of day as cash over.\n'
       '8. A player seated on paper has their call time counted from when they are entered. One whose call time from the floor sheet''s time is done is let go by an admin, with the reason "Paper fallback, seated at" and that time.\n'
       '9. A hand sheet''s pots are set against the drop-box variance when that down ends.'),
      ('Fallback: Wi-Fi down', 'Duty manager', '{super_admin,admin,cashier,dealer,host}'::public.staff_role[],
       E'1. Tablets keep logging hands: they wait on the tablet, through a restart too, and send by themselves once the Wi-Fi is back.\n'
       '2. The cage and the console carry on while they still reach the system.\n'
       '3. If the cage cannot reach the system either, follow Fallback: app down.\n'
       '4. Only for a tablet that has died, the dealer writes each pot on the table''s hand sheet: time, pot, game.\n'
       '5. Back in the system: check each tablet shows no hands waiting. A hand sheet''s pots are set against the drop-box variance when that down ends.'),
      ('Fallback: power cut', 'Duty manager', '{super_admin,admin,cashier,dealer,host}'::public.staff_role[],
       E'1. Play stops. Dealers keep every pot in place and cover the cards; nothing moves until the lights are back.\n'
       '2. The cage closes the drawer and the chip trays; a cashier stays with them.\n'
       '3. The duty manager calls the building and the electricity supplier from the contact list kept at the cage, and writes the time on the outage sheet.\n'
       '4. Tablets keep logging on battery. If the cage computer goes off, follow Fallback: app down.\n'
       '5. Back in the system: enter the paper as in Fallback: app down, then count the cage and the chip trays before play restarts.'),
      ('Fallback: UPI down', 'Duty manager', '{super_admin,admin,cashier}'::public.staff_role[],
       E'1. Take cash only at the cage. Tell members that UPI deposits and withdrawals wait until it is back.\n'
       '2. A member who says they paid by UPI: write it on the UPI sheet: time, member and mobile number, amount, UTR, cashier''s initials. Give no chips for it yet.\n'
       '3. Withdrawals stay waiting; nobody pays one by another way.\n'
       '4. Back in the system: the member records the deposit in the app with its UTR, as every deposit is, and the cage confirms it against the bank by its amount and UTR and ticks the sheet. A line not yet in the app stays unticked and the sheet is kept.'),
      ('Fallback: KYC vendor down', 'Duty manager', '{super_admin,admin,cashier,host}'::public.staff_role[],
       E'1. A new member''s identity check cannot finish online. Nobody plays until it is done: no chips without a complete check.\n'
       '2. Staff who review identity checks check the member in person at the club, with the original documents, on the console.\n'
       '3. If the console is down too, write the member on the identity sheet: time, name, mobile number, the documents seen, staff initials. Give no chips.\n'
       '4. Back in the system: finish each check on the identity sheet in person on the console, and tick it.')
    ) as t (title, owner, ack_roles, body)
  loop
    insert into public.sop (venue_id, title) values (p_venue_id, v_sop.title)
    on conflict (venue_id, title) do nothing returning id into v_sop_id;
    if v_sop_id is not null then
      insert into public.sop_version (venue_id, sop_id, version, owner, ack_roles, effective_on, body)
      values (p_venue_id, v_sop_id, 1, v_sop.owner, v_sop.ack_roles, private.today_ist(), v_sop.body);
    end if;
  end loop;
end;
$$;

-- Venues that exist get the runbooks now; a new venue gets them from bootstrap_venue, which calls this.
select private.add_training_sops(v.id) from public.venue v;
