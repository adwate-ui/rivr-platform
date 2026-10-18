// A one-minute signed URL for one KYC image (#3). Staff call it with their own session. The
// database decides whether they may see the image and audits the view (public.authorize_kyc_image);
// then this signs with the service role, so the URL's lifetime is fixed here: no client can ask
// Storage for a longer one, because no client may read the kyc bucket at all.

const URL_SECONDS = 60;

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// The console calls this from the browser.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function reply(body: object, status: number): Response {
  return Response.json(body, { status, headers: CORS });
}

/** The image's path from the request body, `<venue_id>/<member_id>/<file>`, or null. */
async function pathFrom(request: Request): Promise<string | null> {
  const body: unknown = await request.json().catch(() => null);
  const path: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, 'path') : null;
  return typeof path === 'string' && path !== '' ? path : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') return reply({ error: 'POST only' }, 405);
  const path = await pathFrom(request);
  if (path === null) return reply({ error: 'path is required' }, 400);

  // Asked as the caller, so the database sees who it is.
  const allowed = await fetch(`${supabaseUrl}/rest/v1/rpc/authorize_kyc_image`, {
    method: 'POST',
    headers: { apikey: anonKey, authorization: request.headers.get('authorization') ?? '', 'content-type': 'application/json' },
    body: JSON.stringify({ p_name: path }),
  });
  if (!allowed.ok) return reply({ error: 'Not allowed to see this image' }, 403);

  const encoded = path.split('/').map(encodeURIComponent).join('/');
  const signed = await fetch(`${supabaseUrl}/storage/v1/object/sign/kyc/${encoded}`, {
    method: 'POST',
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn: URL_SECONDS }),
  });
  if (!signed.ok) return reply({ error: 'Image not found' }, 404);
  const signedPath: unknown = Reflect.get(await signed.json(), 'signedURL');
  // Relative to the Storage API (`/object/sign/kyc/...?token=`): this function cannot know the
  // address the browser reaches Storage on, so the client adds its own.
  return typeof signedPath === 'string' ? reply({ signedPath }, 200) : reply({ error: 'Image not found' }, 404);
});
