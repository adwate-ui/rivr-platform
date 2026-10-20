-- A high-hand claim can be reversed (#324). Added apart from what uses it, because a new enum value
-- cannot be used in the migration that adds it.
alter type public.high_hand_status add value 'reversed';
