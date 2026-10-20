import { z } from 'zod';

// name@handle: letters, digits, dots, hyphens and underscores before the @, a bank or app handle after it.
const UPI_VPA = /^[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9]{1,63}$/;
const UTR = /^\d{12}$/;

/** A UPI address in lower case, `arjun.mehta@hdfcbank`. */
export const upiVpaSchema = z.string().trim().toLowerCase().regex(UPI_VPA).brand<'UpiVpa'>();
/** A UPI address. */
export type UpiVpa = z.infer<typeof upiVpaSchema>;

/** The twelve-digit bank reference of a UPI or bank transfer, `412908771204`. */
export const utrSchema = z.string().trim().regex(UTR).brand<'Utr'>();
/** A UTR. */
export type Utr = z.infer<typeof utrSchema>;

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER = /^\d{9,18}$/;

/** A bank branch's IFSC in capitals: four letters, a zero, six letters or digits, `HDFC0001234`. */
export const ifscSchema = z.string().trim().toUpperCase().regex(IFSC).brand<'Ifsc'>();
/** An IFSC. */
export type Ifsc = z.infer<typeof ifscSchema>;

/** A bank account number: 9 to 18 digits. */
export const bankAccountNumberSchema = z.string().trim().regex(ACCOUNT_NUMBER).brand<'BankAccountNumber'>();

/** How a payout account is paid: a UPI address, or a bank account by number and IFSC (#19). */
export const PAYOUT_KINDS = ['upi', 'bank'] as const;
export type PayoutKind = (typeof PAYOUT_KINDS)[number];

const requiredFor = (kind: PayoutKind, field: 'vpa' | 'accountNumber' | 'ifsc' | 'holderName') => ({ kind, field });
const REQUIRED = [requiredFor('upi', 'vpa'), requiredFor('bank', 'accountNumber'), requiredFor('bank', 'ifsc'), requiredFor('bank', 'holderName')];
const CHECKS = { vpa: upiVpaSchema, accountNumber: bankAccountNumberSchema, ifsc: ifscSchema, holderName: z.string().trim().min(2).max(100) };
/** A field as its own schema writes it; as typed when it does not pass (the refinement has said so). */
const normal = (field: keyof typeof CHECKS, value: string): string => CHECKS[field].safeParse(value).data ?? value;

/**
 * A payout account as the member adds it on Balance (#19): the bank's name, and a UPI address, or a
 * bank account number, IFSC and the holder's name. Only the fields of the kind chosen are checked.
 */
export const payoutAccountSchema = z.object({
  kind: z.enum(PAYOUT_KINDS),
  bankName: z.string().trim().min(2).max(60),
  vpa: z.string(),
  accountNumber: z.string(),
  ifsc: z.string(),
  holderName: z.string(),
}).superRefine((account, context) => {
  for (const { kind, field } of REQUIRED) {
    if (account.kind === kind && !CHECKS[field].safeParse(account[field]).success) context.addIssue({ code: 'custom', path: [field], message: field });
  }
}).transform((account) => ({
  ...account,
  // Written as banks write them: a UPI address in lower case, an IFSC in capitals, no spaces around.
  vpa: account.kind === 'upi' ? normal('vpa', account.vpa) : '',
  accountNumber: account.kind === 'bank' ? normal('accountNumber', account.accountNumber) : '',
  ifsc: account.kind === 'bank' ? normal('ifsc', account.ifsc) : '',
  holderName: account.kind === 'bank' ? normal('holderName', account.holderName) : '',
}));
/** A payout account as the member types it. */
export type PayoutAccountInput = z.infer<typeof payoutAccountSchema>;
/** Why the cage turns something down, a payout account (#19) or a withdrawal (#21): 3 to 200 characters, shown to the member. */
export const reasonForMemberSchema = z.object({ reason: z.string().trim().min(3).max(200) });

/** A withdrawal as the member asks for it on Balance (#21): whole rupees, to one of their verified payout accounts. */
export const withdrawalSchema = z.object({ amount: z.string().trim().regex(/^[1-9]\d{0,7}$/), payoutAccountId: z.string().min(1) });

/** The bank's UTR the cage enters when it sends a withdrawal. */
export const sendWithdrawalSchema = z.object({ utr: utrSchema });
