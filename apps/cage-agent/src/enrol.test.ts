import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAgentApi } from './api.ts';
import { enrol, readToken, tokenHash } from './enrol.ts';

/** The cage-agent function, answering `reply` and recording what it was sent. */
function fakeFunction(reply: { status: number; body: unknown }) {
  const sent: { url: string; headers: Record<string, string>; body: unknown }[] = [];
  const send: typeof fetch = (input, init) => {
    sent.push({ url: String(input), headers: Object.fromEntries(new Headers(init?.headers).entries()), body: JSON.parse(String(init?.body)) });
    return Promise.resolve(Response.json(reply.body, { status: reply.status }));
  };
  return { api: createAgentApi('https://rivr.test/functions/v1', send), sent };
}

describe('enrolling the agent', () => {
  it('sends only the hash of a new token, and keeps the token once the code is claimed', async () => {
    const home = await mkdtemp(join(tmpdir(), 'rivr-agent-'));
    const { api, sent } = fakeFunction({ status: 200, body: { device_id: 'd1', venue_id: 'v1' } });
    expect(await enrol(api, home, '123456')).toEqual({ deviceId: 'd1' });
    const token = await readToken(home);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(sent).toEqual([{ url: 'https://rivr.test/functions/v1/cage-agent', headers: { 'content-type': 'application/json' },
      body: { action: 'enrol', code: '123456', token_hash: tokenHash(token ?? '') } }]);
  });

  it('keeps nothing when the code is refused', async () => {
    const home = await mkdtemp(join(tmpdir(), 'rivr-agent-'));
    const { api } = fakeFunction({ status: 429, body: { error: 'too_many' } });
    expect(await enrol(api, home, '123456')).toEqual({ refusal: 'too_many' });
    expect(await readToken(home)).toBeNull();
  });
});

describe('asking for the newest pack', () => {
  it('sends the token, and reads the link at the address it was given, none yet, or not enrolled', async () => {
    const found = fakeFunction({ status: 200, body: { name: '2026-11-15.pdf', path: '/storage/v1/object/sign/offline-packs/v1/2026-11-15.pdf?token=t' } });
    expect(await found.api.newestPack('t0ken')).toEqual({
      name: '2026-11-15.pdf', url: 'https://rivr.test/storage/v1/object/sign/offline-packs/v1/2026-11-15.pdf?token=t',
    });
    expect(found.sent[0]?.headers['x-rivr-computer']).toBe('t0ken');
    expect(await fakeFunction({ status: 404, body: { error: 'none_yet' } }).api.newestPack('t')).toBeNull();
    expect(await fakeFunction({ status: 401, body: { error: 'not_enrolled' } }).api.newestPack('t')).toEqual({ refusal: 'not_enrolled' });
  });
});
