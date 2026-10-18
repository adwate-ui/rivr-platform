# Create a venue

Production is never seeded. The real venue, and any later room, is created once with `private.bootstrap_venue`, which sets up everything a venue needs: its configuration row, the four starting tiers (Member is the default), a tier × feature matrix with every gateable feature on, its ledger accounts and its chip denominations (₹50 upwards).

1. In the Supabase dashboard for `rivr-prod`, open the SQL editor (it runs as the database owner).
2. Run, with the real values:
   ```sql
   select private.bootstrap_venue(
     gen_random_uuid(), 'RIVR Gurugram', 'gurugram', false,
     '<legal entity name>', '<registered address>', '<invoice prefix, e.g. RIVR>'
   );
   ```
3. Create the first super admin: an Auth user with their phone number, then
   ```sql
   insert into public.staff (venue_id, user_id, full_name, job_title, role, phone)
   values ('<venue id>', '<auth user id>', '<name>', 'Owner', 'super_admin', '+91...');
   ```
   Add a second super admin the same way; releasing a venue freeze needs two.
4. Everything else (GSTIN, UPI payee and VPA, bank details, logo, the IP allowlist, staff, the tier matrix) is set from the console.

The practice venue is created the same way with `is_practice = true`.
