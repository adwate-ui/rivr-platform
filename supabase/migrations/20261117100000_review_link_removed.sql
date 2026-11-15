-- The Google review link goes (redesign of 15 Nov, RD-18; the owner, 15 Nov): the setting reviews.google_url, and with it
-- the message that carried the link to a member after their third visit (#159, 20261028390900_google_review_request.sql).
--
-- What stays here: the table review_request (who was asked; a member's export reads it and their erasure clears it) and the
-- 'review.requested' event, which nothing emits any more. Both go with what else only the older screens used (#954).

drop trigger visit_review_request on public.visit;
drop function private.request_review();

-- No rule is left to read the link.
delete from public.setting s where s.key = 'reviews.google_url';
delete from public.setting_key where key in ('reviews.google_url');
