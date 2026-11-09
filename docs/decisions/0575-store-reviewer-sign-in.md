# 0575: One number signs the app stores' reviewers in

Sign-in codes go by WhatsApp, which an Apple or Google reviewer cannot receive. The owner chose one reviewer number on production with a private fixed code (Go-Live Tracker Q9), over a separate review build.

- **The number** is the control setting `auth.store_reviewer`. Only a super admin or the go-live script sets it.
- **The fence** is in the sign-in hook. `private.require_code_sign_in` refuses that number if it is a staff member, or a member with a visit (every seat has one), a tournament entry or a ledger entry. A waitlist place or a selfie is not history, so a reviewer can use the app.
- **Every other number** is treated as before. With no setting, the hook behaves as it did.
- **The fixed code** stays in Auth's `sms_test_otp`, never in the repository. `check-auth-config.mjs` allows exactly `STORE_REVIEWER_NUMBER` on production and still fails on any other or an extra one. It prints only the last four digits.
- The number must be one the club controls: WhatsApp notices go to it. Erase its selfie after approval.
