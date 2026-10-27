# 0254: Main's CI runs give way to newer ones; every money module is mutated every three hours

Date: 2026-10-27 · Owner's decision. Supersedes 0243's "each push to main has a CI run of its own, never cancelled".

**Why.** The account runs 20 jobs at once. Every merge started a run on main of about 18 jobs, the mutation of all 24 money modules included, and none was ever cancelled, so three merges in twenty minutes held nearly every runner for half an hour, and pull requests' CI queued behind them. Most of that run was repeated by the next merge's run, which tests everything the earlier commit holds.

**What.**
- A push to main runs CI without mutation (`ci.yml`, the plan step), and a newer commit's run cancels an older one (one concurrency group for main).
- The full run, which adds the mutation of every money module, is CI dispatched on main (`gh workflow run ci.yml --ref main`). `full-run.yml` dispatches it every three hours, unless main's newest commit has one passed or going, so a quiet night costs no runners. `land.sh --fixes-main` dispatches it after the fix lands. It is never cancelled.
- A release needs the full run green at the tagged commit (`release.yml`): dispatch one, or tag a commit a scheduled run passed.
- A pull request still mutates the modules it changes.
- `land.sh` holds merges until main's newest push run and its newest full run have both passed. It ignores a run a newer commit's replaced, and any pull request's run.
