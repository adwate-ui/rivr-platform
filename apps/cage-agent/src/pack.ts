import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentApi, AgentRefusal } from './api.ts';

/** How many nights' packs stay on the cage computer (owner, 27 Oct: seven, on a BitLocker disk). */
export const KEEP = 7;

/** What a sync did: fetched a new pack, found it already here, found none made yet, or was refused. */
export type PackSync = { fetched: string } | { alreadyHere: string } | { noneYet: true } | { refusal: AgentRefusal };

/** A pack's file name as the nightly job writes it: an IST date. */
const PACK_NAME = /^\d{4}-\d{2}-\d{2}\.pdf$/;

/**
 * Keeps the newest offline pack in `folder` (#168): downloads it unless it is already here, to a temporary file renamed
 * once whole, so the folder never holds half a pack; then removes all but the newest seven.
 */
export async function syncPack(api: AgentApi, token: string, folder: string, send: typeof fetch = fetch): Promise<PackSync> {
  const link = await api.newestPack(token);
  if (link === null) return { noneYet: true };
  if ('refusal' in link) return link;
  if (!PACK_NAME.test(link.name)) return { refusal: 'unavailable' };
  await mkdir(folder, { recursive: true });
  const here = await readdir(folder);
  if (here.includes(link.name)) return { alreadyHere: link.name };
  const response = await send(link.url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) return { refusal: 'unavailable' };
  const part = join(folder, `${link.name}.part`);
  await writeFile(part, new Uint8Array(await response.arrayBuffer()));
  await rename(part, join(folder, link.name));
  const packs = [...here.filter((name) => PACK_NAME.test(name)), link.name].sort().reverse();
  await Promise.all(packs.slice(KEEP).map((name) => rm(join(folder, name), { force: true })));
  return { fetched: link.name };
}
