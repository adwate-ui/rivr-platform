import { z } from 'zod';
import { indianMobileSchema } from './identity.ts';

/** The kill switch's levels (features "Kill switch"), the most severe first. */
export const CONTROL_LEVELS = ['venue_freeze', 'feature_kill', 'messaging_stop', 'member_freeze', 'access_revoke'] as const;

/** The features the kill switch can switch off. */
export const KILLABLE_FEATURES = [
  'withdrawals', 'credit', 'kyc_signup', 'marketing_sends', 'social_publishing', 'promotions', 'tournament_registration',
] as const;

/**
 * The console's engage form (#27): a level, chosen on purpose (none is preselected), its target (a
 * feature, or a member or staff member's mobile number, given as +91), and a reason of 3 to 500 characters.
 */
export const engageControlSchema = z
  .object({
    level: z.enum(CONTROL_LEVELS).nullable(),
    feature: z.enum(KILLABLE_FEATURES).nullable(),
    phone: z.string(),
    reason: z.string().trim().min(3).max(500),
  })
  .superRefine((form, context) => {
    if (form.level === null) context.addIssue({ code: 'custom', path: ['level'], message: 'level' });
    if (form.level === 'feature_kill' && form.feature === null) context.addIssue({ code: 'custom', path: ['feature'], message: 'feature' });
    const needsPhone = form.level === 'member_freeze' || form.level === 'access_revoke';
    if (needsPhone && !indianMobileSchema.safeParse(form.phone).success) context.addIssue({ code: 'custom', path: ['phone'], message: 'phone' });
  });
