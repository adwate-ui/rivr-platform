# 0239: Purging a live venue deletes its play, after a saved archive, while it is frozen

Date: 2026-10-27 · Task: #432 (features "Purge") · The owner approved the plan on 27 Oct.

**Who and when.** A super admin with `purge.run`, at a venue that is not the practice one (that one resets to its seed, #104), while the venue is frozen, so nothing changes between the archive and the purge.

**The archive first.** The console makes the full encrypted archive (#103) and saves it; once the browser has written the file, it marks the archive saved (`complete_export_archive`, by its maker only). The purge refuses without such an archive of that venue, by the same super admin, saved in the last 30 minutes (`RVARC`). That archive is the only copy of what the purge deletes, the AML register and KYC records included, so a purge belongs before launch; afterwards the archive must be kept for as long as the law asks.

**What goes.** What the spec's purge names: members, visits, sessions, hands, tournaments, the ledger's entries, promotions, media and messages: every table a practice reset reloads, but for what a live venue keeps as setup. **What stays:** what a reset keeps (setup, staff, controls, cameras, the audit log), and the venue's own ledger accounts (its members' accounts go), payment accounts, shareholders and holdings, Tally map, blind structures, tournament templates, expense categories, reward catalogue and League seasons. `150_purge_live_venue` lists the tables, so a new one is a decision.

**How.** The dry run counts each table's rows; the venue's name is typed (`RVNAM`). One statement deletes it all, foreign keys checked at its end, past the append-only guards for that venue and transaction only (`rivr.purge`, decision 0117). Nothing may be left, nor a ledger entry of the venue. The audit log records the counts and the owner is alerted (`venue.purged`). Shared id sequences are left alone (0117); per-venue numbering starts again, since its rows go. Date-range and per-entity scopes from the spec are not in #432's acceptance.
