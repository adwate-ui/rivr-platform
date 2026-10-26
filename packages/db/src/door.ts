import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';

/**
 * What a scan at the door kiosk did (decision 0164): checked the member in, checked them out with the
 * seconds they played that visit, or `gone`, a scan just after their visit closed (at the cage, say),
 * which opens nothing again.
 */
export type DoorScan =
  | { readonly action: 'in'; readonly firstName: string }
  | { readonly action: 'out' | 'gone'; readonly firstName: string; readonly playedSeconds: number };

/**
 * Why a scan did nothing: not a door kiosk (or one revoked), a card code that is not current, a member on
 * a break, the member or the venue frozen, still seated, call time still owed, or anything else.
 */
export type DoorScanFailure = 'not_allowed' | 'card_not_current' | 'on_break' | 'stopped' | 'paused' | 'seated' | 'call_time_owed' | 'unavailable';

/** A refused scan: why, and the call time still owed in seconds (0 unless the reason is call_time_owed). */
export interface DoorScanRefusal {
  readonly reason: DoorScanFailure;
  readonly owedSeconds: number;
}

const FAILURE_BY_CODE: Readonly<Record<string, DoorScanFailure>> = {
  '42501': 'not_allowed', RVCRD: 'card_not_current', RVBRK: 'on_break', RVMBR: 'stopped', RVFRZ: 'paused', RVSTD: 'seated', RVCTS: 'call_time_owed',
};

interface ScanRow {
  action: string;
  first_name: string;
  played_seconds: number;
}

/** The database's answer to a scan. */
export function toDoorScan(row: ScanRow | undefined): DoorScan | null {
  if (row === undefined) return null;
  if (row.action === 'in') return { action: 'in', firstName: row.first_name };
  if (row.action === 'out' || row.action === 'gone') return { action: row.action, firstName: row.first_name, playedSeconds: row.played_seconds };
  return null;
}

/** On the signed-in door kiosk: scans the code read from a member's card, which checks them in, or out if they are in. */
export function useDoorScan() {
  const { client } = useRivrData();
  return useMutation({
    mutationFn: async (code: string): Promise<Result<DoorScan, DoorScanRefusal>> => {
      const { data, error } = await client.rpc('door_scan', { p_code: code.trim() });
      const scan = error ? null : toDoorScan(data[0]);
      if (scan !== null) return ok(scan);
      const reason = FAILURE_BY_CODE[error?.code ?? ''] ?? 'unavailable';
      return err({ reason, owedSeconds: reason === 'call_time_owed' ? Number.parseInt(error?.details ?? '', 10) || 0 : 0 });
    },
  });
}
