# 0285: No cab requests in the app; staff book the cab

Date: 1 Nov 2026. The audit of 28 Oct, F3-01, and the owner's answer (Q4): "Remove in-app requests". Remove the cab section, switch `cab.requests` off for every tier, reword the website to "ask the front desk for a cab home", and delete the cab hooks and the cab e2e flow. Staff book the Uber.

- **Why.** The app took pickup and drop requests from a member with enough visits this month, but nothing at the club received them. No Edge Function consumes `cab.requested`, and no console screen lists `cab_request`.
- **Deleted from the apps:** Rewards' cab section, its copy, `useMyCab`, `useMyCabRequests`, `useRequestCab` and `e2e/flows/cab.spec.ts`.
- **In the database** (`20261101160000_cab_requests_off.sql`):
  - `cab.requests` is off for every tier of every venue from now, hidden, and a new venue's tiers start with it off.
  - A member's own grant of it is revoked.
  - `request_cab` and `my_cab` stay, and refuse or return nothing without the feature. The requests already made stay too.
  - Switching the feature back on brings no screen back. Cab requests return only as new work, with something that receives them.
- **The website.**
  - The hospitality card now says "Ask the front desk for a cab home.", but only where it still read as first written. A new venue's website gets the same.
  - The cab rule shows only while a tier has cab requests, so it no longer shows.
  - `cab.minimum_visits` stays as a setting, for staff who want a rule for whom they book.
