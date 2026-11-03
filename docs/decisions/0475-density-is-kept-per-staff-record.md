# 0475: The console's density is kept per staff record, in the database

Date: 3 Nov 2026. Console v3 brief, phase 1: "a density switch (persisted per user in the database, not localStorage)".

- **Table.** `public.staff_preference`, one row per staff record (`staff_id` primary key, its `venue_id`), `density` comfortable or compact, default comfortable. A table of its own rather than a column on `staff`, so a staff member writes it without being able to write their own staff row (role, phone, name).
- **Per user, written together.** A person is a staff record at each venue they work at. `useSetStaffDensity` writes every one of their records at once, so the club and the practice venue match; `useStaffDensity(venueId)` reads the console's venue. A practice reset and a live purge keep the rows, as they keep the staff records they belong to (`practice_reset_keeps`, migration 20261107210000).
- **Access.** RLS lets the signed-in person read, add and change only rows whose record is theirs at that row's venue (`private.current_staff_id`), so a row can never name another person or another venue. No delete, nothing for anon, and no super admin reads anyone else's. Nothing goes to the outbox: it never leaves the database, from either venue.
- **Where it shows.** The frame puts it in `DataTableDensityProvider` (@rivr/ui), so every `DataTable` on the console follows it unless the table sets `density` itself. Rows outside a DataTable read `useStaffDensity` when their screen is rebuilt.
- **Not done.** The rail's own choice of labels or icons stays on the device (decision 0465), as the brief asks only for density in the database.
