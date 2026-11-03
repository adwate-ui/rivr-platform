# 0307: The Aadhaar's name, and no session reminders

Date: 3 Nov 2026. Two answers from the owner on 3 Nov.

- **The member's name is the Aadhaar's (#803).** Once DigiLocker verifies a member (decision 0400), their name becomes the name on their Aadhaar. The card, staff screens and any payout use the legal name. The name they gave at sign-up is kept as what they are known as, and staff see it under the name ("Known as Ashu").
  - The Aadhaar name is kept on the check only with the member's own face, as the rest of that identity is. It becomes the member's name whenever the check is verified, at once or after a reviewer looks.
  - A name in capitals, as DigiLocker often gives it, is set in ordinary capitals, each part after an apostrophe too: D'SOUZA becomes D'Souza.
  - Erasure clears both names.
- **No session reminders (#796).** The redesign took the reminder out of Profile (decision 0322), so a member who set one could not stop it except by turning off push. Every reminder is cleared, and the minute sweep sends none. `set_session_reminder` still answers, for an old app, but nothing comes of it.
