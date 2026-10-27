# 0213: Settings that loosen a control are changed only by a super admin, and the owner hears

Date: 2026-10-27 · Task: #112 (security review, `docs/security/2026-10-review.md`, finding S1)

**Why.** Anyone with `settings.manage`, admins included, could add any setting in force at once. One admin could raise the credit approval threshold and then approve a large line alone, which defeats 0058's second super admin. One super admin could raise the second-approver threshold and then pay a withdrawal alone, which defeats 0063. TDS could be switched off, and the large-export and failed-delivery alerts silenced, with only an audit row the admin cannot read.

**What.** Five keys now follow the AML settings (0234): `credit.config`, `cage.second_approver_threshold`, `tds.config`, `exports.alert_rows` and `alert.thresholds`.
- Only a super admin (`venue.configure`) adds a value or withdraws one not yet in force. A withdrawn cut is a raise.
- Each change needs a reason.
- Each change raises `settings.control_changed` for the owner, with the key and whether it was added or withdrawn, never the reason.
- The database itself (migrations, the seed, the practice reset) is not stopped.

Other keys stay with `settings.manage`. The Settings screen still lists these five to admins, and the database refuses an admin's change (42501), as it already does for the AML keys.

**Then (the owner's answer to #494; #499).** `high_hand.payouts`, `jackpot.payout` and `gst.config` follow the five keys above; `tier.default` stays with admins. A raise of the second-approver threshold or of the credit approval threshold takes effect 24 hours after it is made (its start moves to a day from now if sooner; no threshold in force counts as the lowest); a cut takes effect as set. Their Settings descriptions say so.
