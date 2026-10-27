# @rivr/cage-agent

The cage agent (decision 0260) is a Node 22 service on the cage computer. It has no screen, so the app layout in `.claude/rules/apps.md` doesn't apply. Its jobs:
- **The offline pack (#168):** it keeps tonight's pack on the computer's disk, the newest seven nights.
- **KOTs (#123):** it prints table-side food and drink tickets on the bar printer.

It talks only to the `cage-agent` Edge Function, with a token it got once when it enrolled. That token can fetch its venue's pack and its KOTs and nothing else. It never unlocks the cage's or an admin's work.

`docs/runbooks/cage-agent.md` installs it as a Windows service, and covers enrolment, BitLocker and rollback.

## Commands

| Command | What it does |
|---|---|
| `node rivr-agent.mjs enrol <code>` | Claims the six-digit code an admin got from **Add the cage agent** on Computers. It makes a token from 32 random bytes, sends only its SHA-256, and keeps the token in `RIVR_AGENT_HOME/token`. |
| `node rivr-agent.mjs run` | Fetches the venue's newest offline pack into `RIVR_AGENT_HOME/offline-pack` unless it is already there. It downloads to a temporary file renamed once whole, keeps the newest seven, and checks again every hour. With `RIVR_BAR_PRINTER` set, it also prints the venue's KOTs on the bar printer every five seconds, one run at a time (#123). |

Settings:
- `RIVR_FUNCTIONS_URL`: the project's functions address, `https://<project>.supabase.co/functions/v1`.
- `RIVR_AGENT_HOME`: the agent's folder.
- `RIVR_BAR_PRINTER`: the bar printer, `host` or `host:port` (9100 unless given). Unset, the agent prints no KOTs.

## Source

| File | What it holds |
|---|---|
| `src/api.ts` | `createAgentApi(functionsUrl, fetch)`: `enrol(code, tokenHash)`, `newestPack(token)`, `claimKots(token, limit)` and `finishKot(token, outcome)`, with the function's refusals (`wrong_code`, `too_many`, `not_enrolled`, `unavailable`) |
| `src/enrol.ts` | `enrol`, `readToken` and `tokenHash` |
| `src/pack.ts` | `syncPack(api, token, folder, fetch)` and `KEEP` (7) |
| `src/kots.ts` | `printKots(api, token, printer)`: the venue's KOTs as an outbox store (`kotStore`) run through the `bar_printer` consumer (`barPrinter`), on the ESC/POS printer at `RIVR_BAR_PRINTER` (`barPrinterAt`, over `tcpConnect`) |
| `src/cli.ts` | `runCli(argv, deps)`: the two commands, with the network, the clock, the output and the printer passed in |
| `src/main.ts` | The entry, built to one file, `dist/rivr-agent.mjs` (`pnpm --filter @rivr/cage-agent build`) |

## Must not

- Hold a key other than its own token, or call anything but the `cage-agent` function and the links it hands out.
- Print or keep anything for the practice venue. The database never gives it the practice venue's KOTs or pack.
