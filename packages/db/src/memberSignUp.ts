import { useQuery } from '@tanstack/react-query';
import { useRivrData } from './provider.tsx';
import { queryKeys } from './queryKeys.ts';
import { GAMES_PLAYED, OCCUPATIONS, PLAY_TIMES, type GamePlayed, type Occupation, type PlayTime } from './signUp.ts';

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
      const { data, error } = await client.rpc('member_sign_up', { p_venue_id: venueId, p_member_id: memberId });
      if (error) throw error;
      const row = data[0];
      if (row === undefined) return null;
      return {
        signedUpAt: row.signed_up_at, city: row.city, occupation: OCCUPATIONS.find((code) => code === row.occupation) ?? null,
        playTimes: known(PLAY_TIMES, row.play_times), gamesPlayed: known(GAMES_PLAYED, row.games_played),
        referralCode: row.referral_code, creatorCode: row.creator_code,
        campaign: { source: row.utm_source, medium: row.utm_medium, campaign: row.utm_campaign, content: row.utm_content, term: row.utm_term },
        firstSeenAt: row.first_seen_at,
      };
    },
  });
}
