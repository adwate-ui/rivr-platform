# 0032 The console signs staff in like members, and works in one venue at a time

Date: 18 Oct 2026. Task #223.

Staff sign in to the console with their mobile number and a code, as members do (question #172). The console copies the player app's two sign-in steps (number, then code) into `apps/console/features/sign-in`. An app feature cannot import another app's, and this is the second use, so no shared abstraction yet (CLAUDE.md rule 7). The third, the driver app, moves the steps into a package. The copy is shared already, under `common.signIn`.

Seeded staff, and real staff who train, hold a staff record at the club and at the practice venue. The console works in one venue at a time: the club, unless the staff member turns on "Practice venue" at the foot of the rail. Every console screen reads and writes for that venue only (`useStaffVenue`), so practice bookings and payments never mix into the club's lists. The choice is not kept across reloads or for another person signing in on the same computer: the console always starts at the club.

The rail shows only the screens the staff member's role allows at that venue, from `ROLE_PERMISSIONS` in `@rivr/contracts`, which a database test keeps equal to `role_permission`. The database still checks every permission itself; the rail only keeps the console honest.
