import type { CageAgentRequest } from '@rivr/contracts';

/** The newest offline pack: its name (`2026-11-15.pdf`) and a link to it, good for a few minutes. */
export interface PackLink {
  name: string;
  url: string;
}

/** Why the cage-agent function said no. */
export type AgentRefusal = 'wrong_code' | 'too_many' | 'not_enrolled' | 'unavailable';

/** What the agent asks the cage-agent function (#168; decision 0260). */
export interface AgentApi {
  /** Claims the code staff read from the Computers screen with the hash of the agent's token. */
  enrol(code: string, tokenHash: string): Promise<{ deviceId: string } | { refusal: AgentRefusal }>;
  /** The venue's newest pack, null while none has been made, or why not. */
  newestPack(token: string): Promise<PackLink | null | { refusal: AgentRefusal }>;
}

function field(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, name) : undefined;
}

function refusalOf(status: number, body: unknown): AgentRefusal {
  const error = field(body, 'error');
  if (error === 'wrong_code' || error === 'too_many' || error === 'not_enrolled') return error;
  return status === 401 ? 'not_enrolled' : 'unavailable';
}

/** The cage-agent function at `functionsUrl` (`https://<project>.supabase.co/functions/v1`). */
export function createAgentApi(functionsUrl: string, send: typeof fetch = fetch): AgentApi {
  const post = async (request: CageAgentRequest, token?: string) => {
    const response = await send(`${functionsUrl}/cage-agent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token === undefined ? {} : { 'x-rivr-computer': token }) },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(15_000),
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  };
  return {
    async enrol(code, tokenHash) {
      const { status, body } = await post({ action: 'enrol', code, token_hash: tokenHash });
      const deviceId = field(body, 'device_id');
      return status === 200 && typeof deviceId === 'string' ? { deviceId } : { refusal: refusalOf(status, body) };
    },
    async newestPack(token) {
      const { status, body } = await post({ action: 'pack' }, token);
      if (status === 404) return null;
      const name = field(body, 'name');
      const path = field(body, 'path');
      if (status !== 200 || typeof name !== 'string' || typeof path !== 'string' || !path.startsWith('/storage/v1/')) {
        return { refusal: refusalOf(status, body) };
      }
      // The link's path, joined to the project's address the agent was given.
      return { name, url: new URL(path, functionsUrl).toString() };
    },
  };
}
