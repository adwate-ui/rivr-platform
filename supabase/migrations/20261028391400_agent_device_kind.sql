-- The cage agent (#168, #123; decision 0260) is a device of its own kind: a Node service on the cage computer, not a
-- browser, so its token can never stand in for an enrolled cage or admin computer. Added alone, as Postgres cannot use
-- a new enum value in the transaction that adds it.
alter type public.device_kind add value if not exists 'agent';
