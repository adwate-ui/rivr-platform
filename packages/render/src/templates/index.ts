import { BrandArt, InvoiceDocument } from '@rivr/ui';
import type { ComponentProps } from 'react';
import { StatementDocument } from './paper/StatementDocument.tsx';
import { PromotionSlide } from './tv/PromotionSlide.tsx';
import { WaitlistSlide } from './tv/WaitlistSlide.tsx';

/**
 * Every template @rivr/render can draw, by name. A template composes @rivr/ui components and
 * defines no styles of its own.
 */
export const templates = {
  // The TV's layouts (#64), as slides.
  'tv.waitlist': WaitlistSlide,
  'tv.promotion': PromotionSlide,
  // Icons, splash screens, profile images and covers: the brand kit (src/brandKit.ts).
  'brand.art': BrandArt,
  // A4 invoices and statements.
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
