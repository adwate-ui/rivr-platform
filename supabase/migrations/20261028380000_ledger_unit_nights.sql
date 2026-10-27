-- Hotel nights are a ledger unit of their own (#146; question #486; decision 0246), kept as points are. Its own
-- migration: Postgres does not let a transaction use an enum value it has just added, and the next one opens accounts
-- in it.
alter type public.ledger_unit add value 'nights';
