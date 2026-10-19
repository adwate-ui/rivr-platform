// When Auth refuses a sign-in code because the project's hourly code limit is used up
// (over_sms_send_rate_limit, #182), the sign-in screen calls this, signed out. It raises one alert
// for the owner dashboard at most every 15 minutes (private.raise_sms_limit_alert), and takes
// nothing from the caller but the fact.
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405, headers: CORS });
  const answer = await fetch(`${supabaseUrl}/rest/v1/rpc/raise_sms_limit_alert`, {
    method: 'POST',
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
    body: '{}',
  });
  return new Response(null, { status: answer.ok ? 204 : 502, headers: CORS });
});
