import type { OfflinePackRow } from '@rivr/contracts';
import { tokens } from '@rivr/tokens';
import type { OfflinePack } from '@rivr/ui';
import { renderToPdf } from './render.ts';

export type { OfflinePackRow } from '@rivr/contracts';
export type { OfflinePack } from '@rivr/ui';

/** A venue's offline pack from its row, each amount the row's paise as a bigint. */
export function offlinePackFromRow(row: OfflinePackRow): OfflinePack {
  return {
    // A venue with no configuration yet is headed by its name alone.
    issuer: row.issuer === null
      ? { legalName: row.venue_name, address: '' }
      : { legalName: row.issuer.legal_name, address: row.issuer.address, gstin: row.issuer.gstin ?? undefined },
    venueName: row.venue_name,
    generatedAt: row.generated_at,
    contacts: row.contacts,
    balances: row.balances.map((balance) => ({
      name: balance.name, memberNumber: balance.member_number, walletPaise: BigInt(balance.wallet_paise), markersPaise: BigInt(balance.markers_paise),
    })),
    walletsPaise: BigInt(row.wallets_paise),
    markersPaise: BigInt(row.markers_paise),
    chipsInPlayPaise: BigInt(row.chips_in_play_paise),
    cageFloatPaise: BigInt(row.cage_float_paise),
    tables: row.tables.map((table) => ({
      name: table.name, game: table.game, seats: table.seats.map((seat) => ({ seat: seat.seat, name: seat.name, memberNumber: seat.member_number })),
    })),
    waitlist: row.waitlist.map((place) => ({ game: place.game, place: place.place, name: place.name, memberNumber: place.member_number })),
    sops: row.sops.map((sop) => ({ title: sop.title, version: sop.version, inForceFrom: sop.in_force_from, body: sop.body })),
  };
}

/** The offline pack as a PDF of as many A4 pages as it needs, drawn by `@rivr/ui`'s OfflinePackDocument (#167). */
export function renderOfflinePackPdf(pack: OfflinePack): Promise<Buffer> {
  return renderToPdf({ template: 'document.offlinePack', props: { pack }, ...tokens.viewport.a4, pages: 'all' });
}
