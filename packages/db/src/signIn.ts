import { err, ok, type IndianMobile, type Result } from '@rivr/contracts';
import { useMutation } from '@tanstack/react-query';
import { toSignInFailure, type SignInFailure } from './parse/signInFailure.ts';
import { useRivrData } from './provider.tsx';

/** A sign-in step's outcome: done, or why not. */
export type SignInResult = Result<null, SignInFailure>;

/**
 * Sign-in by mobile number and one-time code, for every app. `requestCode` asks Auth to send a
 * code (Auth's Send SMS hook delivers it, decision 0025); `verifyCode` checks it, then links the
 * staff and member records registered under the number (`link_my_login`). Both resolve to a
 * Result; their `isPending` drives the screen's loading state.
 */
export function useSignIn() {
  const { client } = useRivrData();

  const requestCode = useMutation({
    mutationFn: async ({ phone, language }: { phone: IndianMobile; language: 'en' | 'hi' }): Promise<SignInResult> => {
      // `language` picks the WhatsApp template; Auth keeps it on a new user's metadata.
      const { error } = await client.auth.signInWithOtp({ phone, options: { data: { language } } });
      return error ? err(toSignInFailure(error)) : ok(null);
    },
  });

  const verifyCode = useMutation({
    mutationFn: async ({ phone, code }: { phone: IndianMobile; code: string }): Promise<SignInResult> => {
      const { error } = await client.auth.verifyOtp({ phone, token: code, type: 'sms' });
      if (error) return err(toSignInFailure(error));
      const linked = await client.rpc('link_my_login');
      if (linked.error) {
        // Signed in but not linked would show the person as nobody: undo it and let them try again.
        await client.auth.signOut();
        return err('unavailable');
      }
      return ok(null);
    },
  });

  return { requestCode, verifyCode };
}
