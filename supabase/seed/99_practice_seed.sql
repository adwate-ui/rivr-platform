-- The practice venue as first seeded is what reset to seed brings it back to (#104, decision 0117). Last of
-- the seed files, so it captures everything they loaded. Staging runs every seed file on every deploy, so a
-- venue already captured keeps its seed: what testers did since is never made the seed.
select private.capture_practice_seed(v.id) from public.venue v
where v.is_practice and not exists (select 1 from private.practice_seed s where s.venue_id = v.id);
