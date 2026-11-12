-- The hours leaderboard on the TVs (the owner, 12 Nov; decision 0581; #907): its mode, added on its own, as Postgres uses a new
-- enum value only once the transaction that added it has committed (as 20261028391400_agent_device_kind.sql).
alter type public.tv_mode add value if not exists 'leaderboard';
