import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { AgentApi, PackLink } from './api.ts';
import { syncPack } from './pack.ts';

/** An agent API whose newest pack is `link`, and a download that answers `bytes`. */
function fakes(link: PackLink | null) {
  const api: AgentApi = { enrol: vi.fn(), newestPack: vi.fn(() => Promise.resolve(link)), claimKots: vi.fn(), finishKot: vi.fn() };
  const send = vi.fn<typeof fetch>(() => Promise.resolve(new Response('%PDF-1.7 pack')));
  return { api, send, downloads: send };
}

describe('syncPack', () => {
  it('downloads the newest pack into the folder whole, and not again once it is there', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'rivr-pack-'));
    const { api, send, downloads } = fakes({ name: '2026-11-15.pdf', url: 'https://storage.test/2026-11-15.pdf' });
    expect(await syncPack(api, 'token', folder, send)).toEqual({ fetched: '2026-11-15.pdf' });
    expect(await readFile(join(folder, '2026-11-15.pdf'), 'utf8')).toBe('%PDF-1.7 pack');
    expect(await readdir(folder)).toEqual(['2026-11-15.pdf']);
    expect(await syncPack(api, 'token', folder, send)).toEqual({ alreadyHere: '2026-11-15.pdf' });
    expect(downloads).toHaveBeenCalledOnce();
  });

  it('keeps the newest seven nights and removes the rest', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'rivr-pack-'));
    for (const day of ['08', '09', '10', '11', '12', '13', '14']) await writeFile(join(folder, `2026-11-${day}.pdf`), 'old');
    const { api, send } = fakes({ name: '2026-11-15.pdf', url: 'https://storage.test/2026-11-15.pdf' });
    await syncPack(api, 'token', folder, send);
    expect((await readdir(folder)).sort()).toEqual(['09', '10', '11', '12', '13', '14', '15'].map((day) => `2026-11-${day}.pdf`));
  });

  it('says when no pack is made yet, and passes a refusal on', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'rivr-pack-'));
    expect(await syncPack(fakes(null).api, 'token', folder, fakes(null).send)).toEqual({ noneYet: true });
    const refused: AgentApi = {
      enrol: vi.fn(), newestPack: vi.fn(() => Promise.resolve({ refusal: 'not_enrolled' as const })), claimKots: vi.fn(), finishKot: vi.fn(),
    };
    expect(await syncPack(refused, 'token', folder, fakes(null).send)).toEqual({ refusal: 'not_enrolled' });
  });
});
