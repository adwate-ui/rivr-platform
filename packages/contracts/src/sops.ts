import { z } from 'zod';
import { STAFF_ROLES } from './roles.ts';

/**
 * A new version of an SOP as the console publishes it (#51): its owner by job title, the roles whose
 * staff must acknowledge it, the IST day it takes effect, and its text. The database refuses a day
 * before today or before the last version's.
 */
export const sopVersionSchema = z.object({
  owner: z.string().trim().min(1).max(80),
  ackRoles: z.array(z.enum(STAFF_ROLES)),
  effectiveOn: z.iso.date(),
  body: z.string().trim().min(1).max(20000),
});

/** A new SOP: its title and its first version. */
export const sopSchema = sopVersionSchema.extend({ title: z.string().trim().min(1).max(120) });
