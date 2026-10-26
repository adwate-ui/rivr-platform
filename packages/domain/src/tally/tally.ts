import { err, ok, type Result } from '@rivr/contracts/result';
import { fromPaise, type Paise } from '../money/index.ts';

/** One transaction kind's money posted to one account code on a club day, as private.tally_day gives it; debits positive. */
export interface TallyPosting {
  readonly kind: string;
  readonly accountCode: string;
  /** The Tally ledger the code is mapped to, or null while it is not. */
  readonly tallyLedger: string | null;
  readonly amount: Paise;
}

/** One line of a voucher: a Tally ledger and the net amount posted to it, debits positive. */
export interface TallyLine {
  readonly ledger: string;
  readonly amount: Paise;
}

/** One journal voucher: a day's transactions of one kind, by Tally ledger. */
export interface TallyVoucher {
  readonly number: string;
  readonly kind: string;
  readonly lines: readonly TallyLine[];
}

/** Why a day's file cannot be made: account codes posted to that day that map to no Tally ledger. */
export interface TallyUnmapped {
  readonly unmapped: readonly string[];
}

/** Debits first, the larger first, then by ledger, so the same day always gives the same file. */
function byDebitThenLedger(a: TallyLine, b: TallyLine): number {
  if (a.amount !== b.amount) return a.amount > b.amount ? -1 : 1;
  return a.ledger < b.ledger ? -1 : 1;
}

/** One kind's postings summed by Tally ledger; a ledger that nets to nothing is left out. */
function linesFor(postings: readonly TallyPosting[], ledgerOf: (posting: TallyPosting) => string): TallyLine[] {
  const totals = new Map<string, bigint>();
  for (const posting of postings) totals.set(ledgerOf(posting), (totals.get(ledgerOf(posting)) ?? 0n) + posting.amount);
  return [...totals].filter(([, amount]) => amount !== 0n).map(([ledger, amount]) => ({ ledger, amount: fromPaise(amount) })).sort(byDebitThenLedger);
}

/**
 * A club day's journal vouchers for Tally (#96, decision 0187): one voucher per transaction kind, in the
 * order of the kinds' names, each kind's postings summed by Tally ledger. Codes that map to one ledger
 * net together, and a ledger that nets to nothing is left out, as is a kind with no lines left. Numbered
 * `RIVR-<day>-<n>` from 1. Refused, with the codes, while any code posted that day maps to no ledger.
 */
export function tallyVouchers(day: string, postings: readonly TallyPosting[]): Result<TallyVoucher[], TallyUnmapped> {
  const unmapped = [...new Set(postings.filter((posting) => posting.tallyLedger === null).map((posting) => posting.accountCode))].sort();
  if (unmapped.length > 0) return err({ unmapped });
  const kinds = [...new Set(postings.map((posting) => posting.kind))].sort();
  const vouchers = kinds
    .map((kind) => ({ kind, lines: linesFor(postings.filter((posting) => posting.kind === kind), (posting) => posting.tallyLedger ?? '') }))
    .filter((voucher) => voucher.lines.length > 0);
  return ok(vouchers.map((voucher, index) => ({ number: `RIVR-${day.replaceAll('-', '')}-${index + 1}`, ...voucher })));
}

const XML_ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const escapeXml = (text: string) => text.replace(/[&<>"']/g, (character) => XML_ESCAPES[character] ?? character);

/** Rupees with two decimals and no grouping, as Tally reads an amount: 1234550 paise is `12345.50`. */
function rupees(paise: bigint): string {
  const sign = paise < 0n ? '-' : '';
  const whole = paise < 0n ? -paise : paise;
  return `${sign}${whole / 100n}.${String(whole % 100n).padStart(2, '0')}`;
}

/** A voucher line in Tally's terms: a debit is "deemed positive" and its amount negative; a credit the reverse. */
function ledgerEntry(line: TallyLine): string {
  return [
    '<ALLLEDGERENTRIES.LIST>',
    `<LEDGERNAME>${escapeXml(line.ledger)}</LEDGERNAME>`,
    `<ISDEEMEDPOSITIVE>${line.amount > 0n ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>`,
    `<AMOUNT>${rupees(-line.amount)}</AMOUNT>`,
    '</ALLLEDGERENTRIES.LIST>',
  ].join('');
}

/**
 * A club day's vouchers as a file Tally imports (Import Data, Vouchers): each a journal dated the club
 * day, narrated with its kind, into whichever company is open in Tally. Lines end in CRLF.
 */
export function tallyImportXml(day: string, vouchers: readonly TallyVoucher[]): string {
  const date = day.replaceAll('-', '');
  const messages = vouchers.map((voucher) => [
    '<TALLYMESSAGE xmlns:UDF="TallyUDF">',
    '<VOUCHER VCHTYPE="Journal" ACTION="Create">',
    `<DATE>${date}</DATE>`,
    '<VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>',
    `<VOUCHERNUMBER>${voucher.number}</VOUCHERNUMBER>`,
    `<NARRATION>${escapeXml(`RIVR ${voucher.kind}, club day ${day}`)}</NARRATION>`,
    ...voucher.lines.map(ledgerEntry),
    '</VOUCHER>',
    '</TALLYMESSAGE>',
  ].join('\r\n'));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ENVELOPE>',
    '<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>',
    '<BODY><IMPORTDATA>',
    '<REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>',
    '<REQUESTDATA>',
    ...messages,
    '</REQUESTDATA>',
    '</IMPORTDATA></BODY>',
    '</ENVELOPE>',
    '',
  ].join('\r\n');
}
