import { z } from 'zod';
import { indianMobileSchema } from './identity.ts';

/** A one-time sign-in code: six digits, as Auth generates and a person types it. */
export const signInCodeSchema = z.string().regex(/^\d{6}$/);

/**
 * What Supabase Auth posts to the Send SMS hook (`supabase/functions/auth-send-code`), parsed to
 * the number to send to in E.164 form and the code. Everything else is ignored.
 *
 * The number comes from `sms.phone`, the number Auth is checking, never `user.phone`: during a
 * phone change `user.phone` is still the old number, and sending the new number's code there would
 * let someone confirm a number they do not hold.
 *
 * A device's own login (#41, `app_metadata.device_id`) gets no code at all: it signs in only by its
 * password, and a code would let someone move its number onto their own phone.
 *
 * Nor does anything but a sign-in: a code goes only to the login's own number (`user.phone`). A phone change through
 * PUT /user asks for a code to a new number, and a login with no number yet has none of its own, so neither gets one.
 * Members never change their own number; a super admin does, in the console (#502, decision 0248). At a first
 * sign-up Auth makes the login with the number before it asks, so a new member is sent their code.
 */
/** The issue a phone change's payload carries: the hook refuses it with its own message. */
export const PHONE_CHANGE = 'A phone number is changed at the club, not by a code';

const digitsOf = (phone: string) => phone.replace(/^\+/, '');

/** A code for any number but the login's own: a phone change, or a login with no number of its own. */
function isPhoneChange(user: { phone?: string | undefined } | undefined, to: string): boolean {
  const own = user?.phone ?? '';
  return own === '' || digitsOf(own) !== digitsOf(to);
}

export const sendSmsHookSchema = z
  .object({
    sms: z.object({ otp: signInCodeSchema, phone: z.string() }),
    user: z
      .object({
        phone: z.string().optional(),
        app_metadata: z.object({ device_id: z.string().optional() }).optional(),
      })
      .optional(),
  })
  .transform(({ sms, user }, context) => {
    if (user?.app_metadata?.device_id !== undefined) {
      context.addIssue({ code: 'custom', message: 'A device signs in by its password, never by a code', path: ['user'] });
      return z.NEVER;
    }
    if (isPhoneChange(user, sms.phone)) {
      context.addIssue({ code: 'custom', message: PHONE_CHANGE, path: ['user', 'phone'] });
      return z.NEVER;
    }
    // Auth sends the number without the plus; dropping a plus first means either form parses.
    const to = indianMobileSchema.safeParse(`+${digitsOf(sms.phone)}`);
    if (!to.success) {
      context.addIssue({ code: 'custom', message: 'The number is not an Indian mobile', path: ['sms', 'phone'] });
      return z.NEVER;
    }
    return { to: to.data, code: sms.otp };
  });

/** The sign-in code to send, parsed from the Send SMS hook's payload. */
export type SignInCodeToSend = z.infer<typeof sendSmsHookSchema>;
