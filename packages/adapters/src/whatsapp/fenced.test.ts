import { indianMobileSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createFakeWhatsApp, fencedWhatsApp } from './index.ts';

const team = indianMobileSchema.parse('+919811000001');
const seed = indianMobileSchema.parse('+919000000201');

describe('staging\'s WhatsApp fence', () => {
  it('sends only to the numbers on the list, written either way, and refuses the rest unsent', async () => {
    const whatsapp = createFakeWhatsApp();
    const fenced = fencedWhatsApp(whatsapp, ' 91 98110 00001 , +919811000002');

    expect((await fenced.sendTemplate({ category: 'utility', to: team, template: 'owner_alert', params: ['x'] })).ok).toBe(true);
    expect(await fenced.sendTemplate({ category: 'utility', to: seed, template: 'seat_ready', params: ['Table 2', '4', '21:40'] })).toEqual({
      ok: false, error: { code: 'rejected', reason: 'not on the allowlist' },
    });
    expect(whatsapp.calls.map((call) => call.to)).toEqual([team]);
  });

  it('lets every message go when no list is set, as in production', async () => {
    const whatsapp = createFakeWhatsApp();
    expect(fencedWhatsApp(whatsapp, '')).toBe(whatsapp);
    expect(fencedWhatsApp(whatsapp, ' , ')).toBe(whatsapp);
  });
});
