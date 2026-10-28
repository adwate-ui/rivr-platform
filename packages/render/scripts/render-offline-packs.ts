/**
 * The nightly offline pack (#168; decision 0260). For every venue that is not the practice venue: reads
 * `public.offline_pack` as the service role, draws it as a PDF of A4 pages, keeps it in the private bucket
 * `offline-packs` as `<venue>/<IST date>.pdf`, and removes all but that venue's newest seven. The cage agent fetches
 * the newest each night. Run by .github/workflows/offline-pack.yml with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY;
 * `pnpm --filter @rivr/render render:offline-packs` against a local stack. Plain fetch: only @rivr/db speaks Supabase's
 * client. In the same run, as the owner chose (question #589), it draws the winner cards won since the last night's run
 * (#155; decision 0273) into the private bucket winner-cards, and removes the images no card names any more.
 */
import { execFileSync } from 'node:child_process';
import { offlinePackRowSchema, offlinePackVenuesSchema, storedPacksSchema, winnerCardImagesSchema, winnerCardRowsSchema } from '@rivr/contracts';
import buildRenderHost from '../vitest.global-setup.ts';
import { offlinePackFromRow, renderOfflinePackPdf } from '../src/offlinePack.ts';
import { drawWinnerCard } from '../src/winnerCards.ts';

const KEEP = 7;
const url = process.env.SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (url === '' || key === '') throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
const AS_SERVER = { apikey: key, authorization: `Bearer ${key}` };

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  const answer = await fetch(`${url}${path}`, { ...init, headers: { ...AS_SERVER, ...init.headers } });
  if (!answer.ok) throw new Error(`${path} failed (${String(answer.status)}): ${await answer.text()}`);
  return answer.status === 204 ? null : await answer.json();
}

/** Today in India, as a pack's name: `2026-11-15`. */
function istDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

async function packVenue(venueId: string): Promise<void> {
  const row = offlinePackRowSchema.parse(await call('/rest/v1/rpc/offline_pack', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ p_venue_id: venueId }),
  }));
  const pdf = await renderOfflinePackPdf(offlinePackFromRow(row));
  await call(`/storage/v1/object/offline-packs/${venueId}/${istDate()}.pdf`, {
    method: 'POST', headers: { 'content-type': 'application/pdf', 'x-upsert': 'true' }, body: new Uint8Array(pdf),
  });
  const kept = storedPacksSchema.parse(await call('/storage/v1/object/list/offline-packs', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prefix: `${venueId}/`, limit: 100, sortBy: { column: 'name', order: 'desc' } }),
  }));
  const old = kept.slice(KEEP).map((object) => `${venueId}/${object.name}`);
  if (old.length > 0) {
    await call('/storage/v1/object/offline-packs', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: old }) });
  }
  process.stdout.write(`Offline pack for ${row.venue_name}: ${String(pdf.length)} bytes; ${String(old.length)} old removed.\n`);
}

// Always from the current stylesheet, as the brand kit is drawn.
execFileSync('pnpm', ['--filter', '@rivr/ui', 'build'], { stdio: 'inherit' });
await buildRenderHost();
const venues = offlinePackVenuesSchema.parse(await call('/rest/v1/rpc/offline_pack_venues', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
for (const venue of venues) await packVenue(venue.venue_id);

/** Draws each winner card not yet drawn, and removes the images no card names any more (an erased member's). */
async function drawWinnerCards(): Promise<void> {
  const json = { 'content-type': 'application/json' };
  const cards = winnerCardRowsSchema.parse(await call('/rest/v1/rpc/winner_cards_to_draw', { method: 'POST', headers: json, body: '{}' }));
  for (const card of cards) {
    await call(`/storage/v1/object/winner-cards/${card.venue_id}/${card.card_id}.png`, {
      method: 'POST', headers: { 'content-type': 'image/png', 'x-upsert': 'true' }, body: await drawWinnerCard(card),
    });
    await call('/rest/v1/rpc/record_winner_card_image', { method: 'POST', headers: json, body: JSON.stringify({ p_card_id: card.card_id }) });
  }
  const gone = winnerCardImagesSchema.parse(await call('/rest/v1/rpc/winner_card_images_to_remove', { method: 'POST', headers: json, body: '{}' }));
  if (gone.length > 0) {
    await call('/storage/v1/object/winner-cards', { method: 'DELETE', headers: json, body: JSON.stringify({ prefixes: gone.map((image) => image.name) }) });
  }
  process.stdout.write(`Winner cards: ${String(cards.length)} drawn; ${String(gone.length)} old removed.\n`);
}

await drawWinnerCards();
