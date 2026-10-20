import type { Paise } from '@rivr/domain/money';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { RivrClient } from './client.ts';
import { toPaise } from './parse/hands.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A bonus grant still in force (#17): what is left of it, and when it ends. */
export interface WalletBonus {
  readonly grantId: string;
  readonly remaining: Paise;
  readonly expiresAt: string;
}

/** One of the member's open markers (#74): what it still owes, when it was issued and when it falls due. */
export interface WalletMarker {
  readonly markerId: string;
  readonly outstanding: Paise;
  readonly issuedAt: string;
  readonly dueAt: string;
}

/** The signed-in member's Balance (#18): wallet cash, bonus in force, points, open markers and credit limit (null with none). */
export interface Wallet {
  readonly cash: Paise;
  readonly points: bigint;
  readonly bonus: readonly WalletBonus[];
  readonly markers: readonly WalletMarker[];
  readonly creditLimit: Paise | null;
}

/** The member's grants in force, soonest to end first, and open markers, oldest first. */
async function grantsAndMarkers(client: RivrClient, memberId: string) {
  const [grants, markers] = await Promise.all([
    client.from('bonus_grant').select('id, remaining_paise, expires_at').eq('member_id', memberId).is('expired_at', null)
      .gt('expires_at', new Date().toISOString()).gt('remaining_paise', 0).order('expires_at'),
    client.from('marker').select('id, outstanding_paise, issued_at, due_at').eq('member_id', memberId).is('settled_at', null).order('issued_at'),
  ]);
  if (grants.error) throw grants.error;
  if (markers.error) throw markers.error;
  return {
    bonus: grants.data.map((row) => ({ grantId: row.id, remaining: toPaise(row.remaining_paise), expiresAt: row.expires_at })),
    markers: markers.data.map((row) => ({
      markerId: row.id, outstanding: toPaise(row.outstanding_paise), issuedAt: row.issued_at, dueAt: row.due_at,
    })),
  };
}

/** The signed-in member's Balance; null for someone signed in who is not a member. */
export function useWallet() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.wallet(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<Wallet | null> => {
      const { data, error } = await client.rpc('my_wallet');
      if (error) throw error;
      const row = data[0];
      if (row === undefined) return null;
      const held = await grantsAndMarkers(client, row.member_id);
      return {
        cash: toPaise(row.cash_paise), points: BigInt(row.points), ...held,
        creditLimit: row.credit_limit_paise === null ? null : toPaise(row.credit_limit_paise),
      };
    },
  });
}

/** What a movement was, by its ledger transaction's kind; any other kind is `other`. */
export const MOVEMENT_KINDS = ['buy_in', 'cash_out', 'marker', 'bonus', 'bonus_expiry', 'reversal', 'opening_balance', 'other'] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

/** Which of the member's money accounts moved: wallet cash, bonus, or what they owe on markers (points history is Rewards', decision 0062). */
export const MOVEMENT_ACCOUNTS = ['cash', 'bonus', 'receivable'] as const;
export type MovementAccount = (typeof MOVEMENT_ACCOUNTS)[number];

/**
 * One money line on the member's accounts: when, what, which account, and by how much as the member sees it
 * (positive is more cash or bonus, or more owed on markers), in paise. With the table it happened at, or a bonus's reason.
 */
export interface Movement {
  readonly id: string;
  readonly at: string;
  readonly kind: MovementKind;
  readonly account: MovementAccount;
  readonly amount: Paise;
  readonly tableName: string | null;
  readonly bonusReason: string | null;
}

interface MovementRow {
  id: number | null;
  at: string | null;
  kind: string | null;
  account: string | null;
  amount: number | null;
  table_name: string | null;
  bonus_reason: string | null;
}

function movementOf(row: MovementRow): Movement | null {
  const account = MOVEMENT_ACCOUNTS.find((known) => known === row.account);
  if (row.id === null || row.at === null || row.amount === null || account === undefined) return null;
  return {
    id: String(row.id), at: row.at, kind: MOVEMENT_KINDS.find((known) => known === row.kind) ?? 'other', account, amount: toPaise(row.amount),
    tableName: row.table_name, bonusReason: row.bonus_reason,
  };
}

/** The member's newest `count` movements, newest first, and whether there are earlier ones. */
export function useWalletMovements(count: number) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.walletMovements(userId ?? 'signed-out', count),
    enabled: userId !== null,
    // Showing earlier movements keeps the ones already shown while the longer list loads.
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ movements: Movement[]; hasEarlier: boolean }> => {
      const { data, error } = await client.from('my_wallet_movement').select('*')
        .order('at', { ascending: false }).order('id', { ascending: false }).limit(count + 1);
      if (error) throw error;
      const movements = data.slice(0, count).map(movementOf).filter((movement) => movement !== null);
      return { movements, hasEarlier: data.length > count };
    },
  });
}
