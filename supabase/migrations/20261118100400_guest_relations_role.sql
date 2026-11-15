-- The guest relations role (redesign of 15 Nov 2026, RD-32; the owner, 15 Nov: a sign-in that sees only top-up requests):
-- its own migration, as a new enum value is used only once this transaction has committed. Its one permission and what it
-- reads are in 20261118100500_top_ups_only.sql.
alter type public.staff_role add value if not exists 'guest_relations';
