import { describe, expect, it } from 'vitest';
import { createFakeCachePurge } from './index.ts';

describe('fake cache purge', () => {
  it('records the pages purged after a website publish', async () => {
    const purge = createFakeCachePurge();
    const urls = ['https://rivr.test/', 'https://rivr.test/tournaments'];

    expect(await purge.purgeUrls({ urls })).toEqual({ ok: true, value: { purgeId: 'fake-purge-1' } });
    expect(purge.calls).toEqual([{ urls }]);
  });

  it('refuses an empty purge, which would be a bug in the caller', async () => {
    expect(await createFakeCachePurge().purgeUrls({ urls: [] })).toEqual({
      ok: false,
      error: { code: 'rejected', reason: 'no URLs to purge' },
    });
  });

  it('fails the next purge when a test scripts it', async () => {
    const purge = createFakeCachePurge();
    purge.failNext({ code: 'rate_limited' });

    expect(await purge.purgeUrls({ urls: ['https://rivr.test/'] })).toEqual({ ok: false, error: { code: 'rate_limited' } });
  });
});
