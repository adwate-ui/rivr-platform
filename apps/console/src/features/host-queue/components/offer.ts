import { parseRupees } from '@rivr/domain/money';
import { promotionEffectSchema, type PromotionEffect } from '@rivr/contracts';
import { formatRupeesForInput } from '@rivr/i18n';

/** The offers a host makes from the queue, each a promotion effect. */
export const OFFER_KINDS = ['none', 'points', 'bonus', 'spin', 'message'] as const;
export type OfferKind = (typeof OFFER_KINDS)[number];

/** What the host typed, before it is checked as a promotion effect. */
function draftOf(kind: Exclude<OfferKind, 'none'>, typed: string): unknown {
  if (kind === 'spin') return { kind: 'spin' };
  if (kind === 'message') return { kind: 'message', text: typed };
  if (kind === 'points') return { kind: 'points', points: /^\d{1,7}$/.test(typed) ? Number(typed) : -1 };
  const paise = parseRupees(typed);
  return { kind: 'bonus', amount_paise: paise.ok ? Number(paise.value) : -1 };
}

/**
 * The offer as a promotion effect (#165): null for none, undefined when what was typed is not one (no amount, a bonus
 * not in whole chips).
 */
export function offerFrom(kind: OfferKind, value: string): PromotionEffect | null | undefined {
  if (kind === 'none') return null;
  const parsed = promotionEffectSchema.safeParse(draftOf(kind, value.trim()));
  return parsed.success ? parsed.data : undefined;
}

/** An offer as the form shows it: its kind and the amount or words typed. */
interface OfferDraft {
  readonly kind: OfferKind;
  readonly value: string;
}

const NO_OFFER: OfferDraft = { kind: 'none', value: '' };

/** Points or a bonus as the form shows them: the number typed; none for an offer the queue does not make. */
function amountDraft(offer: PromotionEffect): OfferDraft {
  if (offer.kind === 'points' && 'points' in offer) return { kind: 'points', value: String(offer.points) };
  if (offer.kind === 'bonus' && 'amount_paise' in offer) return { kind: 'bonus', value: formatRupeesForInput(BigInt(offer.amount_paise)) };
  return NO_OFFER;
}

/** The offer already made, as the form shows it again, so saving the call keeps it: its kind and amount or words. */
export function offerDraft(offer: PromotionEffect | null): OfferDraft {
  if (offer === null) return NO_OFFER;
  if (offer.kind === 'spin') return { kind: 'spin', value: '' };
  if (offer.kind === 'message') return { kind: 'message', value: offer.text };
  return amountDraft(offer);
}
