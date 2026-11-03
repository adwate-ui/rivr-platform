# 0461: Staging messages every number

Date: 3 Nov 2026. The owner, after members' messages on staging were refused as "not on the allowlist".

- **What.** Staging has no `WHATSAPP_ALLOWLIST`. Its consumers send members' messages and staff alerts to every number, as production does. The fence in `fencedWhatsApp` stays in the code; with no list it lets every number through.
- **Why.** The owner tests staging with real phones, and wanted every number to receive its messages without keeping a list.
- **The risk, accepted by the owner.** Staging's test members have numbers in `+91 90000 00xxx`, which may belong to strangers. Tests and practice on staging message them from the bridge's number, which production's sign-in codes also use. Spam reports could get that number banned.
- **To go back.** Set `WHATSAPP_ALLOWLIST` on staging to a comma-separated list of `+91…` numbers.
