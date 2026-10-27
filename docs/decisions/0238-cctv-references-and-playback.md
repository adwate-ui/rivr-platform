# 0238: A CCTV reference is a camera and a moment; playback is a link to the recorder's own page

Date: 2026-10-27 · Task: #122 (tech plan item 17)

**Cameras.** Staff who manage devices add each camera with its name and the recorder's channel for its feed, over a table, on the cage or elsewhere. A table or the cage has one camera in use; a camera is retired, never deleted, so what it filmed keeps it.

**References.** A hand carries its table's camera, a cage transaction the cage's, both set as the row is written; an incident carries the camera its logger chose, and the time it happened tonight (the free-text camera note stays for anything else). The moment is the row's own: `played_at`, `created_at`, `occurred_at`. So a reference is two columns, not a table of its own. `public.cctv_reference(kind, id)` runs as the caller and answers only for a row they may read: whoever may read the hand, cage transaction or incident may see its recording (the owner's answer to #505). A camera keeps its channel, so what it filmed stays found; the recorder's address never carries a login, since every such reader gets the link.

**Lanes.** `cage_transaction` is lane A's; lane B's `camera_id` and its trigger on it are signed off by lane A here, and lane A's contract lists them. Lane B's contract planned a `cctv_reference` table; two columns do the job (rule 7).

**Practice and offline.** Cameras are venue setup, kept by a practice reset like its tables and devices; a reset replays hands and cage transactions with the cameras they had. A tablet's offline hands take the camera active when they sync.

**Playback.** The `cctv-playback` Edge Function makes the link through `@rivr/adapters`: the practice venue always gets the fake recorder; a real venue the template recorder at `CCTV_PLAYBACK_URL` (the recorder's playback address with `{channel}` and `{utc}`, `{ist}` or `{epoch}`), set once the recorder is installed (release runbook, step 9). Until then a link points at a `.invalid` address. The link opens at the second, in a new tab; a club-network address is fine, since only the console computers open it. Nothing calls the recorder, so nothing goes through the outbox.

**One Playback.** `@rivr/ui`'s `PlaybackLink` shows it and `@rivr/db/cctv`'s `usePlayback` gives its state. Features may not import each other, so Pot data, Incidents and the cage's receipt each hold a three-line wrapper joining the two; a row's Playback is named for its row.

**Not here.** Pulling clips into the console waits for the recorder's API, confirmed on site (tech plan item 17).
