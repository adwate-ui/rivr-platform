import { z } from 'zod';
import { indianMobileSchema } from './identity.ts';

/**
 * What Supabase Auth posts to the Send SMS hook (`supabase/functions/auth-send-code`): the user,
 * whose phone Auth stores without the plus sign, and the six-digit code it generated. Parsed to the
 * number in E.164 form, the code, and the language the sign-up asked for (`options.data.language`),
 * English unless it was Hindi. Everything else in the payload is ignored.
 */
export const sendSmsHookSchema = z
  .object({
    user: z.object({
      phone: z.string(),
      user_metadata: z.object({ language: z.unknown() }).partial().optional(),
    }),
    sms: z.object({ otp: z.string().regex(/^\d{6}$/) }),
  })
  .transform(({ user, sms }, context) => {
    const to = indianMobileSchema.safeParse(`+${user.phone.replace(/^\+/, '')}`);
    if (!to.success) {
      context.addIssue({ code: 'custom', message: 'The phone is not an Indian mobile', path: ['user', 'phone'] });
      return z.NEVER;
    }
    const language: 'en' | 'hi' = user.user_metadata?.language === 'hi' ? 'hi' : 'en';
    return { to: to.data, code: sms.otp, language };
  });

/** A sign-in code to send, from the Send SMS hook. */
export type SendSmsHook = z.infer<typeof sendSmsHookSchema>;
