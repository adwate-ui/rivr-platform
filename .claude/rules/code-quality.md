---
paths:
  - "**/*.{ts,tsx,sql}"
---

# Code quality

Write code a strong product team would approve without comments, and that a new junior developer can follow on first read.

- A function does one thing, under 40 lines. A file holds one concept, under 250 lines. More than four parameters means pass an object. ESLint enforces these, plus complexity 10 and nesting depth 3.
- Names say what: `settleOpenMarkers`, not `processData`. Booleans read as questions: `isPractice`, `hasOpenMarker`. Only domain abbreviations (KYC, TDS, GST, UTR).
- Types carry meaning: branded `Paise`, `MemberId`, `VenueId`, `TableId`; discriminated unions for states. No `any`. No `as` outside parsing boundaries. Parse external data with Zod at the edge.
- Expected failures return `Result`; throw only for bugs. Every user-facing error maps to a catalogue message.
- No abstraction until the third real use. No generic helpers "for later". Duplication across two places is cheaper than the wrong abstraction.
- Comments say why, never what. Every exported function and component has one TSDoc line.
- No dead code, commented-out code, `console.log`, or TODO without an issue link.
- Every package has a `README.md`: what it is for, its public API, one usage example, what it must not do. Update it in the same PR as the change.
- Feature flags only through `useFlag('feature.<area>.<name>')`; remove within two weeks of full rollout.
