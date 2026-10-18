import { describe, expect, it } from 'vitest';
import { createFakeCctv } from './index.ts';

describe('fake CCTV recorder', () => {
  it('gives a playback link for a camera at a moment, on a domain that never resolves', async () => {
    const cctv = createFakeCctv();
    const at = new Date('2026-11-16T18:35:12Z');

    expect(await cctv.playbackLink({ cameraId: 'table-3/overhead', at })).toEqual({
      ok: true,
      value: { url: 'https://cctv.invalid/playback?camera=table-3%2Foverhead&at=2026-11-16T18%3A35%3A12.000Z' },
    });
    expect(cctv.calls).toEqual([{ cameraId: 'table-3/overhead', at }]);
  });

  it('fails the next call when a test scripts it', async () => {
    const cctv = createFakeCctv();
    cctv.failNext({ code: 'unavailable' });

    expect(await cctv.playbackLink({ cameraId: 'cage', at: new Date(0) })).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
