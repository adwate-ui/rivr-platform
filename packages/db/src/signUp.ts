import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { forgetAttribution, storedAttribution } from './attribution.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Why a sign-up did not go through, as the screen tells it. */
export type SignUpFailure = 'invalid_name' | 'staff' | 'stopped' | 'unavailable';

function failureOf(code: string | undefined): SignUpFailure {
  if (code === '22023') return 'invalid_name';
  if (code === 'RVSTF') return 'staff';
  if (code === 'RVKIL' || code === 'RVFRZ') return 'stopped';
  return 'unavailable';
}

/**
 * Joins the signed-in number to the club (`public.sign_up`): a number staff registered links to its
 * member; a new one becomes a member with the name given, as on the player's Aadhaar, and the codes
 * of the link they arrived by (`rememberAttribution`), which are then forgotten. Resolves to a
 * Result and reloads the member.
 */
export function useSignUp() {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fullName }: { fullName: string }): Promise<Result<null, SignUpFailure>> => {
      const { error } = await client.rpc('sign_up', { p_full_name: fullName, p_attribution: storedAttribution() ?? {} });
      if (error) return err(failureOf(error.code));
      forgetAttribution();
      // Everything cached for the person: the frame already read their features as a non-member.
      await queryClient.invalidateQueries({ queryKey: queryKeys.personal });
      return ok(null);
    },
  });
}
