import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { forgetAttribution, storedAttribution } from './attribution.ts';
import type { RivrClient } from './client.ts';
import { toBase64 } from './kyc.ts';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';

/** Why a sign-up did not go through, as the screen tells it: the name, an answer, the photo, staff, paused, or anything else. */
export type SignUpFailure = 'invalid_name' | 'invalid_answers' | 'photo_failed' | 'staff' | 'stopped' | 'unavailable';

/** What best describes the member (#631), one of these. */
export const OCCUPATIONS = [
  'salaried', 'business_owner', 'independent_professional', 'student', 'homemaker', 'retired', 'prefer_not_to_say',
] as const;
export type Occupation = (typeof OCCUPATIONS)[number];

/** When the member usually plays (#631), any of these. */
export const PLAY_TIMES = ['weekday_afternoons', 'weekday_evenings', 'late_night', 'weekends'] as const;
export type PlayTime = (typeof PLAY_TIMES)[number];

/** Everything sign-up takes (#631): the name as on Aadhaar, the answers, and an optional photo. */
export interface SignUpDetails {
  readonly fullName: string;
  readonly city: string;
  readonly occupation: Occupation;
  readonly playTimes: readonly PlayTime[];
  /** A JPEG, as `shrinkPhoto` makes it. */
  readonly photo: Blob | null;
}

function failureOf(code: string | undefined): SignUpFailure {
  if (code === '22023') return 'invalid_name';
  if (code === 'RVSTF') return 'staff';
  if (code === 'RVKIL' || code === 'RVFRZ' || code === 'RVMBR') return 'stopped';
  return 'unavailable';
}

/**
 * The photo beside the member's identity images, through the kyc Edge Function as the selfie goes: added once, and one
 * there already, from a try that failed after it, is kept.
 */
async function sendPhoto(client: RivrClient, photo: Blob): Promise<boolean> {
  const { error } = await client.functions.invoke('kyc', { body: { action: 'photo', image: await toBase64(photo) } });
  return error === null;
}

/** Becomes a member, saves the answers, then sends the photo; each step may run again after a failure. */
async function signUpWith(client: RivrClient, details: SignUpDetails): Promise<Result<null, SignUpFailure>> {
  const joined = await client.rpc('sign_up', { p_full_name: details.fullName, p_attribution: storedAttribution() ?? {} });
  if (joined.error) return err(failureOf(joined.error.code));
  const answered = await client.rpc('set_my_sign_up_answers', { p_city: details.city, p_occupation: details.occupation, p_play_times: [...details.playTimes] });
  if (answered.error) return err(answered.error.code === '22023' ? 'invalid_answers' : failureOf(answered.error.code));
  if (details.photo !== null && !(await sendPhoto(client, details.photo))) return err('photo_failed');
  return ok(null);
}

/**
 * Joins the signed-in number to the club (`public.sign_up`): a number staff registered links to its
 * member; a new one becomes a member with the name given, as on the player's Aadhaar, and the codes
 * of the link they arrived by (`rememberAttribution`), which are then forgotten. Then the sign-up answers and the
 * optional photo (#631). Resolves to a Result and reloads the member.
 */
export function useSignUp() {
  const { client } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (details: SignUpDetails): Promise<Result<null, SignUpFailure>> => {
      const done = await signUpWith(client, details);
      if (!done.ok) return done;
      forgetAttribution();
      // Everything cached for the person: the frame already read their features as a non-member.
      await queryClient.invalidateQueries({ queryKey: queryKeys.personal });
      return ok(null);
    },
  });
}

/** The mobile number the person signed in with, as `+91…`; null before it is known. */
export function useSignedInPhone() {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.signedInPhone(userId ?? 'signed-out'),
    enabled: userId !== null,
    queryFn: async (): Promise<string | null> => {
      const { data } = await client.auth.getSession();
      const phone = data.session?.user.phone ?? '';
      return phone === '' ? null : `+${phone.replace(/^\+/, '')}`;
    },
  });
}
