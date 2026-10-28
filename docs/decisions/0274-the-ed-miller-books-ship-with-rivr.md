# 0274: The Ed Miller books ship with RIVR

Date: 28 Oct 2026. Supersedes decision 0015 ("the drill engine carries no book content") for these two books. The owner chose this on 28 Oct, after being told the repository is public.

- **What moved.** The two encodings poker-settle shipped are now in `packages/drills/sources/`, unchanged:
  - "The Course" (`src_course`): 14 units, 104 principles, 74 quiz hands.
  - "How To Read Hands" (`src_read_hands`): 16 units, 30 principles, 48 quiz hands.

  `catalogue.ts` lists them as `BUILT_IN_SOURCES`, at `@rivr/drills/sources`. The drills functionality moves from poker-settle to RIVR with them.
- **The repository was public.** The owner was told on 28 Oct that the books' text stays in public git history even after the repository is made private. They chose to commit now and make the repository private later.
- **Gated like the fixtures.** `pnpm --filter @rivr/drills gates` reads `sources/` with `fixtures/` in one run, so CI checks the very files the app opens. Each book's own `state` (`validating`, `draft`) decides whether its gate findings fail the build, as for any encoding.
- **Lazy.** Each book is its own chunk, fetched only when a member opens it. The app's entry does not grow.
- **Public as the repository is.** A chunk is a static file of the player app: anyone can fetch it, whatever their tier. The owner's choice to publish the text (above) covers this. The tier gate decides who drills it, not who can read it.
- **Gated by tier as the drills are.** A built-in book is listed on Learn (`learn.library`) and opens in the same book screen (`learn.drills`). It needs no per-title `learn.source.<key>` feature, which exists for licences that end. Progress keeps the book's source id as its `source_key`.
- **Licensed uploads stay as they were** (#131): a super admin uploads any other licensed encoding at runtime.
