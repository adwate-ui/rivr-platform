# 0235: Promotion cost and cohort retention join the monthly MIS

Date: 2026-10-27 · Task: #111 (scope-v1 module 16; module 7's acceptance)

**Promotion cost.** The monthly MIS (0188) lists each promotion that gave anything in the club month: its grants and their cost in the month, its cost to the month's end, and its budget (the cap, or "No cap"). Grants are counted by their club day. A budget is the promotion's whole cap, not a month's, so the cost to date is what to read against it.

**Cohort retention.** A member's cohort is the club month of their first visit at the venue. The MIS lists the cohorts of the six club months up to this one: how many members each has, and how many of them visited in each month from their first to this one. The share is in whole percent, rounded down, shown beside the count.

**How.** Both are part of `private.mis_for`, so the month stored on the 1st keeps them as they stood. A month stored before #111 has neither, and the console shows them empty.
