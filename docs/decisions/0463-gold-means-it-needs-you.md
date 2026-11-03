# 0463: Gold means it needs you

Date: 3 Nov 2026. The console v3 brief's usage rules, written into `packages/ui/README.md`.

1. A gold filled button is the single primary action on a screen.
2. A gold dot, gold text or a gold inner ring means "this needs you": a request, a top-up, a player leaving.
3. Nothing else is gold. Statuses such as Live, Active, Open and Registered use cream or muted text.

How @rivr/ui follows them:
- A list item's own main action, such as a request's Approve, is a cream fill (`Button` `variant="strong"`), never gold, as a screen holds many.
- A rail or tab count is a solid gold badge only with `isActionable` (requests, orders). An informational one (feedback, KYC) is a muted pill.
- `TableTile` rings itself and fills seats in gold only while someone needs the floor. `HeaderPulse` dots the requests count only above 0. `DotStatus` keeps gold for `needsYou`.
- Every gold sign has words beside it, so colour is never the only sign.
