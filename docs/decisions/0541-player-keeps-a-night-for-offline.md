# 0541: The installed player app keeps one night's essentials for opening offline

Date: 8 Nov 2026 · From the 180-day audit of 8 Nov (F-053, I-33).

**Context.** Opened with no connection, every member screen, the card included, was an Identity page of skeletons that never ended: the identity gate's read paused, and nothing was cached. The fix asked for a query persister.

**Decision.**
- No new library. `@tanstack/react-query` already has `dehydrate` and `hydrate`; `@rivr/db`'s `offlineCache.ts` writes what it needs to localStorage a moment after each answer. Only the player app turns it on (`RivrDataProvider keepsForOffline`).
- What is kept: who the member is, the identity check's status, their tabs, the card, and Home's tables, place, seat and notices. Nothing else.
- The identity check is kept without its documents: no PAN, date of birth, masked Aadhaar or photo path, which are never written to the phone. The card is kept without its photo path too. The card's door code is kept with it; it goes stale in seconds and is checked on scan.
- A later launch keeps what it did not read, so a launch that never opens Card does not lose the member's number. Only the signed-in member's answers are saved.
- It is restored only when the phone opens offline, so online the app never shows old data, and each answer only for 12 hours from when it was read, one club night, checked when saved and when restored.
- Signing out removes it.

**Accepted.** A member's name, number, tier and place sit in the phone's local storage until sign-out or the next save. The same phone already holds their session.

**Not done.** Sessions, Rewards and the other tabs wait for the connection under the offline banner: nothing there is needed at the door.
