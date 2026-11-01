-- The Floor role (#644; owner's feedback doc of 29 Oct): its own migration, as a new enum value is used only once this
-- transaction has committed. Its permissions are in 20261101100500_role_modules.sql.
alter type public.staff_role add value if not exists 'floor';
