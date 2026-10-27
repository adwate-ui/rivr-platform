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
- **Out of scope.** #501's one-marketing-send-a-day cap stays with #501. This approval covers its "a super admin decides" half.
