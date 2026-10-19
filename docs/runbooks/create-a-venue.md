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
4. Set the Academy fees (in paise; ₹2,000 a seat and ₹1,500 a head for a company, scope-v1 module 15). Until they are set, nobody can book an Academy batch:
   ```sql
   insert into public.setting (venue_id, key, value, effective_from, reason)
   values ('<venue id>', 'academy.price', '{"individual_paise": 200000, "corporate_per_head_paise": 150000}', now(), 'Opening fees');
   ```
5. Everything else (GSTIN, UPI payee and VPA, bank details, logo, the IP allowlist, staff, the tier matrix) is set from the console. The UPI payee and VPA must be set before the first Academy booking: they are where players pay.

The practice venue is created the same way with `is_practice = true`.

## Waitlist priority (#40)

Production is never seeded, so set the waitlist priority weights for a new venue until the console's Settings screen (#33) does it. In the SQL editor, with the venue's id:

```sql
insert into public.setting (venue_id, key, subject, value, effective_from, reason)
select t.venue_id, 'waitlist.priority_weights', t.id::text, w.value, now(), 'Launch weights'
from public.tier t
join (values ('Black card', '{"weight": 2, "only_at_qualifying_stake": true}'::jsonb),
             ('Founders'' Circle', '{"weight": 1, "only_at_qualifying_stake": false}'::jsonb)) as w (name, value) on w.name = t.name
where t.venue_id = '<venue id>';
```

Without them every list is in join-time order.

