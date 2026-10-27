# 0260: A RIVR agent on the cage computer keeps the offline pack and prints KOTs

Date: 2026-10-27 · Owner's decisions (27 Oct, 22:30 IST) for #168 and #123 (question #531): "Cloud renders, cage agent keeps", "Same cage agent relays", and the three issues (#123, #167, #168) built as one batch.

**Why.**
- The offline pack must be on the cage computer when the internet is down (#168). Until now nothing ran there but the console in a browser, which cannot save a file by itself each night.
- `@rivr/render` needs Node and Chromium, so a Supabase function (Deno) cannot make the PDF.
- The bar printer is on the club's network, where no cloud function can reach it (#123).

**What.**
- **The nightly render:** a GitHub Actions job renders each real venue's offline pack (never the practice venue's) with `@rivr/render` from `private.offline_pack(venue)`. That function is for the service role only. The job keeps the PDF in a private Storage bucket.
- **The agent:** a small Node service on the cage computer, signed in with the computer's own token (decision 0110).
  - It downloads the latest pack each night to a folder on disk and keeps the last seven.
  - It takes new KOTs and prints them on the bar printer over the network. Printing goes through `@rivr/adapters`' kitchen printer, as an outbox consumer.
- **Until the agent is installed,** the console lists KOTs to print.
- **Install and rollback:** the runbook covers both.
