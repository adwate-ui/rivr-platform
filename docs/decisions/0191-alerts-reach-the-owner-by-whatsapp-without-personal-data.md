# 0191: Alerts reach the owner by WhatsApp, in words, without personal data

Date: 2026-10-26 · Task: #100 (additions "Alerting")

**What.** Alerts are rows for the owner dashboard (#101), each emitting `alert.raised` (#12). A new outbox consumer, `alert-whatsapp`, sends each one to the WhatsApp number in venue configuration (`alert_whatsapp`) as the `owner_alert` utility template: "RIVR alert: a cage shift closed with a variance. The details are on the owner dashboard."

**No personal data.** The message says only the alert's kind, in words from `@rivr/i18n` `alerts`; an unknown kind says "something needs your attention". An alert's details stay in the database. The failed-delivery alert's vendor error now has runs of digits and email addresses taken out before it is stored, since a vendor's error can quote a member's number; and a free-text reason (the kill switch's) stays with its own record, never in an alert.

**Every alert, once, recently.** The sign-in code limit's alert, which wrote its row directly, now goes through `raise_alert`, so it reaches WhatsApp too. Only an alert raised within the day is sent: alerts that waited while WhatsApp was not yet set up are not all sent at once when it is.

**Not held by a messaging stop.** The owner answered #468: a messaging stop holds messages to members, but the owner's alerts still go out, so the owner hears about the stop itself and anything that happens while it is on. The alert consumer is therefore not a messaging consumer. Its own failures raise no further alert, as before.

**Failures over a threshold.** Every five minutes, a venue with `alert.thresholds` failed deliveries (5 unless set) failing for good within its window (60 minutes) raises `outbox.failures`, once a window, with the count and the window. This is beside the alert each failed delivery already raises, at most once an hour per consumer.

**Not yet.** Sentry's own alerts reaching the dashboard wait for the Sentry project's webhook; the template needs Meta's approval before it sends, and until WhatsApp is configured the consumer claims nothing and alerts wait on the dashboard.
