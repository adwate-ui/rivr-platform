import { z } from 'zod';
import { indianMobileSchema } from './identity.ts';

/** The floor adds a member to a waitlist by their mobile number (#38). */
export const floorWaitlistAddSchema = z.object({ phone: indianMobileSchema });

/** The door's check-in by mobile number (#72). */
export const doorCheckInSchema = z.object({ phone: indianMobileSchema });

/** The door's check-in by membership card (#71): what the scanner read from the card's QR. */
export const doorCardSchema = z.object({ code: z.string().trim().min(1).max(200) });

/** The floor seats a player by mobile number (#77). */
export const seatPlayerSchema = z.object({ phone: indianMobileSchema });
