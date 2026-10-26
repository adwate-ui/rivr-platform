# 0196: The venue's logo is a PNG in a public brand bucket, under a new name for each upload

Date: 2026-10-26 · Task: #397 (split from #33)

A super admin (`venue.configure`) uploads the venue's logo on Settings. It goes to the `brand` bucket at `<venue>/logo-<uuid>.png`, and `public.set_venue_logo` points `venue_config.logo_path` at it.

- **PNG only.** The issue allowed SVG too, but an SVG can carry script, and the bucket is served from the project's own address. Opening a logo's address directly would run it. The security review asked for PNG only, or SVGs sanitised by an Edge Function; PNG only is the smaller change. A printable logo is a PNG at the size invoices need.
- **Public bucket.** Invoices (#68), the website and the TVs read the logo, and the TVs and website have no staff session. A logo holds no personal data, so only writes are restricted.
- **Only `venue.configure` writes**, into its own venue's folder, under a logo's name. No update or delete policy exists, so nothing is overwritten, moved or removed.
- **The path is held to the venue's own logo.** Settings updates `venue_config` directly, so a check constraint allows only `<this venue>/logo-<uuid>.png` in `logo_path`. It can never name another venue's file, another bucket's, or a path out of the folder.
- **Setting the logo checks the upload.** `set_venue_logo` refuses while the venue is frozen. It also needs the object to exist in the venue's folder, stored as `image/png`, at 1 MB or less, so a file copied in from another bucket is never made the logo.
- **Audit.** Making an upload the logo writes `venue.logo_uploaded` (name, size, type), and venue configuration's trigger audits the change of path. An upload never made the logo appears nowhere in the product and is not audited. Auditing every upload would need a trigger on `storage.objects`, a table Supabase owns; that is a follow-up, not part of this task.
- **Enrolled computers.** Calls to Storage carry the computer's token too (`x-rivr-computer`), as database calls do, because Storage's policies check permissions the same way (#384).
- **A new name for each upload.** A browser or CDN never shows a cached old logo, and an invoice issued earlier keeps pointing at the logo it printed.
- **UI.** `@rivr/ui` `CameraButton` gains `accept` and `camera="none"` (the file picker only), rather than adding a second file button. `VenueLogo` shows the logo whole in the photo tile's 4:3 box, or says there is none or that it could not load.
