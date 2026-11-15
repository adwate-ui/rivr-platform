-- The High hand bonus board on the TVs (redesign of 15 Nov 2026, issues 968 and 971): its mode, added on its own, as Postgres
-- uses a new enum value only once the transaction that added it has committed (as 20261112120000_tv_mode_leaderboard.sql).
alter type public.tv_mode add value if not exists 'high_hand';
