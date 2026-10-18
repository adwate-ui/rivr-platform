# 0038 The scheduler runs the outbox consumers with its own secret

Date: 19 Oct 2026. Task #215.

pg_cron runs each outbox consumer's Edge Function every minute through pg_net (`private.run_outbox_consumer`). Issue #215 asked for the service-role key from Vault in that call. The security review of #263 found that pg_net's request queue (`net.http_request_queue`) is readable and writable by every database role, and a migration cannot take that away. A key passing through it every minute would be one step from anyone who ever gets SQL as any role, and the service-role key bypasses row-level security everywhere.

The consumer never needs the key from the caller: it calls the database with its own `SUPABASE_SERVICE_ROLE_KEY`. The caller only has to prove it is the scheduler. So:

- The call carries `x-outbox-secret`, a random secret kept twice: in Vault as `outbox_scheduler_secret`, and as the Edge Function secret `OUTBOX_SCHEDULER_SECRET`. `serveConsumer` compares them in constant time.
- Each consumer's function runs with `verify_jwt` off, since the scheduler carries no person's token.
- Whoever reads that secret can only run a consumer early. Claiming deliveries makes that harmless.
