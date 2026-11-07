import { z } from 'zod';
import { indianMobileSchema } from './identity.ts';

/** The door's check-in by mobile number (#72). */
export const doorCheckInSchema = z.object({ phone: indianMobileSchema });

/** The door's check-in by membership card (#71): what the scanner read from the card's QR. */
export const doorCardSchema = z.object({ code: z.string().trim().min(1).max(200) });

// Ten digits, or +91 and ten, are a mobile number; one to nine digits a membership number.
const mobileOrMemberNumberSchema = z.union([
  indianMobileSchema.transform((phone) => ({ phone })),
  z.string().trim().regex(/^\d{1,9}$/).transform((digits) => ({ memberNumber: Number(digits) })),
]);

/** The floor seats a player by mobile number or membership number (#77; decision 0299). */
export const seatPlayerSchema = z.object({ number: mobileOrMemberNumberSchema });

/** Who the floor seats: by mobile number or by membership number. */
export type SeatWho = z.output<typeof seatPlayerSchema>['number'];

/**
 * Bonus chips the member redeems with their buy-in as the floor seats them (decision 0504), as typed: none (blank or 0),
 * or whole 50s, the smallest chip. Whether the member has that many is the database's check.
 */
export const bonusChipsToRedeemSchema = z.string().trim().regex(/^\d{0,8}$/)
  .transform((digits) => (digits === '' ? 0 : Number(digits)))
  .refine((chips) => chips % 50 === 0);

/** The floor adds a member to a table's waitlist the same way, by mobile number or membership number (#38; console v3). */
export const floorWaitlistAddSchema = z.object({ number: mobileOrMemberNumberSchema });
