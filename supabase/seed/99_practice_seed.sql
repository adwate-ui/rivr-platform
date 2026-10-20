-- The practice venue as seeded is what reset to seed brings it back to (#104, decision 0117). Last of
-- the seed files, so it captures everything they loaded.
select private.capture_practice_seed(v.id) from public.venue v where v.is_practice;
