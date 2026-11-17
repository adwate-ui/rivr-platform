# 0689 Alerts by email too, through Resend, off until its key is set

Date: 17 Nov 2026. Issue #1066. The owner: a setting to also send every super admin alert by email, to addresses set on the venue; email through Resend.

- **What goes.** Every `alert.raised` that goes to the alert WhatsApp number also goes to the venue's alert addresses while "Also send alerts by email" is on: the alert's kind in words and nothing else, as WhatsApp's alert says it. No member's details leave in it; the details are in the console. Never from the practice venue, and only alerts raised within the day.
- **Where it is set.** `venue_config.alert_email_on` and `alert_emails`: up to five addresses, at least one while on, checked in the console and inline in the table (super admins update `venue_config` directly). A change raises the usual settings alert. The addresses are personal data and investors' Activity leaves them out.
- **The old addresses are not told.** A changed alert number sends its change alert to the old number too, as a takeover guard; the email addresses add a channel, not a guard, so a change is told to the WhatsApp number and the addresses now set.
- **How it sends.** An outbox consumer, `alert_email` (function `alert-email`), through `@rivr/adapters/email` (Resend, with a fake). Staging sends only to `EMAIL_ALLOWLIST`.
- **Off until its key is set.** The migration does not schedule the job; the runbook (step 13) schedules it once `RESEND_API_KEY` and `ALERT_EMAIL_FROM` are set and the domain is verified, staging first. Until then the function answers 503 and claims nothing, as WhatsApp's alerts did before their keys (audit F-109 keeps unconfigured jobs off, not failing every minute).
- **Not covered.** The owner's Resend account, the DNS records on the club's domain, the key and the From address are the owner's to give.
