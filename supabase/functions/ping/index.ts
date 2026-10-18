// Proves that an Edge Function imports the shared packages through its import map
// (supabase/functions/ping/deno.json) and deploys. Every outbox consumer imports
// @rivr/contracts, @rivr/domain and @rivr/adapters the same way.
import { ok } from '@rivr/contracts';

Deno.serve(() => Response.json(ok({ service: 'rivr' })));
