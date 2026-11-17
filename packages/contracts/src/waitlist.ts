import { z } from 'zod';
import { indianMobileSchema } from './identity.ts';

/** The door's check-in by mobile number (#72). */
export const doorCheckInSchema = z.object({ phone: indianMobileSchema });

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

/**
 * Why a player left the table (#1060, the owner, 17 Nov), asked on every leave from the floor and the dealer tablet,
 * "Call time met" first; the database keeps the same list (seat_session.leave_reason).
 */
export const LEAVE_REASONS = ['call_time_met', 'busted', 'emergency', 'unwell', 'table_broke', 'floor_decision'] as const;
export type LeaveReason = (typeof LEAVE_REASONS)[number];

/** Whether a value read back is one of the reasons. */
export function isLeaveReason(value: unknown): value is LeaveReason {
  return LEAVE_REASONS.some((reason) => reason === value);
}
