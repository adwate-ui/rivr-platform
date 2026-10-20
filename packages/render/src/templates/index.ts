import { BrandArt, ThermalReceipt } from '@rivr/ui';
import type { ComponentProps } from 'react';
import { BadBeatJackpotSlide } from './BadBeatJackpotSlide.tsx';
import { InvoiceDocument } from './paper/InvoiceDocument.tsx';
import { MembershipCardImage } from './paper/MembershipCardImage.tsx';
import { StatementDocument } from './paper/StatementDocument.tsx';
import { HighHandCard } from './social/HighHandCard.tsx';
import { PromoCard } from './social/PromoCard.tsx';
import { TournamentPoster } from './social/TournamentPoster.tsx';
import { WinnerCard } from './social/WinnerCard.tsx';
import { PromotionSlide } from './tv/PromotionSlide.tsx';
import { TournamentClockSlide } from './tv/TournamentClockSlide.tsx';
import { WaitlistSlide } from './tv/WaitlistSlide.tsx';

/**
 * Every template @rivr/render can draw, by name. A template composes @rivr/ui components and
 * defines no styles of its own.
 */
export const templates = {
  // The TV's layouts (#64), as slides.
  'tv.badBeatJackpot': BadBeatJackpotSlide,
  'tv.waitlist': WaitlistSlide,
  'tv.tournamentClock': TournamentClockSlide,
  'tv.promotion': PromotionSlide,
  'social.tournamentPoster': TournamentPoster,
  'social.promoCard': PromoCard,
  'social.winnerCard': WinnerCard,
  'social.highHandCard': HighHandCard,
  // Icons, splash screens, profile images and covers: the brand kit (src/brandKit.ts).
  'brand.art': BrandArt,
  // The membership card, the thermal receipt, and A4 invoices and statements.
  'card.membership': MembershipCardImage,
  'receipt.thermal': ThermalReceipt,
  'document.invoice': InvoiceDocument,
  'document.statement': StatementDocument,
};

export type TemplateName = keyof typeof templates;

/** The props a template takes. */
export type TemplateProps<Name extends TemplateName> = ComponentProps<(typeof templates)[Name]>;

/** True for a name in the registry. */
export function isTemplateName(name: string): name is TemplateName {
  return name in templates;
}
