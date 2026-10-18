/**
 * The codes a link to RIVR carries, so a sign-up is credited to the friend, creator or campaign that
 * brought the player (scope-v1, "Growth"; lane D builds the links). The query parameter for each.
 */
export const ATTRIBUTION_PARAMS = [
  ['referral', 'ref'],
  ['creator', 'creator'],
  ['utmSource', 'utm_source'],
  ['utmMedium', 'utm_medium'],
  ['utmCampaign', 'utm_campaign'],
  ['utmContent', 'utm_content'],
  ['utmTerm', 'utm_term'],
] as const;

export type AttributionField = (typeof ATTRIBUTION_PARAMS)[number][0];

/** The codes a link carried; a field is absent when the link had none. */
export type Attribution = Partial<Record<AttributionField, string>>;

// A code is short and plain: letters, digits, spaces and _ . + -, at most 64. The database holds
// the same rule (public.attribution_code).
const CODE = /^[A-Za-z0-9 _.+-]{1,64}$/;

/** The codes in a query string, or null when it carries none. A malformed code is dropped. */
export function attributionFrom(search: string): Attribution | null {
  const params = new URLSearchParams(search);
  const found: Attribution = {};
  for (const [field, param] of ATTRIBUTION_PARAMS) {
    const value = params.get(param)?.trim();
    if (value && CODE.test(value)) found[field] = value;
  }
  return Object.keys(found).length > 0 ? found : null;
}
