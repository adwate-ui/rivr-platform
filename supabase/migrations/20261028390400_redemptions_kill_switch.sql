-- The kill switch covers rewards redemptions (#462): a feature the owner can switch off, as withdrawals and credit.
-- Added in a migration of its own, since a new enum value cannot be used in the transaction that adds it.
alter type public.killable_feature add value if not exists 'redemptions';
