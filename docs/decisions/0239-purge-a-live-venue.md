# 0239: Purging a live venue deletes its play and its people's data, after a fresh archive, while it is frozen

Date: 2026-10-27 · Task: #432 (features "Purge") · The owner approved the plan, and chose on 27 Oct that a purge removes everything personal it leaves behind.

**Who and when.** A super admin with `purge.run`, at a venue that is not the practice one (that one resets to its seed, #104), while the venue is frozen.

**The archive first, fresh and whole.**
- **Making it.** The console makes the full encrypted archive (#103) with the KYC photos, which needs a written reason.
- **Reading every table.** It reads each table to its last page through pages the server hands out in order. Its own next page coming back short is the only way a table is marked read.
- **The files.** When the archive starts, the server lists the venue's files in Storage: its KYC photos and expense receipts. The console reads each one into the archive.
- **Saving it.** The console saves the file and says so with its SHA-256, its size and the listed files it could not read (`complete_export_archive`). The archive then holds the rest.
- **What the purge needs.** Such an archive of that venue, by the same super admin, with the KYC photos, started after the freeze and saved in the last 30 minutes, with no row added, removed or changed since: `RVCHG` otherwise, naming the tables (`RVARC` when there is no such archive). Alerts and the outbox are the exception: making the archive itself writes to them, so they are deleted without being held to its count, and rows made after it started go unarchived. They are transient delivery records. A freeze stops money and play, not sign-ups or feedback. That archive is the only copy of what the purge deletes, the AML register (decision 0234's "never deleted") and KYC records included, so a purge belongs before launch, and the archive is kept as long as the law asks.

**What goes.** What the spec's purge names: members, visits, sessions, hands, tournaments, the ledger's entries, promotions, media and messages: every table a practice reset reloads, but for what a live venue keeps as setup. With the members go their freezes (the kill switch's link to a member now cascades), their logins (unless one is also staff or a device, as member erasure decides), the personal fields of the audit rows about what was deleted (stripped as erasure strips them; the rows saying what happened stay), and any audit row naming a purged member (a freeze's reason included). Then the venue's files in Storage:
- **What goes.** Only the files the archive held. A file it could not read stays, and so does any file a row names again.
- **How.** Through the `purge-venue` Edge Function, at the venue's super admin's asking (by role, rate-limited), within seven days. The audit log records what went.
- **If some stay.** The screen offers to remove them again.

**What stays.** What a reset keeps (setup, staff, controls, cameras, the audit log), and the venue's own ledger accounts (its members' accounts go), payment accounts, shareholders and holdings, Tally map, blind structures, tournament templates, expense categories, reward catalogue and League seasons. `150_purge_live_venue` lists the tables, so a new one is a decision.

**How.**
- **From the console itself.** The purge runs from the console, so the database checks the super admin's computer and address; the Edge Function only removes files.
- **Locks.** Every table it deletes from is locked in name order, waiting five seconds at most (`busy` otherwise), so nothing is written between the check against the archive and the delete.
- **The rest.** The dry run counts each table's rows, and the venue's name is typed (`RVNAM`). One statement deletes it all, foreign keys checked at its end, past the append-only guards for that venue and transaction only (`rivr.purge`, decision 0117). Nothing may be left, nor a ledger entry of the venue. The audit log records the counts and the owner is alerted (`venue.purged`). Shared id sequences are left alone (0117); per-venue numbering starts again, since its rows go. Date-range and per-entity scopes from the spec are not in #432's acceptance.

**Limits.** The purge runs as one console call, under the database's eight-second limit for a signed-in user. A venue with years of rows may outlast it, and there is no fallback yet: it needs the purge measured on a realistic volume, and a way to purge in parts if it is too slow. A file the archive could not read stays in Storage until someone removes it by hand. The purge itself has no rate limit beyond needing a fresh archive and the typed name; the file removal has one.
