import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeKitchenPrinter } from '@rivr/adapters/kitchen-printer';
import { describe, expect, it, vi } from 'vitest';
import { runCli, type CliDeps } from './cli.ts';

/** The agent with its folder at `home`, the function and Storage answering by address, and what it said. */
function agentAt(home: string) {
  const said: string[] = [];
  // One KOT waiting, claimed once.
  const kotsToClaim = [{
    delivery_id: 'k1', event_id: 'e1', venue_id: 'v1', event_type: 'fnb.ordered', attempts: 1,
    payload: { order_id: '00000000-0000-4000-8000-0000000f0001', kot_number: '1', table_name: 'Table 3', seat: 5,
               items: [{ name: 'Masala chai', quantity: 1, note: null }], ordered_at: '2026-11-15T16:30:00Z', is_comp: false },
  }];
  const every = vi.fn<CliDeps['every']>();
  const send = vi.fn<typeof fetch>((input, init) => {
    if (!String(input).endsWith('/cage-agent')) return Promise.resolve(new Response('%PDF-1.7'));
    const action = String(init?.body).match(/"action":"(\w+)"/)?.[1];
    if (action === 'enrol') return Promise.resolve(Response.json({ device_id: 'd1', venue_id: 'v1' }));
    if (action === 'claim_kots') return Promise.resolve(Response.json(kotsToClaim.splice(0)));
    if (action === 'finish_kot') return Promise.resolve(Response.json({ finished: true }));
    return Promise.resolve(Response.json({ name: '2026-11-15.pdf', path: '/storage/v1/object/sign/offline-packs/v1/2026-11-15.pdf?token=t' }));
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

  it('with the bar printer set, prints the waiting KOT and checks again every five seconds', async () => {
    const home = await mkdtemp(join(tmpdir(), 'rivr-agent-'));
    const { deps, said, every } = agentAt(home);
    const printer = createFakeKitchenPrinter();
    await runCli(['enrol', '123456'], deps);
    await runCli(['run'], { ...deps, env: { ...deps.env, RIVR_BAR_PRINTER: '192.168.1.50' }, printerAt: () => printer });
    expect(printer.calls.map((ticket) => ticket.kotNumber)).toEqual(['1']);
    expect(said).toContain('KOTs: {"delivered":1,"failed":0}');
    expect(every).toHaveBeenCalledWith(expect.any(Function), 5_000);
  });

  it('refuses to run before it has enrolled, a code that is not six digits, and an unknown command', async () => {
    const { deps } = agentAt(await mkdtemp(join(tmpdir(), 'rivr-agent-')));
    await expect(runCli(['run'], deps)).rejects.toThrow('Not enrolled yet');
    await expect(runCli(['enrol', '12'], deps)).rejects.toThrow('six-digit code');
    await expect(runCli(['print'], deps)).rejects.toThrow('Use enrol <code> or run.');
    await expect(runCli(['run'], { ...deps, env: {} })).rejects.toThrow('Set RIVR_AGENT_HOME.');
  });
});
