// An iPhone reports a new token with its own key (decision 0361): the token of a Live Activity Apple started by push, or a
// new push-to-start token. iOS gives them while the app's web view, and so its session, may not be running, so the native
// app calls this with the key the phone was given when the member turned the live status on, and nothing else. A wrong
// key changes nothing; the key is 256 random bits, kept in the database only as a hash. verify_jwt is off.
import { liveStatusTokenReportSchema } from '@rivr/contracts';
import { rpc } from '../_shared/outbox.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });
  const report = liveStatusTokenReportSchema.safeParse(await request.json().catch(() => null));
  if (!report.success) return Response.json({ error: 'Not a token report' }, { status: 400 });
  const { device_key: deviceKey, push_token: token = null, activity_push_token: activityToken = null } = report.data;
  try {
    await rpc('report_live_status_token', { p_device_key: deviceKey, p_token: token, p_activity_token: activityToken });
  } catch {
    // A token another phone already has, or the database out of reach: the phone reports again with its next token.
    return Response.json({ error: 'Not kept' }, { status: 503 });
  }
  return new Response(null, { status: 204 });
});
