# 0494: The promotion builder and the approver's view

Date: 2026-11-03 · Console v3, phase 7, step 3 (console screens) · Builds on decisions 0471, 0472 and 0491 to 0493

**What.**
- **Addresses.** The list is `/promotions`; `?open=new` is a new promotion's builder and `?open=<id>` opens one: the approver's view while a version waits, otherwise the builder on its open draft, or a running one's next version. An ended promotion opens as a new promotion on its terms.
- **Templates.** "Start from" fills the builder in the browser with the club's own rules as step 2 converted them (Tuesday's 20% to 2,000 on the first 5 buy-ins a table, all day). Founders' Circle priority and the Graduate freeroll find their tier by its name, and fall back to every tier where the venue has none of that name; the freeroll enters RIVR Sunday. Templates are offered for a new promotion only.
- **Women members** is offered only to a version that already names them: the club records no gender, so it matches nobody (decision 0472, still the owner's question).
- **Fields.** Times are typed as 24-hour text, as `@rivr/ui` has no time field; dates use `Input type="date"`. The most grants and chosen tables are not offered and are kept as a version has them. The card's link (#776) stays in section 5.
- **Submit** waits for a simulation on the terms as they stand, by `transition`. A change of words or channels after simulating keeps it enabled: Submit then saves, simulates again (a save clears the stored simulation) and submits.
- **Approver's view.** The same five sections, read only, each choice showing only what is chosen (a dimmed row of every choice hid it), each section marked "Changed" where the waiting version differs from the running one, both in one line, and the simulation stored with it. The one who submitted or last changed the version sees Approve disabled and why; staff without `promotions.approve` see who approves. Reject asks for a reason of 3 to 300 characters, the rule shown under the field before it is sent; an approver may reject their own, as the database allows.
- **No line under the titles.** The prototype's are intros, which the copy rules leave out (`.claude/rules/copy.md`); the approver's view keeps who submitted the version, above what it changes.
- **List.** "Awaiting approval" lists a running promotion whose next version waits, beside its own status, so the approver finds it there.
