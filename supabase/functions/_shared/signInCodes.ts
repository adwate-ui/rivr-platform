// Message Central's VerifyNow for sign-in codes (decision 0679), shared by the hook that has it text a
// code (auth-send-code) and the function that checks the code typed (sign-in-verify).
import { createVerifyNow, type VerifyNowAdapter } from '@rivr/adapters/verify-now';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const customerId = Deno.env.get('MESSAGECENTRAL_CUSTOMER_ID') ?? '';
const password = Deno.env.get('MESSAGECENTRAL_PASSWORD') ?? '';

// One per running function, so its token is reused from one request to the next. 1.5 s a request:
// the hook's send, with a new token, must leave time to keep Auth's code within Auth's 5 seconds.
const verifyNow = customerId && password ? createVerifyNow({ customerId, password, timeoutMs: 1_500 }) : null;

/** VerifyNow while both its secrets are set; null until then, and codes go by WhatsApp and MSG91 as before. */
export function liveVerifyNow(): VerifyNowAdapter | null {
  return verifyNow;
}

/** Calls one of the sign-in code functions in the database as the server: its result, or it throws. */
export async function signInCodeRpc(name: string, args: object, timeoutMs: number): Promise<unknown> {
  const answer = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!answer.ok) throw new Error(`${name} failed (${String(answer.status)})`);
  return await answer.json();
}
