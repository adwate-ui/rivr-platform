-- A ticket for the General Manager opens only for a written note (the owner, 9 Nov), whatever the score: until now a rating of 3 or
-- below, or anything with no score, opened one. A low rating with no note shows under Other, and the owner still hears of a 1 or 2.
alter table public.feedback alter column is_ticket set expression as (note is not null);

select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
