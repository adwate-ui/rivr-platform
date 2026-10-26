# 0232: The export archive is made in the browser and locked to the owner's backup key

Date: 2026-10-26 · Task: #103 (features "Exports")

**What.** A super admin (`exports.full`) makes, from Exports in the console, one archive of every table of the venue. It holds a CSV per table in `tables/` and a `manifest.json` with each table's rows. KYC photos go in only when chosen with a written reason. One member's export, for an access request, is the same archive of every row about that member: the member row, the entries on the member's accounts, and every table with a member column that names them. The owner opens it and takes out staff notes the member is not owed (freezes, KYC reviews) before sending it.

**Locked to the owner's backup key** (the owner's answer, 26 Oct). The zip is encrypted in the browser with age (`age-encryption`, loaded only when an archive is made) to `exports.archive_recipient`. That venue setting holds the age public key the nightly backups use (0072). Only a super admin sets or removes it, in Settings, and the owner is alerted on every change (`exports.key_changed`). No archive is made until it is set. Only the owner's offline private key opens one (`age -d -i key.txt`). Local and staging seed a test key, whose private key is kept outside the repository.

**Recorded when started.** `start_export_archive` counts each table's rows itself and writes the audit log: who, the venue or member, each table's rows, and the reason for photos. It alerts `export.large` on a large archive, as a table export does, then gives the archive an id. Only the person who started it reads its tables, with that id, for an hour, so nothing is read that the audit log does not hold. Secrets stay in the database: hashes of PINs, device tokens and pairing codes, and the KYC keys (identity key, Aadhaar, vendor and DigiLocker references). The nightly backup alone holds them.

**Made like the table exports (0190).** The console reads each table a page at a time through `export_archive_rows`: 2,000 rows a page, in primary key order, each page after the last key. It quotes CSV as PostgreSQL's COPY does; values are the database's text casts, so true and false appear in full. The archive is not one snapshot: a row written while it is made may or may not be in it. The nightly export is the consistent copy.

Each KYC photo is read through `kyc-image-url`, which audits that view. A photo that cannot be read is listed in the manifest.

**Not here.** The automatic export before a purge (#432) can use this archive. Photos are held in memory, so a venue with many thousands of them needs a streamed archive; that is a follow-up.
