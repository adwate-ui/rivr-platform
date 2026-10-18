import { render, type RenderResult } from '@testing-library/react';
import axe from 'axe-core';
import type { ReactElement } from 'react';

/** Renders `element` for a test. Kept as the one entry point so a shared wrapper has one home. */
export function renderIn(element: ReactElement): RenderResult {
  return render(element);
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
