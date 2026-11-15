import { z } from 'zod';

// name@handle: letters, digits, dots, hyphens and underscores before the @, a bank or app handle after it.
const UPI_VPA = /^[a-z0-9][a-z0-9._-]{1,255}@[a-z][a-z0-9]{1,63}$/;

/** A UPI address in lower case, `arjun.mehta@hdfcbank`. */
export const upiVpaSchema = z.string().trim().toLowerCase().regex(UPI_VPA).brand<'UpiVpa'>();
/** A UPI address. */
export type UpiVpa = z.infer<typeof upiVpaSchema>;

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER = /^\d{9,18}$/;

/** A bank branch's IFSC in capitals: four letters, a zero, six letters or digits, `HDFC0001234`. */
export const ifscSchema = z.string().trim().toUpperCase().regex(IFSC).brand<'Ifsc'>();
/** An IFSC. */
export type Ifsc = z.infer<typeof ifscSchema>;

/** A bank account number: 9 to 18 digits. */
export const bankAccountNumberSchema = z.string().trim().regex(ACCOUNT_NUMBER).brand<'BankAccountNumber'>();
