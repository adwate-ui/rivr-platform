# 0042 Sign-in sends are kept without a venue, behind row-level security with no policies

Date: 19 Oct 2026. Task #181.

A second sign-in code to a number within ten minutes goes by SMS first. To know that, the send hook keeps `private.sign_in_code_send`: an HMAC of the number under a Vault key, and the time of the last send. Never the code, never the number.

Every table has `venue_id` and row-level security (CLAUDE.md rule 4). This one has no venue: a sign-in belongs to no venue (decision 0025), and the same number may become a member of either. It has row-level security on with no policies, and every role's privileges revoked. Only `private.note_sign_in_code_send`, a security-definer function that the service role alone may run, reads or writes it.

Rows older than a day are deleted each time a send is noted.
