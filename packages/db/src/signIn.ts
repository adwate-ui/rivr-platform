import type { IndianMobile } from '@rivr/contracts';
import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SESSION_STORAGE_KEY, type RivrClient } from './client.ts';
import { toSignInCheckFailure, toSignInFailure, type SignInFailure } from './parse/signInFailure.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** A sign-in step's outcome: done, or why not. */
export type SignInResult = Result<null, SignInFailure>;

/**
 * The code to give Auth for the one typed (decision 0679). While VerifyNow sends the codes,
 * sign-in-verify checks the typed code with VerifyNow and gives back Auth's own; otherwise (VerifyNow
 * off, or a test number) it says to give Auth the typed code.
 */
async function codeForAuth(client: RivrClient, phone: IndianMobile, code: string): Promise<Result<string, SignInFailure>> {
  const { data, error } = await client.functions.invoke('sign-in-verify', { body: { phone, code } });
  if (error) return err(await toSignInCheckFailure(error));
  const token: unknown = typeof data === 'object' && data !== null ? Reflect.get(data, 'token') : null;
  return ok(typeof token === 'string' ? token : code);
}

/**
 * Sign-in by mobile number and one-time code, for every app. `requestCode` asks Auth to send a
 * code (Auth's Send SMS hook delivers it: by VerifyNow, decision 0679, else WhatsApp, decision 0025);
 * `verifyCode` checks it, then links the staff and member records registered under the number
 * (`link_my_login`). Both resolve to a Result; their `isPending` drives the screen's loading state.
 */
export function useSignIn() {
  const { client } = useRivrData();
  const queryClient = useQueryClient();

  const requestCode = useMutation({
    mutationFn: async ({ phone, captchaToken }: { phone: IndianMobile; captchaToken?: string | undefined }): Promise<SignInResult> => {
      // The CAPTCHA token, where Auth asks for one (#182); without one Auth sends no code.
      const { error } = await client.auth.signInWithOtp({ phone, ...(captchaToken ? { options: { captchaToken } } : {}) });
      // The whole project's hourly code limit is used up: every member is locked out of sign-in. Auth
      // gives the same code for one number asking again within the minute, which says to wait.
      if (error?.code === 'over_sms_send_rate_limit' && !/request this after/i.test(error.message)) {
        // Tell the owner dashboard; the function raises one alert at most every 15 minutes.
        void client.functions.invoke('sign-in-alert').catch(() => undefined);
      }
      return error ? err(toSignInFailure(error)) : ok(null);
    },
  });

  const verifyCode = useMutation({
    mutationFn: async ({ phone, code }: { phone: IndianMobile; code: string }): Promise<SignInResult> => {
      const token = await codeForAuth(client, phone, code);
      if (!token.ok) return token;
      const { error } = await client.auth.verifyOtp({ phone, token: token.value, type: 'sms' });
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

/**
 * Signs out on this device only: the person's other devices stay signed in. Everything cached goes
 * with them, so the next person at a shared computer never sees it.
 */
export function useSignOut() {
  const { client } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    // Sent whether or not the app is online: offline it must still end the session on this phone, never wait for the connection.
    networkMode: 'always',
    mutationFn: async () => {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) {
        // Offline with an expired token, Auth keeps the session it could not refresh. Drop it from
        // the browser, then sign out again, which now finds no session and signs out at once.
        globalThis.localStorage.removeItem(SESSION_STORAGE_KEY);
        await client.auth.signOut({ scope: 'local' });
      }
      queryClient.clear();
    },
  });
}
