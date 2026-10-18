import { I18nProvider, type Locale } from '@rivr/i18n';
import { render, type RenderResult } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';

/** Renders `element` in a language, English unless told otherwise. */
export function renderIn(element: ReactElement, locale: Locale = 'en'): RenderResult {
  return render(<I18nProvider locale={locale}>{element}</I18nProvider>);
}

/**
 * The accessibility violations axe finds inside `container`, as `rule: help` lines.
 * jsdom has no layout, so colour contrast is left to the Storybook accessibility panel,
 * and a lone component is not expected to sit inside a page landmark.
 */
export async function axeViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}
