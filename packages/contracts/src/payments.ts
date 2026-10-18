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
