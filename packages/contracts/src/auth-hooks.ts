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
 */
export const sendSmsHookSchema = z
  .object({
    sms: z.object({ otp: signInCodeSchema, phone: z.string() }),
  })
  .transform(({ sms }, context) => {
    // Auth sends the number without the plus; dropping a plus first means either form parses.
    const to = indianMobileSchema.safeParse(`+${sms.phone.replace(/^\+/, '')}`);
    if (!to.success) {
      context.addIssue({ code: 'custom', message: 'The number is not an Indian mobile', path: ['sms', 'phone'] });
      return z.NEVER;
    }
    return { to: to.data, code: sms.otp };
  });

/** The sign-in code to send, parsed from the Send SMS hook's payload. */
export type SignInCodeToSend = z.infer<typeof sendSmsHookSchema>;
