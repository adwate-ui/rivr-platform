import { err, ok, type Result } from '@rivr/contracts/result';
import type { Paise } from '@rivr/domain/money';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';

// Kept here, not in queryKeys: this module is its own subpath (@rivr/db/tds), off the player's first load.
const keys = {
  tdsLedger: (userId: string, venueId: string, from: string, to: string) => ['user', userId, 'tds-ledger', venueId, from, to] as const,
  myTdsCertificates: (userId: string) => ['user', userId, 'my-tds-certificates'] as const,
};

/** One member's TDS over a period (#93): the payments that recorded it (cash-outs, tournament prizes and bounties, #477), what they paid, withheld, and shadow while switched off. */
export interface TdsLedgerRow {
  readonly memberId: string;
  readonly fullName: string;
  readonly memberNumber: number;
  /** The PAN's last four characters, or null without one. */
  readonly panLast4: string | null;
  readonly payments: number;
  readonly paid: Paise;
  readonly withheld: Paise;
  readonly shadow: Paise;
}

/** One deduction in a quarter's return extract, with the member's full PAN (`PANNOTAVBL` without one). */
export interface TdsDeduction {
  readonly deductedAt: string;
  readonly fullName: string;
  readonly pan: string;
  readonly section: string;
  /** The winnings this deduction was taxed on: the return's amount paid or credited (question #455). */
  readonly taxedWinnings: Paise;
  readonly rateBasisPoints: number;
  readonly tds: Paise;
}

/** A member's TDS certificate data (#93): what one venue withheld from them in a quarter, under a section. */
export interface TdsCertificate {
  readonly venueId: string;
  readonly legalName: string;
  /** The venue's TAN, or null while it has none in its configuration. */
  readonly tan: string | null;
  /** The quarter's first day, `2026-10-01`. */
  readonly quarterStart: string;
  readonly section: string;
  readonly panLast4: string | null;
  readonly payments: number;
  readonly paid: Paise;
  readonly tds: Paise;
}

/** Why the return extract was refused: the role exports no tables, not a quarter's first day or the practice venue, or anything else. */
export type TdsExtractFailure = 'not_allowed' | 'invalid' | 'unavailable';

const FAILURE_BY_CODE: Readonly<Record<string, TdsExtractFailure>> = { '42501': 'not_allowed', '22023': 'invalid' };

/** The withholding ledger from the first India day to the last, both included (`2026-10-01`), for ledger readers. */
export function useTdsLedger(venueId: string, from: string, to: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.tdsLedger(userId ?? 'signed-out', venueId, from, to),
    enabled: userId !== null,
    queryFn: async (): Promise<TdsLedgerRow[]> => {
      const { data, error } = await client.rpc('tds_ledger', { p_venue_id: venueId, p_from: from, p_to: to });
      if (error) throw error;
      return data.map((row) => ({
        memberId: row.member_id, fullName: row.full_name, memberNumber: row.member_number, panLast4: row.pan_last4, payments: row.payments,
        paid: toPaise(row.paid_paise), withheld: toPaise(row.withheld_paise), shadow: toPaise(row.shadow_paise),
      }));
    },
  });
}

/** Takes a quarter's return extract (audited each time), a Result with its deductions. */
export function useTdsReturnExtract(venueId: string) {
  const { client } = useRivrData();
  return useMutation({
    mutationFn: async (quarterStart: string): Promise<Result<TdsDeduction[], TdsExtractFailure>> => {
      const { data, error } = await client.rpc('tds_return_extract', { p_venue_id: venueId, p_quarter_start: quarterStart });
      if (error) return err(FAILURE_BY_CODE[error.code] ?? 'unavailable');
      return ok(data.map((row) => ({
        deductedAt: row.deducted_at, fullName: row.full_name, pan: row.pan, section: row.section, taxedWinnings: toPaise(row.taxed_winnings_paise),
        rateBasisPoints: row.rate_basis_points, tds: toPaise(row.tds_paise),
      })));
    },
  });
}

/** The signed-in member's TDS certificate data, newest quarter first; empty when nothing was withheld. */
export function useMyTdsCertificates() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: keys.myTdsCertificates(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<TdsCertificate[]> => {
      const { data, error } = await client.rpc('my_tds_certificates');
      if (error) throw error;
      return data.map((row) => ({
        venueId: row.venue_id, legalName: row.legal_name, tan: row.tan, quarterStart: row.quarter_start, section: row.section, panLast4: row.pan_last4,
        payments: row.payments, paid: toPaise(row.paid_paise), tds: toPaise(row.tds_paise),
      }));
    },
  });
}
