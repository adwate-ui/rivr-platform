# 0263: Learn sources are checked in the console; Learn points start at 10, 25 and 100 a day

Date: 28 Oct 2026. Issues: #131, #132, #135.

**Context.** #131 asks that the drill engine's validator and gates run on an upload before it is accepted. The gates were a command-line script. A Supabase Edge Function has two seconds of CPU, and the gates take one to several seconds on a real encoding.

**Decision.**
- The console runs `@rivr/drills/gates` `checkEncoding` on the file in the super admin's browser, and uploads it to the private `learn-sources` bucket only when it passes. The gates now write reports through an injected writer and print through a sink, so the same code runs in the browser and on the command line.
- The database checks the file is in the bucket before it registers the source. It trusts the super admin's console for the gates, as it trusts them for every other configuration.
- A source's licence end is the `available_until` of its feature key `learn.source.<key>`. `has_feature` and `feature_state` treat a feature past its last day as no one's, overrides included.
- Learn points default to 10 a completed session and 25 for each principle first mastered, with 100 a day at most (`learn.session_points`, `learn.daily_points_cap`). Points never become cash, so these are a starting point the club tunes in Settings.

**Consequences.** A modified console could upload an encoding that fails the gates. Only a super admin can do that, and the command line still gates any file (`--dir`).
