import { describe, expect, it } from 'vitest';
import { displayScreens, playerScreens, tabletScreens, webScreens } from './apps.ts';
import { readRpcs, scanRpcs } from './rpcs.ts';

describe('playerScreens', () => {
  const screens = playerScreens();
  const kindOf = (path: string) => screens.find((screen) => screen.path === path)?.kind;

  it('lists the member screens', () => {
    expect(kindOf('/rewards')).toBe('menu');
    expect(kindOf('/card')).toBe('menu');
    expect(kindOf('/sessions/$sessionId')).toBe('menu');
  });

  it('marks Balance and Academy, which redirect, hidden', () => {
    expect(kindOf('/balance')).toBe('hidden');
    expect(kindOf('/balance/withdraw')).toBe('hidden');
    expect(kindOf('/academy')).toBe('hidden');
  });

  it('marks sign-in and sign-up as open to anyone', () => {
    expect(kindOf('/sign-in')).toBe('route');
    expect(kindOf('/sign-up')).toBe('route');
  });
});

describe('tablet, display and web screens', () => {
  it('has the dealer tablet and the door kiosk', () => {
    expect(tabletScreens().map((screen) => screen.app)).toEqual(['tablet', 'door']);
  });

  it('has one screen per TV mode, the hidden modes hidden', () => {
    const modes = displayScreens();
    expect(modes.find((screen) => screen.path === '/#waitlist')?.kind).toBe('menu');
    expect(modes.find((screen) => screen.path === '/#jackpot')?.kind).toBe('hidden');
  });

  it('turns Astro file routes into addresses', () => {
    expect(webScreens().map((screen) => screen.path)).toEqual(['/404', '/$slug', '/', '/preview/$token']);
  });
});

describe('scanRpcs', () => {
  it('finds direct calls, calls through a union-typed name, and Edge Functions', () => {
    const text = `client.rpc('door_scan', { p_code }); client.rpc("waitlist_now");
      function change(rpc: 'mark_x' | 'unmark_x') { client.rpc(rpc, {}); }
      client.functions.invoke('device-pair', {});`;
    expect(scanRpcs(text, 'door', 'packages/db/src/door.ts').map((rpc) => rpc.name)).toEqual([
      'door_scan',
      'edge:device-pair',
      'mark_x',
      'unmark_x',
      'waitlist_now',
    ]);
  });

  it('reads the real data layer', () => {
    const rpcs = readRpcs();
    expect(rpcs.length).toBeGreaterThan(300);
    expect(rpcs.find((rpc) => rpc.name === 'door_scan')?.module).toBe('door');
    expect(rpcs.some((rpc) => rpc.name === 'mark_tournament_registered')).toBe(true);
    expect(rpcs.some((rpc) => rpc.name === 'edge:device-pair')).toBe(true);
  });
});
