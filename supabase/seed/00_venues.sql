-- Seed for local stacks and staging. Production is never seeded.
-- The design prompt's demo data (docs/spec/design-prompt-2026-09-30.md, section 5). All people are
-- fictional. Every statement is idempotent so a re-run changes nothing. Lanes add their own files
-- (50_tables.sql and so on); the same data as TypeScript fixtures is in packages/testing.

select private.bootstrap_venue(
  '00000000-0000-4000-8000-000000000001', 'RIVR Gurugram', 'gurugram', false,
  'RIVR (legal name to be set)', 'Upper floor, Glaza, M3M 65th Avenue, Gurugram', 'RIVR'
);

select private.bootstrap_venue(
  '00000000-0000-4000-8000-000000000002', 'RIVR Practice', 'practice', true,
  'RIVR practice venue', 'Training only', 'PRAC'
);

-- A made-up GSTIN for the club (Haryana's code and the textbook example PAN), so local stacks and staging
-- can issue tax invoices (#23; owner, #378). The practice venue has none: its invoices are never tax invoices.
update public.venue_config set gstin = '06ABCDE1234F1Z4'
where venue_id = '00000000-0000-4000-8000-000000000001' and gstin is null;
