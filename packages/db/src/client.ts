import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';

/** The typed Supabase client. Only @rivr/db creates or holds one. */
export type RivrClient = SupabaseClient<Database>;

export interface RivrClientOptions {
  readonly url: string;
  /** The project's publishable (anon) key. Never the service-role key. */
  readonly publishableKey: string;
  /** The enrolled device this app runs on (tablet, cage, TV), sent so the audit log records it. */
  readonly deviceId?: string;
}

/** Creates the one client an app uses. */
export function createRivrClient({ url, publishableKey, deviceId }: RivrClientOptions): RivrClient {
  const headers: Record<string, string> = deviceId ? { 'x-rivr-device-id': deviceId } : {};
  return createClient<Database>(url, publishableKey, { global: { headers } });
}
