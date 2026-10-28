# 0272: Web push

Date: 28 Oct 2026. Issues #139 and #338; the owner's answer of 28 Oct: generate a VAPID key pair and build web push now.

- **One key pair for the club.** The public key is in `@rivr/contracts` (`WEB_PUSH_PUBLIC_KEY`). It is public by design, so the player app needs no build setting and CI is untouched. The private key is a function secret only, `VAPID_PRIVATE_KEY`. The owner sets it on staging and production; it is never in the repo. A new pair means a code change, and every phone subscribes again.
- **Phones.** Profile's "Notifications on this phone" subscribes the browser and keeps the subscription in `push_subscription`, one row per browser. A browser signed in by another member moves to them. Workbox's service worker loads `public/push-sw.js`, which shows each notification and opens the app's own page when tapped.
- **What goes.** The `push` consumer sends:
  - seat ready (`waitlist.called`, unless its hold has run out);
  - call time done (`call_time.completed`);
  - the member's session reminder (`session.reminder`);
  - withdrawal sent (`withdrawal.sent`);
  - tournament starting (`tournament.starting`, new: one per member with a seated or alternate entry when the clock starts);
  - each promotion offered (`promotion.offered`, the per-member event WhatsApp uses too).
- **Who gets it.** Each kind goes only where `private.wants_push` says so: the tier has the `push.*` key and the member has not turned it off. Promotions also need the marketing consent. The session reminder is the member's own setting, so it has no switch of its own. Never at the practice venue.
- **Only the browsers' push services, five phones.** A subscription's address must be Chrome's, Firefox's, Apple's or Windows' push service, so nobody can point the club's sender elsewhere (security review). A member keeps their five latest phones. A browser moves to another member only when it presents the same keys. Each phone is sent to at once, with three seconds each.
- **Promotions as WhatsApp offers them.** A promotion push goes only while the promotion runs, to a tier with the promotions feed, with marketing sends on (`private.offer_recipient`).
- **Signing out** unsubscribes the phone, so a shared phone stops showing the member's notifications.
- **Failures.** A browser that dropped its subscription (404 or 410) is forgotten. Other failures retry the delivery, and the notification's tag stops a phone that already had it from showing it twice. A messaging stop holds the consumer.
- **The web-push library** (`web-push`, kept off `@rivr/adapters`' main entry as `@rivr/adapters/web-push`) signs and encrypts each push (RFC 8291 and 8292). Nothing in the repo did this.
