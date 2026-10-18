import { err, ok, type IndianMobile, type Result } from '@rivr/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toSignInFailure, type SignInFailure } from './parse/signInFailure.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

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
  const queryClient = useQueryClient();

  const requestCode = useMutation({
    mutationFn: async ({ phone }: { phone: IndianMobile }): Promise<SignInResult> => {
      const { error } = await client.auth.signInWithOtp({ phone });
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
        // Only on this device: the same person's console or tablet sessions stay signed in.
        await client.auth.signOut({ scope: 'local' });
        return err('unavailable');
      }
      // Auth reports the sign-in before the records are linked, so open screens may already have
      // asked, and cached, what a nobody may see. Ask again now that the person is linked.
      await queryClient.invalidateQueries({ queryKey: queryKeys.personal });
      return ok(null);
    },
  });

  return { requestCode, verifyCode };
}
