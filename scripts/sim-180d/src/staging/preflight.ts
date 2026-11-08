/** The staging preflight's own logic (design 3d): read only, no secret ever printed. */
import { createHash } from 'node:crypto';

/** The numbers in Auth's `sms_test_otp` ("919000000101=123457,…"), and how many take the expected code. */
export function testNumbers(smsTestOtp: string, expectedCode: string): { numbers: string[]; withCode: number } {
  const pairs = smsTestOtp.split(',').map((pair) => pair.trim()).filter((pair) => pair.includes('='));
  const numbers = pairs.map((pair) => pair.split('=')[0]?.trim() ?? '').filter((number) => /^91\d{10}$/.test(number));
  const withCode = pairs.filter((pair) => pair.split('=')[1]?.trim() === expectedCode).length;
  return { numbers, withCode };
}

/** Every ten-digit test number (9000000xxx) a flow file names. */
export function numbersNamed(source: string): string[] {
  return [...new Set([...source.matchAll(/\b9000000\d{3}\b/g)].map((match) => `91${match[0]}`))];
}

/** The digest `supabase secrets list` shows for a value: its SHA-256 in hex. */
export function digestOf(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface Check {
  check: string;
  ok: boolean;
  detail: string;
}

/** WHATSAPP_ALLOWLIST holds exactly the owner's number (decision 0297's format: +91 and ten digits). */
export function allowlistCheck(secrets: readonly { name: string; value: string }[], ownerNumber: string): Check {
  const secret = secrets.find((each) => each.name === 'WHATSAPP_ALLOWLIST');
  if (secret === undefined) return { check: 'allowlist', ok: false, detail: 'WHATSAPP_ALLOWLIST is not set (decision 0461): set it to the owner’s number for the walks' };
  const ok = secret.value === digestOf(ownerNumber);
  return { check: 'allowlist', ok, detail: ok ? 'holds the owner’s number only, by digest' : 'is set, but its digest is not the owner’s number alone' };
}
