import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runCli, type CliDeps } from './cli.ts';

/** The agent with its folder at `home`, the function and Storage answering by address, and what it said. */
function agentAt(home: string) {
  const said: string[] = [];
  const every = vi.fn<CliDeps['every']>();
  const send = vi.fn<typeof fetch>((input, init) => {
    if (!String(input).endsWith('/cage-agent')) return Promise.resolve(new Response('%PDF-1.7'));
    const isEnrol = String(init?.body).includes('"action":"enrol"');
    return Promise.resolve(isEnrol
      ? Response.json({ device_id: 'd1', venue_id: 'v1' })
      : Response.json({ name: '2026-11-15.pdf', path: '/storage/v1/object/sign/offline-packs/v1/2026-11-15.pdf?token=t' }));
  });
  const deps: CliDeps = { env: { RIVR_FUNCTIONS_URL: 'https://rivr.test/functions/v1', RIVR_AGENT_HOME: home }, send, every, say: (line) => said.push(line) };
  return { deps, said, every };
}

describe('the cage agent', () => {
  it('enrols with the code, then keeps tonight\'s pack and checks again every hour', async () => {
    const home = await mkdtemp(join(tmpdir(), 'rivr-agent-'));
    const { deps, said, every } = agentAt(home);
    await runCli(['enrol', '123456'], deps);
    await runCli(['run'], deps);
    expect(said).toEqual(['Enrolled as d1.', 'Offline pack: {"fetched":"2026-11-15.pdf"}']);
    expect(await readdir(join(home, 'offline-pack'))).toEqual(['2026-11-15.pdf']);
    expect(every).toHaveBeenCalledWith(expect.any(Function), 60 * 60 * 1000);
  });

  it('refuses to run before it has enrolled, a code that is not six digits, and an unknown command', async () => {
    const { deps } = agentAt(await mkdtemp(join(tmpdir(), 'rivr-agent-')));
    await expect(runCli(['run'], deps)).rejects.toThrow('Not enrolled yet');
    await expect(runCli(['enrol', '12'], deps)).rejects.toThrow('six-digit code');
    await expect(runCli(['print'], deps)).rejects.toThrow('Use enrol <code> or run.');
    await expect(runCli(['run'], { ...deps, env: {} })).rejects.toThrow('Set RIVR_AGENT_HOME.');
  });
});
