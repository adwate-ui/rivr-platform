# 0020 Kill-switch refusals use their own SQLSTATE codes

Date: 18 Oct 2026

Every write function calls `private.assert_writable(venue, feature?, member?)` before writing. When it refuses, the app must show the right message (`@rivr/i18n`) without parsing English error text.

Decision: refusals raise distinct SQLSTATE codes that clients map to catalogue messages:

| Code | Meaning |
|---|---|
| `RVFRZ` | the venue is frozen: no money movement, seating or hand writes |
| `RVKIL` | this feature is switched off |
| `RVMBR` | this member is frozen |

Lanes that add refusals of their own use the `RV` prefix and add the code here. Engaging and releasing controls (with the second super admin for a venue freeze) is lane A's console work; the table enforces that a venue freeze is released by two different super admins.
