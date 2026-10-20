import type { HandVariant, TabletHighHand } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';

const VARIANT_COPY: Readonly<Record<HandVariant, MessageKey>> = {
  holdem: 'tablet.handEntry.holdem',
  plo: 'tablet.handEntry.plo',
  bomb_pot: 'tablet.handEntry.bombPot',
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

const CLAIM_STATUS_COPY: Readonly<Record<TabletHighHand['status'], MessageKey>> = {
  claimed: 'tablet.highHand.waiting',
  approved: 'tablet.highHand.approved',
  rejected: 'tablet.highHand.rejected',
  reversed: 'tablet.highHand.reversed',
};

/** A hand's high-hand claim as its row shows it: waiting for the floor, approved or not. */
export function claimStatusText(status: TabletHighHand['status']): string {
  return t(CLAIM_STATUS_COPY[status]);
}
