import { err, ok, type Result } from '@rivr/contracts/result';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { GAMES_PLAYED, OCCUPATIONS, PLAY_TIMES, type GamePlayed, type Occupation, type PlayTime } from './signUp.ts';
import { LIST_MOST } from './limits.ts';

/** The link a member arrived by, as its campaign codes named it; each null when the link had none. */
export interface SignUpCampaign {
  readonly source: string | null;
  readonly medium: string | null;
  readonly campaign: string | null;
  readonly content: string | null;
  readonly term: string | null;
}

/** What a member told the club when they signed up (owner, 8 Nov), as staff read it on their record. */
export interface MemberSignUp {
  readonly signedUpAt: string;
  /** Their answers (#631, #653); null or empty for a member staff registered, who never answered. */
  readonly city: string | null;
  readonly occupation: Occupation | null;
  readonly playTimes: readonly PlayTime[];
  readonly gamesPlayed: readonly GamePlayed[];
  /** How they came: a member's referral code, a creator's code, the campaign, and when the club first saw them. */
  readonly referralCode: string | null;
  readonly creatorCode: string | null;
  readonly campaign: SignUpCampaign;
  readonly firstSeenAt: string | null;
  /** Who referred them: the paid referral's referrer, else the member whose code they hold; null for none (the owner, 25 Nov). */
  readonly referrer: Referrer | null;
  /** When the referral was paid on both sides; null until then. */
  readonly referralCompletedAt: string | null;
  /** Whether they have sat at a table, so a referrer set now is paid at once rather than at their first seat. */
  readonly hasSat: boolean;
}

/** The member who referred another. */
export interface Referrer {
  readonly memberId: string;
  readonly fullName: string;
  readonly memberNumber: number;
}

/** The codes of a list that are among `known`, in its order; any other is dropped. */
function known<T extends string>(known: readonly T[], codes: readonly string[]): T[] {
  return known.filter((code) => codes.includes(code));
}

/**
 * A member's sign-up on their record (owner, 8 Nov): the day they joined, their answers and how they came, for staff who
 * read members. Null when they are not a member of this venue.
 */
export function useMemberSignUp(venueId: string, memberId: string) {
  const { client, userId } = useRivrData();
  return useQuery({
    queryKey: queryKeys.memberSignUp(userId ?? 'signed-out', venueId, memberId),
    enabled: userId !== null,
    queryFn: async (): Promise<MemberSignUp | null> => {
      const { data, error } = await client.rpc('member_sign_up', { p_venue_id: venueId, p_member_id: memberId }).limit(LIST_MOST);
      if (error) throw error;
      const row = data[0];
      if (row === undefined) return null;
      return {
        signedUpAt: row.signed_up_at, city: row.city, occupation: OCCUPATIONS.find((code) => code === row.occupation) ?? null,
        playTimes: known(PLAY_TIMES, row.play_times), gamesPlayed: known(GAMES_PLAYED, row.games_played),
        referralCode: row.referral_code, creatorCode: row.creator_code,
        campaign: { source: row.utm_source, medium: row.utm_medium, campaign: row.utm_campaign, content: row.utm_content, term: row.utm_term },
        firstSeenAt: row.first_seen_at,
        referrer: row.referrer_member_id === null ? null : { memberId: row.referrer_member_id, fullName: row.referrer_name, memberNumber: row.referrer_number },
        referralCompletedAt: row.referral_completed_at, hasSat: row.has_sat,
      };
    },
  });
}

/** What setting a referrer did: paid on both sides now, or to be paid at the member's first seat. */
export type ReferrerOutcome = 'paid' | 'at_first_seat';

/**
 * Why a referrer was not set: not the floor and up, a staff member's own, already paid to another, the practice venue, no
 * such member, the member themselves, a referrer whose tier has no referrals or who is self-excluded, paused, too many at once, or
 * anything else.
 */
export type ReferrerFailure = 'not_allowed' | 'own_record' | 'locked' | 'practice' | 'no_member' | 'themselves' | 'no_referrals'
  | 'self_excluded' | 'paused' | 'busy' | 'unavailable';

const REFERRER_FAILURE_BY_CODE: Readonly<Record<string, ReferrerFailure>> = {
  '42501': 'not_allowed', RVOWN: 'own_record', RVRFL: 'locked', RVRFP: 'practice', RVNOM: 'no_member', RVRFS: 'themselves',
  RVRFT: 'no_referrals', RVRFX: 'self_excluded', RVFRZ: 'paused', RVKIL: 'paused', RVMBR: 'paused', RVRAT: 'busy',
};

/**
 * The floor and up (members.referrer) set the member who referred a member (the owner, 25 Nov; #1133), paid as a code typed
 * at sign-up: now, on both sides, for a member who has sat; else at their first seat. Their sign-up is read again either way.
 */
export function useSetReferrer(venueId: string, memberId: string) {
  const { client, userId } = useRivrData();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (referrerId: string): Promise<Result<ReferrerOutcome, ReferrerFailure>> => {
      const { data, error } = await client.rpc('set_member_referrer', { p_member_id: memberId, p_referrer_id: referrerId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.memberSignUp(userId ?? 'signed-out', venueId, memberId) });
      if (error) return err(REFERRER_FAILURE_BY_CODE[error.code] ?? 'unavailable');
      return ok(data === 'paid' ? 'paid' : 'at_first_seat');
    },
  });
}
