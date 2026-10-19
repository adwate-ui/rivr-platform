# 0056 Buy-in requests name the seat session

Date: 19 Oct 2026. Task: #57 (with #59).

Lane B's contract listed `public.request_buy_in(table, seat, amount)`. #57 built `public.request_buy_in(session, amount, idempotency_key)` instead, and both contracts now say so.

- **The seat session, not the table and seat.** A table and seat change hands: a move, a player who leaves and another who sits down. The session is the player in that seat, so the cage pays only the player who asked, and `cage_buy_in` refuses a request whose session has ended (`RVSTL`).
- **A request id.** The tablet retries over a weak connection (#43). The same id is the same request, so a retry never queues a second buy-in.
- **One waiting per seat.** A partial unique index holds one waiting request per session. Another request while one waits is `RVPND`, and the tablet shows the one with the cage instead.

Both callers, the floor and the table's tablet, pass the session id they already read from `floor_seats` or `tablet_seats`.
