import type { ComponentProps } from 'react';
import { BadBeatJackpotSlide } from './BadBeatJackpotSlide.tsx';
import { HighHandCard } from './social/HighHandCard.tsx';
import { PromoCard } from './social/PromoCard.tsx';
import { TournamentPoster } from './social/TournamentPoster.tsx';
import { WinnerCard } from './social/WinnerCard.tsx';

/**
 * Every template @rivr/render can draw, by name. A template composes @rivr/ui components and
 * defines no styles of its own.
 */
export const templates = {
  'tv.badBeatJackpot': BadBeatJackpotSlide,
  'social.tournamentPoster': TournamentPoster,
  'social.promoCard': PromoCard,
  'social.winnerCard': WinnerCard,
  'social.highHandCard': HighHandCard,
};

export type TemplateName = keyof typeof templates;

/** The props a template takes. */
export type TemplateProps<Name extends TemplateName> = ComponentProps<(typeof templates)[Name]>;

/** True for a name in the registry. */
export function isTemplateName(name: string): name is TemplateName {
  return name in templates;
}
