import { idempotencyKeySchema, paiseSchema, upiVpaSchema, utrSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createFakeUpiPayouts, createUnconfiguredUpiPayouts, type UpiPayoutRequest } from './index.ts';

const to = upiVpaSchema.parse('arjun.mehta@hdfcbank');

function request(amount: bigint, key = '00000000-0000-4000-8000-0000000000a1'): UpiPayoutRequest {
  return { idempotencyKey: idempotencyKeySchema.parse(key), to, payeeName: 'Arjun Mehta', amount: paiseSchema.parse(amount), note: 'RIVR withdrawal' };
}

describe('fake UPI payouts', () => {
  it('pays and returns a UTR', async () => {
    const payouts = createFakeUpiPayouts();

    const paid = await payouts.pay(request(10_000_000n));

    expect(paid.ok && paid.value.status).toBe('sent');
    expect(paid.ok && utrSchema.safeParse(paid.value.utr).success).toBe(true);
  });

  it('never pays twice for the same idempotency key', async () => {
    const payouts = createFakeUpiPayouts();

    const first = await payouts.pay(request(10_000_000n));
    const retry = await payouts.pay(request(10_000_000n));

    expect(retry).toEqual(first);
    expect(payouts.payouts).toHaveLength(1);
    expect(payouts.calls).toHaveLength(2);
  });

  it('refuses a payout of nothing or less', async () => {
    const payouts = createFakeUpiPayouts();

    expect(await payouts.pay(request(0n))).toEqual({ ok: false, error: { code: 'rejected', reason: 'amount must be positive' } });
    expect(payouts.payouts).toHaveLength(0);
  });

  it('looks up a payout and the account holder behind an address', async () => {
    const payouts = createFakeUpiPayouts({ accountHolderName: 'Arjun Mehta' });
    const paid = await payouts.pay(request(10_000_000n));
    if (!paid.ok) throw new Error('expected a payout');

    expect(await payouts.getPayout({ payoutId: paid.value.payoutId })).toEqual(paid);
    expect(await payouts.getPayout({ payoutId: 'missing' })).toMatchObject({ ok: false, error: { code: 'rejected' } });
    expect(await payouts.verifyVpa({ vpa: to })).toEqual({ ok: true, value: { accountHolderName: 'Arjun Mehta', bankName: 'HDFC Bank' } });
  });

  it('fails the next call when a test scripts it, without paying', async () => {
    const payouts = createFakeUpiPayouts();
    payouts.failNext({ code: 'unavailable' });

    expect(await payouts.pay(request(10_000_000n))).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(payouts.payouts).toHaveLength(0);
  });
});

describe('unconfigured UPI payouts', () => {
  it('fails closed, so the cage pays by hand and enters the UTR', async () => {
    const payouts = createUnconfiguredUpiPayouts();
    const notConfigured = { ok: false, error: { code: 'not_configured' } };

    expect(await payouts.pay(request(10_000_000n))).toEqual(notConfigured);
    expect(await payouts.getPayout({ payoutId: 'x' })).toEqual(notConfigured);
    expect(await payouts.verifyVpa({ vpa: to })).toEqual(notConfigured);
  });
});
