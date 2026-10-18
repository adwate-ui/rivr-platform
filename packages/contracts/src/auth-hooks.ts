import { z } from 'zod';
import { indianMobileSchema } from './identity.ts';

/**
 * What Supabase Auth posts to the Send SMS hook (`supabase/functions/auth-send-code`), parsed to
 * the number to send to in E.164 form, the code, and the language the sign-up asked for
 * (`options.data.language`), English unless it was Hindi. Everything else is ignored.
 *
 * The number comes from `sms.phone`, the number Auth is checking, never `user.phone`: during a
 * phone change `user.phone` is still the old number, and sending the new number's code there would
 * let someone confirm a number they do not hold.
 */
export const sendSmsHookSchema = z
  .object({
    user: z.object({ user_metadata: z.object({ language: z.unknown() }).partial().optional() }),
    sms: z.object({ otp: z.string().regex(/^\d{6}$/), phone: z.string() }),
  })
  .transform(({ user, sms }, context) => {
    // Auth sends the number without the plus; dropping a plus first means either form parses.
    const to = indianMobileSchema.safeParse(`+${sms.phone.replace(/^\+/, '')}`);
    if (!to.success) {
      context.addIssue({ code: 'custom', message: 'The number is not an Indian mobile', path: ['sms', 'phone'] });
      return z.NEVER;
    }
    // Anything but Hindi, including nothing at all, is English.
    const language: 'en' | 'hi' = user.user_metadata?.language === 'hi' ? 'hi' : 'en';
    return { to: to.data, code: sms.otp, language };
  });

/** The sign-in code to send, parsed from the Send SMS hook's payload. */
export type SignInCodeToSend = z.infer<typeof sendSmsHookSchema>;
