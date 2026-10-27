# 0244: A promotion waits for a super admin, who never approves their own

Date: 2026-10-27 · Task: #144 (the approval half; the simulation is decision 0214) · Question: #507 (the owner's answers of 27 Oct)

**Why.** A promotion gives away money and points. Before, a promotions manager published one live at once from the builder or a template, and could even insert a live promotion straight into the table. The owner's answers:
- Only super admins approve, and never their own.
- Templates are approved too.
- A promotion simply waits until a super admin acts.

**What.**
- **Submitting.** `submit_promotion` and `submit_promotion_template` replace the two publish functions. A promotion goes in as `pending`, recording who submitted it and when. Nothing is announced yet.
- **Approving.** `approve_promotion` (permission `promotions.approve`, super admin only) puts it live and emits `promotion.published` as publishing did. When it goes live from pending, `announce_promotion` offers it to members. Approving one's own submission is refused with RVTWO.
- **Refusing.** `refuse_promotion` sends it back to `draft` with a reason (3 to 300 characters) that the submitter reads. A template sent again starts afresh.
- **Direct writes closed.** Inserts, updates and deletes on `promotion`, `promotion_rule` and `promotion_budget` are revoked from `authenticated` and their write policies dropped. Only these functions and the engine write them.
- **Console.** The builder's button is "Submit for approval", and templates say "Send for approval". "Waiting for approval" lists each pending promotion with who submitted it. A super admin sees Approve and Refuse on others' submissions; everyone else sees it waiting.
- **The approver reads what it does.** "Waiting for approval" shows each promotion's rule as stored, in words the console generates from it: what it gives, when, for whom, the per-member limit and the budget. The card words the submitter typed are shown too, but nothing ties them to the rule. A rule the console cannot read can only be refused.
- **Known limits.** A super admin who makes a second super admin login for themselves could approve their own submission; the audit log records both. Promotions already live before this change stay live without approval.
- **Sent back.** A refused promotion is a draft again, and "Sent back" lists it for a fortnight with who refused it and why. A template is sent again from Templates; a builder's promotion is built anew. Approving or refusing one another super admin already decided says so (RVDEC).
- **Budgets.** No app path writes `promotion_budget` any more; the approver sees there is none. #501 adds the cap for large promotions.
- **Out of scope.** #501's one-marketing-send-a-day cap stays with #501. This approval covers its "a super admin decides" half.
