-- One hundred more members of RIVR Gurugram, so the console's lists and searches, the cage and the
-- player app read like a busy club (members 0000…0400 to 0499, numbers 90000 00400 to 00499). Local and
-- staging only; every statement is idempotent. Those with the app take code 123456 locally
-- (supabase/config.template.toml); on staging a number signs in once it is added as a test number.
--
-- They vary by: the app, or a walk-in's record with no login; tier (Member, Academy graduate, Founders'
-- Circle, a Black card at 50/100 or 100/200); the identity check (none, started, waiting for a PAN, done
-- through DigiLocker, by PAN, or in person at the cage); wallet cash, points and a bonus; and a verified
-- or refused withdrawal account.
--
-- Kept clear of what the flows and pgTAP count: no visits, waitlist entries, breaks, credit or markers,
-- consents or attribution, withdrawal accounts waiting for the cage, or checks waiting for review; and
-- no name that a flow's search would also find.

create temporary table seed_more_player (
  id uuid primary key,
  phone text not null,
  full_name text not null,
  has_app boolean not null,
  tier_name text not null,
  small_blind bigint,
  big_blind bigint,
  joined_days_ago int not null,
  -- The identity check: null for none yet.
  kyc_status text,
  kyc_method text,
  date_of_birth date,
  pan text,
  verified_days_ago int,
  -- Opening balances: paise, and points.
  cash_paise bigint not null,
  points bigint not null,
  bonus_paise bigint not null
) on commit drop;

insert into seed_more_player values
  ('00000000-0000-4000-8000-000000000400', '+919000000400', 'Nakul Dhillon', true, 'Member', null, null, 63, 'verified', 'digilocker', '1994-06-08', 'RVRPD4000R', 29, 4000000, 5310, 200000),
  ('00000000-0000-4000-8000-000000000401', '+919000000401', 'Vidya Chadha', true, 'Academy graduate', null, null, 157, 'verified', 'digilocker', '1983-05-20', 'RVRPC4001R', 137, 0, 20300, 0),
  ('00000000-0000-4000-8000-000000000402', '+919000000402', 'Mrinal Thakur', true, 'Founders'' Circle', null, null, 114, 'verified', 'pan', '1987-08-12', 'RVRPT4002R', 54, 0, 18940, 0),
  ('00000000-0000-4000-8000-000000000403', '+919000000403', 'Shreya Mittal', true, 'Member', null, null, 140, 'started', 'digilocker', null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000404', '+919000000404', 'Shaurya Walia', false, 'Member', null, null, 21, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000405', '+919000000405', 'Siddharth Vaid', true, 'Founders'' Circle', null, null, 296, 'verified', 'digilocker', '1995-11-15', 'RVRPV4005R', 101, 0, 25530, 0),
  ('00000000-0000-4000-8000-000000000406', '+919000000406', 'Chirag Bajaj', true, 'Member', null, null, 135, 'verified', 'pan', '1992-06-09', 'RVRPB4006R', 74, 1000000, 16860, 0),
  ('00000000-0000-4000-8000-000000000407', '+919000000407', 'Charu Bedi', true, 'Member', null, null, 150, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000408', '+919000000408', 'Ajay Dhillon', true, 'Founders'' Circle', null, null, 79, 'verified', 'pan', '1993-05-20', 'RVRPD4008R', 18, 0, 21420, 250000),
  ('00000000-0000-4000-8000-000000000409', '+919000000409', 'Siddharth Tiwari', false, 'Member', null, null, 58, 'verified', 'manual', '1968-03-01', 'RVRPT4009R', 25, 500000, 0, 0),
  ('00000000-0000-4000-8000-000000000410', '+919000000410', 'Raghav Grewal', true, 'Member', null, null, 263, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000411', '+919000000411', 'Jahnavi Mittal', true, 'Member', null, null, 125, 'verified', 'digilocker', '1992-04-22', 'RVRPM4011R', 33, 10000000, 17580, 0),
  ('00000000-0000-4000-8000-000000000412', '+919000000412', 'Jayesh Dhillon', true, 'Member', null, null, 78, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000413', '+919000000413', 'Abhay Agarwal', true, 'Member', null, null, 248, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000414', '+919000000414', 'Shreya Rastogi', false, 'Member', null, null, 67, 'verified', 'manual', '1976-08-11', 'RVRPR4014R', 28, 1000000, 27690, 0),
  ('00000000-0000-4000-8000-000000000415', '+919000000415', 'Girish Sarin', true, 'Member', null, null, 63, 'started', 'digilocker', null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000416', '+919000000416', 'Prachi Saini', true, 'Member', null, null, 126, 'started', 'digilocker', null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000417', '+919000000417', 'Keshav Parikh', true, 'Member', null, null, 112, 'needs_pan', 'digilocker', '1976-06-28', null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000418', '+919000000418', 'Uday Thakur', true, 'Member', null, null, 204, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000419', '+919000000419', 'Anushka Chawla', false, 'Founders'' Circle', null, null, 55, 'verified', 'manual', '1977-10-11', 'RVRPC4019R', 39, 500000, 19960, 0),
  ('00000000-0000-4000-8000-000000000420', '+919000000420', 'Sakshi Tandon', true, 'Black card', 5000, 10000, 115, 'verified', 'digilocker', '1970-08-25', 'RVRPT4020R', 73, 10000000, 1160, 0),
  ('00000000-0000-4000-8000-000000000421', '+919000000421', 'Puneet Agarwal', true, 'Member', null, null, 148, 'needs_pan', 'digilocker', '1967-11-28', null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000422', '+919000000422', 'Vinay Saini', true, 'Member', null, null, 210, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000423', '+919000000423', 'Abhay Sarin', true, 'Member', null, null, 242, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000424', '+919000000424', 'Amrita Agarwal', false, 'Member', null, null, 84, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000425', '+919000000425', 'Nidhi Mittal', true, 'Member', null, null, 208, 'started', 'digilocker', null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000426', '+919000000426', 'Bhuvan Walia', true, 'Founders'' Circle', null, null, 242, 'verified', 'pan', '2005-01-08', 'RVRPW4026R', 32, 2500000, 0, 100000),
  ('00000000-0000-4000-8000-000000000427', '+919000000427', 'Kashish Rastogi', true, 'Founders'' Circle', null, null, 117, 'verified', 'pan', '1974-11-28', 'RVRPR4027R', 71, 1000000, 0, 0),
  ('00000000-0000-4000-8000-000000000428', '+919000000428', 'Vaani Mathur', true, 'Member', null, null, 166, 'verified', 'digilocker', '1972-07-05', 'RVRPM4028R', 26, 0, 13190, 0),
  ('00000000-0000-4000-8000-000000000429', '+919000000429', 'Atharv Grewal', false, 'Academy graduate', null, null, 49, 'verified', 'manual', '2002-04-01', 'RVRPG4029R', 0, 500000, 0, 0),
  ('00000000-0000-4000-8000-000000000430', '+919000000430', 'Radhika Walia', true, 'Member', null, null, 182, 'started', 'digilocker', null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000431', '+919000000431', 'Radhika Agarwal', true, 'Member', null, null, 177, 'started', 'digilocker', null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000432', '+919000000432', 'Rajesh Saini', true, 'Founders'' Circle', null, null, 195, 'verified', 'pan', '1991-12-17', 'RVRPS4032R', 117, 5000000, 11560, 0),
  ('00000000-0000-4000-8000-000000000433', '+919000000433', 'Prateek Luthra', true, 'Member', null, null, 170, 'started', 'digilocker', null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000434', '+919000000434', 'Mahima Bedi', false, 'Academy graduate', null, null, 86, 'verified', 'manual', '1983-09-28', 'RVRPB4034R', 34, 500000, 3400, 0),
  ('00000000-0000-4000-8000-000000000435', '+919000000435', 'Yamini Mehrotra', true, 'Black card', 10000, 20000, 173, 'verified', 'digilocker', '2004-04-03', 'RVRPM4035R', 140, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000436', '+919000000436', 'Charu Taneja', true, 'Member', null, null, 51, 'needs_pan', 'digilocker', '1975-07-18', null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000437', '+919000000437', 'Eshan Taneja', true, 'Black card', 5000, 10000, 69, 'verified', 'digilocker', '1968-12-23', 'RVRPT4037R', 0, 10000000, 0, 0),
  ('00000000-0000-4000-8000-000000000438', '+919000000438', 'Shalini Sood', true, 'Member', null, null, 256, 'verified', 'pan', '1994-11-28', 'RVRPS4038R', 136, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000439', '+919000000439', 'Vishal Ghosh', false, 'Member', null, null, 29, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000440', '+919000000440', 'Vishal Dutta', true, 'Member', null, null, 118, 'verified', 'digilocker', '1986-10-03', 'RVRPD4040R', 113, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000441', '+919000000441', 'Mansi Kalra', true, 'Founders'' Circle', null, null, 294, 'verified', 'digilocker', '1996-03-08', 'RVRPK4041R', 112, 0, 16570, 0),
  ('00000000-0000-4000-8000-000000000442', '+919000000442', 'Shivam Kalra', true, 'Member', null, null, 39, 'needs_pan', 'digilocker', '1974-09-25', null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000443', '+919000000443', 'Samar Dua', true, 'Black card', 5000, 10000, 93, 'verified', 'digilocker', '1980-10-23', 'RVRPD4043R', 92, 0, 16570, 500000),
  ('00000000-0000-4000-8000-000000000444', '+919000000444', 'Hemant Sood', false, 'Member', null, null, 89, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000445', '+919000000445', 'Payal Agarwal', true, 'Black card', 10000, 20000, 273, 'verified', 'digilocker', '1995-09-22', 'RVRPA4045R', 158, 15000000, 18100, 0),
  ('00000000-0000-4000-8000-000000000446', '+919000000446', 'Lalit Goel', true, 'Black card', 5000, 10000, 158, 'verified', 'digilocker', '2004-07-06', 'RVRPG4046R', 52, 10000000, 5590, 0),
  ('00000000-0000-4000-8000-000000000447', '+919000000447', 'Keshav Mehrotra', true, 'Founders'' Circle', null, null, 133, 'verified', 'digilocker', '2005-05-11', 'RVRPM4047R', 108, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000448', '+919000000448', 'Mayank Jain', true, 'Member', null, null, 112, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000449', '+919000000449', 'Girish Khanna', false, 'Member', null, null, 31, 'verified', 'manual', '1996-01-26', 'RVRPK4049R', 29, 2500000, 870, 0),
  ('00000000-0000-4000-8000-000000000450', '+919000000450', 'Payal Bhatt', true, 'Member', null, null, 256, 'verified', 'digilocker', '1993-09-20', 'RVRPB4050R', 7, 0, 17220, 0),
  ('00000000-0000-4000-8000-000000000451', '+919000000451', 'Vaani Sahni', true, 'Member', null, null, 130, 'started', 'digilocker', null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000452', '+919000000452', 'Yuvraj Luthra', true, 'Academy graduate', null, null, 254, 'verified', 'digilocker', '1968-08-08', 'RVRPL4052R', 196, 500000, 19260, 0),
  ('00000000-0000-4000-8000-000000000453', '+919000000453', 'Parth Mehrotra', true, 'Member', null, null, 96, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000454', '+919000000454', 'Amrita Lamba', false, 'Member', null, null, 31, 'verified', 'manual', '1977-02-18', 'RVRPL4054R', 23, 10000000, 24960, 0),
  ('00000000-0000-4000-8000-000000000455', '+919000000455', 'Sonal Kohli', true, 'Academy graduate', null, null, 250, 'verified', 'pan', '2002-04-02', 'RVRPK4055R', 91, 7500000, 2750, 0),
  ('00000000-0000-4000-8000-000000000456', '+919000000456', 'Jahnavi Tiwari', true, 'Member', null, null, 191, 'needs_pan', 'digilocker', '2001-08-08', null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000457', '+919000000457', 'Pranav Jain', true, 'Member', null, null, 84, 'started', 'digilocker', null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000458', '+919000000458', 'Mahima Tiwari', true, 'Academy graduate', null, null, 267, 'verified', 'digilocker', '1978-07-05', 'RVRPT4058R', 66, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000459', '+919000000459', 'Rajesh Dua', false, 'Member', null, null, 83, 'verified', 'manual', '1991-09-25', 'RVRPD4059R', 25, 2500000, 20890, 0),
  ('00000000-0000-4000-8000-000000000460', '+919000000460', 'Zara Talwar', true, 'Member', null, null, 111, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000461', '+919000000461', 'Sakshi Oberoi', true, 'Member', null, null, 288, 'verified', 'digilocker', '1972-02-01', 'RVRPO4061R', 197, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000462', '+919000000462', 'Anirudh Saini', true, 'Academy graduate', null, null, 274, 'verified', 'digilocker', '1966-05-10', 'RVRPS4062R', 274, 1000000, 14160, 0),
  ('00000000-0000-4000-8000-000000000463', '+919000000463', 'Chetan Bedi', true, 'Member', null, null, 170, 'verified', 'digilocker', '1972-07-18', 'RVRPB4063R', 139, 0, 1530, 0),
  ('00000000-0000-4000-8000-000000000464', '+919000000464', 'Lalit Chadha', false, 'Member', null, null, 80, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000465', '+919000000465', 'Tushar Mittal', true, 'Member', null, null, 59, 'started', 'digilocker', null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000466', '+919000000466', 'Arnav Pahwa', true, 'Member', null, null, 23, 'needs_pan', 'digilocker', '2001-09-06', null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000467', '+919000000467', 'Mohit Taneja', true, 'Member', null, null, 135, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000468', '+919000000468', 'Ishani Bhatt', true, 'Member', null, null, 32, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000469', '+919000000469', 'Shaurya Luthra', false, 'Member', null, null, 29, 'verified', 'manual', '1971-08-23', 'RVRPL4069R', 12, 1500000, 20820, 0),
  ('00000000-0000-4000-8000-000000000470', '+919000000470', 'Dhruv Talwar', true, 'Academy graduate', null, null, 21, 'verified', 'pan', '2001-08-03', 'RVRPT4070R', 7, 10000000, 8480, 0),
  ('00000000-0000-4000-8000-000000000471', '+919000000471', 'Hitesh Talwar', true, 'Member', null, null, 182, 'verified', 'digilocker', '1986-03-17', 'RVRPT4071R', 45, 1000000, 20310, 0),
  ('00000000-0000-4000-8000-000000000472', '+919000000472', 'Nakul Jain', true, 'Academy graduate', null, null, 203, 'verified', 'digilocker', '2003-08-18', 'RVRPJ4072R', 58, 0, 16510, 0),
  ('00000000-0000-4000-8000-000000000473', '+919000000473', 'Dhruv Dua', true, 'Member', null, null, 170, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000474', '+919000000474', 'Nidhi Wadhwa', false, 'Member', null, null, 67, 'verified', 'manual', '1994-02-16', 'RVRPW4074R', 37, 7500000, 14120, 0),
  ('00000000-0000-4000-8000-000000000475', '+919000000475', 'Yamini Vaid', true, 'Member', null, null, 153, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000476', '+919000000476', 'Ajay Tiwari', true, 'Member', null, null, 164, 'verified', 'digilocker', '1989-07-25', 'RVRPT4076R', 26, 500000, 20870, 0),
  ('00000000-0000-4000-8000-000000000477', '+919000000477', 'Mayank Handa', true, 'Black card', 10000, 20000, 167, 'verified', 'digilocker', '1964-05-09', 'RVRPH4077R', 165, 0, 21770, 0),
  ('00000000-0000-4000-8000-000000000478', '+919000000478', 'Omkar Tandon', true, 'Member', null, null, 186, 'needs_pan', 'digilocker', '1995-02-23', null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000479', '+919000000479', 'Madhav Tandon', false, 'Member', null, null, 54, 'verified', 'manual', '1975-04-23', 'RVRPT4079R', 16, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000480', '+919000000480', 'Alok Thakur', true, 'Black card', 10000, 20000, 285, 'verified', 'digilocker', '1978-08-12', 'RVRPT4080R', 45, 0, 1300, 0),
  ('00000000-0000-4000-8000-000000000481', '+919000000481', 'Vinay Ahuja', true, 'Member', null, null, 197, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000482', '+919000000482', 'Bhumi Rastogi', true, 'Academy graduate', null, null, 6, 'verified', 'digilocker', '1972-12-23', 'RVRPR4082R', 5, 1500000, 3760, 0),
  ('00000000-0000-4000-8000-000000000483', '+919000000483', 'Yuvraj Mehrotra', true, 'Member', null, null, 245, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000484', '+919000000484', 'Omkar Bajaj', false, 'Member', null, null, 73, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000485', '+919000000485', 'Vedant Kalra', true, 'Member', null, null, 118, 'verified', 'digilocker', '1985-05-07', 'RVRPK4085R', 116, 0, 6730, 0),
  ('00000000-0000-4000-8000-000000000486', '+919000000486', 'Jayesh Tiwari', true, 'Member', null, null, 215, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000487', '+919000000487', 'Ishani Ahuja', true, 'Member', null, null, 35, 'needs_pan', 'digilocker', '1967-07-04', null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000488', '+919000000488', 'Riya Sarin', true, 'Member', null, null, 87, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000489', '+919000000489', 'Mansi Thakur', false, 'Academy graduate', null, null, 56, 'verified', 'manual', '1992-05-01', 'RVRPT4089R', 47, 0, 29620, 0),
  ('00000000-0000-4000-8000-000000000490', '+919000000490', 'Ananya Wadhwa', true, 'Founders'' Circle', null, null, 72, 'verified', 'pan', '1978-02-21', 'RVRPW4090R', 33, 1000000, 0, 0),
  ('00000000-0000-4000-8000-000000000491', '+919000000491', 'Hemant Jain', true, 'Member', null, null, 64, 'needs_pan', 'digilocker', '2000-11-25', null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000492', '+919000000492', 'Bhumi Vaid', true, 'Member', null, null, 33, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000493', '+919000000493', 'Shalini Tiwari', true, 'Academy graduate', null, null, 47, 'verified', 'digilocker', '1967-11-18', 'RVRPT4093R', 19, 0, 11180, 0),
  ('00000000-0000-4000-8000-000000000494', '+919000000494', 'Akanksha Luthra', false, 'Member', null, null, 6, 'verified', 'manual', '1977-04-24', 'RVRPL4094R', 2, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000495', '+919000000495', 'Zara Dutta', true, 'Member', null, null, 201, 'needs_pan', 'digilocker', '2001-11-20', null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000496', '+919000000496', 'Prateek Sood', true, 'Member', null, null, 276, null, null, null, null, null, 0, 0, 0),
  ('00000000-0000-4000-8000-000000000497', '+919000000497', 'Atharv Rastogi', true, 'Member', null, null, 224, 'verified', 'digilocker', '2005-02-09', 'RVRPR4097R', 65, 0, 0, 100000),
  ('00000000-0000-4000-8000-000000000498', '+919000000498', 'Garima Kakkar', true, 'Member', null, null, 185, 'verified', 'digilocker', '1985-10-13', 'RVRPK4098R', 108, 1000000, 1670, 250000),
  ('00000000-0000-4000-8000-000000000499', '+919000000499', 'Anirudh Talwar', false, 'Member', null, null, 20, 'verified', 'manual', '1984-05-04', 'RVRPT4099R', 20, 5000000, 15080, 0);

-- Auth users with confirmed phones, for those with the app. Auth stores the number without the plus sign.
insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', p.id, 'authenticated', 'authenticated', ltrim(p.phone, '+'),
       now() - make_interval(days => p.joined_days_ago),
       '{"provider":"phone","providers":["phone"]}', '{}', now() - make_interval(days => p.joined_days_ago), now(), '', '', '', '', '', '', '', ''
from seed_more_player p
where p.has_app
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select p.id::text, p.id, jsonb_build_object('sub', p.id::text, 'phone', ltrim(p.phone, '+')), 'phone', now(), now(), now()
from seed_more_player p
where p.has_app
on conflict (provider_id, provider) do nothing;

insert into public.member (id, venue_id, user_id, full_name, phone, tier_id, qualifying_small_blind, qualifying_big_blind, created_at)
select p.id, '00000000-0000-4000-8000-000000000001', case when p.has_app then p.id end, p.full_name, p.phone,
       (select t.id from public.tier t where t.venue_id = '00000000-0000-4000-8000-000000000001' and t.name = p.tier_name),
       p.small_blind, p.big_blind, now() - make_interval(days => p.joined_days_ago)
from seed_more_player p
on conflict do nothing;

-- Identity checks. A check in person keeps the reviewer's photo at a path of its own.
insert into public.kyc_record (venue_id, member_id, status, method, date_of_birth, pan, photo_path, verified_at)
select '00000000-0000-4000-8000-000000000001', p.id, p.kyc_status, p.kyc_method, p.date_of_birth, p.pan,
       case when p.kyc_status = 'verified' then
         '00000000-0000-4000-8000-000000000001/' || p.id::text ||
         case when p.kyc_method = 'manual' then '/in-person-00000000-0000-4000-9000-' || right(p.id::text, 12) || '.jpg' else '/selfie.jpg' end
       end,
       case when p.kyc_status = 'verified' then now() - make_interval(days => p.verified_days_ago) end
from seed_more_player p
where p.kyc_status is not null
on conflict do nothing;

-- Opening balances, as balanced ledger transactions with idempotency keys (20_balances.sql).
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'opening_balance', 'seed:more:' || right(p.id::text, 3) || ':cash',
  jsonb_build_array(
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = '00000000-0000-4000-8000-000000000001'
                                       and a.code = 'venue.opening_balance' and a.member_id is null), 'amount', p.cash_paise::text),
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p.id
                                       and a.code = 'member.cash'), 'amount', (-p.cash_paise)::text)), null)
from seed_more_player p
where p.cash_paise > 0;

select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'opening_balance', 'seed:more:' || right(p.id::text, 3) || ':points',
  jsonb_build_array(
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = '00000000-0000-4000-8000-000000000001'
                                       and a.code = 'venue.points_opening_balance' and a.member_id is null), 'amount', p.points::text),
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p.id
                                       and a.code = 'member.points'), 'amount', (-p.points)::text)), null)
from seed_more_player p
where p.points > 0;

-- A bonus is one grant, ending at 23:59 on next week's Sunday when it is first seeded.
select private.post_ledger_transaction('00000000-0000-4000-8000-000000000001', 'opening_balance', 'seed:more:' || right(p.id::text, 3) || ':bonus',
  jsonb_build_array(
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.venue_id = '00000000-0000-4000-8000-000000000001'
                                       and a.code = 'venue.bonus_expense' and a.member_id is null), 'amount', p.bonus_paise::text),
    jsonb_build_object('account_id', (select a.id from public.ledger_account a where a.member_id = p.id
                                       and a.code = 'member.bonus'), 'amount', (-p.bonus_paise)::text)), null)
from seed_more_player p
where p.bonus_paise > 0;

insert into public.bonus_grant (venue_id, member_id, amount_paise, remaining_paise, expires_at, reason, idempotency_key, ledger_transaction_id)
select '00000000-0000-4000-8000-000000000001', p.id, p.bonus_paise, p.bonus_paise,
       (date_trunc('week', now() at time zone 'Asia/Kolkata') + interval '13 days 23 hours 59 minutes') at time zone 'Asia/Kolkata',
       'Buy-in bonus Tuesday', t.idempotency_key, t.id
from seed_more_player p
join public.ledger_transaction t on t.venue_id = '00000000-0000-4000-8000-000000000001' and t.idempotency_key = 'seed:more:' || right(p.id::text, 3) || ':bonus'
where p.bonus_paise > 0
on conflict (venue_id, idempotency_key) do nothing;

-- Withdrawal accounts the cashier Sana Qureshi has verified, and two she refused.
insert into public.payout_account (venue_id, member_id, kind, bank_name, vpa, account_number, ifsc, holder_name, status, decided_at,
                                   decided_by_staff_id, reject_reason)
select s.venue_id, a.member_id_text::uuid, a.kind, a.bank_name, a.vpa, a.account_number, a.ifsc, a.holder_name, a.status,
       now() - make_interval(days => a.days_ago), s.id, a.reject_reason
from (values
  ('00000000-0000-4000-8000-000000000476', 'upi', 'HDFC Bank', 'ajay.tiwari@okhdfcbank', null, null, null, 'verified', null, 17),
  ('00000000-0000-4000-8000-000000000490', 'upi', 'Axis Bank', 'ananya.wadhwa@okaxis', null, null, null, 'verified', null, 11),
  ('00000000-0000-4000-8000-000000000470', 'upi', 'State Bank of India', 'dhruv.talwar@oksbi', null, null, null, 'verified', null, 11),
  ('00000000-0000-4000-8000-000000000498', 'upi', 'ICICI Bank', 'garima.kakkar@okicici', null, null, null, 'verified', null, 19),
  ('00000000-0000-4000-8000-000000000455', 'upi', 'Kotak Mahindra Bank', 'sonal.kohli@kotak', null, null, null, 'verified', null, 16),
  ('00000000-0000-4000-8000-000000000445', 'upi', 'HDFC Bank', 'payal.agarwal@okhdfcbank', null, null, null, 'verified', null, 6),
  ('00000000-0000-4000-8000-000000000482', 'upi', 'Axis Bank', 'bhumi.rastogi@okaxis', null, null, null, 'verified', null, 3),
  ('00000000-0000-4000-8000-000000000400', 'upi', 'State Bank of India', 'nakul.dhillon@oksbi', null, null, null, 'verified', null, 1),
  ('00000000-0000-4000-8000-000000000471', 'bank', 'ICICI Bank', null, '50100562249', 'ICIC0022882', 'Hitesh Talwar', 'verified', null, 12),
  ('00000000-0000-4000-8000-000000000411', 'bank', 'Kotak Mahindra Bank', null, '50100087109', 'KKBK0074106', 'Jahnavi Mittal', 'verified', null, 12),
  ('00000000-0000-4000-8000-000000000426', 'bank', 'HDFC Bank', null, '50100205894', 'HDFC0077627', 'Bhuvan Walia', 'verified', null, 7),
  ('00000000-0000-4000-8000-000000000446', 'upi', 'Axis Bank', 'lalit46@okaxis', null, null, null, 'rejected', 'The name on the UPI address is not the member''s.', 7),
  ('00000000-0000-4000-8000-000000000437', 'upi', 'State Bank of India', 'eshan37@oksbi', null, null, null, 'rejected', 'The name on the UPI address is not the member''s.', 18)
) as a (member_id_text, kind, bank_name, vpa, account_number, ifsc, holder_name, status, reject_reason, days_ago)
join public.staff s on s.user_id = '00000000-0000-4000-8000-000000000104' and s.venue_id = '00000000-0000-4000-8000-000000000001'
on conflict do nothing;
