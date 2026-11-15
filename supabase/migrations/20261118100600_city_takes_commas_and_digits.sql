-- The sign-up form's city takes commas and digits (issue 1006; the owner, 15 Nov), so "Gurugram, Haryana" and "Sector 65"
-- pass. It still starts with a letter or a digit, never with punctuation, in English letters, and keeps its length of 2 to
-- 60. The name's rule (private.sign_up) does not change: it must match Aadhaar.
--
-- The check came with the column in 20261029190000_sign_up_answers.sql and has not changed since. Every city kept under
-- the older rule passes the wider one, so no row is rewritten.

alter table public.member_preference drop constraint member_preference_city_check;
alter table public.member_preference
  add constraint member_preference_city_check
  check (city is null or (length(city) between 2 and 60 and city ~ '^[A-Za-z0-9][A-Za-z0-9 .,''-]*$'));
