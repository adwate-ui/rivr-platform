-- The SQL twins of money rules, proved against the golden files @rivr/domain is proved against
-- (#221, decision 0037). `pnpm supabase test db` loads every case of packages/testing/golden/*.json
-- into golden.golden_case first, so a case added to a file is tested here and in the domain alike.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- A golden amount such as "₹1,00,000" or "₹1,999.99", in paise.
create function pg_temp.paise(p_amount text) returns bigint language sql immutable as $$
  select (replace(replace(p_amount, '₹', ''), ',', '')::numeric * 100)::bigint;
$$;

-- The Academy fee: private.academy_fee and @rivr/domain academyFee (packages/testing/golden/academy.json).
select ok((select count(*) > 0 from golden.golden_case where file = 'academy.json'), 'the Academy fee cases are loaded');
select is_empty($$ select operation from golden.golden_case where file = 'academy.json' and operation <> 'fee' $$,
  'every operation in academy.json is proved here');
select results_eq(
  $$ select description,
            private.academy_fee(inputs ->> 'kind', (inputs ->> 'seats')::integer,
                                jsonb_build_object('individual_paise', pg_temp.paise(inputs ->> 'individual'),
                                                   'corporate_per_head_paise', pg_temp.paise(inputs ->> 'corporatePerHead')))
     from golden.golden_case where file = 'academy.json' order by position $$,
  $$ select description, pg_temp.paise(expected ->> 'result') from golden.golden_case where file = 'academy.json' order by position $$,
  'private.academy_fee gives every Academy fee in the golden file');

select * from finish();
rollback;
