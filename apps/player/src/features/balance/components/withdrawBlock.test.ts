import type { Wallet, Withdrawal } from '@rivr/db';
import { fromPaise } from '@rivr/domain/money';
import { t } from '@rivr/i18n';
import { describe, expect, it } from 'vitest';
import { withdrawBlock } from './withdrawBlock.ts';

const NOW = new Date('2026-11-20T12:00:00Z');
const marker = (dueAt: string): Wallet['markers'][number] => ({ markerId: 'm1', outstanding: fromPaise(5_000_000n), issuedAt: '2026-10-06T12:00:00Z', dueAt });
const waiting: Withdrawal = {
  withdrawalId: 'w1', amount: fromPaise(10_000_000n), status: 'waiting', utr: null, declineReason: null, requestedAt: '2026-11-20T10:00:00Z',
  decidedAt: null, kind: 'upi', bankName: 'HDFC Bank',
};

describe('what blocks Withdraw before anything is typed (#55)', () => {
  it('is a marker past due', () => {
    expect(withdrawBlock([marker('2026-11-05T12:00:00Z')], [], NOW)).toBe('player.balance.withdrawMarkerPastDue');
    expect(t('player.balance.withdrawMarkerPastDue')).toBe('Marker overdue. Settle it before withdrawing.');
  });

  it('or a withdrawal already waiting for the cage, said first', () => {
    expect(withdrawBlock([marker('2026-11-05T12:00:00Z')], [waiting], NOW)).toBe('player.balance.withdrawAlreadyWaiting');
    expect(t('player.balance.withdrawAlreadyWaiting')).toBe('One withdrawal is already pending. Wait for the cage to send it.');
  });

  it('is nothing for a marker not yet due, nor one due this very moment, nor a withdrawal already decided', () => {
    expect(withdrawBlock([marker('2026-12-05T12:00:00Z'), marker('2026-11-20T12:00:00Z')], [{ ...waiting, status: 'sent', utr: '412908771204' }], NOW))
      .toBeNull();
  });
});
