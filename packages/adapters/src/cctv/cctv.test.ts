import { describe, expect, it } from 'vitest';
import { createFakeCctv, createTemplateCctv, isRecorderTemplate } from './index.ts';

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

describe('template recorder', () => {
  // 00:05:12.900 IST on 17 November: the second the hand was played, milliseconds dropped.
  const at = new Date('2026-11-16T18:35:12.900Z');

  it('opens the camera at the right second, in UTC', async () => {
    const cctv = createTemplateCctv({ template: 'https://nvr.club.lan/playback?channel={channel}&start={utc}' });
    expect(await cctv.playbackLink({ cameraId: 'ch-2', at })).toEqual({
      ok: true, value: { url: 'https://nvr.club.lan/playback?channel=ch-2&start=20261116T183512Z' },
    });
  });

  it('or on India\'s clock, or in seconds since 1970, with the channel encoded', async () => {
    const cctv = createTemplateCctv({ template: 'http://10.0.0.5/play/{channel}?t={ist}&e={epoch}' });
    expect(await cctv.playbackLink({ cameraId: 'table 3/overhead', at })).toEqual({
      ok: true, value: { url: 'http://10.0.0.5/play/table%203%2Foverhead?t=2026-11-17T00:05:12&e=1794854112' },
    });
  });

  it('takes only an http(s) address with the channel and a moment', () => {
    expect(isRecorderTemplate('https://nvr.club.lan/playback?channel={channel}&start={utc}')).toBe(true);
    expect(isRecorderTemplate('https://nvr.club.lan/playback?start={utc}')).toBe(false);
    expect(isRecorderTemplate('https://nvr.club.lan/playback?channel={channel}')).toBe(false);
    expect(isRecorderTemplate('javascript:alert({channel}{utc})')).toBe(false);
    expect(isRecorderTemplate('')).toBe(false);
  });

  it('never takes a login in the address, since every staff member who may see the row gets the link', () => {
    expect(isRecorderTemplate('http://admin:secret@10.0.0.5/playback?channel={channel}&start={utc}')).toBe(false);
    expect(isRecorderTemplate('http://10.0.0.5/playback?channel={channel}&start={utc}&user=admin&password=secret')).toBe(false);
    expect(isRecorderTemplate('http://10.0.0.5/playback?channel={channel}&start={utc}&token=abc')).toBe(false);
    expect(isRecorderTemplate('http://{channel}.nvr.lan/playback?start={utc}')).toBe(false);
  });
});
