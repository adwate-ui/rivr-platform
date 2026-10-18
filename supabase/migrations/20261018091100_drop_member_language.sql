-- RIVR ships in English only (decision 0027, #186), so a member has no language setting.
-- The column's insert and update grants go with it.
alter table public.member drop column preferred_language;
