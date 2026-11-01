-- The Service role (#640; owner's feedback doc of 29 Oct): staff who serve food and drink, and see only the menu and the
-- orders. A migration of its own: a new enum value cannot be used in the transaction that adds it.
alter type public.staff_role add value if not exists 'service';
