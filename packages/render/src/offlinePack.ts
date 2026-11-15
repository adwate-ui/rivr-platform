import type { OfflinePackRow } from '@rivr/contracts';
import { tokens } from '@rivr/tokens';
import type { OfflinePack } from '@rivr/ui';
import { renderToPdf } from './render.ts';

export type { OfflinePackRow } from '@rivr/contracts';
export type { OfflinePack } from '@rivr/ui';

/** A venue's offline pack from its row. */
export function offlinePackFromRow(row: OfflinePackRow): OfflinePack {
  return {
    // A venue with no configuration yet is headed by its name alone.
    issuer: row.issuer === null
      ? { legalName: row.venue_name, address: '' }
      : { legalName: row.issuer.legal_name, address: row.issuer.address, gstin: row.issuer.gstin ?? undefined },
    venueName: row.venue_name,
    generatedAt: row.generated_at,
    contacts: row.contacts,
    tables: row.tables.map((table) => ({
      name: table.name, game: table.game, seats: table.seats.map((seat) => ({ seat: seat.seat, name: seat.name, memberNumber: seat.member_number })),
    })),
    waitlist: row.waitlist.map((place) => ({ table: place.table, game: place.game, place: place.place, name: place.name, memberNumber: place.member_number })),
  };
}

/** The offline pack as a PDF of as many A4 pages as it needs, drawn by `@rivr/ui`'s OfflinePackDocument (#167). */
export function renderOfflinePackPdf(pack: OfflinePack): Promise<Buffer> {
  return renderToPdf({ template: 'document.offlinePack', props: { pack }, ...tokens.viewport.a4, pages: 'all' });
}
