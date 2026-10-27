import { formatDate, formatTime, t } from '@rivr/i18n';
import type { ReactNode } from 'react';
import { DocumentPage, type Issuer } from '../DocumentPage/DocumentPage.tsx';
import { DocumentTable } from '../DocumentTable/DocumentTable.tsx';
import { cx } from '../internal/classes.ts';

/** Who to call when the system is down (#53): a contact's kind, as the incidents screen keeps it. */
export type OfflinePackContactKind = 'escalation' | 'vendor' | 'glaza' | 'police' | 'fire' | 'electricity';

/** One point of contact. */
export interface OfflinePackContact {
  readonly kind: OfflinePackContactKind;
  readonly name: string;
  readonly role: string | null;
  readonly phone: string;
  readonly note: string | null;
}

/** A seat taken at a table: the seat, the member's name and number. */
export interface OfflinePackSeat {
  readonly seat: number;
  readonly name: string;
  readonly memberNumber: string;
}

/** A table open tonight, its game and who sits where. */
export interface OfflinePackTable {
  readonly name: string;
  readonly game: string;
  readonly seats: readonly OfflinePackSeat[];
}

/** A place on the waitlist. */
export interface OfflinePackWaiting {
  readonly game: string;
  readonly place: number;
  readonly name: string;
  readonly memberNumber: string;
}

/** A member with money held or owed: what their wallet holds and what their markers owe, in paise. */
export interface OfflinePackBalance {
  readonly name: string;
  readonly memberNumber: string;
  readonly walletPaise: bigint;
  readonly markersPaise: bigint;
}

/** An SOP in force: its title, version, the day it took effect (`2026-11-01`) and its text. */
export interface OfflinePackSop {
  readonly title: string;
  readonly version: number;
  readonly inForceFrom: string;
  readonly body: string;
}

/**
 * Everything the floor and the cage need on paper when the system is down (#167; scope-v1 module 11), as the nightly
 * job gathers it from `private.offline_pack`: who to call, who holds money and owes it, the floor as it stood, and
 * every SOP in force. Amounts come worked out; nothing is worked out again here.
 */
export interface OfflinePack {
  readonly issuer: Issuer;
  readonly venueName: string;
  /** When the pack was made, as an ISO time. */
  readonly generatedAt: string;
  readonly contacts: readonly OfflinePackContact[];
  readonly balances: readonly OfflinePackBalance[];
  readonly walletsPaise: bigint;
  readonly markersPaise: bigint;
  readonly chipsInPlayPaise: bigint;
  /** Null when no cage shift was open as the pack was made. */
  readonly cageFloatPaise: bigint | null;
  readonly tables: readonly OfflinePackTable[];
  readonly waitlist: readonly OfflinePackWaiting[];
  readonly sops: readonly OfflinePackSop[];
}

/** One part of the pack; all but the first start a new page. */
function Section({ title, isNewPage = true, children }: { title: string; isNewPage?: boolean; children: ReactNode }) {
  return (
    <section className={cx('space-y-4', isNewPage && 'break-before-page')}>
      <h2 className="font-display text-24 leading-tight">{title}</h2>
      {children}
    </section>
  );
}

/** A line said in place of an empty list. */
function NoneLine({ text }: { text: string }) {
  return <p className="text-14">{text}</p>;
}

function Contacts({ contacts }: { contacts: readonly OfflinePackContact[] }) {
  if (contacts.length === 0) return <NoneLine text={t('documents.offlinePack.noContacts')} />;
  return (
    <DocumentTable caption={t('documents.offlinePack.contacts')}
      columns={[{ label: t('documents.offlinePack.who') }, { label: t('documents.offlinePack.kind') }, { label: t('documents.offlinePack.phone') }]}
      rows={contacts.map((contact) => [
        [contact.name, contact.role].filter((part) => part !== null).join(', ') + (contact.note === null ? '' : ` · ${contact.note}`),
        t(`documents.offlinePack.contactKind.${contact.kind}`), contact.phone,
      ])} />
  );
}

/** Each member's wallet and markers, with their totals, then the cage's float and the chips in play on their own. */
function Balances({ pack }: { pack: OfflinePack }) {
  return (
    <div className="space-y-8">
      {pack.balances.length === 0 ? <NoneLine text={t('documents.offlinePack.noBalances')} /> : (
        <DocumentTable caption={t('documents.offlinePack.balances')}
          columns={[{ label: t('documents.offlinePack.member') }, { label: t('documents.offlinePack.wallet'), isAmount: true },
            { label: t('documents.offlinePack.markers'), isAmount: true }]}
          rows={pack.balances.map((balance) => [`${balance.name} (${balance.memberNumber})`, balance.walletPaise, balance.markersPaise])}
          totals={[
            { label: t('documents.offlinePack.walletsTotal'), paise: pack.walletsPaise },
            { label: t('documents.offlinePack.markersTotal'), paise: pack.markersPaise },
          ]} />
      )}
      <DocumentTable caption={t('documents.offlinePack.cage')}
        columns={[{ label: t('documents.offlinePack.cage') }, { label: t('documents.offlinePack.amount'), isAmount: true }]}
        rows={[[t('documents.offlinePack.cageFloat'), pack.cageFloatPaise ?? t('documents.offlinePack.noShift')], [t('documents.offlinePack.chipsInPlay'), pack.chipsInPlayPaise]]} />
    </div>
  );
}

function Floor({ pack }: { pack: OfflinePack }) {
  return (
    <div className="space-y-6">
      {pack.tables.length === 0 ? <NoneLine text={t('documents.offlinePack.noTables')} /> : pack.tables.map((table) => (
        <div key={table.name} className="break-inside-avoid space-y-2">
          <h3 className="text-16 font-semibold">{t('documents.offlinePack.table', { table: table.name, game: table.game })}</h3>
          {table.seats.length === 0 ? <NoneLine text={t('documents.offlinePack.nobodySeated')} /> : (
            <DocumentTable caption={t('documents.offlinePack.seatsAt', { table: table.name })}
              columns={[{ label: t('documents.offlinePack.seat') }, { label: t('documents.offlinePack.member') }]}
              rows={table.seats.map((seat) => [String(seat.seat), `${seat.name} (${seat.memberNumber})`])} />
          )}
        </div>
      ))}
      <h3 className="text-16 font-semibold">{t('documents.offlinePack.waitlist')}</h3>
      {pack.waitlist.length === 0 ? <NoneLine text={t('documents.offlinePack.nobodyWaiting')} /> : (
        <DocumentTable caption={t('documents.offlinePack.waitlist')}
          columns={[{ label: t('documents.offlinePack.game') }, { label: t('documents.offlinePack.place') }, { label: t('documents.offlinePack.member') }]}
          rows={pack.waitlist.map((place) => [place.game, String(place.place), `${place.name} (${place.memberNumber})`])} />
      )}
    </div>
  );
}

function Sops({ sops }: { sops: readonly OfflinePackSop[] }) {
  if (sops.length === 0) return <NoneLine text={t('documents.offlinePack.noSops')} />;
  return (
    <div className="space-y-8">
      {sops.map((sop) => (
        <article key={sop.title} className="space-y-2">
          <h3 className="text-16 font-semibold">{sop.title}</h3>
          <p className="text-12">{t('documents.offlinePack.sopVersion', { version: sop.version, day: formatDate(new Date(`${sop.inForceFrom}T12:00:00+05:30`)) })}</p>
          <p className="whitespace-pre-line text-14">{sop.body}</p>
        </article>
      ))}
    </div>
  );
}

/**
 * The offline pack on A4 pages (#167; scope-v1 module 11), for the cage computer to print when the system is down:
 * the points of contact, open balances, the floor as it stood when the pack was made, and every SOP in force, each
 * from the top of a page. @rivr/render draws it to a PDF of as many pages as it needs. Its copy is the `documents`
 * namespace, which the caller registers.
 */
export function OfflinePackDocument({ pack }: { pack: OfflinePack }) {
  const made = new Date(pack.generatedAt);
  return (
    <DocumentPage issuer={pack.issuer} title={t('documents.offlinePack.title')} flow="pages" note={t('documents.offlinePack.note')}
      details={[
        { label: t('documents.offlinePack.venue'), value: pack.venueName },
        { label: t('documents.offlinePack.made'), value: `${formatDate(made)}, ${formatTime(made)}` },
      ]}>
      {/* Blocks, not a flex column: a section's page break only holds in block flow. */}
      <div className="space-y-10">
        <p className="text-16">{t('documents.offlinePack.intro')}</p>
        <Section title={t('documents.offlinePack.contacts')} isNewPage={false}><Contacts contacts={pack.contacts} /></Section>
        <Section title={t('documents.offlinePack.balances')}><Balances pack={pack} /></Section>
        <Section title={t('documents.offlinePack.floor')}><Floor pack={pack} /></Section>
        <Section title={t('documents.offlinePack.sops')}><Sops sops={pack.sops} /></Section>
      </div>
    </DocumentPage>
  );
}
