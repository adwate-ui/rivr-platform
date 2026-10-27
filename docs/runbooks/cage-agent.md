# The cage agent

The cage agent is a small service on the cage computer (decision 0260). It does two jobs:
- **The offline pack (#168):** it keeps tonight's pack on the computer's own disk, so it can be printed when the system is down.
- **KOTs (#123):** it prints table-side food and drink tickets on Glaza's bar printer.

It is not a browser and needs no one signed in. It knows the club by a token it got once, when an admin added it on the console.

## What it keeps

The pack sits in `C:\RIVR\agent\offline-pack\`, one PDF a night named by its date: `2026-11-15.pdf`. The newest seven are kept.

The pack has:
- who to call;
- every member with money held or owed;
- the cage's float and chips in play;
- each open table with who sits where;
- the waitlist;
- every SOP in force.

The pack is made each evening at 17:00 IST, so it shows the club as it stood then.

The packs hold members' names and balances, so the computer's disk must be encrypted with BitLocker (owner, 27 Oct). Packs older than seven nights are removed. A member's erasure doesn't reach a pack already made; it ages out within a week.

## Installing it (once, on the cage computer)

1. **Install Node.js 22 LTS** from nodejs.org.
2. **Copy the agent:** build it on a development machine with `pnpm --filter @rivr/cage-agent build`, then copy `apps/cage-agent/dist/rivr-agent.mjs` to `C:\RIVR\agent\`.
3. **Install NSSM** (nssm.cc), which runs a program as a Windows service.
4. **Add the agent on the console.**
   1. An admin opens Computers, types the name "Cage agent" and presses **Add the cage agent**.
   2. The console shows a six-digit code, good for ten minutes.
5. **Enrol the agent** in a Command Prompt on the cage computer, replacing `<project>` and `<code>`:
   ```
   set RIVR_FUNCTIONS_URL=https://<project>.supabase.co/functions/v1
   set RIVR_AGENT_HOME=C:\RIVR\agent
   node C:\RIVR\agent\rivr-agent.mjs enrol <code>
   ```
   It prints `Enrolled as <device>`.
   - After five wrong codes from the club's address, it refuses for ten minutes.
   - The agent keeps its token in `C:\RIVR\agent\token`. Only the computer's administrators and the service may read that folder.
6. **Run it as a service:**
   ```
   nssm install RIVR-Agent "C:\Program Files\nodejs\node.exe" "C:\RIVR\agent\rivr-agent.mjs run"
   nssm set RIVR-Agent AppEnvironmentExtra RIVR_FUNCTIONS_URL=https://<project>.supabase.co/functions/v1 RIVR_AGENT_HOME=C:\RIVR\agent RIVR_BAR_PRINTER=<printer address>
   nssm set RIVR-Agent AppStdout C:\RIVR\agent\agent.log
   nssm set RIVR-Agent AppStderr C:\RIVR\agent\agent.log
   nssm start RIVR-Agent
   ```
   The agent fetches tonight's pack at once, then checks every hour. Its log names each pack it fetched.
   - `<printer address>` is the bar printer's address on the club's network, such as `192.168.1.60` (port 9100) or `192.168.1.60:9100`. Leave `RIVR_BAR_PRINTER` out until the printer is installed: the agent then prints nothing, and the console's KOTs to print list carries the bar.
7. **Turn on BitLocker** for the drive that holds `C:\RIVR`.

## Printing KOTs

With `RIVR_BAR_PRINTER` set, the agent checks for new KOTs every five seconds and prints each on the bar printer (ESC/POS over its raw port). A KOT shows its number, the table and seat, PAID BY THE MEMBER or COMP - RIVR, the time and each item.

- Its log says `KOTs: {"delivered":1,"failed":0}` after each run that printed or failed.
- A printer that is off or out of paper is tried again a little later, without losing the KOT.
- On the console, Food and drink lists every KOT the bar does not have yet. A KOT given to the bar by hand is marked sent there, and the agent never prints it.
- To test the printer, place an order for a seat on the console and watch for it at the bar and in the log.

## The nightly job

GitHub Actions runs `offline-pack` at 17:00 IST, for staging and production. It uses each environment's existing Supabase settings: the access token, the project's ref and its URL. It reads the service-role key from Supabase at run time and never stores it. A target whose settings are missing is skipped with a notice.

To make tonight's packs again, for example after an SOP changes, open Actions, then **offline-pack**, then **Run workflow**.

## When something is wrong

- **No pack tonight in the folder:**
  - Check the night's `offline-pack` run in GitHub Actions.
  - Then check the agent's log. `{"noneYet":true}` means the job has not made one yet. A connection error is tried again within the hour.
  - Last night's pack is still in the folder and can be used.
- **`not_enrolled` in the log:** the agent was revoked on Computers, or its token file was lost. Add it again (step 4) and enrol it with the new code (step 5).
- **KOTs not printing:**
  - Check the log for `failed`. Then check that the printer is on, has paper, and answers at its address from the cage computer.
  - Meanwhile, read or hand each KOT to the bar from the console's KOTs to print and mark it sent.
- **Moving to another computer:** revoke the old agent on Computers, then install and enrol it on the new one.

## Rollback

```
nssm stop RIVR-Agent
nssm remove RIVR-Agent confirm
```

Then revoke "Cage agent" on Computers, and delete `C:\RIVR\agent`. Without the agent, the console's KOTs to print list carries the bar (#123). A pack can still be downloaded from the bucket by an owner (`offline-packs`, in Supabase Storage).
