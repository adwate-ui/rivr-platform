# 0075 An SOP's versions take effect by day and are acknowledged by role

Date: 20 Oct 2026. Task #51.

Scope-v1 module 11 asks for an SOP library with owner, version, effective date and required acknowledgement by role, with the training set loaded first.

- **Versions.** An SOP (`sop`) is a title. Its text lives in versions (`sop_version`), and each version names its owner (a job title such as Floor manager, since the training set is loaded before anyone is on the staff list), its IST day, and the roles whose staff must acknowledge it. A version is never changed; a change is a new version.
- **Which version is in force.** The latest whose day has come. A new version takes effect today or later, never before the last version's day, so versions follow one another in order.
- **Acknowledging.** Staff acknowledge the version in force, once (`sop_ack`). A new version asks again. Anyone at the venue may acknowledge, but only the roles named count towards "4 of 9 staff acknowledged".
- **Managing.** Staff with `sops.manage` add SOPs, publish versions and see who has acknowledged. Everyone else sees only their own acknowledgements. Nothing is published while the venue is frozen.
- **The training set.** Dealer certification, cage, women's safety, AML and table-side food and drink are loaded into every venue, practice included: by the migration for venues that exist, and by `bootstrap_venue` for new ones. They are in force from the day they are loaded. Their text is this system's own procedures, written for it.
- **New UI.** The console needed a field for text of several lines, so `@rivr/ui` gains `TextArea`.
