import type { HandVariant, LogHandFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';

const VARIANT_COPY: Readonly<Record<HandVariant, MessageKey>> = {
  holdem: 'tablet.handEntry.holdem',
  plo: 'tablet.handEntry.plo',
  bomb_pot: 'tablet.handEntry.bombPot',
};

const FAILURE_COPY: Readonly<Record<LogHandFailure, MessageKey>> = {
  no_dealer: 'tablet.handEntry.noDealer',
  paused: 'tablet.handEntry.paused',
  invalid: 'tablet.handEntry.invalid',
  unavailable: 'tablet.handEntry.unavailable',
};

/** A hand's game as the tablet names it: Hold'em, PLO or Bomb pot. */
export function variantText(variant: HandVariant): string {
  return t(VARIANT_COPY[variant]);
}

/** The games the dealer picks from: Hold'em at every table, PLO and bomb pots where the table plays variations. */
export function variantOptions(hasVariation: boolean): { value: HandVariant; label: string }[] {
  const variants: HandVariant[] = hasVariation ? ['holdem', 'plo', 'bomb_pot'] : ['holdem'];
  return variants.map((variant) => ({ value: variant, label: variantText(variant) }));
}

/** What the tablet says when a hand was not logged, and what to do. */
export function logFailureText(failure: LogHandFailure): string {
  return t(FAILURE_COPY[failure]);
}
