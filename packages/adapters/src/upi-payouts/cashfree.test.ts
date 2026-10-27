import { idempotencyKeySchema, paiseSchema, upiVpaSchema } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { createCashfreePayouts, isVpaAnswer, transferIdOf } from './cashfree.ts';

const key = idempotencyKeySchema.parse('7240ba7e-ade2-456d-a638-80f81f7bd64c');
const request = {
  idempotencyKey: key, to: upiVpaSchema.parse('success@upi'), payeeName: "Rhea D'Souza", amount: paiseSchema.parse(123_450n), note: 'RIVR withdrawal #12',
};

async function makePublicKey() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-1' }, true, ['encrypt', 'decrypt'],
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  return `-----BEGIN PUBLIC KEY-----\n${btoa(String.fromCharCode(...spki))}\n-----END PUBLIC KEY-----`;
}

// One key for the file: making a 2,048-bit RSA key for every case is slow enough to time out on a busy runner.
let publicKeyMade: Promise<string> | undefined;
function publicKey(): Promise<string> {
  publicKeyMade ??= makePublicKey();
  return publicKeyMade;
}

/** Cashfree Payouts as its API reference documents it; each `METHOD path` answers in turn with the replies given. */
async function cashfree(replies: Record<string, { status?: number; body: unknown }[]>) {
  const sent: { route: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const route = `${init?.method ?? 'GET'} ${url.pathname}`;
    sent.push({ route, body: init?.body === undefined || init.body === null ? undefined : JSON.parse(String(init.body)) });
    const reply = replies[route]?.shift() ?? { status: 404, body: { code: 'transfer_id_not_found' } };
    return Response.json(reply.body, { status: reply.status ?? 200 });
  };
  const payouts = createCashfreePayouts({ clientId: 'CF1', clientSecret: 's', publicKey: await publicKey(), environment: 'sandbox', fetch });
  return { payouts, sent };
}

describe('Cashfree Payouts', () => {
  it('pays a new transfer by UPI in rupees, with only the characters Cashfree takes', async () => {
    const { payouts, sent } = await cashfree({ 'POST /payout/transfers': [{ body: { transfer_id: transferIdOf(key), status: 'RECEIVED' } }] });
    expect(await payouts.pay(request)).toEqual({ ok: true, value: { payoutId: 'rivr_7240ba7eade2456da63880f81f7bd64c', status: 'pending', utr: null } });
    expect(sent.map((call) => call.route)).toEqual(['GET /payout/transfers', 'POST /payout/transfers']);
    expect(sent[1]?.body).toEqual({
      transfer_id: 'rivr_7240ba7eade2456da63880f81f7bd64c', transfer_amount: 1234.5, transfer_currency: 'INR', transfer_mode: 'upi',
      beneficiary_details: { beneficiary_name: 'Rhea DSouza', beneficiary_instrument_details: { vpa: 'success@upi' } },
      transfer_remarks: 'RIVR withdrawal 12',
    });
  });

  it('never pays twice: a key Cashfree has seen returns its transfer, with the UTR once sent', async () => {
    const { payouts, sent } = await cashfree({
      'GET /payout/transfers': [{ body: { transfer_id: transferIdOf(key), status: 'SUCCESS', transfer_utr: '412345678901' } }],
    });
    expect(await payouts.pay(request)).toEqual({ ok: true, value: { payoutId: transferIdOf(key), status: 'sent', utr: '412345678901' } });
    expect(sent.map((call) => call.route)).toEqual(['GET /payout/transfers']);
  });

  it('sends nothing when it cannot tell whether the transfer went', async () => {
    const { payouts, sent } = await cashfree({ 'GET /payout/transfers': [{ status: 502, body: {} }] });
    expect(await payouts.pay(request)).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(sent.map((call) => call.route)).toEqual(['GET /payout/transfers']);
  });

  it('reads a repeated send as the earlier transfer, or as unknown, never as refused', async () => {
    const found = await cashfree({
      'GET /payout/transfers': [{ status: 404, body: { code: 'transfer_id_not_found' } }, { body: { transfer_id: transferIdOf(key), status: 'PENDING' } }],
      'POST /payout/transfers': [{ status: 409, body: { code: 'transfer_id_already_exists' } }],
    });
    expect(await found.payouts.pay(request)).toEqual({ ok: true, value: { payoutId: transferIdOf(key), status: 'pending', utr: null } });
    const notYet = await cashfree({ 'POST /payout/transfers': [{ status: 409, body: { code: 'transfer_id_already_exists' } }] });
    expect(await notYet.payouts.pay(request)).toEqual({ ok: false, error: { code: 'unavailable' } });
    const bare = await cashfree({ 'POST /payout/transfers': [{ status: 409, body: 'Conflict' }] });
    expect(await bare.payouts.pay(request)).toEqual({ ok: false, error: { code: 'unavailable' } });
  });

  it('sends nothing, and says it cannot tell, when the lookup is refused', async () => {
    const { payouts, sent } = await cashfree({ 'GET /payout/transfers': [{ status: 403, body: { code: 'ip_validation_failed' } }] });
    expect(await payouts.pay(request)).toEqual({ ok: false, error: { code: 'unavailable' } });
    expect(sent.map((call) => call.route)).toEqual(['GET /payout/transfers']);
  });

  it('refuses, before calling, an amount UPI does not pay and a key every caller could share', async () => {
    const { payouts, sent } = await cashfree({});
    for (const amount of [0n, 99n, 10_000_001n]) {
      expect(await payouts.pay({ ...request, amount: paiseSchema.parse(amount) })).toMatchObject({ ok: false, error: { code: 'rejected' } });
    }
    const nil = idempotencyKeySchema.parse('00000000-0000-0000-0000-000000000000');
    expect(await payouts.pay({ ...request, idempotencyKey: nil })).toMatchObject({ ok: false, error: { code: 'rejected' } });
    expect(sent).toEqual([]);
  });

  it('gives a key the same transfer id whatever its case', () => {
    expect(transferIdOf(idempotencyKeySchema.parse('7240BA7E-ADE2-456D-A638-80F81F7BD64C'))).toBe(transferIdOf(key));
  });

  it('reads Cashfree\'s states as sent, still on its way, or not paid', async () => {
    const states: Record<string, string> = {
      SUCCESS: 'sent', RECEIVED: 'pending', PENDING: 'pending', APPROVAL_PENDING: 'pending', QUEUED: 'pending',
      FAILED: 'failed', REJECTED: 'failed', REVERSED: 'failed', MANUALLY_REJECTED: 'failed',
    };
    for (const [cashfreeStatus, status] of Object.entries(states)) {
      const { payouts } = await cashfree({ 'GET /payout/transfers': [{ body: { transfer_id: 'rivr_x', status: cashfreeStatus } }] });
      expect(await payouts.getPayout({ payoutId: 'rivr_x' })).toMatchObject({ ok: true, value: { status } });
    }
  });

  it('names the holder behind a valid VPA, and refuses an invalid one', async () => {
    const valid = await cashfree({ 'POST /payout/validatePayout': [{ body: { account_status: 'VALID', name_at_bank: 'JOHN SNOW', vpa: 'success@upi' } }] });
    expect(await valid.payouts.verifyVpa({ vpa: upiVpaSchema.parse('success@upi') }))
      .toEqual({ ok: true, value: { accountHolderName: 'JOHN SNOW', bankName: '' } });
    const invalid = await cashfree({ 'POST /payout/validatePayout': [{ body: { account_status: 'INVALID', vpa: 'invalid@upi' } }] });
    expect(await invalid.payouts.verifyVpa({ vpa: upiVpaSchema.parse('invalid@upi') }))
      .toEqual({ ok: false, error: { code: 'rejected', reason: 'Cashfree VPA INVALID' } });
  });

  it('tells Cashfree\'s answer about an address from trouble asking', async () => {
    const invalid = await cashfree({ 'POST /payout/validatePayout': [{ body: { account_status: 'INVALID', vpa: 'invalid@upi' } }] });
    const answer = await invalid.payouts.verifyVpa({ vpa: upiVpaSchema.parse('invalid@upi') });
    expect(!answer.ok && isVpaAnswer(answer.error)).toBe(true);
    const wrongKey = await cashfree({ 'POST /payout/validatePayout': [{ status: 401, body: { code: 'authentication_failed' } }] });
    const trouble = await wrongKey.payouts.verifyVpa({ vpa: upiVpaSchema.parse('success@upi') });
    expect(trouble.ok).toBe(false);
    expect(!trouble.ok && isVpaAnswer(trouble.error)).toBe(false);
    const unreachable = await cashfree({ 'POST /payout/validatePayout': [{ body: { account_status: 'PENDING', vpa: 'success@upi' } }] });
    expect(await unreachable.payouts.verifyVpa({ vpa: upiVpaSchema.parse('success@upi') })).toEqual({ ok: false, error: { code: 'unavailable' } });
  });
});
