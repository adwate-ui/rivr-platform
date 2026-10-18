import type { ComponentProps } from 'react';
import { BadBeatJackpotSlide } from './BadBeatJackpotSlide.tsx';

/**
 * Every template @rivr/render can draw, by name. A template composes @rivr/ui components and
 * defines no styles of its own.
 */
export const templates = {
  'tv.badBeatJackpot': BadBeatJackpotSlide,
};

export type TemplateName = keyof typeof templates;

/** The props a template takes. */
export type TemplateProps<Name extends TemplateName> = ComponentProps<(typeof templates)[Name]>;

/** True for a name in the registry. */
export function isTemplateName(name: string): name is TemplateName {
  return name in templates;
}
