# 0462: The console v3 tokens

Date: 3 Nov 2026. The console v3 brief, phase 0. Where the brief and the 4.5:1 rule disagree, the rule wins (CLAUDE.md).

- **Surfaces reuse what is there.** Base is `color.surface` and raised is `color.raised`. The new names are aliases: `subtle` (cream 5%, the skeleton's faint tint), `subtleHover` (cream 8%) and `selected` (`goldTint`, gold 14%). `danger` (#E8828C) is new: 4.76:1 on green, 5.86:1 on green-black.
- **No 55% or 40% text.** Cream at 55% is 4.35:1 on green and cream at 40% is 3.01:1, both under 4.5:1. The lowest passing alpha on green is about 57%, too close to muted to read as its own step. So secondary and tertiary text are both `contentMuted` (60%, 4.89:1). There is no fainter text.
- **Muted text stays off fills.** Muted is 4.47:1 on cream at 5% and 4.18:1 on the selected tint. On a subtle, selected or cream-track fill, words are cream. The header's search is filled green-black, not cream at 5%, so its muted words keep 5.62:1.
- **Type, space and sizes.** Font size 15 is new (a row's primary text; "Console scale: 15." in the design inventory). Also new: `space.7` (28 px), `size.row` 42 and `size.rowCompact` 34, `size.control` 36 (a control at a desk), `size.railCollapsed` 64, `size.sidePanel` 440, `size.palette` 600, `size.paletteList` and `size.search` 420. `size.rail` goes from 248 to 224 px. Radius stays 3, 4 and 6.
- **Breakpoints.** The brief's 760 px is the existing `medium`, 768 px: DataTable, SplitView and Grid already change there, and no device sits between. Its 1200 px is the new `breakpoint.wide`, where the rail shows its labels. Below 1180 px (`tablet`) controls keep 44 px targets (decision 0282).
- **Motion.** `motion.duration.fresh` (2.5 s) fades a new request's tint, one more exception beside decision 0320's.
