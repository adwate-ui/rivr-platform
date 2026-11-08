import type { Database } from './database.types.ts';
import { GAMES_PLAYED, OCCUPATIONS, PLAY_TIMES, type GamePlayed, type Occupation, type PlayTime } from './signUp.ts';

type ListRow = Database['public']['Functions']['members_of_tier']['Returns'][number];

/**
 * What a Members export adds beside the list (the owner, 9 Nov: "include all the member related fields"): the name given
 * at sign-up, their own referral code, their sign-up answers, how they came, and how their identity was checked; their
 * identity documents only for super admins, null for other staff. Null, or empty, where there is none.
 */
export interface MemberExportDetails {
  readonly knownAs: string | null;
  readonly ownReferralCode: string | null;
  readonly occupation: Occupation | null;
  readonly playTimes: readonly PlayTime[];
  readonly gamesPlayed: readonly GamePlayed[];
  /** The code they joined with, a creator's code, the campaign's codes, and when the club first saw them. */
  readonly referralCode: string | null;
  readonly creatorCode: string | null;
  readonly campaign: { readonly source: string | null; readonly medium: string | null; readonly name: string | null; readonly content: string | null; readonly term: string | null };
  readonly firstSeenAt: string | null;
  /** `digilocker`, `pan` or `manual` (at the desk), and when the check was finished. */
  readonly kycMethod: string | null;
  readonly kycVerifiedAt: string | null;
  readonly dateOfBirth: string | null;
  readonly pan: string | null;
  readonly maskedAadhaar: string | null;
  readonly aadhaarName: string | null;
  readonly address: string | null;
}

/** The codes of a list that are among `known`, in its order; any other is dropped. */
const known = <T extends string>(codes: readonly T[], given: readonly string[] | null) => codes.filter((code) => (given ?? []).includes(code));

/** A list row's export details. */
export function detailsOf(row: ListRow): MemberExportDetails {
  return {
    knownAs: row.known_as, ownReferralCode: row.own_referral_code, occupation: OCCUPATIONS.find((code) => code === row.occupation) ?? null,
    playTimes: known(PLAY_TIMES, row.play_times), gamesPlayed: known(GAMES_PLAYED, row.games_played),
    referralCode: row.referral_code, creatorCode: row.creator_code,
    campaign: { source: row.utm_source, medium: row.utm_medium, name: row.utm_campaign, content: row.utm_content, term: row.utm_term },
    firstSeenAt: row.first_seen_at, kycMethod: row.kyc_method, kycVerifiedAt: row.kyc_verified_at,
    dateOfBirth: row.date_of_birth, pan: row.pan, maskedAadhaar: row.masked_aadhaar, aadhaarName: row.aadhaar_name, address: row.address,
  };
}
