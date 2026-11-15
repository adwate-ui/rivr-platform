-- The Google review link is removed (redesign RD-18): no setting, and a third visit asks for no review.
begin;
select plan(4);

select is_empty($$ select 1 from public.setting_key where key = 'reviews.google_url' $$, 'no setting holds a Google review link');
select is_empty($$ select 1 from public.setting where key = 'reviews.google_url' $$, 'and no venue has one set');
select hasnt_trigger('public', 'visit', 'visit_review_request', 'a visit that closes asks for no review');
select hasnt_function('private', 'request_review', 'and the rule that asked is gone');

select * from finish();
rollback;
