import { z } from 'zod';
import { indianMobileSchema } from './identity.ts';

/** The floor adds a member to a waitlist by their mobile number (#38). */
export const floorWaitlistAddSchema = z.object({ phone: indianMobileSchema });
