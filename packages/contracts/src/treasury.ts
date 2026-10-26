import { z } from 'zod';

// Whole rupees above nothing, as the console types them; the database checks the rest.
const rupees = z.string().trim().regex(/^[1-9]\d{0,7}$/);
const optionalText = (max: number) => z.string().trim().max(max);

/** The cage's repayment form (#92): whole rupees (the database then checks ₹50 chips), by cash or UPI with its 12-digit UTR. */
export const repaymentSchema = z.object({
  memberId: z.string().uuid(),
  amount: rupees,
  method: z.enum(['cash', 'upi']),
  utr: z.string().trim(),
}).refine((form) => form.method === 'cash' || /^\d{12}$/.test(form.utr), { path: ['utr'] });

/** A UPI handle or a bank account to add (#94): its name, and the handle or the bank and last four digits. */
export const paymentAccountSchema = z.object({
  kind: z.enum(['upi', 'bank']),
  name: z.string().trim().min(1).max(60),
  details: optionalText(80),
});

/** Money moved between two payment accounts (#94), in whole rupees. */
export const transferSchema = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  amount: rupees,
  note: optionalText(200),
}).refine((form) => form.fromId !== form.toId, { path: ['toId'] });

/** An expense category to add (#95). */
export const expenseCategorySchema = z.object({ name: z.string().trim().min(1).max(60) });

/** An expense to ask for (#95): its category, the account it is paid from, whole rupees, the payee and a note. */
export const expenseRequestSchema = z.object({
  categoryId: z.string().uuid(),
  accountId: z.string().uuid(),
  amount: rupees,
  payee: z.string().trim().min(1).max(80),
  note: optionalText(300),
});

/** Why an expense is turned down (#95). */
export const expenseRejectionSchema = z.object({ reason: z.string().trim().min(1).max(200) });
