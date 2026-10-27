import { err, ok, utrSchema, type IdempotencyKey, type Paise, type Result } from '@rivr/contracts';
import { z } from 'zod';
import { createCashfreeClient, parsed, type CashfreeClient, type CashfreeOptions } from '../shared/cashfree.ts';
import type { AdapterFailure } from '../shared/failure.ts';
import type { UpiPayout, UpiPayoutAdapter, UpiPayoutStatus } from './types.ts';

// Cashfree Payouts v2 (#475; decision 0197): the same account and keys as KYC.
const API_VERSION = '2024-01-01';

const transferSchema = z.object({
  transfer_id: z.string(),
  status: z.string(),
  transfer_utr: z.string().nullish(),
});

const validationSchema = z.object({
  account_status: z.string(),
  name_at_bank: z.string().nullish(),
  ifsc_details: z.object({ bank: z.string().nullish() }).nullish(),
});

// Cashfree's transfer states (Payouts v2): done, still on its way, or not paid (refused, failed or reversed).
const SENT = new Set(['SUCCESS']);
const FAILED = new Set(['FAILED', 'REJECTED', 'REVERSED', 'MANUALLY_REJECTED']);

function statusOf(cashfree: string): UpiPayoutStatus {
  if (SENT.has(cashfree)) return 'sent';
  return FAILED.has(cashfree) ? 'failed' : 'pending';
}

function payoutOf(transfer: z.infer<typeof transferSchema>): UpiPayout {
  const utr = utrSchema.safeParse(transfer.transfer_utr ?? '');
  return { payoutId: transfer.transfer_id, status: statusOf(transfer.status), utr: utr.success ? utr.data : null };
}

/** Our idempotency key as Cashfree's transfer id: up to 40 letters, digits and underscores, the same every time. */
export const transferIdOf = (key: IdempotencyKey) => `rivr_${key.toLowerCase().replaceAll('-', '')}`;

// A key every buggy caller could share would fold different payouts into one.
const SHARED_KEYS = new Set(['rivr_00000000000000000000000000000000', 'rivr_ffffffffffffffffffffffffffffffff']);

// UPI pays from ₹1 to ₹1,00,000 at a time.
const MIN_PAISE = 100n;
const MAX_PAISE = 10_000_000n;

/** Paise as the rupees Cashfree takes, `1234.50`. */
const rupeesOf = (amount: Paise) => Number(`${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`);

/** Only what Cashfree accepts in a field: letters and spaces for a name, letters, digits and spaces for remarks. */
const keep = (text: string, allowed: RegExp, length: number) =>
  text.replace(/\s+/g, ' ').replace(allowed, '').replace(/ +/g, ' ').trim().slice(0, length).trim();

async function readTransfer(client: CashfreeClient, transferId: string): Promise<Result<UpiPayout, AdapterFailure>> {
  const reply = parsed(transferSchema, await client.request({
    method: 'GET', path: `/payout/transfers?transfer_id=${encodeURIComponent(transferId)}`, apiVersion: API_VERSION,
  }));
  return reply.ok ? ok(payoutOf(reply.value)) : reply;
}

const isUnknown = (failure: AdapterFailure) => failure.code === 'rejected' && failure.reason === 'Cashfree transfer_id_not_found';
// A repeated transfer id, by Cashfree's code, or a bare 409 (a conflict it did not explain).
const isDuplicate = (failure: AdapterFailure) => failure.code === 'rejected' && /duplicate|already|exists|HTTP 409/i.test(failure.reason);
const UNAVAILABLE: AdapterFailure = { code: 'unavailable' };

/** Whether a payout may be sent at all: one transfer id of its own, and an amount UPI pays. */
function refusalOf(transferId: string, amount: Paise): AdapterFailure | null {
  if (SHARED_KEYS.has(transferId)) return { code: 'rejected', reason: 'idempotency key shared by every caller' };
  if (amount < MIN_PAISE || amount > MAX_PAISE) return { code: 'rejected', reason: 'amount outside UPI limits (₹1 to ₹1,00,000)' };
  return null;
}

/**
 * UPI payouts on Cashfree Payouts (#475; decision 0197). A payout is idempotent on our key: the transfer is
 * looked up first and sent only when Cashfree has never seen it, so a retry after a timeout or a server error
 * returns the first transfer and never pays twice. The sandbox pays only Cashfree's test VPAs (`success@upi`).
 */
const VPA_ANSWER = 'Cashfree VPA ';

/**
 * Whether a refused VPA check is Cashfree's own answer about the address (it knows no such VPA, or not a valid one),
 * not trouble asking: a wrong or rotated key, or a bad request, says nothing about the address (#503).
 */
export const isVpaAnswer = (failure: AdapterFailure): boolean => failure.code === 'rejected' && failure.reason.startsWith(VPA_ANSWER);

export function createCashfreePayouts(options: CashfreeOptions): UpiPayoutAdapter {
  const client = createCashfreeClient(options);
  return {
    async pay(request) {
      const transferId = transferIdOf(request.idempotencyKey);
      const refusal = refusalOf(transferId, request.amount);
      if (refusal !== null) return err(refusal);
      const existing = await readTransfer(client, transferId);
      if (existing.ok) return existing;
      // Unless Cashfree says it has never seen the transfer, it may have gone: send nothing, and say so.
      if (!isUnknown(existing.error)) return existing.error.code === 'rate_limited' ? existing : err(UNAVAILABLE);
      const sent = parsed(transferSchema, await client.request({
        method: 'POST', path: '/payout/transfers', apiVersion: API_VERSION,
        json: {
          transfer_id: transferId, transfer_amount: rupeesOf(request.amount), transfer_currency: 'INR', transfer_mode: 'upi',
          beneficiary_details: {
            beneficiary_name: keep(request.payeeName, /[^A-Za-z ]/g, 100) || 'RIVR member',
            beneficiary_instrument_details: { vpa: request.to },
          },
          ...(keep(request.note, /[^A-Za-z0-9 ]/g, 70) === '' ? {} : { transfer_remarks: keep(request.note, /[^A-Za-z0-9 ]/g, 70) }),
        },
      }));
      if (sent.ok) return ok(payoutOf(sent.value));
      // A repeated id means an earlier send went: read it back, or say it cannot be told yet, never that it was refused.
      if (!isDuplicate(sent.error)) return sent;
      const again = await readTransfer(client, transferId);
      return again.ok ? again : err(UNAVAILABLE);
    },
    getPayout: ({ payoutId }) => readTransfer(client, payoutId),
    async verifyVpa({ vpa }) {
      const reply = parsed(validationSchema, await client.request({
        method: 'POST', path: '/payout/validatePayout', apiVersion: API_VERSION,
        json: { transfer_id: `rivrvpa_${crypto.randomUUID().replaceAll('-', '')}`, vpa },
      }));
      if (!reply.ok) return reply;
      if (reply.value.account_status !== 'VALID') return err({ code: 'rejected', reason: `${VPA_ANSWER}${reply.value.account_status}` });
      return ok({ accountHolderName: reply.value.name_at_bank ?? '', bankName: reply.value.ifsc_details?.bank ?? '' });
    },
  };
}
