import type { PromotionTerms } from '@rivr/contracts/promotionModel';

/** The parts of a version that decide what it gives: the reward, who, when and how often. Words and channels do not. */
export type Terms = Pick<PromotionTerms, 'reward' | 'eligibility' | 'schedule' | 'limits'>;

/** A value as text with every object's keys in order, so two equal terms read the same however they were built. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value !== 'object' || value === null) return JSON.stringify(value) ?? 'null';
  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([one], [other]) => (one < other ? -1 : 1));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
}

/** Whether two versions give the same thing to the same members at the same times: a simulation of one holds for the other. */
export function sameTerms(one: Terms, other: Terms): boolean {
  const pick = (terms: Terms) => canonical({ reward: terms.reward, eligibility: terms.eligibility, schedule: terms.schedule, limits: terms.limits });
  return pick(one) === pick(other);
}

/** The parts of a version an approver compares, in the order the builder shows them. */
export const TERMS_PARTS = ['name', 'reward', 'eligibility', 'schedule', 'limits', 'channels', 'rulesText', 'link'] as const;
export type TermsPart = (typeof TERMS_PARTS)[number];

/** What a waiting version changes against the live one: the approver's diff. */
export function termsDiff(before: PromotionTerms, after: PromotionTerms): TermsPart[] {
  return TERMS_PARTS.filter((part) => canonical(before[part]) !== canonical(after[part]));
}
